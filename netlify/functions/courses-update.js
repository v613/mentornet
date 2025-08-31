import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { isValidUUID } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, permissionError, notFoundError } from './shared/response.js';

/**
 * Update course endpoint
 * PUT /api/courses/update/:courseId
 * Requires course ownership or admin role
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Only allow PUT requests
  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }
  
  // Authenticate request
  return withAuth(event, async (event, user) => {
    try {
      // Extract course ID from path
      const pathSegments = event.path.split('/');
      const courseId = pathSegments[pathSegments.length - 1];
      
      if (!courseId || isNaN(parseInt(courseId))) {
        return validationError('Invalid course ID');
      }
      
      // Parse request body
      const body = JSON.parse(event.body || '{}');
      
      // Check if course exists and user has permission to update it
      const courseCheckResult = await executeQuery(`
        SELECT mentor_id as "mentorId", title
        FROM courses 
        WHERE course_id = $1
      `, [parseInt(courseId)]);
      
      if (!courseCheckResult.success) {
        console.error('Database error checking course:', courseCheckResult.error);
        return serverError('Failed to update course');
      }
      
      if (courseCheckResult.data.length === 0) {
        return notFoundError('Course not found');
      }
      
      const course = courseCheckResult.data[0];
      
      // Check permissions (course owner or admin)
      if (course.mentorId !== user.userId && !hasRole(user, ['admin'])) {
        return permissionError('You can only update courses you created');
      }
      
      // Build dynamic update query
      const setParts = [];
      const values = [];
      let valueIndex = 1;
      
      // Handle each possible update field
      if (body.title !== undefined) {
        if (!body.title || body.title.trim().length === 0) {
          return validationError('Title cannot be empty');
        }
        setParts.push(`title = $${valueIndex++}`);
        values.push(body.title.trim());
      }
      
      if (body.description !== undefined) {
        setParts.push(`description = $${valueIndex++}`);
        values.push(body.description);
      }
      
      if (body.category !== undefined) {
        setParts.push(`category = $${valueIndex++}`);
        values.push(body.category);
      }
      
      if (body.level !== undefined) {
        setParts.push(`level = $${valueIndex++}`);
        values.push(body.level);
      }
      
      if (body.duration !== undefined) {
        if (body.duration < 1 || body.duration > 52) {
          return validationError('Duration must be between 1 and 52 weeks');
        }
        setParts.push(`duration = $${valueIndex++}`);
        values.push(body.duration);
      }
      
      if (body.maxEnrollment !== undefined) {
        if (body.maxEnrollment < 1 || body.maxEnrollment > 1000) {
          return validationError('Max enrollment must be between 1 and 1000');
        }
        setParts.push(`max_enrollment = $${valueIndex++}`);
        values.push(body.maxEnrollment);
      }
      
      if (body.objectives !== undefined) {
        setParts.push(`objectives = $${valueIndex++}`);
        values.push(body.objectives);
      }
      
      if (body.prerequisites !== undefined) {
        setParts.push(`prerequisites = $${valueIndex++}`);
        values.push(Array.isArray(body.prerequisites) ? JSON.stringify(body.prerequisites) : body.prerequisites);
      }
      
      if (body.skills !== undefined) {
        setParts.push(`skills = $${valueIndex++}`);
        values.push(Array.isArray(body.skills) ? JSON.stringify(body.skills) : body.skills);
      }
      
      if (body.settings !== undefined) {
        setParts.push(`settings = $${valueIndex++}`);
        values.push(typeof body.settings === 'object' ? JSON.stringify(body.settings) : body.settings);
      }
      
      if (body.status !== undefined) {
        const validStatuses = ['draft', 'published', 'archived', 'suspended'];
        if (!validStatuses.includes(body.status)) {
          return validationError('Invalid status. Must be: draft, published, archived, or suspended');
        }
        setParts.push(`status = $${valueIndex++}`);
        values.push(body.status);
      }
      
      if (body.timeSlots !== undefined) {
        setParts.push(`time_slots = $${valueIndex++}`);
        values.push(Array.isArray(body.timeSlots) ? JSON.stringify(body.timeSlots) : body.timeSlots);
      }
      
      // Check if any updates were provided
      if (setParts.length === 0) {
        return validationError('No valid update fields provided');
      }
      
      // Add course ID as last parameter
      values.push(parseInt(courseId));
      
      // Execute update query
      const updateResult = await executeQuery(`
        UPDATE courses 
        SET ${setParts.join(', ')}
        WHERE course_id = $${valueIndex}
        RETURNING course_id as "courseId", title, description, category, level, 
                 duration, max_enrollment as "maxEnrollment", objectives, 
                 prerequisites, skills, settings, status, time_slots as "timeSlots", 
                 created_at as "createdAt", mentor_id as "mentorId"
      `, values);
      
      if (!updateResult.success) {
        console.error('Database error updating course:', updateResult.error);
        return serverError('Failed to update course');
      }
      
      if (updateResult.data.length === 0) {
        return notFoundError('Course not found');
      }
      
      const updatedCourse = updateResult.data[0];
      
      // Process JSON fields for response
      const processedCourse = {
        ...updatedCourse,
        skills: updatedCourse.skills ? JSON.parse(updatedCourse.skills) : [],
        prerequisites: updatedCourse.prerequisites ? JSON.parse(updatedCourse.prerequisites) : [],
        settings: updatedCourse.settings ? JSON.parse(updatedCourse.settings) : {},
        timeSlots: updatedCourse.timeSlots ? JSON.parse(updatedCourse.timeSlots) : []
      };
      
      return successResponse({
        course: processedCourse,
        message: 'Course updated successfully'
      });
      
    } catch (error) {
      console.error('Update course function error:', error);
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return validationError('Invalid JSON in request body');
      }
      
      return serverError('Failed to update course');
    }
  });
}