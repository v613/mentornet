// Client-side database service using direct database connection
import { neon } from '@neondatabase/serverless';

// Simple user session management 
let currentUserId = null;
let db = null;

async function getDb() {
  if (!db) {
    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
    }
    
    db = neon(connectionString);
  }
  return db;
}

export const databaseService = {
  
  // Authentication helpers
  setCurrentUser(userId) {
    currentUserId = userId;
  },
  
  getCurrentUserId() {
    return currentUserId;
  },

  // Authentication using direct database connection
  async authenticateUser(userid, password, translateFn = null) {
    try {
      const database = await getDb();
      
      // Authenticate user with encrypted password
      const result = await database(`
        SELECT 1 
        FROM users 
        WHERE userid = $1 
        AND pwd = crypt($2, pwd)
      `, [userid, password]);
      
      if (result.length > 0) {
        // Get user details after successful authentication
        const userResult = await database(`
          SELECT id, userid, email, role, is_blocked as "isBlocked", display_name as "displayName"
          FROM users 
          WHERE userid = $1 
          LIMIT 1
        `, [userid]);
        
        if (userResult.length > 0 && !userResult[0].isBlocked) {
          this.setCurrentUser(userResult[0].id);
          return {
            success: true,
            user: userResult[0]
          };
        } else {
          return {
            success: false,
            error: translateFn ? translateFn('auth.errors.userBlocked') : 'User is blocked',
            errorCode: 'auth.errors.userBlocked'
          };
        }
      } else {
        return {
          success: false,
          error: translateFn ? translateFn('auth.errors.invalidCredentials') : 'Invalid credentials',
          errorCode: 'auth.errors.invalidCredentials'
        };
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return { 
        success: false, 
        error: translateFn ? translateFn('auth.errors.authenticationFailed') : 'Authentication failed',
        errorCode: 'auth.errors.authenticationFailed'
      };
    }
  },

  // User registration using direct database connection
  async registerUser(userid, email, password, translateFn = null) {
    try {
      const database = await getDb();
      
      // Check if user already exists
      const existingUser = await database(`
        SELECT 1 FROM users WHERE userid = $1 LIMIT 1
      `, [userid]);
        
      if (existingUser.length > 0) {
        return {
          success: false,
          error: translateFn ? translateFn('auth.errors.userExists') : 'User already exists',
          errorCode: 'auth.errors.userExists'
        };
      }
      
      // Insert new user with encrypted password
      const newUser = await database(`
        INSERT INTO users (userid, email, pwd, role) 
        VALUES ($1, $2, crypt($3, gen_salt('bf')), 'mentee')
        RETURNING id, userid, email, role
      `, [userid, email, password]);
      
      if (newUser.length > 0) {
        return {
          success: true,
          user: newUser[0]
        };
      } else {
        return {
          success: false,
          error: translateFn ? translateFn('auth.errors.registrationFailed') : 'Registration failed',
          errorCode: 'auth.errors.registrationFailed'
        };
      }
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return {
          success: false,
          error: translateFn ? translateFn('auth.errors.emailExists') : 'Email already exists',
          errorCode: 'auth.errors.emailExists'
        };
      }
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: translateFn ? translateFn('auth.errors.registrationFailed') : 'Registration failed',
        errorCode: 'auth.errors.registrationFailed'
      };
    }
  },

  // Get user profile using direct database connection
  async getUserWithRoles(userId) {
    try {
      const database = await getDb();
      
      // Check if userId is a UUID (contains hyphens) or a userid string
      const isUuid = userId.includes('-');
      const field = isUuid ? 'id' : 'userid';
      
      const userResult = await database(`
        SELECT id, userid, email, role, img, description, display_name as "displayName", is_blocked as "isBlocked", created_at as "createdAt"
        FROM users 
        WHERE ${field} = $1 
        LIMIT 1
      `, [userId]);
      
      if (userResult.length > 0) {
        return userResult[0];
      } else {
        return null;
      }
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  },

  // Update user profile
  async updateUserProfile(userId, updateData) {
    try {
      const database = await getDb();
      
      const result = await database(`
        UPDATE users 
        SET 
          display_name = $2,
          img = $3,
          description = $4
        WHERE id = $1 
        RETURNING id, display_name as "displayName", img, description
      `, [
        userId,
        updateData.displayName,
        updateData.profileImage,
        updateData.description
      ]);
      
      if (result.length > 0) {
        return {
          success: true,
          user: result[0]
        };
      } else {
        return {
          success: false,
          error: 'User not found or update failed'
        };
      }
    } catch (error) {
      console.error('Update user profile error:', error);
      return {
        success: false,
        error: 'Failed to update profile'
      };
    }
  },

  // Change user password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const database = await getDb();
      
      // First verify current password
      const verifyResult = await database(`
        SELECT 1 
        FROM users 
        WHERE id = $1 
        AND pwd = crypt($2, pwd)
      `, [userId, currentPassword]);
      
      if (verifyResult.length === 0) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }
      
      // Update password with new encrypted password
      const updateResult = await database(`
        UPDATE users 
        SET 
          pwd = crypt($2, gen_salt('bf')),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 
        RETURNING id
      `, [userId, newPassword]);
      
      if (updateResult.length > 0) {
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: 'Failed to update password'
        };
      }
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: 'Failed to change password'
      };
    }
  },

  // Get all mentors (including new fields)
  async getMentors() {
    try {
      const database = await getDb();
      
      // Get all mentors with their profile data
      const mentors = await database(`
        SELECT 
          id, 
          userid, 
          email, 
          img, 
          display_name as "displayName", 
          description,
          created_at as "createdAt"
        FROM users 
        WHERE role = 'mentor'
        ORDER BY display_name ASC, created_at DESC
      `);
      
      return {
        success: true,
        mentors: mentors
      };
    } catch (error) {
      console.error('Get mentors error:', error);
      return {
        success: false,
        error: 'Failed to fetch mentors'
      };
    }
  },

  // Get mentor image separately to avoid large response
  async getMentorImage(mentorId) {
    try {
      const database = await getDb();
      
      const result = await database(`
        SELECT img FROM users WHERE id = $1 AND role = 'mentor'
      `, [mentorId]);
      
      return {
        success: true,
        img: result[0]?.img || null
      };
    } catch (error) {
      console.error('Get mentor image error:', error);
      return {
        success: false,
        error: 'Failed to fetch mentor image'
      };
    }
  },

  // Get courses with pagination
  async getCourses(page = 1, pageSize = 10) {
    try {
      const database = await getDb();
      const offset = (page - 1) * pageSize;
      
      // Get total count
      const countResult = await database(`
        SELECT COUNT(*) as total FROM courses
      `);
      const total = parseInt(countResult[0]?.total || 0);
      
      // Get paginated courses with enrollment count
      const courseResults = await database(`
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
          u.email as "mentorEmail",
          c.mentor_id as "mentorId",
          u.display_name as "creatorName",
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
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]);
      
      // Process JSON fields
      const processedCourses = courseResults.map(course => ({
        ...course,
        skills: course.skills ? JSON.parse(course.skills) : [],
        prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
        settings: course.settings ? JSON.parse(course.settings) : {},
        timeSlots: course.timeSlots ? JSON.parse(course.timeSlots) : []
      }));

      return { 
        success: true, 
        courses: processedCourses,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: offset + pageSize < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get courses error:', error);
      return { success: false, error: 'courses.messages.loadFailed' };
    }
  },

  // Create a new course
  async createCourse(courseData) {
    try {
      const database = await getDb();
      
      const result = await database(`
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
        RETURNING course_id as "courseId"
      `, [
        currentUserId,
        courseData.title,
        courseData.description,
        courseData.category || null,
        courseData.level || null,
        courseData.duration || 8,
        courseData.maxEnrollment || 20,
        courseData.objectives || null,
        courseData.prerequisites ? JSON.stringify(courseData.prerequisites) : null,
        courseData.skills ? JSON.stringify(courseData.skills) : null,
        courseData.settings ? JSON.stringify(courseData.settings) : null,
        courseData.status || 'draft',
        courseData.timeSlots ? JSON.stringify(courseData.timeSlots) : null
      ]);
      
      if (result.length > 0) {
        return { 
          success: true, 
          courseId: result[0].courseId,
          message: 'courses.messages.courseCreated'
        };
      } else {
        return { success: false, error: 'courses.messages.createFailed' };
      }
    } catch (error) {
      console.error('Create course error:', error);
      return { success: false, error: 'courses.messages.createError', details: error.message };
    }
  },

  async getCourseApplications(courseId) {
    try {
      const database = await getDb();
      
      const applications = await database(`
        SELECT 
          s.subscription_id as "id",
          COALESCE(u.display_name, u.email, u.userid) as "applicantName",
          u.userid as "applicantId",
          s.subscribed_at as "appliedAt",
          s.status,
          s.motivation,
          s.experience
        FROM subscriptions s
        LEFT JOIN users u ON s.mentee_id = u.id
        WHERE s.course_id = $1
        ORDER BY s.subscribed_at DESC
      `, [courseId]);
      
      return { 
        success: true, 
        applications: applications 
      };
    } catch (error) {
      console.error('Get course applications error:', error);
      return { success: false, error: 'courses.messages.loadApplicationsFailed' };
    }
  },

  async updateApplicationStatus(applicationId, status) {
    try {
      const database = await getDb();
      
      const result = await database(`
        UPDATE subscriptions 
        SET status = $1
        WHERE subscription_id = $2
        RETURNING subscription_id as "id", status
      `, [status, applicationId]);
      
      if (result.length > 0) {
        return { 
          success: true,
          application: result[0],
          message: 'courses.messages.applicationUpdated'
        };
      } else {
        return { success: false, error: 'courses.messages.applicationNotFound' };
      }
    } catch (error) {
      console.error('Update application status error:', error);
      return { success: false, error: 'courses.messages.updateApplicationFailed' };
    }
  },

  async applyToCourse(courseId, applicationData) {
    try {
      const database = await getDb();
      
      const existingApplication = await database(`
        SELECT 1 FROM subscriptions WHERE course_id = $1 AND mentee_id = $2
      `, [courseId, currentUserId]);
      
      if (existingApplication.length > 0) {
        return {
          success: false,
          error: 'courses.messages.alreadyApplied'
        };
      }
      
      const result = await database(`
        INSERT INTO subscriptions (course_id, mentee_id, status, motivation, experience, subscribed_at)
        VALUES ($1, $2, 'pending', $3, $4, NOW())
        RETURNING subscription_id as "subscriptionId"
      `, [courseId, currentUserId, applicationData.motivation, applicationData.experience]);
      
      if (result.length > 0) {
        return { 
          success: true,
          subscriptionId: result[0].subscriptionId
        };
      } else {
        return { success: false, error: 'courses.messages.applyFailed' };
      }
    } catch (error) {
      console.error('Apply to course error:', error);
      return { success: false, error: 'courses.messages.applyError' };
    }
  },

  async getMenteeEnrolledCourses(menteeId) {
    try {
      const database = await getDb();
      
      const enrolledCourses = await database(`
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
      `, [menteeId]);
      
      // Process JSON fields
      const processedCourses = enrolledCourses.map(course => ({
        ...course,
        skills: course.skills ? JSON.parse(course.skills) : [],
        prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
        settings: course.settings ? JSON.parse(course.settings) : {},
        timeSlots: course.timeSlots ? JSON.parse(course.timeSlots) : []
      }));

      return { 
        success: true, 
        courses: processedCourses
      };
    } catch (error) {
      console.error('Get mentee enrolled courses error:', error);
      return { success: false, error: 'courses.messages.loadFailed' };
    }
  },

  async updateCourse(courseId, updates) {
    try {
      const database = await getDb();
      
      const setParts = [];
      const values = [];
      let valueIndex = 1;

      if (updates.title !== undefined) {
        setParts.push(`title = $${valueIndex++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        setParts.push(`description = $${valueIndex++}`);
        values.push(updates.description);
      }
      if (updates.category !== undefined) {
        setParts.push(`category = $${valueIndex++}`);
        values.push(updates.category);
      }
      if (updates.level !== undefined) {
        setParts.push(`level = $${valueIndex++}`);
        values.push(updates.level);
      }
      if (updates.duration !== undefined) {
        setParts.push(`duration = $${valueIndex++}`);
        values.push(updates.duration);
      }
      if (updates.maxEnrollment !== undefined) {
        setParts.push(`max_enrollment = $${valueIndex++}`);
        values.push(updates.maxEnrollment);
      }
      if (updates.objectives !== undefined) {
        setParts.push(`objectives = $${valueIndex++}`);
        values.push(updates.objectives);
      }
      if (updates.prerequisites !== undefined) {
        setParts.push(`prerequisites = $${valueIndex++}`);
        values.push(Array.isArray(updates.prerequisites) ? JSON.stringify(updates.prerequisites) : updates.prerequisites);
      }
      if (updates.skills !== undefined) {
        setParts.push(`skills = $${valueIndex++}`);
        values.push(Array.isArray(updates.skills) ? JSON.stringify(updates.skills) : updates.skills);
      }
      if (updates.settings !== undefined) {
        setParts.push(`settings = $${valueIndex++}`);
        values.push(typeof updates.settings === 'object' ? JSON.stringify(updates.settings) : updates.settings);
      }
      if (updates.status !== undefined) {
        setParts.push(`status = $${valueIndex++}`);
        values.push(updates.status);
      }
      if (updates.timeSlots !== undefined) {
        setParts.push(`time_slots = $${valueIndex++}`);
        values.push(Array.isArray(updates.timeSlots) ? JSON.stringify(updates.timeSlots) : updates.timeSlots);
      }

      if (setParts.length === 0) {
        return { success: false, error: 'courses.messages.noUpdatesProvided' };
      }

      values.push(courseId);
      
      const result = await database(`
        UPDATE courses 
        SET ${setParts.join(', ')}
        WHERE course_id = $${valueIndex}
        RETURNING course_id as "courseId", title, description, category, level, duration, max_enrollment as "maxEnrollment", objectives, prerequisites, skills, settings, status, time_slots as "timeSlots", created_at as "createdAt"
      `, values);

      if (result.length > 0) {
        const updatedCourse = result[0];
        return {
          success: true,
          course: {
            ...updatedCourse,
            skills: updatedCourse.skills ? JSON.parse(updatedCourse.skills) : [],
            prerequisites: updatedCourse.prerequisites ? JSON.parse(updatedCourse.prerequisites) : [],
            settings: updatedCourse.settings ? JSON.parse(updatedCourse.settings) : {},
            timeSlots: updatedCourse.timeSlots ? JSON.parse(updatedCourse.timeSlots) : []
          }
        };
      } else {
        return { success: false, error: 'courses.messages.courseNotFound' };
      }
    } catch (error) {
      console.error('Update course error:', error);
      return { success: false, error: 'courses.messages.updateFailed' };
    }
  }
};