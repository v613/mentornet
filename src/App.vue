<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AuthForm from './components/AuthForm.vue'
import CourseManagement from './components/CourseManagement.vue'
import UserProfile from './components/UserProfile.vue'
import PermitSync from './components/PermitSync.vue'
import { authService } from './services/auth'
import { abacService } from './services/abac'

const user = ref(null)
const userProfile = ref(null)
const loading = ref(true)
const activeView = ref('courses')
const isAdminUser = ref(false)
let authStateUnsubscribe = null
let inactivityTimer = null
let lastActivityTime = ref(Date.now())
const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

onMounted(() => {
  authStateUnsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      try {
        // Get full user profile with role and attributes
        const profile = await authService.getCurrentUserProfile()
        
        user.value = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0]
        }
        
        userProfile.value = profile
        isAdminUser.value = profile?.role === 'admin'
        
        startInactivityTimer()
        setupActivityListeners()
      } catch (error) {
        console.error('Error loading user profile:', error)
        user.value = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0]
        }
      }
    } else {
      user.value = null
      userProfile.value = null
      isAdminUser.value = false
      clearInactivityTimer()
      removeActivityListeners()
    }
    loading.value = false
  })
})

onUnmounted(() => {
  if (authStateUnsubscribe) {
    authStateUnsubscribe()
  }
  clearInactivityTimer()
  removeActivityListeners()
})

const handleAuthSuccess = (authenticatedUser) => {
  user.value = authenticatedUser
}

const handleSignOut = async () => {
  clearInactivityTimer()
  removeActivityListeners()
  await authService.signOut()
}

const startInactivityTimer = () => {
  clearInactivityTimer()
  lastActivityTime.value = Date.now()
  
  inactivityTimer = setInterval(() => {
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityTime.value
    
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleInactivityLogout()
    }
  }, 60000) // Check every minute
}

const clearInactivityTimer = () => {
  if (inactivityTimer) {
    clearInterval(inactivityTimer)
    inactivityTimer = null
  }
}

const handleInactivityLogout = async () => {
  alert('You have been automatically logged out due to inactivity.')
  await handleSignOut()
}

const updateLastActivity = () => {
  lastActivityTime.value = Date.now()
}

const setupActivityListeners = () => {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
  
  events.forEach(event => {
    document.addEventListener(event, updateLastActivity, { passive: true })
  })
}

const removeActivityListeners = () => {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
  
  events.forEach(event => {
    document.removeEventListener(event, updateLastActivity)
  })
}


const getRoleDisplayName = (role) => {
  const roleNames = {
    mentee: 'Mentee',
    mentor: 'Mentor',
    admin: 'Administrator'
  }
  return roleNames[role] || 'User'
}
</script>

<template>
  <div v-if="loading" class="loading">
    <p>{{ $t('common.loading') }}</p>
  </div>
  
  <AuthForm v-else-if="!user" @auth-success="handleAuthSuccess" />
  
  <div v-else>
    <header>
      <div class="user-info">
        <span>{{ $t('dashboard.welcome', { email: user.email }) }}</span>
        <button @click="handleSignOut" class="sign-out-btn">{{ $t('common.signOut') }}</button>
      </div>
    </header>

    <main>
      <div class="dashboard">
        <div class="dashboard-header">
          <h1>{{ $t('app.dashboard') }}</h1>
          <div class="user-role" v-if="userProfile">
            <span class="role-badge" :class="userProfile.role">{{ $t('dashboard.userRole.' + userProfile.role) }}</span>
          </div>
        </div>
        
        <div class="navigation-tabs">
          <button 
            @click="activeView = 'courses'"
            :class="{ active: activeView === 'courses' }"
            class="nav-tab"
          >
            {{ $t('courses.title') }}
          </button>
          <button 
            @click="activeView = 'profile'"
            :class="{ active: activeView === 'profile' }"
            class="nav-tab"
          >
            {{ $t('profile.title') }}
          </button>
          <button 
            v-if="isAdminUser"
            @click="activeView = 'permit'"
            :class="{ active: activeView === 'permit' }"
            class="nav-tab"
          >
            {{ $t('permitio.title') }}
          </button>
        </div>
        
        <div class="view-content">
          <CourseManagement v-if="activeView === 'courses'" />
          <UserProfile v-if="activeView === 'profile'" />
          <PermitSync v-if="activeView === 'permit'" />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f0f0f0;
  margin-bottom: 1rem;
}

.sign-out-btn {
  padding: 0.5rem 1rem;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.sign-out-btn:hover {
  background-color: #da190b;
}

header {
  line-height: 1.5;
}

.dashboard {
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  margin: 0;
}

.user-role {
  display: flex;
  align-items: center;
}

.role-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.mentee {
  background-color: #e3f2fd;
  color: #1976d2;
}

.role-badge.mentor {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.role-badge.admin {
  background-color: #fff3e0;
  color: #f57c00;
}

.navigation-tabs {
  display: flex;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 2rem;
}

.nav-tab {
  background: none;
  border: none;
  padding: 1rem 2rem;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
}

.nav-tab:hover {
  color: #333;
  background-color: #f5f5f5;
}

.nav-tab.active {
  color: #4CAF50;
  border-bottom-color: #4CAF50;
}

.view-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .navigation-tabs {
    width: 100%;
  }
  
  .nav-tab {
    flex: 1;
    text-align: center;
  }
}
</style>
