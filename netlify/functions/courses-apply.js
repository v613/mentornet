import { executeQuery } from './shared/database.js';
import { withAuth } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';
import { t } from './shared/i18n.js';

/**
 * Apply to course endpoint
 * POST /api/courses/:courseId/apply
 * Requires authentication (mentees can apply)
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
  
  // Authenticate request
  return withAuth(event, async (event, user) => {
    try {
      // Extract course ID from query parameters
      const courseId = event.queryStringParameters?.courseId;
      
      if (!courseId || isNaN(parseInt(courseId))) {
        return validationError(t('auth.errors.invalidInput'));
      }
      
      // Parse request body
      const body = JSON.parse(event.body || '{}');
      
      // Validate required fields
      const validation = validateRequiredFields(body, ['motivation', 'experience']);
      if (!validation.valid) {
        return validationError(validation.error, validation.missingFields);
      }
      
      const { motivation, experience, timeSlotId } = body;
      
      // Check if course exists and is available for applications
      const courseResult = await executeQuery(`
        SELECT 
          c.course_id as "courseId",
          c.title,
          c.status,
          c.max_enrollment as "maxEnrollment",
          c.settings,
          COALESCE(s.enrolled_count, 0) as "enrolledCount"
        FROM courses c
        LEFT JOIN (
          SELECT 
            course_id,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as enrolled_count
          FROM subscriptions 
          GROUP BY course_id
        ) s ON c.course_id = s.course_id
        WHERE c.course_id = $1
      `, [parseInt(courseId)]);
      
      if (!courseResult.success) {
        console.error('Database error checking course:', courseResult.error);
        return serverError(t('courses.messages.failedToProcessApplication'));
      }
      
      if (courseResult.data.length === 0) {
        return notFoundError(t('courses.messages.courseNotFound'));
      }
      
      const course = courseResult.data[0];
      
      // Check if course is published and accepting applications
      if (course.status !== 'published') {
        return errorResponse(t('courses.messages.courseNotAvailable'), 400, 'COURSE_NOT_AVAILABLE');
      }
      
      // Check if course is full
      if (course.enrolledCount >= course.maxEnrollment) {
        return errorResponse(t('courses.actions.full'), 400, 'COURSE_FULL');
      }
      
      // Check course settings for self-enrollment
      const settings = course.settings ? JSON.parse(course.settings) : {};
      if (settings.allowSelfEnrollment === false) {
        return errorResponse(t('courses.messages.applicationsNotAllowed'), 400, 'APPLICATIONS_NOT_ALLOWED');
      }
      
      // Check if user has already applied to this course
      const existingApplicationResult = await executeQuery(`
        SELECT subscription_id as "subscriptionId", status 
        FROM subscriptions 
        WHERE course_id = $1 AND mentee_id = $2
      `, [parseInt(courseId), user.userId]);
      
      if (!existingApplicationResult.success) {
        console.error('Database error checking existing application:', existingApplicationResult.error);
        return serverError(t('courses.messages.failedToProcessApplication'));
      }
      
      if (existingApplicationResult.data.length > 0) {
        const existingApp = existingApplicationResult.data[0];
        return errorResponse(t('courses.messages.alreadyApplied'), 409, 'ALREADY_APPLIED');
      }
      
      // Create application
      const applicationResult = await executeQuery(`
        INSERT INTO subscriptions (course_id, mentee_id, status, motivation, experience, subscribed_at)
        VALUES ($1, $2, 'pending', $3, $4, NOW())
        RETURNING subscription_id as "subscriptionId", status, subscribed_at as "appliedAt"
      `, [parseInt(courseId), user.userId, motivation, experience]);
      
      if (!applicationResult.success) {
        console.error('Database error creating application:', applicationResult.error);
        return serverError(t('courses.messages.failedToSubmitApplication'));
      }
      
      if (applicationResult.data.length === 0) {
        return serverError(t('courses.messages.failedToSubmitApplication'));
      }
      
      const application = applicationResult.data[0];
      
      return successResponse({
        subscriptionId: application.subscriptionId,
        status: application.status,
        appliedAt: application.appliedAt,
        course: {
          courseId: course.courseId,
          title: course.title
        },
        message: t('courses.applicationSubmitted')
      }, 201);
      
    } catch (error) {
      console.error('Apply to course function error:', error);
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return validationError(t('auth.errors.invalidInput'));
      }
      
      return serverError(t('courses.messages.failedToSubmitApplication'));
    }
  });
}