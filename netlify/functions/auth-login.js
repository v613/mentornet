import { executeQuery } from './shared/database.js';
import { generateToken } from './shared/auth.js';
import { validateRequiredFields, isValidEmail } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';

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
    return errorResponse('Method not allowed', 405);
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
    const authResult = await executeQuery(`
      SELECT id, userid, email, role, is_blocked as "isBlocked", display_name as "displayName"
      FROM users 
      WHERE userid = $1 AND pwd = crypt($2, pwd)
      LIMIT 1
    `, [userid, password]);
    
    if (!authResult.success) {
      console.error('Database error during authentication:', authResult.error);
      return serverError('Authentication failed');
    }
    
    if (authResult.data.length === 0) {
      return errorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    const user = authResult.data[0];
    if (user.isBlocked) {
      return errorResponse('User account is blocked', 403, 'USER_BLOCKED');
    }
    
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
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError('Authentication failed');
  }
}