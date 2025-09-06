import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validatePagination } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, serverError, permissionError } from './shared/response.js';

/**
 * Consolidated User Courses endpoint
 * GET /api/user-courses?type=created - Get user's created courses (mentor/admin only)
 * GET /api/user-courses?type=enrolled - Get user's enrolled courses
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
  
  // Authenticate request
  return withAuth(event, async (event, user) => {
    try {
      // Get type from query parameters
      const queryParams = event.queryStringParameters || {};
      const type = queryParams.type;
      
      if (!type) {
        return errorResponse('Type parameter required (?type=created|enrolled)', 400);
      }
      
      switch (type) {
        case 'created':
          return handleCreatedCourses(event, user);
        case 'enrolled':
          return handleEnrolledCourses(event, user);
        default:
          return errorResponse('Invalid type. Must be one of: created, enrolled', 400);
      }
    } catch (error) {
      return serverError('Failed to load user courses');
    }
  });
}

/**
 * Get mentor's created courses
 * GET /api/user-courses?type=created&page=1&pageSize=10
 * Returns courses created by the current mentor
 */
async function handleCreatedCourses(event, user) {
  // Check if user is a mentor or admin
  if (!hasRole(user, ['mentor', 'admin'])) {
    return permissionError('Only mentors and admins can view created courses');
  }
  
  // Validate and extract pagination parameters
  const { page, pageSize, offset } = validatePagination(event.queryStringParameters || {});
  
  // Get total count of courses created by this mentor
  const countResult = await executeQuery(`
    SELECT COUNT(*) as total 
    FROM courses 
    WHERE mentor_id = $1
  `, [user.userId]);
  
  if (!countResult.success) {
    return serverError('Failed to load courses');
  }
  
  const total = parseInt(countResult.data[0]?.total || 0);
  
  // Get paginated courses created by this mentor
  const coursesResult = await executeQuery(`
    SELECT 
      c.course_id as "courseId",
      c.title,
      c.description,
      c.category,
      c.level,
      c.duration,
      c.max_enrollment as "maxEnrollment",
      c.objectives,
      c.prerequisites,
      c.skills,
      c.settings,
      c.status,
      c.time_slots as "timeSlots",
      c.created_at as "createdAt",
      c.mentor_id as "mentorId",
      u.display_name as "creatorName",
      u.email as "mentorEmail",
      COALESCE(s.enrolled_count, 0) as "enrolledCount",
      COALESCE(s.applications_count, 0) as "applicationsCount"
    FROM courses c
    LEFT JOIN users u ON c.mentor_id = u.id
    LEFT JOIN (
      SELECT 
        course_id,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as enrolled_count,
        COUNT(*) as applications_count
      FROM subscriptions 
      GROUP BY course_id
    ) s ON c.course_id = s.course_id
    WHERE c.mentor_id = $1
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3
  `, [user.userId, pageSize, offset]);
  
  if (!coursesResult.success) {
    return serverError('Failed to load courses');
  }
  
  // Process JSON fields for response
  const processedCourses = coursesResult.data.map(course => ({
    ...course,
    skills: course.skills ? JSON.parse(course.skills) : [],
    prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
    settings: course.settings ? JSON.parse(course.settings) : {},
    timeSlots: course.timeSlots ? JSON.parse(course.timeSlots) : []
  }));
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(total / pageSize);
  const hasNext = offset + pageSize < total;
  const hasPrev = page > 1;
  
  return successResponse({
    courses: processedCourses,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext,
      hasPrev
    }
  });
}

/**
 * Get mentee's enrolled courses
 * GET /api/user-courses?type=enrolled
 * Returns courses where the current user has been approved
 */
async function handleEnrolledCourses(event, user) {
  // Get all courses where the user is enrolled (approved status)
  const enrolledCoursesResult = await executeQuery(`
    SELECT 
      c.course_id as "courseId",
      c.title,
      c.description,
      c.category,
      c.level,
      c.duration,
      c.max_enrollment as "maxEnrollment",
      c.objectives,
      c.prerequisites,
      c.skills,
      c.settings,
      c.status,
      c.time_slots as "timeSlots",
      c.created_at as "createdAt",
      u.display_name as "creatorName",
      u.email as "mentorEmail",
      s.status as "enrollmentStatus",
      s.subscribed_at as "enrolledAt",
      COALESCE(enrolled_stats.enrolled_count, 0) as "enrolledCount",
      COALESCE(enrolled_stats.applications_count, 0) as "applicationsCount"
    FROM subscriptions s
    LEFT JOIN courses c ON s.course_id = c.course_id
    LEFT JOIN users u ON c.mentor_id = u.id
    LEFT JOIN (
      SELECT 
        course_id,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as enrolled_count,
        COUNT(*) as applications_count
      FROM subscriptions 
      GROUP BY course_id
    ) enrolled_stats ON c.course_id = enrolled_stats.course_id
    WHERE s.mentee_id = $1 AND s.status = 'approved'
    ORDER BY s.subscribed_at DESC
  `, [user.userId]);
  
  if (!enrolledCoursesResult.success) {
    return serverError('Failed to load enrolled courses');
  }
  
  // Process JSON fields for response
  const processedCourses = enrolledCoursesResult.data.map(course => ({
    ...course,
    skills: course.skills ? JSON.parse(course.skills) : [],
    prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
    settings: course.settings ? JSON.parse(course.settings) : {},
    timeSlots: course.timeSlots ? JSON.parse(course.timeSlots) : []
  }));
  
  return successResponse({
    courses: processedCourses,
    total: processedCourses.length
  });
}