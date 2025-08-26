import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../firebase.js'

export const abacService = {
  
  // Main policy evaluation function
  async evaluatePolicy(resource, action, environment = {}) {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) return false

      const user = await this.getUserWithAttributes(currentUser.uid)
      if (!user) return false

      const policy = {
        subject: {
          role: user.role,
          attributes: user.attributes,
          id: user.uid,
          currentLoad: user.currentLoad
        },
        resource: resource,
        action: action,
        environment: {
          time: new Date(),
          systemLoad: environment.systemLoad || 'normal',
          ...environment
        }
      }

      return this.applyPolicies(policy)
    } catch (error) {
      console.error('ABAC Policy Evaluation Error:', error)
      return false
    }
  },

  // Get user with full attributes
  async getUserWithAttributes(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) return null
      
      return {
        id: userDoc.id,
        ...userDoc.data()
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  },

  // Apply policy rules
  applyPolicies(policy) {
    const { subject, resource, action } = policy

    // Route to specific policy checks based on resource type
    switch (resource.type) {
      case 'course':
        return this.evaluateCoursePolicy(subject, resource, action, policy.environment)
      case 'session':
        return this.evaluateSessionPolicy(subject, resource, action, policy.environment)
      case 'user':
        return this.evaluateUserPolicy(subject, resource, action, policy.environment)
      case 'application':
        return this.evaluateApplicationPolicy(subject, resource, action, policy.environment)
      case 'analytics':
        return this.evaluateAnalyticsPolicy(subject, resource, action, policy.environment)
      default:
        return false
    }
  },

  // Course-specific policies
  evaluateCoursePolicy(subject, resource, action, environment) {
    switch (action) {
      case 'create':
        return this.canCreateCourse(subject)
      
      case 'read':
        return resource.data?.status === 'published' || 
               subject.id === resource.data?.creatorId ||
               subject.role === 'admin'
      
      case 'update':
        return subject.id === resource.data?.creatorId ||
               (subject.role === 'admin' && this.hasPermission(subject, 'course_approval'))
      
      case 'delete':
        return subject.role === 'admin' && this.hasPermission(subject, 'course_approval')
      
      default:
        return false
    }
  },

  // Session-specific policies
  evaluateSessionPolicy(subject, resource, action, environment) {
    switch (action) {
      case 'create':
        return this.canScheduleSession(subject, resource.data, environment)
      
      case 'read':
        return resource.data?.participants?.includes(subject.id) ||
               subject.role === 'admin'
      
      case 'update':
        if (resource.data?.participants?.includes(subject.id)) {
          // Participants can update limited fields
          return !this.hasRestrictedFields(resource.updates, ['participants', 'creatorId'])
        }
        return subject.id === resource.data?.creatorId || subject.role === 'admin'
      
      case 'delete':
        return subject.id === resource.data?.creatorId || subject.role === 'admin'
      
      default:
        return false
    }
  },

  // User-specific policies
  evaluateUserPolicy(subject, resource, action, environment) {
    switch (action) {
      case 'read':
        return subject.id === resource.userId ||
               subject.role === 'admin' ||
               (subject.role === 'mentor' && this.canAccessMenteeProfile(subject, resource))
      
      case 'update':
        if (subject.id === resource.userId) {
          // Users can't change their own role (unless admin)
          return subject.role === 'admin' || !resource.updates?.role
        }
        return subject.role === 'admin' && this.hasPermission(subject, 'user_management')
      
      case 'delete':
        return subject.role === 'admin' && this.hasPermission(subject, 'user_management')
      
      default:
        return false
    }
  },

  // Application-specific policies
  evaluateApplicationPolicy(subject, resource, action, environment) {
    switch (action) {
      case 'create':
        return subject.attributes.availableForMentoring === true &&
               ['mentee', 'mentor', 'admin'].includes(subject.role)
      
      case 'read':
        return subject.id === resource.data?.applicantId ||
               subject.id === resource.data?.courseCreatorId ||
               subject.role === 'admin'
      
      case 'update':
        return subject.id === resource.data?.courseCreatorId ||
               (subject.role === 'admin' && this.hasPermission(subject, 'course_approval'))
      
      default:
        return false
    }
  },

  // Analytics-specific policies
  evaluateAnalyticsPolicy(subject, resource, action, environment) {
    if (subject.role !== 'admin') return false
    
    switch (action) {
      case 'read':
        return this.hasPermission(subject, 'system_analytics')
      
      case 'write':
        return this.hasPermission(subject, 'system_config')
      
      default:
        return false
    }
  },

  // Helper policy functions
  canCreateCourse(subject) {
    return ['mentor', 'admin'].includes(subject.role) &&
           subject.attributes.canCreateCourses === true &&
           subject.currentLoad < subject.attributes.mentoringCapacity
  },

  canScheduleSession(subject, sessionData, environment) {
    if (!['mentor', 'admin'].includes(subject.role)) return false
    if (subject.currentLoad >= subject.attributes.mentoringCapacity) return false
    
    // Check if scheduled time is in the future
    const scheduledTime = new Date(sessionData.scheduledAt)
    if (scheduledTime <= environment.time) return false
    
    // Check working hours (9 AM to 5 PM)
    return this.isWithinWorkingHours(scheduledTime)
  },

  canAccessMenteeProfile(mentor, resource) {
    // Mentors can access profiles of their assigned mentees
    // This would require additional relationship data
    return false // Placeholder - implement based on mentor-mentee relationships
  },

  hasPermission(subject, permission) {
    return subject.attributes.permissions?.includes(permission) || false
  },

  hasRestrictedFields(updates, restrictedFields) {
    if (!updates || typeof updates !== 'object') return false
    return restrictedFields.some(field => updates.hasOwnProperty(field))
  },

  isWithinWorkingHours(date) {
    const hour = date.getHours()
    return hour >= 9 && hour <= 17 // 9 AM to 5 PM
  },

  // Convenience methods for common checks
  async canUserCreateCourse(userId = null) {
    const user = await this.getUserWithAttributes(userId || auth.currentUser?.uid)
    return user ? this.canCreateCourse(user) : false
  },

  async canUserManageUsers(userId = null) {
    const user = await this.getUserWithAttributes(userId || auth.currentUser?.uid)
    return user?.role === 'admin' && this.hasPermission(user, 'user_management')
  },

  async canUserAccessAnalytics(userId = null) {
    const user = await this.getUserWithAttributes(userId || auth.currentUser?.uid)
    return user?.role === 'admin' && this.hasPermission(user, 'system_analytics')
  },

  async getUserRole(userId = null) {
    const user = await this.getUserWithAttributes(userId || auth.currentUser?.uid)
    return user?.role || 'mentee'
  },

  // Policy validation for UI components
  async validateUIAction(resourceType, action, resourceData = {}) {
    return await this.evaluatePolicy(
      { type: resourceType, data: resourceData },
      action
    )
  },

  // Batch policy evaluation for multiple resources
  async evaluateMultiplePolicies(policies) {
    const results = await Promise.all(
      policies.map(policy => 
        this.evaluatePolicy(policy.resource, policy.action, policy.environment)
      )
    )
    
    return policies.map((policy, index) => ({
      ...policy,
      allowed: results[index]
    }))
  }
}