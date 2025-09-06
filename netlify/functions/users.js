import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validateRequiredFields, isValidUUID, validatePassword } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, permissionError, notFoundError } from './shared/response.js';

/**
 * Consolidated User Management endpoint
 * GET /api/users - Get current user profile
 * PUT /api/users - Update current user profile  
 * GET /api/users?action=list&page=1 - List all users (admin only)
 * PATCH /api/users?action=block&userId=123 - Block/unblock user (admin only)
 * POST /api/users?action=change-password - Change user password
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Authenticate all user operations
  return withAuth(event, async (event, user) => {
    try {
      // Get action from query parameters
      const queryParams = event.queryStringParameters || {};
      const action = queryParams.action;
      
      switch (event.httpMethod) {
        case 'GET':
          if (action === 'list') {
            return handleGetAllUsers(event, user);
          } else {
            return handleGetProfile(event, user);
          }
        case 'PUT':
          return handleUpdateProfile(event, user);
        case 'PATCH':
          if (action === 'block') {
            return handleBlockUser(event, user);
          } else {
            return errorResponse('Invalid action for PATCH method', 400);
          }
        case 'POST':
          if (action === 'change-password') {
            return handleChangePassword(event, user);
          } else {
            return errorResponse('Invalid action for POST method', 400);
          }
        default:
          return errorResponse('Method not allowed', 405);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return validationError('Invalid JSON in request body');
      }
      
      return serverError('User operation failed');
    }
  });
}

/**
 * Get user profile
 * GET /api/users
 */
async function handleGetProfile(event, user) {
  // Get full user profile data including TOTP status
  const profileResult = await executeQuery(`
    SELECT u.id, u.userid, u.email, u.role, u.img, u.description, u.display_name as "displayName", 
           u.is_blocked as "isBlocked", u.created_at as "createdAt",
           COALESCE(t.enabled, false) as "totpEnabled"
    FROM users u
    LEFT JOIN user_totp t ON u.id = t.id
    WHERE u.id = $1 
    LIMIT 1
  `, [user.userId]);
  
  if (!profileResult.success) {
    return serverError('Failed to fetch profile');
  }
  
  if (profileResult.data.length === 0) {
    return notFoundError('User profile not found');
  }
  
  const profile = profileResult.data[0];
  
  return successResponse({
    user: {
      id: profile.id,
      userid: profile.userid,
      email: profile.email,
      role: profile.role,
      img: profile.img,
      description: profile.description,
      displayName: profile.displayName,
      isBlocked: profile.isBlocked,
      createdAt: profile.createdAt,
      totpEnabled: profile.totpEnabled
    }
  });
}

/**
 * Update user profile
 * PUT /api/users
 */
async function handleUpdateProfile(event, user) {
  const body = JSON.parse(event.body || '{}');
  
  // Validate that at least one field is provided for update
  const allowedFields = ['displayName', 'profileImage', 'description'];
  const hasValidField = allowedFields.some(field => 
    body.hasOwnProperty(field) && body[field] !== undefined
  );
  
  if (!hasValidField) {
    return validationError('At least one field must be provided for update');
  }
  
  // Build dynamic update query
  const setParts = [];
  const values = [];
  let valueIndex = 1;
  
  if (body.displayName !== undefined) {
    setParts.push(`display_name = $${valueIndex++}`);
    values.push(body.displayName);
  }
  
  if (body.profileImage !== undefined) {
    setParts.push(`img = $${valueIndex++}`);
    values.push(body.profileImage);
  }
  
  if (body.description !== undefined) {
    setParts.push(`description = $${valueIndex++}`);
    values.push(body.description);
  }
  
  // Add user ID as last parameter
  values.push(user.userId);
  
  const updateResult = await executeQuery(`
    UPDATE users 
    SET ${setParts.join(', ')}
    WHERE id = $${valueIndex}
    RETURNING id, display_name as "displayName", img, description
  `, values);
  
  if (!updateResult.success || updateResult.data.length === 0) {
    return serverError('Failed to update profile');
  }
  
  const updatedUser = updateResult.data[0];
  
  return successResponse({
    user: {
      id: updatedUser.id,
      displayName: updatedUser.displayName,
      img: updatedUser.img,
      description: updatedUser.description
    }
  });
}

/**
 * Get all users (admin only)
 * GET /api/users?action=list&page=1&pageSize=20&role=mentee&search=john
 */
async function handleGetAllUsers(event, user) {
  // Check if user is admin
  if (!hasRole(user, ['admin'])) {
    return errorResponse('Admin access required', 403, 'ADMIN_REQUIRED');
  }
  
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
    return serverError('Failed to fetch users');
  }

  const users = usersResult.data.map(user => ({
    id: user.id,
    userid: user.userid,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    img: user.img ? Buffer.from(user.img).toString('utf8') : user.img,
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
}

/**
 * Block/unblock user (admin only)
 * PATCH /api/users?action=block&userId=123
 * Body: { blocked: boolean }
 */
async function handleBlockUser(event, user) {
  // Check if user is admin
  if (!hasRole(user, ['admin'])) {
    return errorResponse('Admin access required', 403, 'ADMIN_REQUIRED');
  }

  const body = JSON.parse(event.body || '{}');
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId;

  if (!userId) {
    return validationError('userId parameter is required');
  }

  const validation = validateRequiredFields(body, ['blocked']);
  if (!validation.valid) {
    return validationError('blocked field is required', validation.missingFields);
  }
  
  const { blocked } = body;
  if (typeof blocked !== 'boolean') {
    return validationError('Blocked field must be boolean');
  }

  // Prevent admin from blocking themselves
  if (userId === user.userId) {
    return validationError('Cannot block yourself');
  }

  // Check if target user exists
  const userExistsResult = await executeQuery(`
    SELECT id, userid, role, is_blocked as "isBlocked"
    FROM users 
    WHERE id = $1
    LIMIT 1
  `, [userId]);
  
  if (!userExistsResult.success) {
    return serverError('Failed to check user');
  }
  
  if (userExistsResult.data.length === 0) {
    return notFoundError('User not found');
  }

  const targetUser = userExistsResult.data[0];

  // Prevent blocking other admins
  if (targetUser.role === 'admin') {
    return validationError('Cannot block admin');
  }

  // Update user's blocked status
  const updateResult = await executeQuery(`
    UPDATE users 
    SET is_blocked = $1
    WHERE id = $2
    RETURNING id, userid, is_blocked as "isBlocked"
  `, [blocked, userId]);
  
  if (!updateResult.success || updateResult.data.length === 0) {
    return serverError('Failed to update user status');
  }
  
  return successResponse({
    message: blocked ? 'User blocked successfully' : 'User unblocked successfully',
    user: {
      id: updateResult.data[0].id,
      userid: updateResult.data[0].userid,
      isBlocked: updateResult.data[0].isBlocked
    }
  });
}

/**
 * Change user password
 * POST /api/users?action=change-password
 * Body: { currentPassword: string, newPassword: string }
 */
async function handleChangePassword(event, user) {
  const body = JSON.parse(event.body || '{}');
  
  // Validate required fields
  const validation = validateRequiredFields(body, ['currentPassword', 'newPassword']);
  if (!validation.valid) {
    return validationError(validation.error, validation.missingFields);
  }
  
  const { currentPassword, newPassword } = body;
  
  // Validate new password strength
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return validationError(passwordValidation.error, null, 'WEAK_PASSWORD');
  }
  
  // Verify current password
  const verifyResult = await executeQuery(`
    SELECT 1 
    FROM users 
    WHERE id = $1 
    AND pwd = crypt($2, pwd)
  `, [user.userId, currentPassword]);
  
  if (!verifyResult.success) {
    return serverError('Failed to verify current password');
  }
  
  if (verifyResult.data.length === 0) {
    return errorResponse('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Update password with new encrypted password
  const updateResult = await executeQuery(`
    UPDATE users 
    SET pwd = $2
    WHERE id = $1 
    RETURNING id
  `, [user.userId, newPassword]);
  
  if (!updateResult.success || updateResult.data.length === 0) {
    return serverError('Failed to update password');
  }
  
  return successResponse({
    message: 'Password updated successfully'
  });
}