import { auth } from '../firebase.js'
import { databaseService } from './database.js'

class PermitService {
  constructor() {
    this.apiKey = import.meta.env.VITE_PERMIT_API_KEY
    this.baseUrl = 'https://api.permit.io'
    this.pdpUrl = 'https://cloudpdp.api.permit.io'
    this.enabled = !!this.apiKey
    
    if (!this.enabled) {
      console.warn('Permit.io integration disabled: VITE_PERMIT_API_KEY not configured')
    }
  }

  async makeApiCall(endpoint, method = 'GET', body = null) {
    try {
      const config = {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        }
      }

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body)
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, config)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API call failed: ${response.status} ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Permit.io API call failed:', error)
      throw error
    }
  }

  async syncUserToPermit(firebaseUser, userProfile = null) {
    if (!this.enabled) {
      return { success: false, error: 'Permit.io integration disabled' }
    }

    try {
      let profile = userProfile
      if (!profile) {
        const result = await databaseService.getUserProfile(firebaseUser.uid)
        profile = result.success ? result.user : null
      }

      const permitUser = {
        key: firebaseUser.uid,
        email: firebaseUser.email,
        first_name: firebaseUser.displayName?.split(' ')[0] || firebaseUser.email.split('@')[0],
        last_name: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        attributes: {
          firebase_uid: firebaseUser.uid,
          email_verified: firebaseUser.emailVerified,
          creation_time: firebaseUser.metadata.creationTime,
          last_sign_in: firebaseUser.metadata.lastSignInTime,
          ...(profile?.attributes || {})
        }
      }

      await this.makeApiCall('/v2/facts/users', 'POST', permitUser)
      console.log(`User ${firebaseUser.uid} synced to Permit.io`)

      if (profile?.role) {
        await this.assignRole(firebaseUser.uid, profile.role)
      }

      return { success: true, user: permitUser }
    } catch (error) {
      if (error.message?.includes('already exists') || error.message?.includes('409')) {
        return await this.updateUserInPermit(firebaseUser, userProfile)
      }
      console.error('Error syncing user to Permit.io:', error)
      return { success: false, error: error.message }
    }
  }

  async updateUserInPermit(firebaseUser, userProfile = null) {
    if (!this.enabled) {
      return { success: false, error: 'Permit.io integration disabled' }
    }

    try {
      let profile = userProfile
      if (!profile) {
        const result = await databaseService.getUserProfile(firebaseUser.uid)
        profile = result.success ? result.user : null
      }

      const updateData = {
        email: firebaseUser.email,
        first_name: firebaseUser.displayName?.split(' ')[0] || firebaseUser.email.split('@')[0],
        last_name: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        attributes: {
          firebase_uid: firebaseUser.uid,
          email_verified: firebaseUser.emailVerified,
          last_sign_in: firebaseUser.metadata.lastSignInTime,
          ...(profile?.attributes || {})
        }
      }

      await this.makeApiCall(`/v2/facts/users/${firebaseUser.uid}`, 'PATCH', updateData)
      console.log(`User ${firebaseUser.uid} updated in Permit.io`)

      if (profile?.role) {
        await this.assignRole(firebaseUser.uid, profile.role)
      }

      return { success: true, updated: true }
    } catch (error) {
      console.error('Error updating user in Permit.io:', error)
      return { success: false, error: error.message }
    }
  }

  async assignRole(userId, role) {
    if (!this.enabled) {
      return { success: false, error: 'Permit.io integration disabled' }
    }

    try {
      const roleMapping = {
        mentee: 'mentee',
        mentor: 'mentor', 
        admin: 'admin'
      }

      const permitRole = roleMapping[role] || 'mentee'
      
      await this.makeApiCall('/v2/facts/role_assignments', 'POST', {
        user: userId,
        role: permitRole,
        tenant: 'default'
      })

      console.log(`Role ${permitRole} assigned to user ${userId}`)
      return { success: true, role: permitRole }
    } catch (error) {
      console.error('Error assigning role:', error)
      return { success: false, error: error.message }
    }
  }

  async unassignRole(userId, role) {
    try {
      const roleMapping = {
        mentee: 'mentee',
        mentor: 'mentor',
        admin: 'admin'
      }

      const permitRole = roleMapping[role] || 'mentee'

      await this.makeApiCall(`/v2/facts/role_assignments/${userId}/${permitRole}`, 'DELETE')

      console.log(`Role ${permitRole} unassigned from user ${userId}`)
      return { success: true }
    } catch (error) {
      console.error('Error unassigning role:', error)
      return { success: false, error: error.message }
    }
  }

  async checkPermission(userId, action, resource) {
    if (!this.enabled) {
      return { success: false, allowed: false, error: 'Permit.io integration disabled' }
    }

    try {
      const response = await fetch(`${this.pdpUrl}/allowed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: { key: userId },
          action: action,
          resource: resource
        })
      })

      const result = await response.json()
      return { success: true, allowed: result.allow === true }
    } catch (error) {
      console.error('Error checking permission:', error)
      return { success: false, allowed: false, error: error.message }
    }
  }

  async syncAllFirebaseUsers() {
    if (!this.enabled) {
      return { success: false, error: 'Permit.io integration disabled' }
    }

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('No authenticated user')
      }

      const adminCheck = await databaseService.getUserProfile(currentUser.uid)
      if (!adminCheck.success || adminCheck.user.role !== 'admin') {
        throw new Error('Only admins can perform bulk sync')
      }

      const { getDocs, collection } = await import('firebase/firestore')
      const { db } = await import('../firebase.js')
      
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const results = []
      let successCount = 0
      let errorCount = 0

      console.log(`Starting migration of ${usersSnapshot.docs.length} users...`)

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data()
        
        console.log(`Migrating user: ${doc.id}`)
        
        const mockFirebaseUser = {
          uid: doc.id,
          email: userData.email || `${doc.id}@example.com`,
          displayName: userData.displayName || userData.email?.split('@')[0] || doc.id,
          emailVerified: userData.emailVerified !== false,
          metadata: {
            creationTime: userData.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
            lastSignInTime: userData.updatedAt?.toDate()?.toISOString() || new Date().toISOString()
          }
        }

        try {
          const result = await this.syncUserToPermit(mockFirebaseUser, userData)
          results.push({ 
            userId: doc.id, 
            email: userData.email,
            role: userData.role,
            ...result 
          })
          
          if (result.success) {
            successCount++
            console.log(`✅ User ${doc.id} migrated successfully`)
          } else {
            errorCount++
            console.log(`❌ User ${doc.id} failed: ${result.error}`)
          }
        } catch (syncError) {
          errorCount++
          const errorResult = { 
            userId: doc.id, 
            email: userData.email,
            role: userData.role,
            success: false, 
            error: syncError.message 
          }
          results.push(errorResult)
          console.log(`❌ User ${doc.id} failed: ${syncError.message}`)
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Migration completed. ${successCount} users migrated successfully, ${errorCount} failed`)
      
      return { 
        success: true, 
        results, 
        totalSynced: successCount,
        totalFailed: errorCount,
        totalProcessed: usersSnapshot.docs.length
      }
    } catch (error) {
      console.error('Error in bulk sync:', error)
      return { success: false, error: error.message }
    }
  }

  async migrateSpecificUser(userId) {
    if (!this.enabled) {
      return { success: false, error: 'Permit.io integration disabled' }
    }

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('No authenticated user')
      }

      const adminCheck = await databaseService.getUserProfile(currentUser.uid)
      if (!adminCheck.success || adminCheck.user.role !== 'admin') {
        throw new Error('Only admins can perform user migration')
      }

      const { getDoc, doc } = await import('firebase/firestore')
      const { db } = await import('../firebase.js')
      
      const userDoc = await getDoc(doc(db, 'users', userId))
      
      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found in Firebase`)
      }

      const userData = userDoc.data()
      const mockFirebaseUser = {
        uid: userId,
        email: userData.email || `${userId}@example.com`,
        displayName: userData.displayName || userData.email?.split('@')[0] || userId,
        emailVerified: userData.emailVerified !== false,
        metadata: {
          creationTime: userData.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
          lastSignInTime: userData.updatedAt?.toDate()?.toISOString() || new Date().toISOString()
        }
      }

      const result = await this.syncUserToPermit(mockFirebaseUser, userData)
      
      return {
        ...result,
        userId,
        email: userData.email,
        role: userData.role
      }
    } catch (error) {
      console.error(`Error migrating user ${userId}:`, error)
      return { success: false, error: error.message }
    }
  }

  async deleteUserFromPermit(userId) {
    try {
      await this.makeApiCall(`/v2/facts/users/${userId}`, 'DELETE')
      console.log(`User ${userId} deleted from Permit.io`)
      return { success: true }
    } catch (error) {
      console.error('Error deleting user from Permit.io:', error)
      return { success: false, error: error.message }
    }
  }

  async createResource(resourceKey, resourceType, attributes = {}) {
    try {
      const resource = {
        key: resourceKey,
        type: resourceType,
        attributes
      }

      await this.makeApiCall('/v2/facts/resources', 'POST', resource)
      console.log(`Resource ${resourceKey} created in Permit.io`)
      return { success: true, resource }
    } catch (error) {
      console.error('Error creating resource:', error)
      return { success: false, error: error.message }
    }
  }

  async initializeRolesAndPermissions() {
    try {
      const roles = [
        {
          key: 'mentee',
          name: 'Mentee',
          description: 'Students seeking mentorship',
          permissions: ['course:read', 'session:create', 'session:read', 'session:update', 'application:create']
        },
        {
          key: 'mentor', 
          name: 'Mentor',
          description: 'Experienced professionals providing mentorship',
          permissions: ['course:create', 'course:read', 'course:update', 'session:create', 'session:read', 'session:update', 'application:read', 'application:update']
        },
        {
          key: 'admin',
          name: 'Administrator', 
          description: 'System administrators with full access',
          permissions: ['*']
        }
      ]

      for (const role of roles) {
        try {
          await this.makeApiCall('/v2/schema/roles', 'POST', role)
          console.log(`Role ${role.key} created`)
        } catch (error) {
          if (error.message?.includes('already exists') || error.message?.includes('409')) {
            console.log(`Role ${role.key} already exists`)
          } else {
            console.error(`Error creating role ${role.key}:`, error)
          }
        }
      }

      return { success: true, message: 'Roles and permissions initialized' }
    } catch (error) {
      console.error('Error initializing roles:', error)
      return { success: false, error: error.message }
    }
  }
}

export const permitService = new PermitService()