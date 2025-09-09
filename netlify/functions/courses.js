import { executeQuery } from './shared/database.js';
import { withAuth, hasRole, verifyToken } from './shared/auth.js';
import { validateCourseData, validatePagination, isValidUUID } from './shared/validation.js';
import { successResponse, errorResponse, corsResponse, validationError, serverError, permissionError, notFoundError } from './shared/response.js';

/**
 * Consolidated Course Management endpoint
 * GET /api/courses - List courses with pagination
 * POST /api/courses - Create new course
 * PUT /api/courses?courseId=123 - Update course
 * DELETE /api/courses?courseId=123 - Delete course (admin only)
 */
export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  try {
    switch (event.httpMethod) {
      case 'GET':
        return handleGetCourses(event);
      case 'POST':
        return withAuth(event, handleCreateCourse);
      case 'PUT':
        return withAuth(event, handleUpdateCourse);
      case 'DELETE':
        return withAuth(event, handleDeleteCourse);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError('Invalid JSON in request body');
    }
    
    return serverError('Course operation failed');
  }
}

/**
 * Get courses with pagination
 * GET /api/courses?page=1&pageSize=10&all=true (admin only)
 */
async function handleGetCourses(event) {
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
      return errorResponse('Admin access required', 403, 'ADMIN_REQUIRED');
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
    return serverError('Failed to load courses');
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
    return serverError('Failed to load courses');
  }
  
  // Get enrollment counts per time slot for all courses
  const timeSlotEnrollments = new Map();
  if (coursesResult.data.length > 0) {
    const courseIds = coursesResult.data.map(c => c.courseId);
    const enrollmentResult = await executeQuery(`
      SELECT 
        course_id as "courseId",
        time_slot_id as "timeSlotId", 
        COUNT(*) as enrollment_count
      FROM subscriptions 
      WHERE course_id = ANY($1) AND status = 'approved' AND time_slot_id IS NOT NULL
      GROUP BY course_id, time_slot_id
    `, [courseIds]);
    
    if (enrollmentResult.success) {
      enrollmentResult.data.forEach(row => {
        const key = `${row.courseId}_${row.timeSlotId}`;
        timeSlotEnrollments.set(key, parseInt(row.enrollment_count));
      });
    }
  }
  
  // Process JSON fields and format data with time slot enrollments
  const processedCourses = coursesResult.data.map(course => {
    const timeSlots = course.timeSlots ? JSON.parse(course.timeSlots) : [];
    const enrichedTimeSlots = timeSlots.map((slot, index) => ({
      ...slot,
      currentEnrollment: timeSlotEnrollments.get(`${course.courseId}_${index}`) || 0
    }));
    
    return {
      ...course,
      skills: course.skills ? JSON.parse(course.skills) : [],
      prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
      settings: course.settings ? JSON.parse(course.settings) : {},
      timeSlots: enrichedTimeSlots
    };
  });
  
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
 * Create new course
 * POST /api/courses
 * Requires mentor or admin role
 */
async function handleCreateCourse(event, user) {
  // Check if user has permission to create courses (mentor or admin)
  if (!hasRole(user, ['mentor', 'admin'])) {
    return permissionError('Only mentors and admins can create courses');
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
  
  if (!courseResult.success || courseResult.data.length === 0) {
    return serverError('Failed to create course');
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
    message: 'Course created successfully'
  }, 201);
}

/**
 * Update course
 * PUT /api/courses?courseId=123
 * Requires course ownership or admin role
 */
async function handleUpdateCourse(event, user) {
  const queryParams = event.queryStringParameters || {};
  const courseId = queryParams.courseId;
  
  if (!courseId || isNaN(parseInt(courseId))) {
    return validationError('Valid courseId parameter is required');
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
  
  if (!updateResult.success || updateResult.data.length === 0) {
    return serverError('Failed to update course');
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
}

/**
 * Delete course
 * DELETE /api/courses?courseId=123
 * Admin only
 */
async function handleDeleteCourse(event, user) {
  // Check if user is admin
  if (!hasRole(user, ['admin'])) {
    return errorResponse('Admin access required', 403, 'ADMIN_REQUIRED');
  }

  // Get courseId from query parameters
  const queryParams = event.queryStringParameters || {};
  const courseId = queryParams.courseId;
  
  if (!courseId || !/^\d+$/.test(courseId)) {
    return validationError('Valid courseId parameter is required');
  }

  // Check if course exists
  const courseResult = await executeQuery(`
    SELECT course_id, title, mentor_id, status
    FROM courses 
    WHERE course_id = $1
    LIMIT 1
  `, [parseInt(courseId)]);
  
  if (!courseResult.success) {
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
    return serverError('Failed to delete course');
  }
  
  return successResponse({
    message: 'Course deleted successfully',
    courseId: course.course_id
  });
}