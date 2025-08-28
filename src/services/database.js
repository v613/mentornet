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
      
      const userResult = await database(`
        SELECT id, userid, email, role, img, description, display_name as "displayName", is_blocked as "isBlocked", created_at as "createdAt"
        FROM users 
        WHERE id = $1 
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
      
      // Get paginated courses
      const courseResults = await database(`
        SELECT 
          c.course_id as "courseId",
          c.title,
          c.description,
          c.scheduled_time as "scheduledTime",
          c.created_at as "createdAt",
          u.email as "mentorEmail",
          c.mentor_id as "mentorId"
        FROM courses c
        LEFT JOIN users u ON c.mentor_id = u.id
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]);
      
      return { 
        success: true, 
        courses: courseResults,
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
      return { success: false, error: 'Failed to load courses' };
    }
  }
};