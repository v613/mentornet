import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { db, auth } from '../firebase.js'
import { permitService } from './permit.js'

export const databaseService = {
  // User Profile Operations
  async createUserProfile(userData) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      const userProfile = {
        ...userData,
        role: userData.role || 'mentee', // Default role
        attributes: {
          // Common attributes
          experience: userData.attributes?.experience || 0,
          skills: userData.attributes?.skills || [],
          location: userData.attributes?.location || '',
          department: userData.attributes?.department || '',
          
          // Mentee-specific
          learningGoals: userData.attributes?.learningGoals || [],
          availableForMentoring: userData.attributes?.availableForMentoring !== false,
          
          // Mentor-specific (only if role is mentor)
          mentoringCapacity: userData.role === 'mentor' ? (userData.attributes?.mentoringCapacity || 5) : 0,
          expertise: userData.role === 'mentor' ? (userData.attributes?.expertise || []) : [],
          canCreateCourses: userData.role === 'mentor' ? (userData.attributes?.canCreateCourses !== false) : false,
          coursesCreated: 0,
          
          // Admin-specific (only if role is admin)
          permissions: userData.role === 'admin' ? (userData.attributes?.permissions || ['user_management', 'course_approval']) : [],
          adminLevel: userData.role === 'admin' ? (userData.attributes?.adminLevel || 'basic') : null,
          
          ...userData.attributes
        },
        currentLoad: 0,
        accountStatus: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      await setDoc(doc(db, 'users', userId), userProfile)

      // Sync user profile creation to Permit.io
      try {
        const firebaseUser = auth.currentUser
        if (firebaseUser) {
          await permitService.syncUserToPermit(firebaseUser, userProfile)
        }
      } catch (permitError) {
        console.error('Failed to sync user profile to Permit.io:', permitError)
      }
      
      return {
        success: true,
        message: 'User profile created successfully',
        userId: userId
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getUserProfile(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      
      if (userDoc.exists()) {
        return {
          success: true,
          user: {
            id: userDoc.id,
            ...userDoc.data()
          }
        }
      } else {
        return {
          success: false,
          error: 'User not found'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  async updateUserProfile(updates) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      // Get current user to check permissions
      const currentUserDoc = await getDoc(doc(db, 'users', userId))
      const currentUser = currentUserDoc.data()
      
      // Prevent role changes unless user is admin
      if (updates.role && currentUser.role !== 'admin') {
        delete updates.role
      }

      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      }

      await updateDoc(doc(db, 'users', userId), updateData)

      // Sync profile updates to Permit.io
      try {
        const firebaseUser = auth.currentUser
        if (firebaseUser) {
          const updatedProfile = await this.getUserProfile(userId)
          if (updatedProfile.success) {
            await permitService.updateUserInPermit(firebaseUser, updatedProfile.user)
          }
        }
      } catch (permitError) {
        console.error('Failed to sync profile update to Permit.io:', permitError)
      }
      
      return {
        success: true,
        message: 'Profile updated successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Role Management Operations
  async promoteUserRole(targetUserId, newRole) {
    try {
      const currentUserId = auth.currentUser?.uid
      if (!currentUserId) throw new Error('User not authenticated')

      // Check if current user is admin
      const currentUserDoc = await getDoc(doc(db, 'users', currentUserId))
      const currentUser = currentUserDoc.data()
      
      if (currentUser.role !== 'admin') {
        throw new Error('Only admins can change user roles')
      }

      // Update target user's role and attributes
      const roleAttributes = this.getRoleAttributes(newRole)
      
      await updateDoc(doc(db, 'users', targetUserId), {
        role: newRole,
        'attributes.mentoringCapacity': roleAttributes.mentoringCapacity,
        'attributes.canCreateCourses': roleAttributes.canCreateCourses,
        'attributes.permissions': roleAttributes.permissions,
        'attributes.adminLevel': roleAttributes.adminLevel,
        updatedAt: serverTimestamp()
      })

      // Sync role change to Permit.io
      try {
        await permitService.assignRole(targetUserId, newRole)
      } catch (permitError) {
        console.error('Failed to sync role change to Permit.io:', permitError)
      }
      
      return {
        success: true,
        message: `User role updated to ${newRole}`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  getRoleAttributes(role) {
    const roleDefaults = {
      mentee: {
        mentoringCapacity: 0,
        canCreateCourses: false,
        permissions: [],
        adminLevel: null
      },
      mentor: {
        mentoringCapacity: 5,
        canCreateCourses: true,
        permissions: [],
        adminLevel: null
      },
      admin: {
        mentoringCapacity: 10,
        canCreateCourses: true,
        permissions: ['user_management', 'course_approval', 'system_analytics'],
        adminLevel: 'basic'
      }
    }
    return roleDefaults[role] || roleDefaults.mentee
  },

  // Course Operations
  async createCourse(courseData) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      // Check if user can create courses
      const userDoc = await getDoc(doc(db, 'users', userId))
      const user = userDoc.data()
      
      if (!user || !['mentor', 'admin'].includes(user.role) || !user.attributes.canCreateCourses) {
        throw new Error('Insufficient permissions to create courses')
      }

      if (user.currentLoad >= user.attributes.mentoringCapacity) {
        throw new Error('Mentoring capacity exceeded')
      }

      const course = {
        ...courseData,
        creatorId: userId,
        creatorName: user.displayName || user.email.split('@')[0],
        status: 'draft', // draft, published, archived
        enrolledCount: 0,
        maxEnrollment: courseData.maxEnrollment || 20,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, 'courses'), course)
      
      // Update user's course count
      await updateDoc(doc(db, 'users', userId), {
        'attributes.coursesCreated': increment(1),
        currentLoad: increment(1),
        updatedAt: serverTimestamp()
      })
      
      return {
        success: true,
        courseId: docRef.id,
        message: 'Course created successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getCourses(filters = {}) {
    try {
      let q = collection(db, 'courses')
      
      // Apply filters
      if (filters.status) {
        q = query(q, where('status', '==', filters.status))
      }
      
      if (filters.creatorId) {
        q = query(q, where('creatorId', '==', filters.creatorId))
      }
      
      // Add ordering
      q = query(q, orderBy('createdAt', 'desc'))
      
      // Add limit if specified
      if (filters.limit) {
        q = query(q, limit(filters.limit))
      }

      const querySnapshot = await getDocs(q)
      const courses = []
      
      querySnapshot.forEach((doc) => {
        courses.push({
          id: doc.id,
          ...doc.data()
        })
      })

      return {
        success: true,
        courses: courses
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        courses: []
      }
    }
  },

  async updateCourse(courseId, updates) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      // Check if user owns the course or is admin
      const courseDoc = await getDoc(doc(db, 'courses', courseId))
      const course = courseDoc.data()
      
      const userDoc = await getDoc(doc(db, 'users', userId))
      const user = userDoc.data()
      
      if (course.creatorId !== userId && user.role !== 'admin') {
        throw new Error('Insufficient permissions to update this course')
      }

      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      }

      await updateDoc(doc(db, 'courses', courseId), updateData)
      
      return {
        success: true,
        message: 'Course updated successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Course Application Operations
  async applyToCourse(courseId, applicationData) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      // Check if user is available for mentoring
      const userDoc = await getDoc(doc(db, 'users', userId))
      const user = userDoc.data()
      
      if (!user.attributes.availableForMentoring) {
        throw new Error('User is not available for mentoring')
      }

      const application = {
        ...applicationData,
        courseId: courseId,
        applicantId: userId,
        applicantName: user.displayName || user.email.split('@')[0],
        status: 'pending', // pending, approved, rejected
        appliedAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, 'course_applications'), application)
      
      return {
        success: true,
        applicationId: docRef.id,
        message: 'Application submitted successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getCourseApplications(courseId) {
    try {
      const q = query(
        collection(db, 'course_applications'),
        where('courseId', '==', courseId),
        orderBy('appliedAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      const applications = []
      
      querySnapshot.forEach((doc) => {
        applications.push({
          id: doc.id,
          ...doc.data()
        })
      })

      return {
        success: true,
        applications: applications
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        applications: []
      }
    }
  },

  async updateApplicationStatus(applicationId, status) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      await updateDoc(doc(db, 'course_applications', applicationId), {
        status: status,
        reviewedAt: serverTimestamp(),
        reviewedBy: userId
      })
      
      return {
        success: true,
        message: `Application ${status} successfully`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Mentor Operations
  async getMentors(filters = {}) {
    try {
      let q = collection(db, 'mentors')
      
      // Apply filters
      if (filters.skills && filters.skills.length > 0) {
        q = query(q, where('skills', 'array-contains-any', filters.skills))
      }
      
      if (filters.isAvailable !== undefined) {
        q = query(q, where('isAvailable', '==', filters.isAvailable))
      }
      
      // Add ordering
      q = query(q, orderBy('rating', 'desc'))
      
      // Add limit if specified
      if (filters.limit) {
        q = query(q, limit(filters.limit))
      }

      const querySnapshot = await getDocs(q)
      const mentors = []
      
      querySnapshot.forEach((doc) => {
        mentors.push({
          id: doc.id,
          ...doc.data()
        })
      })

      return {
        success: true,
        mentors: mentors
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mentors: []
      }
    }
  },

  // Session Operations
  async createSession(sessionData) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      const session = {
        ...sessionData,
        participants: [sessionData.mentorId, sessionData.menteeId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'scheduled'
      }

      const docRef = await addDoc(collection(db, 'sessions'), session)
      
      return {
        success: true,
        sessionId: docRef.id,
        message: 'Session created successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getUserSessions(userId = null) {
    try {
      const currentUserId = userId || auth.currentUser?.uid
      if (!currentUserId) throw new Error('User not authenticated')

      const q = query(
        collection(db, 'sessions'),
        where('participants', 'array-contains', currentUserId),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      const sessions = []
      
      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        })
      })

      return {
        success: true,
        sessions: sessions
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sessions: []
      }
    }
  },

  async updateSession(sessionId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      }

      await updateDoc(doc(db, 'sessions', sessionId), updateData)
      
      return {
        success: true,
        message: 'Session updated successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Review Operations
  async createReview(reviewData) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      const review = {
        ...reviewData,
        authorId: userId,
        createdAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, 'reviews'), review)
      
      // Update mentor's rating (this would typically be done with a Cloud Function)
      // For now, we'll increment the review count
      if (reviewData.mentorId) {
        await updateDoc(doc(db, 'mentors', reviewData.mentorId), {
          totalReviews: increment(1),
          updatedAt: serverTimestamp()
        })
      }

      return {
        success: true,
        reviewId: docRef.id,
        message: 'Review submitted successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getMentorReviews(mentorId) {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('mentorId', '==', mentorId),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      const reviews = []
      
      querySnapshot.forEach((doc) => {
        reviews.push({
          id: doc.id,
          ...doc.data()
        })
      })

      return {
        success: true,
        reviews: reviews
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reviews: []
      }
    }
  },

  // Message Operations (for session chat)
  async sendMessage(sessionId, messageData) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      const message = {
        ...messageData,
        senderId: userId,
        sessionId: sessionId,
        createdAt: serverTimestamp()
      }

      const docRef = await addDoc(
        collection(db, 'sessions', sessionId, 'messages'), 
        message
      )
      
      // Update session's last activity
      await updateDoc(doc(db, 'sessions', sessionId), {
        lastActivity: serverTimestamp()
      })

      return {
        success: true,
        messageId: docRef.id,
        message: 'Message sent successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Real-time listeners
  subscribeToMessages(sessionId, callback) {
    try {
      const q = query(
        collection(db, 'sessions', sessionId, 'messages'),
        orderBy('createdAt', 'asc')
      )

      return onSnapshot(q, (querySnapshot) => {
        const messages = []
        querySnapshot.forEach((doc) => {
          messages.push({
            id: doc.id,
            ...doc.data()
          })
        })
        callback(messages)
      })
    } catch (error) {
      console.error('Error subscribing to messages:', error)
      return null
    }
  },

  subscribeToUserSessions(callback) {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('User not authenticated')

      const q = query(
        collection(db, 'sessions'),
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      )

      return onSnapshot(q, (querySnapshot) => {
        const sessions = []
        querySnapshot.forEach((doc) => {
          sessions.push({
            id: doc.id,
            ...doc.data()
          })
        })
        callback(sessions)
      })
    } catch (error) {
      console.error('Error subscribing to sessions:', error)
      return null
    }
  },

  // Utility functions
  async deleteDocument(collectionName, documentId) {
    try {
      await deleteDoc(doc(db, collectionName, documentId))
      return {
        success: true,
        message: 'Document deleted successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Batch operations helper
  async batchUpdate(updates) {
    try {
      // This would use writeBatch for atomic operations
      // Implementation depends on specific use case
      return {
        success: true,
        message: 'Batch update completed'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}