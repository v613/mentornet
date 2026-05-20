import { executeQuery } from './shared/database.js';
import { generateToken } from './shared/auth.js';
import { validateRequiredFields, isValidEmail, validatePassword } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';
import { verifySync } from 'otplib';

// Rate limiting: Store recent attempts in memory
const attemptTracker = new Map();

/**
 * Consolidated Authentication endpoint
 * POST /api/auth?action=login - User login with password
 * POST /api/auth?action=register - User registration  
 * POST /api/auth?action=totp - TOTP authentication
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
  
  // Get action from query parameters
  const urlParams = new URLSearchParams(event.queryStringParameters || {});
  const action = urlParams.get('action');
  
  if (!action) {
    return errorResponse('Action parameter required (?action=login|register|totp)', 400);
  }
  
  try {
    switch (action) {
      case 'login':
        return handleLogin(event);
      case 'register':
        return handleRegister(event);
      case 'totp':
        return handleTotpAuth(event);
      default:
        return errorResponse('Invalid action. Must be one of: login, register, totp', 400);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError(`Authentication failed for action: ${action}`);
  }
}

/**
 * Handle user login with password
 * Body: { userid: string, password: string }
 */
async function handleLogin(event) {
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
}

/**
 * Handle user registration
 * Body: { userid: string, email: string, password: string }
 */
async function handleRegister(event) {
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
    return validationError('Password does not meet security requirements', null, 'WEAK_PASSWORD');
  }
  
  // Check if user already exists
  const existingUserResult = await executeQuery(`
    SELECT 1 FROM users WHERE userid = $1 OR email = $2 LIMIT 1
  `, [userid, email]);
  
  if (!existingUserResult.success) {
    return serverError('Registration failed');
  }
  
  if (existingUserResult.data.length > 0) {
    return errorResponse('User already exists with this username or email', 409, 'USER_EXISTS');
  }
  
  // Insert new user with encrypted password
  const newUserResult = await executeQuery(`
    INSERT INTO users (userid, email, pwd, role) 
    VALUES ($1, $2, $3, 'mentee')
    RETURNING id, userid, email, role, display_name as "displayName"
  `, [userid, email, password]);
  
  if (!newUserResult.success) {
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
  
  return successResponse({
    user: {
      id: newUser.id,
      userid: newUser.userid,
      email: newUser.email,
      role: newUser.role,
      displayName: newUser.displayName
    }
  }, 201);
}

/**
 * Handle TOTP authentication
 * Body: { userid: string, code: string }
 */
async function handleTotpAuth(event) {
  const body = JSON.parse(event.body || '{}');
  const validation = validateRequiredFields(body, ['userid', 'code']);
  if (!validation.valid) {
    return validationError(validation.error, validation.missingFields);
  }
  
  const { userid, code } = body;
  const now = Date.now();
  const userAttempts = attemptTracker.get(userid) || [];
  const recentAttempts = userAttempts.filter(time => now - time < 60000);
  
  if (recentAttempts.length >= 5) {
    return errorResponse('Too many login attempts. Please wait a minute.', 429, 'RATE_LIMITED');
  }
  
  const userResult = await executeQuery(`
    SELECT 
      u.id, 
      u.userid, 
      u.role, 
      u.is_blocked as "isBlocked", 
      u.display_name as "displayName",
      t.secret
    FROM users u
    INNER JOIN user_totp t ON u.id = t.id
    WHERE u.userid = $1 AND t.enabled = TRUE
    LIMIT 1
  `, [userid]);
  
  if (!userResult.success) {
    return serverError('Authentication failed');
  }
  
  if (userResult.data.length === 0) {
    recentAttempts.push(now);
    attemptTracker.set(userid, recentAttempts);
    
    return errorResponse('Invalid credentials or TOTP not enabled', 401, 'INVALID_CREDENTIALS');
  }
  
  const user = userResult.data[0];
  
  if (user.isBlocked) {
    return errorResponse('User account is blocked', 403, 'USER_BLOCKED');
  }
  
  recentAttempts.push(now);
  attemptTracker.set(userid, recentAttempts);
  
  const isValid = verifySync({
    token: code,
    secret: user.secret,
    period: 30
  }).valid;
  
  if (!isValid) {
    return errorResponse('Invalid TOTP code', 401, 'INVALID_CODE');
  }
  
  const token = await generateToken(user);
  attemptTracker.delete(userid);
  
  return successResponse({
    token,
    user: {
      id: user.id,
      userid: user.userid,
      role: user.role,
      displayName: user.displayName
    }
  });
}
