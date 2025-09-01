import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { successResponse, errorResponse, corsResponse, serverError } from './shared/response.js';

/**
 * User list endpoint (admin only)
 * GET /api/users-list?page=1&pageSize=20&role=mentee&search=john - Get filtered users (admin only)
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - role: Filter by role (optional: mentee, mentor, admin)
 * - search: Search in userid, email, displayName (optional)
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Authenticate request and check admin role
  return withAuth(event, async (event, user) => {
    // Check if user is admin
    if (!hasRole(user, ['admin'])) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Admin access required',
          errorCode: 'ADMIN_REQUIRED'
        })
      };
    }

    switch (event.httpMethod) {
      case 'GET':
        return handleGetAllUsers(event, user);
      default:
        return errorResponse('Method not allowed', 405);
    }
  });
}

/**
 * Get all users (admin only)
 */
async function handleGetAllUsers(event, user) {
  try {
    // Parse query parameters for pagination and filtering
    const queryStringParameters = event.queryStringParameters || {};
    const page = parseInt(queryStringParameters.page) || 1;
    const pageSize = Math.min(parseInt(queryStringParameters.pageSize) || 20, 100); // Max 100 users per page
    const offset = (page - 1) * pageSize;
    const roleFilter = queryStringParameters.role; // Optional role filter
    const searchTerm = queryStringParameters.search; // Optional search term
    
    // Build WHERE clause for filtering
    const whereConditions = [];
    const countParams = [];
    const queryParams = [];
    let paramIndex = 1;
    
    if (roleFilter && ['mentee', 'mentor', 'admin'].includes(roleFilter)) {
      whereConditions.push(`role = $${paramIndex}`);
      countParams.push(roleFilter);
      queryParams.push(roleFilter);
      paramIndex++;
    }
    
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereConditions.push(`(LOWER(userid) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex + 1} OR LOWER(display_name) LIKE $${paramIndex + 2})`);
      countParams.push(searchPattern, searchPattern, searchPattern);
      queryParams.push(searchPattern, searchPattern, searchPattern);
      paramIndex += 3;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count with filters
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total
      FROM users
      ${whereClause}
    `, countParams);

    if (!countResult.success) {
      console.error('Database error counting users:', countResult.error);
      return serverError('Failed to fetch users count');
    }

    const totalUsers = parseInt(countResult.data[0].total);
    const totalPages = Math.ceil(totalUsers / pageSize);

    // Get users with pagination and filters
    // Add pagination parameters to query params
    queryParams.push(pageSize, offset);
    const limitOffset = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const usersResult = await executeQuery(`
      SELECT id, userid, email, role, display_name as "displayName", 
             img, description, is_blocked as "isBlocked", 
             created_at as "createdAt"
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      ${limitOffset}
    `, queryParams);
    
    if (!usersResult.success) {
      console.error('Database error fetching users:', usersResult.error);
      return serverError('Failed to fetch users');
    }

    const users = usersResult.data.map(user => ({
      id: user.id,
      userid: user.userid,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      img: user.img,
      description: user.description,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt
    }));

    return successResponse({
      users: users,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalPages: totalPages,
        totalUsers: totalUsers,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      filters: {
        role: roleFilter || null,
        search: searchTerm || null,
        appliedFilters: whereConditions.length
      }
    });
    
  } catch (error) {
    console.error('Get all users function error:', error);
    return serverError('Failed to fetch users');
  }
}