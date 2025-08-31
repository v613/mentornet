// Client-side ABAC service - uses API service
import { apiService } from './api.js';

// Simple user session management (replace with proper auth system)
let currentUserId = null;

export const abacService = {
  
  // Set current user for session management
  setCurrentUser(userId) {
    currentUserId = userId;
  },
  
  getCurrentUserId() {
    return currentUserId;
  },
  
  // Main policy evaluation function
  async evaluatePolicy(resource, action, environment = {}, userId = null) {
    try {
      const userIdToCheck = userId || currentUserId;
      if (!userIdToCheck) return false;

      const user = await this.getUserWithAttributes(userIdToCheck);
      if (!user) return false;

      const policy = {
        subject: {
          role: user.role,
          attributes: {
            experience: user.experience,
            skills: user.skills,
            location: user.location,
            department: user.department,
            mentoringCapacity: user.mentoringCapacity,
            canCreateCourses: user.canCreateCourses,
            permissions: user.permissions,
            adminLevel: user.adminLevel,
            availableForMentoring: user.availableForMentoring
          },
          id: user.id,
          currentLoad: user.currentLoad,
          email: user.email
        },
        resource: resource,
        action: action,
        environment: {
          time: new Date(),
          systemLoad: environment.systemLoad || 'normal',
          ...environment
        }
      };

      return this.applyPolicies(policy);
    } catch (error) {
      console.error('ABAC Policy Evaluation Error:', error);
      return false;
    }
  },

  // Get user with full attributes from API
  async getUserWithAttributes(userId) {
    try {
      const user = await apiService.getUserWithRoles();
      
      if (user) {
        const primaryRole = user.role; // Direct role field from users table
        
        return {
          id: user.id,
          role: primaryRole,
          attributes: {
            experience: 0,
            skills: [],
            location: '',
            department: '',
            mentoringCapacity: primaryRole === 'mentor' ? 5 : 0,
            canCreateCourses: primaryRole === 'mentor' || primaryRole === 'admin',
            permissions: primaryRole === 'admin' ? ['user_management', 'course_approval'] : [],
            adminLevel: primaryRole === 'admin' ? 'basic' : null,
            availableForMentoring: primaryRole === 'mentor'
          },
          currentLoad: 0,
          email: user.email
        };
      }
      
      return null;
    } catch (error) {
      console.error('💥 ABAC: Error fetching user:', error);
      return null;
    }
  },

  // Apply policy rules
  applyPolicies(policy) {
    const { subject, resource, action } = policy;

    // Route to specific policy checks based on resource type
    switch (resource.type) {
      case 'course':
        return this.evaluateCoursePolicy(subject, resource, action, policy.environment);
      case 'session':
        return this.evaluateSessionPolicy(subject, resource, action, policy.environment);
      case 'user':
        return this.evaluateUserPolicy(subject, resource, action, policy.environment);
      case 'application':
        return this.evaluateApplicationPolicy(subject, resource, action, policy.environment);
      case 'analytics':
        return this.evaluateAnalyticsPolicy(subject, resource, action, policy.environment);
      default:
        return false;
    }
  },

  // Course-specific policies
  evaluateCoursePolicy(subject, resource, action, environment) {
    switch (action) {
      case 'create':
        return this.canCreateCourse(subject);
      
      case 'read':
        return resource.data?.status === 'published' || 
               subject.id === resource.data?.creatorId ||
               subject.role === 'admin';
      
      case 'update':
        return subject.id === resource.data?.creatorId ||
               (subject.role === 'admin' && this.hasPermission(subject, 'course_approval'));
      
      case 'delete':
        return subject.role === 'admin' && this.hasPermission(subject, 'course_approval');
      
      case 'publish':
        return (subject.id === resource.data?.creatorId && subject.role === 'mentor') ||
               (subject.role === 'admin' && this.hasPermission(subject, 'course_approval'));
      
      default:
        return false;
    }
  },

  // Session-specific policies
  evaluateSessionPolicy(subject, resource, action, environment) {
    switch (action) {
      case 'create':
        return this.canCreateSession(subject, resource, environment);
      
      case 'read':
        return subject.id === resource.data?.mentorId ||
               subject.id === resource.data?.menteeId ||
               subject.role === 'admin';
      
      case 'update':
        return subject.id === resource.data?.mentorId ||
               subject.id === resource.data?.menteeId ||
               subject.role === 'admin';
      
      case 'cancel':
        return (subject.id === resource.data?.mentorId || 
                subject.id === resource.data?.menteeId) &&
               this.isSessionCancellable(resource.data, environment);
      
      case 'complete':
        return subject.id === resource.data?.mentorId &&
               resource.data?.status === 'in_progress';
      
      default:
        return false;
    }
  },

  // User management policies
  evaluateUserPolicy(subject, resource, action, environment) {
    switch (action) {
      case 'read':
        return this.canReadUserProfile(subject, resource);
      
      case 'update':
        return subject.id === resource.data?.id ||
               (subject.role === 'admin' && this.hasPermission(subject, 'user_management'));
      
      case 'promote':
        return subject.role === 'admin' && 
               this.hasPermission(subject, 'user_management') &&
               this.canPromoteToRole(subject, resource.data?.targetRole);
      
      case 'suspend':
        return subject.role === 'admin' && 
               this.hasPermission(subject, 'user_management') &&
               subject.id !== resource.data?.id; // Can't suspend self
      
      default:
        return false;
    }
  },

  // Application-specific policies
  evaluateApplicationPolicy(subject, resource, action, environment) {
    switch (action) {
      case 'create':
        return subject.attributes.availableForMentoring &&
               subject.role === 'mentee';
      
      case 'read':
        return subject.id === resource.data?.applicantId ||
               subject.id === resource.data?.courseCreatorId ||
               subject.role === 'admin';
      
      case 'approve':
      case 'reject':
        return subject.id === resource.data?.courseCreatorId ||
               (subject.role === 'admin' && this.hasPermission(subject, 'course_approval'));
      
      default:
        return false;
    }
  },

  // Helper policy functions
  canCreateCourse(subject) {
    return (subject.role === 'mentor' || subject.role === 'admin') &&
           subject.attributes.canCreateCourses &&
           subject.currentLoad <= subject.attributes.mentoringCapacity;
  },

  canCreateSession(subject, resource, environment) {
    // Must be either mentor or mentee in the session
    const isMentor = subject.id === resource.data?.mentorId;
    const isMentee = subject.id === resource.data?.menteeId;
    
    if (!isMentor && !isMentee) return false;
    
    // Mentors can always create sessions if they have capacity
    if (isMentor) {
      return subject.currentLoad < subject.attributes.mentoringCapacity;
    }
    
    // Mentees can create sessions if they're available
    if (isMentee) {
      return subject.attributes.availableForMentoring;
    }
    
    return false;
  },

  canReadUserProfile(subject, resource) {
    // Can always read own profile
    if (subject.id === resource.data?.id) return true;
    
    // Admins can read all profiles
    if (subject.role === 'admin') return true;
    
    // Check profile visibility settings
    const visibility = resource.data?.preferences?.profileVisibility || 'public';
    
    switch (visibility) {
      case 'public':
        return true;
      case 'mentors':
        return subject.role === 'mentor' || subject.role === 'admin';
      case 'private':
        return false;
      default:
        return false;
    }
  },

  canPromoteToRole(subject, targetRole) {
    // Super admins can promote to any role
    if (subject.attributes.adminLevel === 'super') return true;
    
    // Senior admins can promote to mentor
    if (subject.attributes.adminLevel === 'senior') {
      return targetRole === 'mentor';
    }
    
    // Basic admins can only promote mentee to mentor
    if (subject.attributes.adminLevel === 'basic') {
      return targetRole === 'mentor';
    }
    
    return false;
  },

  isSessionCancellable(sessionData, environment) {
    if (!sessionData.scheduledAt) return true;
    
    const scheduledTime = new Date(sessionData.scheduledAt);
    const now = environment.time || new Date();
    const hoursUntilSession = (scheduledTime - now) / (1000 * 60 * 60);
    
    // Can cancel if session is more than 24 hours away
    return hoursUntilSession > 24;
  },

  hasPermission(subject, permission) {
    return subject.attributes.permissions?.includes(permission) || false;
  },

  // High-level permission checks (these match the current API)
  async getUserRole(userId = null) {
    try {
      const userIdToCheck = userId || currentUserId;
      if (!userIdToCheck) return 'guest';

      const user = await this.getUserWithAttributes(userIdToCheck);
      return user?.role || 'mentee';
    } catch (error) {
      console.error('Error getting user role:', error);
      return 'guest';
    }
  },

  async canUserCreateCourse() {
    return await this.evaluatePolicy(
      { type: 'course' },
      'create'
    );
  },

  async canUserManageUsers() {
    return await this.evaluatePolicy(
      { type: 'user' },
      'promote'
    );
  },

  async canUserViewAnalytics(level = 'basic') {
    return await this.evaluatePolicy(
      { type: 'analytics' },
      level === 'basic' ? 'view_basic' : 'view_advanced'
    );
  },

  async canUserAccessCourse(courseId) {
    try {
      // Get course data from API
      const coursesResult = await apiService.getCourses(1, 10);
      if (coursesResult.success) {
        const course = coursesResult.courses.find(c => c.courseId === courseId);
        if (course) {
          return await this.evaluatePolicy(
            { type: 'course', data: { status: 'published', creatorId: course.mentorId } },
            'read'
          );
        }
      }
      return false;
    } catch (error) {
      console.error('💥 ABAC: Error checking course access:', error);
      return false;
    }
  },

  async canUserEditCourse(courseId) {
    try {
      // Get course data from API
      const coursesResult = await apiService.getCourses(1, 10);
      if (coursesResult.success) {
        const course = coursesResult.courses.find(c => c.courseId === courseId);
        if (course) {
          return await this.evaluatePolicy(
            { type: 'course', data: { creatorId: course.mentorId } },
            'update'
          );
        }
      }
      return false;
    } catch (error) {
      console.error('💥 ABAC: Error checking course edit permission:', error);
      return false;
    }
  },

  async canUserAccessSession(sessionId) {
    try {
      // TODO: Implement real session data retrieval when sessions table is available
      return false;
    } catch (error) {
      console.error('💥 ABAC: Error checking session access:', error);
      return false;
    }
  },

  // Context-aware permissions for UI
  async getPermissionContext(userId = null) {
    try {
      const userIdToCheck = userId || currentUserId;
      if (!userIdToCheck) {
        return {
          isAuthenticated: false,
          role: 'guest',
          permissions: []
        };
      }

      const user = await this.getUserWithAttributes(userIdToCheck);
      if (!user) {
        return {
          isAuthenticated: true,
          role: 'guest',
          permissions: []
        };
      }

      const permissions = [];
      
      // Check various permissions
      if (await this.canUserCreateCourse()) permissions.push('create_course');
      if (await this.canUserManageUsers()) permissions.push('manage_users');
      if (await this.canUserViewAnalytics()) permissions.push('view_analytics');
      if (await this.canUserViewAnalytics('advanced')) permissions.push('view_advanced_analytics');
      
      return {
        isAuthenticated: true,
        role: user.role,
        permissions: permissions,
        attributes: user.attributes,
        currentLoad: user.currentLoad,
        capacity: user.mentoringCapacity
      };
    } catch (error) {
      console.error('Error getting permission context:', error);
      return {
        isAuthenticated: false,
        role: 'guest',
        permissions: [],
        error: error.message
      };
    }
  }
};