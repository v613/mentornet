import { executeQuery } from './shared/database.js';
import { withAuth } from './shared/auth.js';
import { validateRequiredFields, validatePassword } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';

/**
 * Change user password endpoint
 * PUT /api/users/change-password
 * 
 * Body: { currentPassword: string, newPassword: string }
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Only allow PUT requests
  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }
  
  // Authenticate request
  return withAuth(event, async (event, user) => {
    try {
      // Parse request body
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
        console.error('Database error verifying current password:', verifyResult.error);
        return serverError('Failed to verify current password');
      }
      
      if (verifyResult.data.length === 0) {
        return errorResponse('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }
      
      // Update password with new encrypted password
      const updateResult = await executeQuery(`
        UPDATE users 
        SET pwd = crypt($2, gen_salt('bf'))
        WHERE id = $1 
        RETURNING id
      `, [user.userId, newPassword]);
      
      if (!updateResult.success) {
        console.error('Database error updating password:', updateResult.error);
        return serverError('Failed to update password');
      }
      
      if (updateResult.data.length === 0) {
        return serverError('Failed to update password');
      }
      
      return successResponse({
        message: 'Password updated successfully'
      });
      
    } catch (error) {
      console.error('Change password function error:', error);
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return validationError('Invalid JSON in request body');
      }
      
      return serverError('Failed to change password');
    }
  });
}