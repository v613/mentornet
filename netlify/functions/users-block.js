import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validateRequiredFields, isValidIntegerId } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';

/**
 * User block/unblock endpoint (admin only)
 * PUT /api/users-block - Block or unblock a user (admin only)
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
      case 'PUT':
        return handleBlockUser(event, user);
      default:
        return errorResponse('Method not allowed', 405);
    }
  });
}

/**
 * Block or unblock a user (admin only)
 */
async function handleBlockUser(event, user) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    const validation = validateRequiredFields(body, ['userId', 'blocked']);
    if (!validation.valid) {
      return validationError('All fields are required', validation.missingFields);
    }
    
    const { userId: id, blocked } = body;
    if (typeof blocked !== 'boolean') {
      return validationError('Blocked field must be boolean');
    }

    // Prevent admin from blocking themselves
    if (id === user.id) {
      console.log("id:",id,"user.id:",user.id);
      return validationError('Cannot block yourself');
    }

    // Check if target user exists
    const userExistsResult = await executeQuery(`
      SELECT id, userid, role, is_blocked as "isBlocked"
      FROM users 
      WHERE id = $1
      LIMIT 1
    `, [id]);
    
    if (!userExistsResult.success) {
      console.error('Database error checking user existence:', {
        error: userExistsResult.error,
        userId: id,
        code: userExistsResult.code
      });
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
    `, [blocked, id]);
    
    if (!updateResult.success) {
      console.error('Database error updating user block status:', {
        error: updateResult.error,
        userId: id,
        blocked: blocked,
        code: updateResult.code
      });
      return serverError('Failed to update user status');
    }
    
    if (updateResult.data.length === 0) {
      return notFoundError('User not found');
    }
    
    return successResponse({
      message: blocked ? 'User blocked successfully' : 'User unblocked successfully',
      user: {
        id: updateResult.data[0].id,
        userid: updateResult.data[0].userid,
        isBlocked: updateResult.data[0].isBlocked
      }
    });
    
  } catch (error) {
    console.error('Block user function error:', error);
    
    if (error instanceof SyntaxError) {
      return validationError('Invalid input parameters');
    }
    
    return serverError('Failed to update user status');
  }
}