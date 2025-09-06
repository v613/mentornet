import { executeQuery } from './shared/database.js';
import { authenticateUser } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Rate limiting: Store recent attempts in memory
const attemptTracker = new Map();

/**
 * Consolidated TOTP Management endpoint
 * POST /api/totp?action=setup - Setup TOTP (generate QR code)
 * POST /api/totp?action=verify - Verify and enable TOTP
 * DELETE /api/totp or POST /api/totp?action=disable - Disable TOTP
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Authenticate user for all TOTP operations
  const authResult = await authenticateUser(event);
  if (!authResult.success) {
    return errorResponse(authResult.error, 401);
  }
  
  const userId = authResult.user.id;
  const user = authResult.user;
  
  // Route based on HTTP method and action parameter
  const urlParams = new URLSearchParams(event.queryStringParameters || {});
  const action = urlParams.get('action');
  
  try {
    switch (event.httpMethod) {
      case 'POST':
        if (!action) {
          return errorResponse('Action parameter required (?action=setup|verify|disable)', 400);
        }
        
        switch (action) {
          case 'setup':
            return handleTotpSetup(userId, user);
          case 'verify':
            return handleTotpVerify(event, userId);
          case 'disable':
            return handleTotpDisable(event, userId);
          default:
            return errorResponse('Invalid action. Must be one of: setup, verify, disable', 400);
        }
      
      case 'DELETE':
        return handleTotpDisable(event, userId);
      
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError(`TOTP operation failed`);
  }
}

/**
 * Setup TOTP - Generate secret and QR code
 */
async function handleTotpSetup(userId, user) {
  // Check if user already has TOTP setup
  const existingTotpResult = await executeQuery(`
    SELECT enabled FROM user_totp WHERE id = $1
  `, [userId]);
  
  if (!existingTotpResult.success) {
    return serverError('Failed to check TOTP status');
  }
  
  // If TOTP is already enabled, don't allow new setup
  if (existingTotpResult.data.length > 0 && existingTotpResult.data[0].enabled) {
    return errorResponse('TOTP is already enabled for this account', 400, 'TOTP_ALREADY_ENABLED');
  }
  
  // Generate new TOTP secret
  const secret = authenticator.generateSecret();
  
  // Create TOTP URL for QR code
  const totpUrl = authenticator.keyuri(user.userid, 'MentorNet', secret);
  
  // Generate QR code data URL
  const qrCodeDataUrl = await QRCode.toDataURL(totpUrl);
  
  // Store or update TOTP record (not enabled yet)
  const upsertResult = await executeQuery(`
    INSERT INTO user_totp (id, secret, enabled, created_at)
    VALUES ($1, $2, FALSE, NOW())
    ON CONFLICT (id) DO UPDATE SET
      secret = EXCLUDED.secret,
      enabled = FALSE,
      setup_completed_at = NULL,
      created_at = NOW()
  `, [userId, secret]);
  
  if (!upsertResult.success) {
    return serverError('Failed to setup TOTP');
  }
  
  // Return QR code and setup instructions
  return successResponse({
    qrCodeDataUrl,
    secret,
    instructions: 'Scan this QR code with your authenticator app, then verify with a generated code to complete setup.'
  });
}

/**
 * Verify TOTP setup and enable it
 * Body: { code: string }
 */
async function handleTotpVerify(event, userId) {
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
    return serverError('Failed to enable TOTP');
  }
  
  // Clear rate limiting for this user
  attemptTracker.delete(userId);
  
  return successResponse({
    message: 'TOTP setup completed successfully',
    enabled: true
  });
}

/**
 * Disable TOTP
 * Body: { password: string }
 */
async function handleTotpDisable(event, userId) {
  const body = JSON.parse(event.body || '{}');
  const validation = validateRequiredFields(body, ['password']);
  if (!validation.valid) {
    return validationError(validation.error, validation.missingFields);
  }
  
  const { password } = body;
  const passwordResult = await executeQuery(`SELECT id FROM users WHERE id = $1 AND pwd = crypt($2, pwd) LIMIT 1`, [userId, password]);
  if (!passwordResult.success) {
    return serverError('Failed to verify password');
  }
  
  if (passwordResult.data.length === 0) {
    return errorResponse('Invalid password', 401, 'INVALID_PASSWORD');
  }
  
  const totpResult = await executeQuery(`SELECT enabled FROM user_totp WHERE id = $1`, [userId]);
  if (!totpResult.success) {
    return serverError('Failed to check TOTP status');
  }
  
  if (totpResult.data.length === 0 || !totpResult.data[0].enabled) {
    return errorResponse('TOTP is not currently enabled for this account', 400, 'TOTP_NOT_ENABLED');
  }
  
  const disableResult = await executeQuery(`DELETE FROM user_totp WHERE id = $1`, [userId]);
  if (!disableResult.success) {
    return serverError('Failed to disable TOTP');
  }
  
  return successResponse({
    message: 'TOTP disabled successfully',
    enabled: false
  });
}