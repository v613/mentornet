<script setup>
import { ref, onMounted } from 'vue'
import AuthForm from './components/AuthForm.vue'
import { authService } from './services/auth'

const user = ref(null)
const loading = ref(true)

onMounted(() => {
  // Skip Firebase auth state checking
  loading.value = false
})

const handleAuthSuccess = (authenticatedUser) => {
  user.value = authenticatedUser
}

const handleSignOut = async () => {
  await authService.signOut()
  user.value = null
}
</script>

<template>
  <div v-if="loading" class="loading">
    <p>{{ $t('auth.loading') }}</p>
  </div>
  
  <AuthForm v-else-if="!user" @auth-success="handleAuthSuccess" />
  
  <div v-else>
    <header>
      <div class="user-info">
        <span>{{ $t('app.welcome', { email: user.email }) }}</span>
        <button @click="handleSignOut" class="sign-out-btn">{{ $t('auth.signOut') }}</button>
      </div>
    </header>

    <main>
      <div class="dashboard">
        <h1>{{ $t('app.dashboard') }}</h1>
        <p>{{ $t('app.dashboardWelcome') }}</p>
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
  text-align: center;
}

.dashboard h1 {
  color: #333;
  margin-bottom: 1rem;
}

.dashboard p {
  color: #666;
  font-size: 1.1rem;
}
</style>
