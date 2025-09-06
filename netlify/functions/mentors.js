import { executeQuery } from './shared/database.js';
import { isValidUUID } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';

/**
 * Consolidated Mentors endpoint
 * GET /api/mentors - Get all mentors
 * GET /api/mentors?mentorId=123 - Get specific mentor profile
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
    // Get mentorId from query parameters
    const queryParams = event.queryStringParameters || {};
    const mentorId = queryParams.mentorId;
    
    if (mentorId) {
      return handleGetMentorProfile(mentorId);
    } else {
      return handleGetAllMentors();
    }
  } catch (error) {
    return serverError('Failed to load mentor data');
  }
}

/**
 * Get all mentors
 * GET /api/mentors
 */
async function handleGetAllMentors() {
  // Get all mentors with their profile data
  const mentorsResult = await executeQuery(`
    SELECT 
      id, 
      userid, 
      email, 
      img, 
      cv,
      display_name as "displayName", 
      description,
      created_at as "createdAt"
    FROM users 
    WHERE role = 'mentor' AND is_blocked = false
    ORDER BY display_name ASC, created_at DESC
  `);
  
  if (!mentorsResult.success) {
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
}

/**
 * Get mentor profile by ID
 * GET /api/mentors?mentorId=123
 */
async function handleGetMentorProfile(mentorId) {
  if (!mentorId) {
    return validationError('Mentor ID is required');
  }
  
  if (!isValidUUID(mentorId)) {
    return validationError('Invalid mentor ID format');
  }
  
  const mentorResult = await executeQuery(`
    SELECT 
      id, 
      userid, 
      email, 
      img, 
      cv,
      display_name as "displayName", 
      description,
      created_at as "createdAt"
    FROM users 
    WHERE id = $1 AND role = 'mentor' AND is_blocked = false
    LIMIT 1
  `, [mentorId]);
  
  if (!mentorResult.success) {
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
}