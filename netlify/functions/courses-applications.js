import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError, permissionError } from './shared/response.js';

/**
 * Course applications management endpoint
 * GET /api/courses/:courseId/applications - Get applications for a course
 * PUT /api/courses/:courseId/applications/:applicationId - Update application status
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
        return handleGetApplications(event, user);
      case 'PUT':
        return handleUpdateApplication(event, user);
      default:
        return errorResponse('Method not allowed', 405);
    }
  });
}

/**
 * Get applications for a course
 * Only course owner or admin can view applications
 */
async function handleGetApplications(event, user) {
  try {
    // Extract course ID from path
    const pathSegments = event.path.split('/');
    const courseIdIndex = pathSegments.findIndex(segment => segment === 'courses') + 1;
    const courseId = pathSegments[courseIdIndex];
    
    if (!courseId || isNaN(parseInt(courseId))) {
      return validationError('Invalid course ID');
    }
    
    // Check if course exists and user has permission to view applications
    const courseResult = await executeQuery(`
      SELECT mentor_id as "mentorId", title
      FROM courses 
      WHERE course_id = $1
    `, [parseInt(courseId)]);
    
    if (!courseResult.success) {
      console.error('Database error checking course:', courseResult.error);
      return serverError('Failed to load applications');
    }
    
    if (courseResult.data.length === 0) {
      return notFoundError('Course not found');
    }
    
    const course = courseResult.data[0];
    
    // Check permissions (course owner or admin)
    if (course.mentorId !== user.userId && !hasRole(user, ['admin'])) {
      return permissionError('You can only view applications for courses you created');
    }
    
    // Get all applications for the course
    const applicationsResult = await executeQuery(`
      SELECT 
        s.subscription_id as "id",
        COALESCE(u.display_name, u.email, u.userid) as "applicantName",
        u.userid as "applicantId",
        u.email as "applicantEmail",
        s.subscribed_at as "appliedAt",
        s.status,
        s.motivation,
        s.experience
      FROM subscriptions s
      LEFT JOIN users u ON s.mentee_id = u.id
      WHERE s.course_id = $1
      ORDER BY s.subscribed_at DESC
    `, [parseInt(courseId)]);
    
    if (!applicationsResult.success) {
      console.error('Database error getting applications:', applicationsResult.error);
      return serverError('Failed to load applications');
    }
    
    return successResponse({
      applications: applicationsResult.data,
      course: {
        courseId: parseInt(courseId),
        title: course.title
      }
    });
    
  } catch (error) {
    console.error('Get applications function error:', error);
    return serverError('Failed to load applications');
  }
}

/**
 * Update application status (approve/reject)
 * Only course owner or admin can update application status
 */
async function handleUpdateApplication(event, user) {
  try {
    // Extract course ID and application ID from path
    const pathSegments = event.path.split('/');
    const courseIdIndex = pathSegments.findIndex(segment => segment === 'courses') + 1;
    const courseId = pathSegments[courseIdIndex];
    const applicationId = pathSegments[pathSegments.length - 1];
    
    if (!courseId || isNaN(parseInt(courseId))) {
      return validationError('Invalid course ID');
    }
    
    if (!applicationId || isNaN(parseInt(applicationId))) {
      return validationError('Invalid application ID');
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    if (!body.status) {
      return validationError('Status is required');
    }
    
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(body.status)) {
      return validationError('Invalid status. Must be: pending, approved, or rejected');
    }
    
    // Check if course exists and user has permission
    const courseResult = await executeQuery(`
      SELECT mentor_id as "mentorId", title, max_enrollment as "maxEnrollment"
      FROM courses 
      WHERE course_id = $1
    `, [parseInt(courseId)]);
    
    if (!courseResult.success) {
      console.error('Database error checking course:', courseResult.error);
      return serverError('Failed to update application');
    }
    
    if (courseResult.data.length === 0) {
      return notFoundError('Course not found');
    }
    
    const course = courseResult.data[0];
    
    // Check permissions (course owner or admin)
    if (course.mentorId !== user.userId && !hasRole(user, ['admin'])) {
      return permissionError('You can only update applications for courses you created');
    }
    
    // If approving, check if course has space
    if (body.status === 'approved') {
      const enrollmentResult = await executeQuery(`
        SELECT COUNT(*) as "currentEnrolled"
        FROM subscriptions 
        WHERE course_id = $1 AND status = 'approved'
      `, [parseInt(courseId)]);
      
      if (enrollmentResult.success && enrollmentResult.data[0]) {
        const currentEnrolled = parseInt(enrollmentResult.data[0].currentEnrolled);
        if (currentEnrolled >= course.maxEnrollment) {
          return errorResponse('Course is full, cannot approve more applications', 400, 'COURSE_FULL');
        }
      }
    }
    
    // Update application status
    const updateResult = await executeQuery(`
      UPDATE subscriptions 
      SET status = $1
      WHERE subscription_id = $2 AND course_id = $3
      RETURNING subscription_id as "id", status, mentee_id as "menteeId"
    `, [body.status, parseInt(applicationId), parseInt(courseId)]);
    
    if (!updateResult.success) {
      console.error('Database error updating application:', updateResult.error);
      return serverError('Failed to update application');
    }
    
    if (updateResult.data.length === 0) {
      return notFoundError('Application not found');
    }
    
    const updatedApplication = updateResult.data[0];
    
    return successResponse({
      application: updatedApplication,
      message: `Application ${body.status} successfully`
    });
    
  } catch (error) {
    console.error('Update application function error:', error);
    
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError('Failed to update application');
  }
}