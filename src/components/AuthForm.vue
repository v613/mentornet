<template>
  <div class="page-background">
    <LanguageSwitcher />
    <div class="brand-header">
      <h1 class="brand-title">{{ $t('app.title') }}</h1>
      <p class="brand-subtitle">{{ $t('app.subtitle') }}</p>
    </div>
    
    <div class="auth-container">
      <div class="auth-form">
      <h2>{{ $t(isLogin ? 'auth.signIn' : 'auth.signUp') }}</h2>
      
      <form @submit.prevent="handleSubmit">
        <div class="form-group" v-if="!isLogin">
          <label for="username">{{ $t('auth.username') }}</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            :placeholder="$t('auth.usernamePlaceholder')"
          />
        </div>
        
        <div class="form-group">
          <label for="email">{{ $t('auth.email') }}</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            :placeholder="$t('auth.emailPlaceholder')"
          />
        </div>
        
        <div class="form-group">
          <label for="password">{{ $t('auth.password') }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            :placeholder="$t('auth.passwordPlaceholder')"
          />
        </div>
        
        <button type="submit" :disabled="loading">
          {{ loading ? $t('auth.processing') : $t(isLogin ? 'auth.signIn' : 'auth.signUp') }}
        </button>
        
        <div class="error-message" v-if="error">
          {{ error }}
        </div>
      </form>
      
      <p class="toggle-mode">
        {{ $t(isLogin ? 'auth.noAccount' : 'auth.haveAccount') }}
        <button type="button" @click="toggleMode" class="link-button">
          {{ $t(isLogin ? 'auth.signUp' : 'auth.signIn') }}
        </button>
      </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { authService } from '../services/auth'
import LanguageSwitcher from './LanguageSwitcher.vue'

const emit = defineEmits(['auth-success'])

const isLogin = ref(true)
const username = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = ''
}

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  
  try {
    let result
    
    if (isLogin.value) {
      result = await authService.signIn(email.value, password.value)
    } else {
      result = await authService.signUp(email.value, password.value, username.value)
    }
    
    if (result.success) {
      emit('auth-success', result.user)
    } else {
      error.value = result.error
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>
.page-background {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.brand-header {
  text-align: center;
  margin-bottom: 2rem;
  color: white;
}

.brand-title {
  font-size: 3rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: -1px;
}

.brand-subtitle {
  font-size: 1.1rem;
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
  font-weight: 300;
}

.auth-container {
  width: 100%;
  max-width: 400px;
}

.auth-form {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #667eea;
}

button[type="submit"] {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

button[type="submit"]:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

button[type="submit"]:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #f44336;
  text-align: center;
  margin-top: 1rem;
  font-size: 0.9rem;
}

.toggle-mode {
  text-align: center;
  margin-top: 1.5rem;
  color: #666;
}

.link-button {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;
  font-weight: 600;
}

.link-button:hover {
  color: #764ba2;
}


/* Mobile only */
@media (max-width: 768px) {
  .page-background {
    justify-content: flex-start;
    padding-top: 2rem;
  }
  
  .brand-title {
    font-size: 2.5rem;
  }
  
  .auth-container {
    max-width: 100%;
  }
  
  .auth-form {
    padding: 1.5rem;
  }
}
</style>