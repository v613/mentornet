import { executeQuery } from './shared/database.js';
import { successResponse, errorResponse, corsResponse, serverError } from './shared/response.js';

/**
 * Get all mentors
 * GET /api/mentors
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }
  
  try {
    // Get all mentors with their profile data
    const mentorsResult = await executeQuery(`
      SELECT 
        id, 
        userid, 
        email, 
        img, 
        display_name as "displayName", 
        description,
        created_at as "createdAt"
      FROM users 
      WHERE role = 'mentor' AND is_blocked = false
      ORDER BY display_name ASC, created_at DESC
    `);
    
    if (!mentorsResult.success) {
      console.error('Database error getting mentors:', mentorsResult.error);
      return serverError('Failed to load mentors');
    }
    
    // Process img field to convert Buffer to string
    const processedMentors = mentorsResult.data.map(mentor => ({
      ...mentor,
      img: mentor.img ? Buffer.from(mentor.img).toString('utf8') : null
    }));

    return successResponse({
      mentors: processedMentors
    });
    
  } catch (error) {
    console.error('Get mentors function error:', error);
    return serverError('Failed to load mentors');
  }
}