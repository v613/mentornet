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
      
      <div v-if="isLogin" class="login-method-toggle">
        <div class="toggle-buttons">
          <button
            type="button"
            @click="loginMethod = 'password'"
            :class="{ active: loginMethod === 'password' }"
            class="toggle-button"
          >
            {{ $t('auth.loginWithPassword') }}
          </button>
          <button
            type="button"
            @click="loginMethod = 'totp'"
            :class="{ active: loginMethod === 'totp' }"
            class="toggle-button"
          >
            {{ $t('auth.loginWithTotp') }}
          </button>
        </div>
      </div>
      
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="username">{{ $t('auth.username') }}</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            :placeholder="$t('auth.usernamePlaceholder')"
          />
        </div>
        
        <div class="form-group" v-if="!isLogin">
          <label for="email">{{ $t('auth.email') }}</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            :placeholder="$t('auth.emailPlaceholder')"
          />
        </div>
        
        <div v-if="loginMethod === 'password' || !isLogin" class="form-group">
          <label for="password">{{ $t('auth.password') }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            :required="loginMethod === 'password' || !isLogin"
            :placeholder="$t('auth.passwordPlaceholder')"
          />
        </div>
        
        <div v-if="isLogin && loginMethod === 'totp'" class="form-group">
          <TOTPInput
            v-model="totpCode"
            :label="$t('auth.totpCode')"
            :help-text="$t('auth.totpHelp')"
            :error-message="error && error.includes('TOTP') ? error : ''"
            @complete="handleSubmit"
          />
        </div>
        
        <div class="form-group" v-if="!isLogin">
          <label class="checkbox-container">
            <input
              type="checkbox"
              v-model="isMentor"
            />
            <span class="checkmark"></span>
            {{ $t('auth.createMentorProfile') }}
          </label>
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
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'
import { tokenService } from '../services/tokenService.js'
import LanguageSwitcher from './LanguageSwitcher.vue'
import TOTPInput from './TOTPInput.vue'

const emit = defineEmits(['auth-success'])
const { t } = useI18n()

const isLogin = ref(true)
const loginMethod = ref('password')
const username = ref('')
const email = ref('')
const password = ref('')
const totpCode = ref('')
const isMentor = ref(false)
const loading = ref(false)
const error = ref('')

const toggleMode = () => {
  isLogin.value = !isLogin.value
  loginMethod.value = 'password'
  isMentor.value = false
  error.value = ''
  totpCode.value = ''
}

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  
  if (isLogin.value) {
    let result
    if (loginMethod.value === 'password') {
      result = await apiService.authenticateUser(username.value, password.value)
    } else {
      result = await apiService.authenticateUserTotp(username.value, totpCode.value)
    }
    
    if (result.success) {
      const authUser = {
        uid: result.user.id,
        id: result.user.id,
        userid: result.user.userid,
        email: result.user.email || '',
        displayName: result.user.displayName,
        role: result.user.role,
        isBlocked: result.user.isBlocked
      }
      
      const token = await tokenService.generateToken(result.user)
      if (token) {
        tokenService.storeToken(token)
      }
      
      emit('auth-success', authUser)
    } else {
      const errorMap = {
        'USER_BLOCKED': 'auth.accountBlockedMessage',
        'INVALID_CREDENTIALS': 'auth.errors.invalidCredentials',
        'USER_NOT_FOUND': 'auth.errors.userNotFound',
        'INVALID_CODE': 'auth.errors.invalidTotpCode',
        'RATE_LIMITED': 'auth.errors.rateLimited'
      }
      const errorKey = errorMap[result.errorCode]
      error.value = errorKey ? t(errorKey) : (result.error || 'Authentication failed')
    }
  } else {
    // API registration for signup
    const role = isMentor.value ? 'mentor' : 'mentee'
    const result = await apiService.registerUser(
      username.value,
      email.value,
      password.value,
      role
    )
    
    if (result.success) {
      // Auto-login after successful registration
      const authUser = {
        uid: result.user.id,
        id: result.user.id,
        userid: result.user.userid,
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
        isBlocked: result.user.isBlocked
      }
      
      // Generate and store JWT token synchronously
      const token = await tokenService.generateToken(result.user)
      if (token) {
        tokenService.storeToken(token)
      }
      
      emit('auth-success', authUser)
    } else {
      const errorMap = {
        'EMAIL_EXISTS': 'auth.errors.emailExists',
        'USER_EXISTS': 'auth.errors.userExists',
        'INVALID_EMAIL': 'auth.errors.invalidEmail',
        'WEAK_PASSWORD': 'courses.messages.weakPassword'
      }
      const errorKey = errorMap[result.errorCode]
      error.value = errorKey ? t(errorKey) : (result.error || 'Registration failed')
    }
  }
  
  loading.value = false
}

</script>

<style scoped>
.page-background {
  min-height: 100vh;
  background: var(--color-primary-gradient);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.brand-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
  color: var(--color-text-inverse);
}

.brand-title {
  font-size: 3rem;
  font-weight: var(--font-weight-bold);
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: -1px;
}

.brand-subtitle {
  font-size: 1.1rem;
  margin: var(--spacing-sm) 0 0 0;
  opacity: 0.9;
  font-weight: var(--font-weight-normal);
}

.auth-container {
  width: 100%;
  max-width: 400px;
}

.auth-form {
  background: var(--color-bg-primary);
  padding: var(--spacing-2xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-auth-card);
  backdrop-filter: blur(10px);
}

h2 {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  color: var(--color-text-primary);
}

.login-method-toggle {
  margin-bottom: var(--spacing-xl);
}

.toggle-buttons {
  display: flex;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-xs);
  gap: var(--spacing-xs);
}

@media (prefers-color-scheme: dark) {
  .toggle-buttons {
    background: var(--vt-c-black);
  }
}

.toggle-button {
  flex: 1;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  background: transparent;
  color: var(--color-text-secondary);
}

@media (prefers-color-scheme: dark) {
  .toggle-button {
    color: var(--vt-c-text-dark-2);
  }
}

.toggle-button.active {
  background: var(--color-primary-gradient);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-sm);
}

.toggle-button:hover:not(.active) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

@media (prefers-color-scheme: dark) {
  .toggle-button:hover:not(.active) {
    background: var(--vt-c-black-mute);
    color: var(--vt-c-text-dark-1);
  }
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

label {
  display: block;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

input {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  box-sizing: border-box;
  background-color: var(--color-input-bg);
  color: var(--color-text-primary);
  transition: border-color var(--transition-base);
}

input:focus {
  outline: none;
  border-color: var(--color-input-focus);
}

input::placeholder {
  color: var(--color-input-placeholder);
}

button[type="submit"] {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--color-primary-gradient);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

button[type="submit"]:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-button-hover);
}

button[type="submit"]:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.error-message {
  color: var(--color-error);
  text-align: center;
  margin-top: var(--spacing-lg);
  font-size: 0.9rem;
}

.toggle-mode {
  text-align: center;
  margin-top: var(--spacing-xl);
  color: var(--color-text-tertiary);
}

.link-button {
  background: none;
  border: none;
  color: var(--color-primary-start);
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;
  font-weight: var(--font-weight-semibold);
  transition: color var(--transition-base);
}

.link-button:hover {
  color: var(--color-primary-hover);
}

.checkbox-container {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-normal);
}

.checkbox-container input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  height: 18px;
  width: 18px;
  background-color: var(--color-input-bg);
  border: 2px solid var(--color-input-border);
  border-radius: var(--radius-xs);
  margin-right: var(--spacing-sm);
  display: inline-block;
  position: relative;
  transition: all var(--transition-base);
}

.checkbox-container:hover input ~ .checkmark {
  border-color: var(--color-primary-start);
}

.checkbox-container input:checked ~ .checkmark {
  background-color: var(--color-primary-start);
  border-color: var(--color-primary-start);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 5px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
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