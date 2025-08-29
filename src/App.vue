<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AuthForm from './components/AuthForm.vue'
import CourseManagement from './components/CourseManagement.vue'
import UserProfile from './components/UserProfile.vue'
import MentorsList from './components/MentorsList.vue'
import { tokenService } from './services/tokenService.js'

const user = ref(null)
const userProfile = ref(null)
const loading = ref(true)
const activeView = ref('courses')
const isAdminUser = ref(false)

onMounted(async () => {
  await checkExistingSession()
  loading.value = false
})

const handleAuthSuccess = (authenticatedUser) => {
  user.value = authenticatedUser
  userProfile.value = { role: authenticatedUser.role }
  isAdminUser.value = authenticatedUser.role === 'admin'
}

const handleSignOut = async () => {
  tokenService.removeToken()
  user.value = null
  userProfile.value = null
  isAdminUser.value = false
}

const checkExistingSession = async () => {
  if (await tokenService.isTokenValid()) {
    const userData = await tokenService.getCurrentUser()
    if (userData) {
      user.value = userData
      userProfile.value = { role: userData.role }
      isAdminUser.value = userData.role === 'admin'
    }
  } else {
    tokenService.removeToken()
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
