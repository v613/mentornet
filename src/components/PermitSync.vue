<template>
  <div class="permit-sync-container">
    <div class="section-header">
      <h3>Permit.io Integration</h3>
      <p class="description">Manage user synchronization between Firebase and Permit.io</p>
    </div>

    <div class="sync-actions">
      <div class="action-card">
        <h4>Individual User Sync</h4>
        <p>Sync current user to Permit.io</p>
        <button 
          @click="syncCurrentUser" 
          :disabled="loading"
          class="sync-btn primary"
        >
          {{ loading ? 'Syncing...' : 'Sync Current User' }}
        </button>
      </div>

      <div class="action-card" v-if="isAdmin">
        <h4>Migrate All Users</h4>
        <p>Migrate all Firebase users to Permit.io (Admin only)</p>
        <button 
          @click="migrateAllUsers" 
          :disabled="loading"
          class="sync-btn secondary"
        >
          {{ loading ? 'Migrating...' : 'Migrate All Users' }}
        </button>
      </div>

      <div class="action-card" v-if="isAdmin">
        <h4>Migrate Specific User</h4>
        <div class="input-group">
          <input 
            v-model="specificUserId"
            type="text" 
            placeholder="Enter User ID"
            :disabled="loading"
            class="user-input"
          />
          <button 
            @click="migrateSpecificUser" 
            :disabled="loading || !specificUserId.trim()"
            class="sync-btn primary small"
          >
            {{ loading ? 'Migrating...' : 'Migrate User' }}
          </button>
        </div>
      </div>

      <div class="action-card" v-if="isAdmin">
        <h4>Initialize Roles & Permissions</h4>
        <p>Set up role hierarchy in Permit.io</p>
        <button 
          @click="initializeRoles" 
          :disabled="loading"
          class="sync-btn tertiary"
        >
          {{ loading ? 'Initializing...' : 'Initialize Roles' }}
        </button>
      </div>
    </div>

    <div v-if="migrationProgress" class="migration-progress">
      <h4>Migration Summary</h4>
      <div class="progress-stats">
        <div class="stat success">
          <span class="stat-number">{{ migrationProgress.success }}</span>
          <span class="stat-label">Migrated</span>
        </div>
        <div class="stat error">
          <span class="stat-number">{{ migrationProgress.failed }}</span>
          <span class="stat-label">Failed</span>
        </div>
        <div class="stat total">
          <span class="stat-number">{{ migrationProgress.total }}</span>
          <span class="stat-label">Total</span>
        </div>
      </div>
      
      <div v-if="migrationProgress.results && migrationProgress.results.length > 0" class="migration-details">
        <h5>Migration Details</h5>
        <div class="user-list">
          <div v-for="user in migrationProgress.results" :key="user.userId" class="user-item" :class="{ success: user.success, error: !user.success }">
            <div class="user-info">
              <strong>{{ user.email || user.userId }}</strong>
              <span class="role-badge">{{ user.role || 'mentee' }}</span>
            </div>
            <div class="user-status">
              {{ user.success ? '✅' : '❌' }}
              <span v-if="!user.success" class="error-msg">{{ user.error }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="result" class="result-container" :class="result.type">
      <h4>{{ result.type === 'success' ? 'Success' : 'Error' }}</h4>
      <p>{{ result.message }}</p>
      <div v-if="result.details && !migrationProgress" class="result-details">
        <pre>{{ JSON.stringify(result.details, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { authService } from '../services/auth.js'
import { permitService } from '../services/permit.js'

const loading = ref(false)
const result = ref(null)
const isAdmin = ref(false)
const specificUserId = ref('')
const migrationProgress = ref(null)

onMounted(async () => {
  isAdmin.value = await authService.isAdmin()
})

const syncCurrentUser = async () => {
  loading.value = true
  result.value = null
  
  try {
    const currentUser = await authService.getCurrentUser()
    if (!currentUser) {
      throw new Error('No authenticated user found')
    }

    const profile = await authService.getCurrentUserProfile()
    const syncResult = await permitService.syncUserToPermit(currentUser, profile)
    
    result.value = {
      type: syncResult.success ? 'success' : 'error',
      message: syncResult.success ? 
        'User successfully synced to Permit.io' : 
        `Sync failed: ${syncResult.error}`,
      details: syncResult
    }
  } catch (error) {
    result.value = {
      type: 'error',
      message: `Error: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}

const migrateAllUsers = async () => {
  if (!isAdmin.value) {
    result.value = {
      type: 'error', 
      message: 'Only administrators can perform bulk migration'
    }
    return
  }

  loading.value = true
  result.value = null
  migrationProgress.value = null
  
  try {
    const migrationResult = await permitService.syncAllFirebaseUsers()
    
    result.value = {
      type: migrationResult.success ? 'success' : 'error',
      message: migrationResult.success ? 
        `Migration completed! ${migrationResult.totalSynced} users migrated successfully` +
        (migrationResult.totalFailed > 0 ? `, ${migrationResult.totalFailed} failed` : '') : 
        `Migration failed: ${migrationResult.error}`,
      details: migrationResult
    }

    if (migrationResult.success) {
      migrationProgress.value = {
        total: migrationResult.totalProcessed,
        success: migrationResult.totalSynced,
        failed: migrationResult.totalFailed,
        results: migrationResult.results
      }
    }
  } catch (error) {
    result.value = {
      type: 'error',
      message: `Migration error: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}

const migrateSpecificUser = async () => {
  if (!isAdmin.value) {
    result.value = {
      type: 'error',
      message: 'Only administrators can migrate users'
    }
    return
  }

  if (!specificUserId.value.trim()) {
    result.value = {
      type: 'error',
      message: 'Please enter a valid User ID'
    }
    return
  }

  loading.value = true
  result.value = null
  
  try {
    const migrationResult = await permitService.migrateSpecificUser(specificUserId.value.trim())
    
    result.value = {
      type: migrationResult.success ? 'success' : 'error',
      message: migrationResult.success ? 
        `User ${migrationResult.userId} migrated successfully` : 
        `Migration failed: ${migrationResult.error}`,
      details: migrationResult
    }

    if (migrationResult.success) {
      specificUserId.value = '' // Clear the input on success
    }
  } catch (error) {
    result.value = {
      type: 'error',
      message: `Migration error: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}

const initializeRoles = async () => {
  if (!isAdmin.value) {
    result.value = {
      type: 'error',
      message: 'Only administrators can initialize roles'
    }
    return
  }

  loading.value = true
  result.value = null
  
  try {
    const initResult = await permitService.initializeRolesAndPermissions()
    
    result.value = {
      type: initResult.success ? 'success' : 'error',
      message: initResult.success ? 
        'Roles and permissions initialized successfully' : 
        `Initialization failed: ${initResult.error}`,
      details: initResult
    }
  } catch (error) {
    result.value = {
      type: 'error',
      message: `Initialization error: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.permit-sync-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.section-header {
  text-align: center;
  margin-bottom: 3rem;
}

.section-header h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.description {
  color: #666;
  font-size: 1rem;
}

.sync-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.action-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.action-card h4 {
  color: #333;
  margin-bottom: 0.5rem;
}

.action-card p {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.sync-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-btn.primary {
  background-color: #4CAF50;
  color: white;
}

.sync-btn.primary:hover:not(:disabled) {
  background-color: #45a049;
}

.sync-btn.secondary {
  background-color: #2196F3;
  color: white;
}

.sync-btn.secondary:hover:not(:disabled) {
  background-color: #1976D2;
}

.sync-btn.tertiary {
  background-color: #FF9800;
  color: white;
}

.sync-btn.tertiary:hover:not(:disabled) {
  background-color: #F57C00;
}

.input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.user-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.user-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.sync-btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}

.migration-progress {
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.migration-progress h4 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #333;
}

.progress-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.stat {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.stat.success .stat-number {
  color: #4CAF50;
}

.stat.error .stat-number {
  color: #f44336;
}

.stat.total .stat-number {
  color: #2196F3;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.migration-details h5 {
  margin-bottom: 1rem;
  color: #333;
}

.user-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
}

.user-item:last-child {
  border-bottom: none;
}

.user-item.success {
  background-color: #f8fff8;
}

.user-item.error {
  background-color: #fff8f8;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.role-badge {
  background-color: #e0e0e0;
  color: #666;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-msg {
  font-size: 0.8rem;
  color: #f44336;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-container {
  margin-top: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.result-container.success {
  background-color: #f0f8f0;
  border-left-color: #4CAF50;
}

.result-container.error {
  background-color: #fff0f0;
  border-left-color: #f44336;
}

.result-container h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.result-details {
  margin-top: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.result-details pre {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-wrap: break-word;
}

@media (max-width: 768px) {
  .permit-sync-container {
    padding: 1rem;
  }
  
  .sync-actions {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>