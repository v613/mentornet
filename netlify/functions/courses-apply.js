import { executeQuery } from './shared/database.js';
import { withAuth } from './shared/auth.js';
import { validateRequiredFields } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';

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
      // Extract course ID from path
      const pathSegments = event.path.split('/');
      const courseIdIndex = pathSegments.findIndex(segment => segment === 'courses') + 1;
      const courseId = pathSegments[courseIdIndex];
      
      if (!courseId || isNaN(parseInt(courseId))) {
        return validationError('Invalid course ID');
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
        return serverError('Failed to process application');
      }
      
      if (courseResult.data.length === 0) {
        return notFoundError('Course not found');
      }
      
      const course = courseResult.data[0];
      
      // Check if course is published and accepting applications
      if (course.status !== 'published') {
        return errorResponse('Course is not available for applications', 400, 'COURSE_NOT_AVAILABLE');
      }
      
      // Check if course is full
      if (course.enrolledCount >= course.maxEnrollment) {
        return errorResponse('Course is full', 400, 'COURSE_FULL');
      }
      
      // Check course settings for self-enrollment
      const settings = course.settings ? JSON.parse(course.settings) : {};
      if (settings.allowSelfEnrollment === false) {
        return errorResponse('This course does not allow direct applications', 400, 'APPLICATIONS_NOT_ALLOWED');
      }
      
      // Check if user has already applied to this course
      const existingApplicationResult = await executeQuery(`
        SELECT subscription_id as "subscriptionId", status 
        FROM subscriptions 
        WHERE course_id = $1 AND mentee_id = $2
      `, [parseInt(courseId), user.userId]);
      
      if (!existingApplicationResult.success) {
        console.error('Database error checking existing application:', existingApplicationResult.error);
        return serverError('Failed to process application');
      }
      
      if (existingApplicationResult.data.length > 0) {
        const existingApp = existingApplicationResult.data[0];
        return errorResponse(`You have already applied to this course (Status: ${existingApp.status})`, 409, 'ALREADY_APPLIED');
      }
      
      // Create application
      const applicationResult = await executeQuery(`
        INSERT INTO subscriptions (course_id, mentee_id, status, motivation, experience, subscribed_at)
        VALUES ($1, $2, 'pending', $3, $4, NOW())
        RETURNING subscription_id as "subscriptionId", status, subscribed_at as "appliedAt"
      `, [parseInt(courseId), user.userId, motivation, experience]);
      
      if (!applicationResult.success) {
        console.error('Database error creating application:', applicationResult.error);
        return serverError('Failed to submit application');
      }
      
      if (applicationResult.data.length === 0) {
        return serverError('Failed to submit application');
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
        message: 'Application submitted successfully'
      }, 201);
      
    } catch (error) {
      console.error('Apply to course function error:', error);
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return validationError('Invalid JSON in request body');
      }
      
      return serverError('Failed to submit application');
    }
  });
}