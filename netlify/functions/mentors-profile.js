import { executeQuery } from './shared/database.js';
import { isValidUUID } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';

/**
 * Get mentor profile by ID
 * GET /api/mentors/:mentorId
 * GET /api/mentors/:mentorId/image - Get only mentor image
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
    // Extract mentor ID from path
    const pathSegments = event.path.split('/');
    const mentorIdIndex = pathSegments.findIndex(segment => segment === 'mentors') + 1;
    const mentorId = pathSegments[mentorIdIndex];
    
    if (!mentorId) {
      return validationError('Mentor ID is required');
    }
    
    if (!isValidUUID(mentorId)) {
      return validationError('Invalid mentor ID format');
    }
    
    // Check if request is for image only
    const isImageRequest = pathSegments[pathSegments.length - 1] === 'image';
    
    if (isImageRequest) {
      return handleGetMentorImage(mentorId);
    } else {
      return handleGetMentorProfile(mentorId);
    }
    
  } catch (error) {
    console.error('Get mentor profile function error:', error);
    return serverError('Failed to load mentor profile');
  }
}

/**
 * Get full mentor profile
 */
async function handleGetMentorProfile(mentorId) {
  try {
    const mentorResult = await executeQuery(`
      SELECT 
        id, 
        userid, 
        email, 
        img, 
        display_name as "displayName", 
        description,
        created_at as "createdAt"
      FROM users 
      WHERE id = $1 AND role = 'mentor' AND is_blocked = false
      LIMIT 1
    `, [mentorId]);
    
    if (!mentorResult.success) {
      console.error('Database error getting mentor profile:', mentorResult.error);
      return serverError('Failed to load mentor profile');
    }
    
    if (mentorResult.data.length === 0) {
      return notFoundError('Mentor not found or not available');
    }
    
    const mentor = mentorResult.data[0];
    
    // Get mentor's course statistics
    const statsResult = await executeQuery(`
      SELECT 
        COUNT(*) as "totalCourses",
        COUNT(CASE WHEN status = 'published' THEN 1 END) as "publishedCourses",
        COALESCE(SUM(COALESCE(enrolled_stats.enrolled_count, 0)), 0) as "totalStudents"
      FROM courses c
      LEFT JOIN (
        SELECT 
          course_id,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as enrolled_count
        FROM subscriptions 
        GROUP BY course_id
      ) enrolled_stats ON c.course_id = enrolled_stats.course_id
      WHERE c.mentor_id = $1
    `, [mentorId]);
    
    let stats = {
      totalCourses: 0,
      publishedCourses: 0,
      totalStudents: 0
    };
    
    if (statsResult.success && statsResult.data.length > 0) {
      stats = {
        totalCourses: parseInt(statsResult.data[0].totalCourses || 0),
        publishedCourses: parseInt(statsResult.data[0].publishedCourses || 0),
        totalStudents: parseInt(statsResult.data[0].totalStudents || 0)
      };
    }
    
    return successResponse({
      mentor: {
        ...mentor,
        stats
      }
    });
    
  } catch (error) {
    console.error('Get mentor profile error:', error);
    return serverError('Failed to load mentor profile');
  }
}

/**
 * Get mentor image only (for performance)
 */
async function handleGetMentorImage(mentorId) {
  try {
    const imageResult = await executeQuery(`
      SELECT img 
      FROM users 
      WHERE id = $1 AND role = 'mentor' AND is_blocked = false
      LIMIT 1
    `, [mentorId]);
    
    if (!imageResult.success) {
      console.error('Database error getting mentor image:', imageResult.error);
      return serverError('Failed to load mentor image');
    }
    
    if (imageResult.data.length === 0) {
      return notFoundError('Mentor not found');
    }
    
    const mentor = imageResult.data[0];
    
    return successResponse({
      img: mentor.img
    });
    
  } catch (error) {
    console.error('Get mentor image error:', error);
    return serverError('Failed to load mentor image');
  }
}