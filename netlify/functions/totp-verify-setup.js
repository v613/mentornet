import { executeQuery } from './shared/database.js';
import { authenticateUser } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';
import { authenticator } from 'otplib';

// Rate limiting: Store recent attempts in memory (in production, use Redis)
const attemptTracker = new Map();

/**
 * TOTP Verify Setup endpoint
 * POST /api/totp/verify-setup
 * 
 * Headers: { Authorization: Bearer <token> }
 * Body: { code: string }
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
    // Authenticate user from JWT token
    const authResult = await authenticateUser(event);
    if (!authResult.success) {
      return errorResponse(authResult.error, 401);
    }
    
    const userId = authResult.user.id;
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    const validation = validateRequiredFields(body, ['code']);
    if (!validation.valid) {
      return validationError(validation.error, validation.missingFields);
    }
    
    const { code } = body;
    
    // Rate limiting check
    const now = Date.now();
    const userAttempts = attemptTracker.get(userId) || [];
    const recentAttempts = userAttempts.filter(time => now - time < 60000); // Last minute
    
    if (recentAttempts.length >= 5) {
      return errorResponse('Too many verification attempts. Please wait a minute.', 429, 'RATE_LIMITED');
    }
    
    // Get user's TOTP secret
    const totpResult = await executeQuery(`
      SELECT secret, enabled FROM user_totp WHERE id = $1
    `, [userId]);
    
    if (!totpResult.success) {
      console.error('Database error getting TOTP:', totpResult.error);
      return serverError('Failed to verify TOTP');
    }
    
    if (totpResult.data.length === 0) {
      return errorResponse('TOTP not set up for this account', 400, 'TOTP_NOT_SETUP');
    }
    
    const totpRecord = totpResult.data[0];
    
    if (totpRecord.enabled) {
      return errorResponse('TOTP is already enabled for this account', 400, 'TOTP_ALREADY_ENABLED');
    }
    
    // Track this attempt
    recentAttempts.push(now);
    attemptTracker.set(userId, recentAttempts);
    
    // Verify TOTP code
    const isValid = authenticator.verify({
      token: code,
      secret: totpRecord.secret,
      window: 1 // Allow 1 time step tolerance (30 seconds before/after)
    });
    
    if (!isValid) {
      return errorResponse('Invalid verification code', 400, 'INVALID_CODE');
    }
    
    // Enable TOTP and mark setup as completed
    const enableResult = await executeQuery(`
      UPDATE user_totp 
      SET enabled = TRUE, setup_completed_at = NOW()
      WHERE id = $1
    `, [userId]);
    
    if (!enableResult.success) {
      console.error('Database error enabling TOTP:', enableResult.error);
      return serverError('Failed to enable TOTP');
    }
    
    // Clear rate limiting for this user
    attemptTracker.delete(userId);
    
    return successResponse({
      message: 'TOTP setup completed successfully',
      enabled: true
    });
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    console.error('TOTP verify setup error:', error);
    return serverError('TOTP verification failed');
  }
}