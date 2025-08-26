import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '../firebase.js'
import { permitService } from './permit.js'
import { databaseService } from './database.js'

export const authService = {
  async signUp(email, password, username) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update user profile with display name
      await updateProfile(userCredential.user, {
        displayName: username
      })

      // Sync user to Permit.io immediately after Firebase creation
      try {
        await permitService.syncUserToPermit(userCredential.user)
      } catch (permitError) {
        console.error('Failed to sync user to Permit.io during signup:', permitError)
      }
      
      return { 
        success: true, 
        user: { 
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: username
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: this.getErrorMessage(error.code) 
      }
    }
  },

  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      return { 
        success: true, 
        user: { 
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName || email.split('@')[0]
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: this.getErrorMessage(error.code) 
      }
    }
  },

  async signOut() {
    try {
      await firebaseSignOut(auth)
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: this.getErrorMessage(error.code) 
      }
    }
  },

  // Auth state observer
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback)
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser
  },

  // Error message mapping
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'User not found. Please check your email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'Email is already registered. Please use a different email.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/invalid-credential': 'Invalid email or password. Please try again.'
    }
    
    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.'
  },

  // Get current user profile (add missing method)
  async getCurrentUserProfile() {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) return null
      
      const result = await databaseService.getUserProfile(currentUser.uid)
      return result.success ? result.user : null
    } catch (error) {
      console.error('Error getting current user profile:', error)
      return null
    }
  },

  // Utility functions for role checking
  async isAdmin(userId = null) {
    try {
      const user = userId ? 
        await databaseService.getUserProfile(userId) : 
        await this.getCurrentUserProfile()
      return user?.role === 'admin'
    } catch (error) {
      return false
    }
  },

  async isMentor(userId = null) {
    try {
      const user = userId ? 
        await databaseService.getUserProfile(userId) : 
        await this.getCurrentUserProfile()
      return ['mentor', 'admin'].includes(user?.role)
    } catch (error) {
      return false
    }
  },

  async getUserRole(userId = null) {
    try {
      const user = userId ? 
        await databaseService.getUserProfile(userId) : 
        await this.getCurrentUserProfile()
      return user?.role || 'mentee'
    } catch (error) {
      return 'mentee'
    }
  }
}