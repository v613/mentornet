import { executeQuery } from './shared/database.js';
import { validatePagination } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, serverError } from './shared/response.js';
import { verifyToken, hasRole } from './shared/auth.js';
import { t } from './shared/i18n.js';

/**
 * Get courses with pagination
 * GET /api/courses?page=1&pageSize=10&all=true (admin only)
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return errorResponse(t('courses.messages.methodNotAllowed'), 405);
  }
  
  try {
    // Validate and extract pagination parameters
    const { page, pageSize, offset } = validatePagination(event.queryStringParameters || {});
    const queryParams = event.queryStringParameters || {};
    const showAllCourses = queryParams.all === 'true';
    
    // Check authentication for admin features
    let user = null;
    if (showAllCourses) {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        user = await verifyToken(token);
      }
      
      // If requesting all courses but not admin, return error
      if (!user || !hasRole(user, ['admin'])) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            success: false, 
            error: t('courses.messages.adminAccessRequiredForAllCourses'),
            errorCode: 'ADMIN_REQUIRED'
          })
        };
      }
    }
    
    // Build WHERE clause based on access level
    const whereClause = showAllCourses ? '' : 'WHERE c.status = \'published\'';
    const countWhereClause = showAllCourses ? '' : 'WHERE status = \'published\'';
    
    // Get total count of courses
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total FROM courses ${countWhereClause}
    `);
    
    if (!countResult.success) {
      console.error('Database error getting course count:', countResult.error);
      return serverError(t('courses.messages.failedToLoadCourses'));
    }
    
    const total = parseInt(countResult.data[0]?.total || 0);
    
    // Get paginated courses with enrollment count and creator details
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
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    
    if (!coursesResult.success) {
      console.error('Database error getting courses:', coursesResult.error);
      return serverError(t('courses.messages.failedToLoadCourses'));
    }
    
    // Process JSON fields and format data
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
    console.error('Get courses function error:', error);
    return serverError(t('courses.messages.failedToLoadCourses'));
  }
}