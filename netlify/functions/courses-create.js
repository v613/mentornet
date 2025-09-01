import { executeQuery } from './shared/database.js';
import { withAuth, hasRole } from './shared/auth.js';
import { validateCourseData } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, permissionError } from './shared/response.js';
import { t } from './shared/i18n.js';

/**
 * Create new course endpoint
 * POST /api/courses/create
 * Requires mentor or admin role
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return errorResponse(t('courses.messages.methodNotAllowed'), 405);
  }
  
  // Authenticate request
  return withAuth(event, async (event, user) => {
    try {
      // Check if user has permission to create courses (mentor or admin)
      if (!hasRole(user, ['mentor', 'admin'])) {
        return permissionError(t('courses.messages.onlyMentorsAndAdminsCanCreateCourses'));
      }
      
      // Parse request body
      const body = JSON.parse(event.body || '{}');
      
      // Validate course data
      const validation = validateCourseData(body);
      if (!validation.valid) {
        return validationError(validation.error, null, validation.errorCode);
      }
      
      // Extract and prepare course data
      const {
        title,
        description,
        category,
        level,
        duration = 8,
        maxEnrollment = 20,
        objectives,
        prerequisites,
        skills,
        settings,
        status = 'draft',
        timeSlots
      } = body;
      
      // Insert new course
      const courseResult = await executeQuery(`
        INSERT INTO courses (
          mentor_id, 
          title, 
          description,
          category,
          level,
          duration,
          max_enrollment,
          objectives,
          prerequisites,
          skills,
          settings,
          status,
          time_slots,
          created_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING course_id as "courseId", title, description, category, level, 
                 duration, max_enrollment as "maxEnrollment", objectives, 
                 prerequisites, skills, settings, status, time_slots as "timeSlots", 
                 created_at as "createdAt"
      `, [
        user.userId,
        title,
        description,
        category || null,
        level || null,
        duration,
        maxEnrollment,
        objectives || null,
        prerequisites ? JSON.stringify(prerequisites) : null,
        skills ? JSON.stringify(skills) : null,
        settings ? JSON.stringify(settings) : null,
        status,
        timeSlots ? JSON.stringify(timeSlots) : null
      ]);
      
      if (!courseResult.success) {
        console.error('Database error creating course:', courseResult.error);
        return serverError(t('courses.messages.failedToCreateCourse'));
      }
      
      if (courseResult.data.length === 0) {
        return serverError(t('courses.messages.failedToCreateCourse'));
      }
      
      const course = courseResult.data[0];
      
      // Process JSON fields for response
      const processedCourse = {
        ...course,
        skills: course.skills ? JSON.parse(course.skills) : [],
        prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
        settings: course.settings ? JSON.parse(course.settings) : {},
        timeSlots: course.timeSlots ? JSON.parse(course.timeSlots) : [],
        mentorId: user.userId,
        creatorName: user.displayName,
        enrolledCount: 0,
        applicationsCount: 0
      };
      
      return successResponse({
        course: processedCourse,
        courseId: course.courseId,
        message: t('courses.messages.courseCreatedSuccessfully')
      }, 201);
      
    } catch (error) {
      console.error('Create course function error:', error);
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return validationError(t('courses.messages.invalidJsonInRequestBody'));
      }
      
      return serverError('Failed to create course');
    }
  });
}