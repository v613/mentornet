import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { isValidUUID } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, notFoundError } from './shared/response.js';

/**
 * Course deletion endpoint
 * DELETE /api/courses-delete?courseId={id} - Delete a course (admin only)
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Authenticate request and check admin role
  return withAuth(event, async (event, user) => {
    // Check if user is admin
    if (!hasRole(user, ['admin'])) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Admin access required',
          errorCode: 'ADMIN_REQUIRED'
        })
      };
    }

    switch (event.httpMethod) {
      case 'DELETE':
        return handleDeleteCourse(event, user);
      default:
        return errorResponse('Method not allowed', 405);
    }
  });
}

/**
 * Delete a course (admin only)
 */
async function handleDeleteCourse(event, user) {
  try {
    // Get courseId from query parameters
    const queryParams = event.queryStringParameters || {};
    const courseId = queryParams.courseId;
    
    if (!courseId) {
      return validationError('Course ID is required');
    }

    // Validate courseId format (should be numeric for this system)
    if (!/^\d+$/.test(courseId)) {
      return validationError('Invalid course ID format');
    }

    // Check if course exists
    const courseResult = await executeQuery(`
      SELECT course_id, title, mentor_id, status
      FROM courses 
      WHERE course_id = $1
      LIMIT 1
    `, [parseInt(courseId)]);
    
    if (!courseResult.success) {
      console.error('Database error checking course:', courseResult.error);
      return serverError('Failed to check course');
    }
    
    if (courseResult.data.length === 0) {
      return notFoundError('Course not found');
    }

    const course = courseResult.data[0];

    // Check if course has active subscriptions
    const subscriptionsResult = await executeQuery(`
      SELECT COUNT(*) as count
      FROM subscriptions 
      WHERE course_id = $1 AND status = 'approved'
    `, [parseInt(courseId)]);
    
    if (!subscriptionsResult.success) {
      console.error('Database error checking subscriptions:', subscriptionsResult.error);
      return serverError('Failed to check course subscriptions');
    }

    const activeSubscriptions = parseInt(subscriptionsResult.data[0].count);
    
    if (activeSubscriptions > 0) {
      return validationError('Cannot delete course with active enrollments');
    }

    // Delete the course (this will cascade delete related subscriptions due to foreign keys)
    const deleteResult = await executeQuery(`
      DELETE FROM courses 
      WHERE course_id = $1
    `, [parseInt(courseId)]);
    
    if (!deleteResult.success) {
      console.error('Database error deleting course:', deleteResult.error);
      return serverError('Failed to delete course');
    }
    
    return successResponse({
      message: 'Course deleted successfully',
      courseId: course.course_id
    });
    
  } catch (error) {
    console.error('Delete course function error:', error);
    return serverError('Failed to delete course');
  }
}