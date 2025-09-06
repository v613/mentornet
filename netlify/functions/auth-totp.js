import { executeQuery } from './shared/database.js';
import { generateToken } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';
import { authenticator } from 'otplib';

// Rate limiting: Store recent attempts in memory
const attemptTracker = new Map();

/**
 * TOTP Authentication endpoint
 * POST /api/auth/totp
 * 
 * Body: { userid: string, code: string }
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
      console.error('Database error during TOTP authentication:', userResult.error);
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
    
    const isValid = authenticator.verify({
      token: code,
      secret: user.secret,
      window: 1 // Allow 1 time step tolerance (30 seconds before/after)
    });
    
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
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    console.error('TOTP authentication error:', error);
    return serverError('Authentication failed');
  }
}