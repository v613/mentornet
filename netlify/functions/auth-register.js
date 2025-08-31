import { executeQuery } from './shared/database.js';
import { validateRequiredFields, isValidEmail, validatePassword } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';

/**
 * User registration endpoint
 * POST /api/auth/register
 * 
 * Body: { userid: string, email: string, password: string }
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
    const validation = validateRequiredFields(body, ['userid', 'email', 'password']);
    if (!validation.valid) {
      return validationError(validation.error, validation.missingFields);
    }
    
    const { userid, email, password } = body;
    
    // Validate email format
    if (!isValidEmail(email)) {
      return validationError('Invalid email format', null, 'INVALID_EMAIL');
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return validationError(passwordValidation.error, null, 'WEAK_PASSWORD');
    }
    
    // Check if user already exists
    const existingUserResult = await executeQuery(`
      SELECT 1 FROM users WHERE userid = $1 OR email = $2 LIMIT 1
    `, [userid, email]);
    
    if (!existingUserResult.success) {
      console.error('Database error checking existing user:', existingUserResult.error);
      return serverError('Registration failed');
    }
    
    if (existingUserResult.data.length > 0) {
      return errorResponse('User already exists with this username or email', 409, 'USER_EXISTS');
    }
    
    // Insert new user with encrypted password
    const newUserResult = await executeQuery(`
      INSERT INTO users (userid, email, pwd, role) 
      VALUES ($1, $2, crypt($3, gen_salt('bf')), 'mentee')
      RETURNING id, userid, email, role, display_name as "displayName"
    `, [userid, email, password]);
    
    if (!newUserResult.success) {
      console.error('Database error creating user:', newUserResult.error);
      
      // Handle unique constraint violations
      if (newUserResult.code === '23505') {
        return errorResponse('User already exists with this username or email', 409, 'USER_EXISTS');
      }
      
      return serverError('Registration failed');
    }
    
    if (newUserResult.data.length === 0) {
      return serverError('Failed to create user');
    }
    
    const newUser = newUserResult.data[0];
    
    // Return success response with user data (no token - user should login)
    return successResponse({
      user: {
        id: newUser.id,
        userid: newUser.userid,
        email: newUser.email,
        role: newUser.role,
        displayName: newUser.displayName
      }
    }, 201);
    
  } catch (error) {
    console.error('Register function error:', error);
    
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError('Registration failed');
  }
}