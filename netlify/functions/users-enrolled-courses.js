import { executeQuery } from './shared/database.js';
import { withAuth } from './shared/auth.js';
import { successResponse, errorResponse, corsResponse, serverError } from './shared/response.js';

/**
 * Get mentee's enrolled courses
 * GET /api/users/enrolled-courses
 * Returns courses where the current user has been approved
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
        console.error('Database error getting enrolled courses:', enrolledCoursesResult.error);
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
      
    } catch (error) {
      console.error('Get enrolled courses function error:', error);
      return serverError('Failed to load enrolled courses');
    }
  });
}