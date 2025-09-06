import { executeQuery } from './shared/database.js';
import { authenticateUser } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';

/**
 * TOTP Disable endpoint
 * POST /api/totp/disable
 * 
 * Headers: { Authorization: Bearer <token> }
 * Body: { password: string }
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }
  
  try {
    const authResult = await authenticateUser(event);
    if (!authResult.success) {
      return errorResponse(authResult.error, 401);
    }
    
    const userId = authResult.user.id;
    const body = JSON.parse(event.body || '{}');
    const validation = validateRequiredFields(body, ['password']);
    if (!validation.valid) {
      return validationError(validation.error, validation.missingFields);
    }
    
    const { password } = body;
    const passwordResult = await executeQuery(`SELECT id FROM users WHERE id = $1 AND pwd = crypt($2, pwd) LIMIT 1`, [userId, password]);
    if (!passwordResult.success) {
      console.error('Database error verifying password:', passwordResult.error);
      return serverError('Failed to verify password');
    }
    
    if (passwordResult.data.length === 0) {
      return errorResponse('Invalid password', 401, 'INVALID_PASSWORD');
    }
    
    const totpResult = await executeQuery(`SELECT enabled FROM user_totp WHERE id = $1`, [userId]);
    if (!totpResult.success) {
      console.error('Database error checking TOTP:', totpResult.error);
      return serverError('Failed to check TOTP status');
    }
    
    if (totpResult.data.length === 0 || !totpResult.data[0].enabled) {
      return errorResponse('TOTP is not currently enabled for this account', 400, 'TOTP_NOT_ENABLED');
    }
    
    const disableResult = await executeQuery(`DELETE FROM user_totp WHERE id = $1`, [userId]);
    if (!disableResult.success) {
      console.error('Database error disabling TOTP:', disableResult.error);
      return serverError('Failed to disable TOTP');
    }
    
    return successResponse({
      message: 'TOTP disabled successfully',
      enabled: false
    });
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    console.error('TOTP disable error:', error);
    return serverError('TOTP disable failed');
  }
}