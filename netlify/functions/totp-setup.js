import { executeQuery } from './shared/database.js';
import { authenticateUser } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError } from './shared/response.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

/**
 * TOTP Setup endpoint
 * POST /api/totp/setup
 * 
 * Headers: { Authorization: Bearer <token> }
 * Body: {} (empty, uses JWT for user identification)
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
    
    // Check if user already has TOTP setup
    const existingTotpResult = await executeQuery(`
      SELECT enabled FROM user_totp WHERE id = $1
    `, [userId]);
    
    if (!existingTotpResult.success) {
      console.error('Database error checking existing TOTP:', existingTotpResult.error);
      return serverError('Failed to check TOTP status');
    }
    
    // If TOTP is already enabled, don't allow new setup
    if (existingTotpResult.data.length > 0 && existingTotpResult.data[0].enabled) {
      return errorResponse('TOTP is already enabled for this account', 400, 'TOTP_ALREADY_ENABLED');
    }
    
    // Generate new TOTP secret
    const secret = authenticator.generateSecret();
    const user = authResult.user;
    
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
      console.error('Database error storing TOTP secret:', upsertResult.error);
      return serverError('Failed to setup TOTP');
    }
    
    // Return QR code and setup instructions
    return successResponse({
      qrCodeDataUrl,
      secret,
      instructions: 'Scan this QR code with your authenticator app, then verify with a generated code to complete setup.'
    });
    
  } catch (error) {
    console.error('TOTP setup error:', error);
    return serverError('TOTP setup failed');
  }
}