import { executeQuery } from './shared/database.js';
import { withAuth } from './shared/auth.js';
import { validateRequiredFields, isValidUUID } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';

/**
 * User profile endpoints
 * GET /api/users/profile - Get current user profile
 * PUT /api/users/profile - Update current user profile
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Authenticate request
  return withAuth(event, async (event, user) => {
    switch (event.httpMethod) {
      case 'GET':
        return handleGetProfile(event, user);
      case 'PUT':
        return handleUpdateProfile(event, user);
      default:
        return errorResponse('Method not allowed', 405);
    }
  });
}

/**
 * Get user profile
 */
async function handleGetProfile(event, user) {
  try {
    // Get full user profile data
    const profileResult = await executeQuery(`
      SELECT id, userid, email, role, img, description, display_name as "displayName", 
             is_blocked as "isBlocked", created_at as "createdAt"
      FROM users 
      WHERE id = $1 
      LIMIT 1
    `, [user.userId]);
    
    if (!profileResult.success) {
      console.error('Database error fetching profile:', profileResult.error);
      return serverError('Failed to fetch profile');
    }
    
    if (profileResult.data.length === 0) {
      return notFoundError('User profile not found');
    }
    
    const profile = profileResult.data[0];
    
    return successResponse({
      user: {
        id: profile.id,
        userid: profile.userid,
        email: profile.email,
        role: profile.role,
        img: profile.img,
        description: profile.description,
        displayName: profile.displayName,
        isBlocked: profile.isBlocked,
        createdAt: profile.createdAt
      }
    });
    
  } catch (error) {
    console.error('Get profile function error:', error);
    return serverError('Failed to fetch profile');
  }
}

/**
 * Update user profile
 */
async function handleUpdateProfile(event, user) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate that at least one field is provided for update
    const allowedFields = ['displayName', 'profileImage', 'description'];
    const hasValidField = allowedFields.some(field => 
      body.hasOwnProperty(field) && body[field] !== undefined
    );
    
    if (!hasValidField) {
      return validationError('At least one field must be provided for update');
    }
    
    // Build dynamic update query
    const setParts = [];
    const values = [];
    let valueIndex = 1;
    
    if (body.displayName !== undefined) {
      setParts.push(`display_name = $${valueIndex++}`);
      values.push(body.displayName);
    }
    
    if (body.profileImage !== undefined) {
      setParts.push(`img = $${valueIndex++}`);
      values.push(body.profileImage);
    }
    
    if (body.description !== undefined) {
      setParts.push(`description = $${valueIndex++}`);
      values.push(body.description);
    }
    
    // Add user ID as last parameter
    values.push(user.userId);
    
    const updateResult = await executeQuery(`
      UPDATE users 
      SET ${setParts.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING id, display_name as "displayName", img, description
    `, values);
    
    if (!updateResult.success) {
      console.error('Database error updating profile:', updateResult.error);
      return serverError('Failed to update profile');
    }
    
    if (updateResult.data.length === 0) {
      return notFoundError('User not found');
    }
    
    const updatedUser = updateResult.data[0];
    
    return successResponse({
      user: {
        id: updatedUser.id,
        displayName: updatedUser.displayName,
        img: updatedUser.img,
        description: updatedUser.description
      }
    });
    
  } catch (error) {
    console.error('Update profile function error:', error);
    
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError('Failed to update profile');
  }
}