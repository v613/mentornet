import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validateRequiredFields, isValidUUID } from './shared/validation.js';
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
    
    // Validate required fields
    const requiredFields = ['userId', 'blocked'];
    const validation = validateRequiredFields(body, requiredFields);
    if (!validation.valid) {
      return validationError(`Missing required fields: ${validation.missing.join(', ')}`);
    }

    const { userId, blocked } = body;

    // Validate userId is a valid UUID
    if (!isValidUUID(userId)) {
      return validationError('Invalid user ID format');
    }

    // Validate blocked is a boolean
    if (typeof blocked !== 'boolean') {
      return validationError('Blocked field must be a boolean');
    }

    // Prevent admin from blocking themselves
    if (userId === user.userId) {
      return validationError('Cannot block/unblock yourself');
    }

    // Check if target user exists
    const userExistsResult = await executeQuery(`
      SELECT id, userid, role, is_blocked as "isBlocked"
      FROM users 
      WHERE id = $1
      LIMIT 1
    `, [userId]);
    
    if (!userExistsResult.success) {
      console.error('Database error checking user existence:', userExistsResult.error);
      return serverError('Failed to check user');
    }
    
    if (userExistsResult.data.length === 0) {
      return notFoundError('User not found');
    }

    const targetUser = userExistsResult.data[0];

    // Prevent blocking other admins
    if (targetUser.role === 'admin') {
      return validationError('Cannot block/unblock admin users');
    }

    // Update user's blocked status
    const updateResult = await executeQuery(`
      UPDATE users 
      SET is_blocked = $1
      WHERE id = $2
      RETURNING id, userid, is_blocked as "isBlocked"
    `, [blocked, userId]);
    
    if (!updateResult.success) {
      console.error('Database error updating user block status:', updateResult.error);
      return serverError('Failed to update user status');
    }
    
    if (updateResult.data.length === 0) {
      return notFoundError('User not found');
    }
    
    const updatedUser = updateResult.data[0];
    
    return successResponse({
      message: `User ${blocked ? 'blocked' : 'unblocked'} successfully`,
      user: {
        id: updatedUser.id,
        userid: updatedUser.userid,
        isBlocked: updatedUser.isBlocked
      }
    });
    
  } catch (error) {
    console.error('Block user function error:', error);
    
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError('Failed to update user status');
  }
}