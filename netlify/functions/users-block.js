import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validateRequiredFields, isValidIntegerId } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';
import { t } from './shared/i18n.js';

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
          error: t('courses.messages.adminAccessRequired'),
          errorCode: 'ADMIN_REQUIRED'
        })
      };
    }

    switch (event.httpMethod) {
      case 'PUT':
        return handleBlockUser(event, user);
      default:
        return errorResponse(t('courses.messages.methodNotAllowed'), 405);
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
      return validationError(t('auth.errors.allFieldsRequired'));
    }

    const { userId, blocked } = body;

    // Validate userId is a valid integer ID
    if (!isValidIntegerId(userId)) {
      return validationError(t('courses.messages.invalidUserIdFormat'));
    }
    
    // Convert userId to integer for database query
    const userIdInt = parseInt(userId, 10);
    
    // Debug logging
    console.log('Block user request:', {
      originalUserId: userId,
      convertedUserId: userIdInt,
      blocked: blocked,
      requestingUser: user.userId
    });

    // Validate blocked is a boolean
    if (typeof blocked !== 'boolean') {
      return validationError(t('courses.messages.blockedFieldMustBeBoolean'));
    }

    // Prevent admin from blocking themselves
    if (userIdInt === user.userId) {
      return validationError(t('courses.messages.cannotBlockYourself'));
    }

    // Check if target user exists
    const userExistsResult = await executeQuery(`
      SELECT id, userid, role, is_blocked as "isBlocked"
      FROM users 
      WHERE id = $1
      LIMIT 1
    `, [userIdInt]);
    
    if (!userExistsResult.success) {
      console.error('Database error checking user existence:', {
        error: userExistsResult.error,
        userId: userIdInt,
        code: userExistsResult.code
      });
      return serverError(t('courses.messages.failedToCheckUser'));
    }
    
    if (userExistsResult.data.length === 0) {
      return notFoundError(t('auth.errors.userNotFound'));
    }

    const targetUser = userExistsResult.data[0];

    // Prevent blocking other admins
    if (targetUser.role === 'admin') {
      return validationError(t('courses.messages.cannotBlockAdmin'));
    }

    // Update user's blocked status
    const updateResult = await executeQuery(`
      UPDATE users 
      SET is_blocked = $1
      WHERE id = $2
      RETURNING id, userid, is_blocked as "isBlocked"
    `, [blocked, userIdInt]);
    
    if (!updateResult.success) {
      console.error('Database error updating user block status:', {
        error: updateResult.error,
        userId: userIdInt,
        blocked: blocked,
        code: updateResult.code
      });
      return serverError(t('courses.messages.failedToUpdateUserStatus'));
    }
    
    if (updateResult.data.length === 0) {
      return notFoundError(t('auth.errors.userNotFound'));
    }
    
    const updatedUser = updateResult.data[0];
    
    return successResponse({
      message: blocked ? t('courses.messages.userBlockedSuccessfully') : t('courses.messages.userUnblockedSuccessfully'),
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
      return validationError(t('auth.errors.invalidInput'));
    }
    
    return serverError(t('courses.messages.failedToUpdateUserStatus'));
  }
}