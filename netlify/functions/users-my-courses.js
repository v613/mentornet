import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validatePagination } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, serverError, permissionError } from './shared/response.js';

/**
 * Get mentor's created courses
 * GET /api/users/my-courses?page=1&pageSize=10
 * Returns courses created by the current mentor
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
        console.error('Database error getting course count:', countResult.error);
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
        console.error('Database error getting mentor courses:', coursesResult.error);
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
      
    } catch (error) {
      console.error('Get mentor courses function error:', error);
      return serverError('Failed to load courses');
    }
  });
}