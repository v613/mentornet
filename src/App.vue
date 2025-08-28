<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AuthForm from './components/AuthForm.vue'
import CourseManagement from './components/CourseManagement.vue'
import UserProfile from './components/UserProfile.vue'
import MentorsList from './components/MentorsList.vue'

const user = ref(null)
const userProfile = ref(null)
const loading = ref(true)
const activeView = ref('courses')
const isAdminUser = ref(false)
let inactivityTimer = null
let activityCheckInterval = null
let lastActivityTime = ref(Date.now())
const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
const ACTIVITY_CHECK_INTERVAL = 60 * 1000 // Check every 1 minute

onMounted(() => {
  // Check if user should still be logged in
  checkExistingSession()
  loading.value = false
})

onUnmounted(() => {
  clearInactivityTimer()
  removeActivityListeners()
})

const handleAuthSuccess = (authenticatedUser) => {
  user.value = authenticatedUser
  userProfile.value = { role: authenticatedUser.role } // Use actual user role
  isAdminUser.value = authenticatedUser.role === 'admin'
  
  // Store user data for session persistence
  localStorage.setItem('userData', JSON.stringify(authenticatedUser))
  
  startInactivityTimer()
  setupActivityListeners()
}

const handleSignOut = async () => {
  clearInactivityTimer()
  removeActivityListeners()
  user.value = null
  userProfile.value = null
  isAdminUser.value = false
}

const startInactivityTimer = () => {
  clearInactivityTimer()
  lastActivityTime.value = Date.now()
  
  // Store login time in localStorage for persistence across tabs/refresh
  localStorage.setItem('loginTime', Date.now().toString())
  localStorage.setItem('lastActivity', Date.now().toString())
  
  activityCheckInterval = setInterval(() => {
    const now = Date.now()
    const storedLastActivity = parseInt(localStorage.getItem('lastActivity') || '0')
    const timeSinceLastActivity = now - Math.max(lastActivityTime.value, storedLastActivity)
    
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleInactivityLogout()
    }
  }, ACTIVITY_CHECK_INTERVAL)
}

const clearInactivityTimer = () => {
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval)
    activityCheckInterval = null
  }
  // Clear localStorage
  localStorage.removeItem('loginTime')
  localStorage.removeItem('lastActivity')
  localStorage.removeItem('userData')
}

const handleInactivityLogout = async () => {
  alert('You have been automatically logged out due to inactivity.')
  await handleSignOut()
}

const updateLastActivity = () => {
  const now = Date.now()
  lastActivityTime.value = now
  localStorage.setItem('lastActivity', now.toString())
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


const checkExistingSession = () => {
  const loginTime = localStorage.getItem('loginTime')
  const lastActivity = localStorage.getItem('lastActivity')
  const userData = localStorage.getItem('userData')
  
  if (loginTime && lastActivity && userData) {
    const now = Date.now()
    const timeSinceLastActivity = now - parseInt(lastActivity)
    
    if (timeSinceLastActivity < INACTIVITY_TIMEOUT) {
      // Session is still valid, restore user
      try {
        const parsedUser = JSON.parse(userData)
        user.value = parsedUser
        userProfile.value = { role: parsedUser.role }
        isAdminUser.value = parsedUser.role === 'admin'
        startInactivityTimer()
        setupActivityListeners()
      } catch (e) {
        // Invalid data, clear everything
        clearInactivityTimer()
      }
    } else {
      // Session expired, clear everything
      clearInactivityTimer()
    }
  }
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
        <span>{{ $t('dashboard.welcome', { email: user.displayName || user.userid }) }}</span>
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
            @click="activeView = 'mentors'"
            :class="{ active: activeView === 'mentors' }"
            class="nav-tab"
          >
            {{ $t('mentors.title') }}
          </button>
          <button 
            @click="activeView = 'profile'"
            :class="{ active: activeView === 'profile' }"
            class="nav-tab"
          >
            {{ $t('profile.title') }}
          </button>
        </div>
        
        <div class="view-content">
          <CourseManagement v-if="activeView === 'courses'" />
          <MentorsList v-if="activeView === 'mentors'" />
          <UserProfile v-if="activeView === 'profile'" />
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
  padding: var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  margin-bottom: var(--spacing-lg);
}

.sign-out-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-error);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-base);
  font-weight: var(--font-weight-medium);
}

.sign-out-btn:hover {
  background-color: var(--color-error-dark);
}

header {
  line-height: 1.5;
}

.dashboard {
  padding: var(--spacing-2xl);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.dashboard-header h1 {
  margin: 0;
  color: var(--color-text-primary);
}

.user-role {
  display: flex;
  align-items: center;
}

.role-badge {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.mentee {
  background-color: var(--color-role-mentee-bg);
  color: var(--color-role-mentee-text);
}

.role-badge.mentor {
  background-color: var(--color-role-mentor-bg);
  color: var(--color-role-mentor-text);
}

.role-badge.admin {
  background-color: var(--color-role-admin-bg);
  color: var(--color-role-admin-text);
}

.navigation-tabs {
  display: flex;
  border-bottom: 2px solid var(--color-border-light);
  margin-bottom: var(--spacing-2xl);
}

.nav-tab {
  background: none;
  border: none;
  padding: var(--spacing-lg) var(--spacing-2xl);
  cursor: pointer;
  font-size: 1rem;
  color: var(--color-text-tertiary);
  border-bottom: 2px solid transparent;
  transition: all var(--transition-base);
  font-weight: var(--font-weight-medium);
}

.nav-tab:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-secondary);
}

.nav-tab.active {
  color: var(--color-primary-start);
  border-bottom-color: var(--color-primary-start);
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
