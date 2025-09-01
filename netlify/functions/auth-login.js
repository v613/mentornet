import { executeQuery } from './shared/database.js';
import { generateToken } from './shared/auth.js';
import { validateRequiredFields, isValidEmail } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';
import { t } from './shared/i18n.js';

/**
 * User authentication endpoint
 * POST /api/auth/login
 * 
 * Body: { userid: string, password: string }
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return errorResponse(t('courses.messages.methodNotAllowed'), 405);
  }
  
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    const validation = validateRequiredFields(body, ['userid', 'password']);
    if (!validation.valid) {
      return validationError(validation.error, validation.missingFields);
    }
    
    const { userid, password } = body;
    
    // Authenticate user with encrypted password
    const authResult = await executeQuery(`
      SELECT 1 
      FROM users 
      WHERE userid = $1 
      AND pwd = crypt($2, pwd)
    `, [userid, password]);
    
    if (!authResult.success) {
      console.error('Database error during authentication:', authResult.error);
      return serverError(t('courses.messages.authenticationFailed'));
    }
    
    if (authResult.data.length === 0) {
      return errorResponse(t('auth.errors.invalidCredentials'), 401, 'INVALID_CREDENTIALS');
    }
    
    // Get user details after successful authentication
    const userResult = await executeQuery(`
      SELECT id, userid, email, role, is_blocked as "isBlocked", display_name as "displayName"
      FROM users 
      WHERE userid = $1 
      LIMIT 1
    `, [userid]);
    
    if (!userResult.success) {
      console.error('Database error fetching user details:', userResult.error);
      return serverError(t('courses.messages.failedToFetchUserDetails'));
    }
    
    if (userResult.data.length === 0) {
      return errorResponse(t('auth.errors.userNotFound'), 404, 'USER_NOT_FOUND');
    }
    
    const user = userResult.data[0];
    
    // Check if user is blocked
    if (user.isBlocked) {
      return errorResponse(t('courses.messages.userAccountBlocked'), 403, 'USER_BLOCKED');
    }
    
    // Generate JWT token
    const token = await generateToken(user);
    
    // Return success response with token and user data
    return successResponse({
      token,
      user: {
        id: user.id,
        userid: user.userid,
        email: user.email,
        role: user.role,
        displayName: user.displayName
      }
    });
    
  } catch (error) {
    console.error('Login function error:', error);
    
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return validationError(t('courses.messages.invalidJsonInRequestBody'));
    }
    
    return serverError(t('courses.messages.authenticationFailed'));
  }
}