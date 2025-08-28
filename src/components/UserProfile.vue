<template>
  <div class="profile-container">
    <div class="profile-header">
      <h2>{{ $t('profile.myProfile') }}</h2>
      <p class="profile-description">{{ $t('profile.manageAccount') }}</p>
    </div>

    <div v-if="loading" class="loading">
      <p>{{ $t('profile.loadingProfile') }}</p>
    </div>

    <form v-else @submit.prevent="saveProfile" class="profile-form">
      <div class="form-sections">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>{{ $t('profile.basicInfo') }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="email">{{ $t('profile.email') }}</label>
              <input 
                id="email"
                type="email" 
                :value="profile.email" 
                readonly
                class="form-input readonly"
              />
              <small class="form-help">{{ $t('profile.help.emailCannotChange') }}</small>
            </div>

            <div class="form-group">
              <label for="displayName">{{ $t('profile.displayName') }}</label>
              <input 
                id="displayName"
                type="text" 
                v-model="profile.displayName"
                class="form-input"
                placeholder="Your display name"
                required
              />
            </div>

            <div class="form-group">
              <label for="profileImage">{{ $t('profile.profileImage') }}</label>
              <input 
                id="profileImage"
                type="url" 
                v-model="profile.profileImage"
                class="form-input"
                :placeholder="$t('profile.profileImagePlaceholder')"
              />
              <small class="form-help">{{ $t('profile.help.profileImageHelp') }}</small>
            </div>

          </div>
        </div>

        <!-- Profile Details -->
        <div class="form-section">
          <h3>{{ $t('profile.profileDetails') }}</h3>
          <div class="form-group">
            <label for="description">{{ $t('profile.description') }}</label>
            <textarea 
              id="description"
              v-model="profile.description"
              class="form-textarea"
              :placeholder="$t('profile.descriptionPlaceholder')"
              rows="4"
            ></textarea>
            <small class="form-help">{{ $t('profile.help.descriptionHelp') }}</small>
          </div>
        </div>

        <!-- Availability -->
        <div class="form-section">
          <h3>{{ $t('profile.availability') }}</h3>
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="profile.attributes.availableForMentoring"
              />
              <span>{{ $t('profile.availableForMentoring') }}</span>
            </label>
            <small class="form-help">{{ $t('profile.help.availabilityDescription') }}</small>
          </div>
        </div>

        <!-- Password & Security -->
        <div class="form-section">
          <h3>{{ $t('profile.passwordSecurity') }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="currentPassword">{{ $t('profile.currentPassword') }}</label>
              <input 
                id="currentPassword"
                type="password" 
                v-model="passwordData.currentPassword"
                class="form-input"
                autocomplete="current-password"
              />
            </div>

            <div class="form-group">
              <label for="newPassword">{{ $t('profile.newPassword') }}</label>
              <input 
                id="newPassword"
                type="password" 
                v-model="passwordData.newPassword"
                class="form-input"
                autocomplete="new-password"
              />
            </div>

            <div class="form-group">
              <label for="confirmPassword">{{ $t('profile.confirmPassword') }}</label>
              <input 
                id="confirmPassword"
                type="password" 
                v-model="passwordData.confirmPassword"
                class="form-input"
                autocomplete="new-password"
              />
            </div>
          </div>
          <small class="form-help">{{ $t('profile.help.passwordHelp') }}</small>
          <div v-if="passwordError" class="error-message">
            {{ passwordError }}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button type="button" @click="resetProfile" class="btn-secondary" :disabled="saving">
          {{ $t('profile.resetChanges') }}
        </button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? $t('profile.saving') : $t('profile.saveProfile') }}
        </button>
      </div>
    </form>

    <!-- Save Result -->
    <div v-if="saveResult" class="result-message" :class="saveResult.type">
      <p>{{ saveResult.message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { databaseService } from '../services/database.js'

const { t } = useI18n()

const loading = ref(true)
const saving = ref(false)
const saveResult = ref(null)
const originalProfile = ref(null)
const profile = ref({
  email: '',
  displayName: '',
  profileImage: '',
  description: '',
  role: 'mentee',
  attributes: {
    department: '',
    location: '',
    experience: 0,
    skills: [],
    learningGoals: [],
    expertise: [],
    mentoringCapacity: 5,
    canCreateCourses: false,
    availableForMentoring: true
  }
})

// Password change data
const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordError = ref('')

// Text representations for array fields
const skillsText = ref('')
const learningGoalsText = ref('')
const expertiseText = ref('')

const canChangeRole = computed(() => {
  return profile.value.role === 'admin'
})

// Watch for changes in text fields to update arrays
watch(skillsText, (newValue) => {
  profile.value.attributes.skills = newValue
    .split(',')
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0)
})

watch(learningGoalsText, (newValue) => {
  profile.value.attributes.learningGoals = newValue
    .split(',')
    .map(goal => goal.trim())
    .filter(goal => goal.length > 0)
})

watch(expertiseText, (newValue) => {
  profile.value.attributes.expertise = newValue
    .split(',')
    .map(area => area.trim())
    .filter(area => area.length > 0)
})

onMounted(async () => {
  await loadProfile()
})

const loadProfile = async () => {
  loading.value = true
  try {
    const currentUserId = databaseService.getCurrentUserId()
    if (!currentUserId) {
      throw new Error('No current user')
    }

    const userData = await databaseService.getUserWithRoles(currentUserId)
    if (userData) {
      profile.value = {
        email: userData.email,
        userid: userData.userid,
        displayName: userData.displayName || userData.userid,
        profileImage: userData.img || '',
        description: userData.description || '',
        role: userData.role,
        attributes: {
          department: userData.department || '',
          location: userData.location || '',
          experience: userData.experience || 0,
          skills: userData.skills || [],
          learningGoals: userData.learningGoals || [],
          expertise: userData.expertise || [],
          mentoringCapacity: userData.mentoringCapacity || 5,
          canCreateCourses: userData.role === 'mentor' || userData.role === 'admin',
          availableForMentoring: userData.availableForMentoring !== false
        }
      }
    } else {
      throw new Error('User data not found')
    }

    // Update text fields
    skillsText.value = profile.value.attributes.skills.join(', ')
    learningGoalsText.value = profile.value.attributes.learningGoals.join(', ')
    expertiseText.value = profile.value.attributes.expertise.join(', ')

    // Store original for reset
    originalProfile.value = JSON.parse(JSON.stringify(profile.value))
  } catch (error) {
    console.error('Error loading profile:', error)
    saveResult.value = {
      type: 'error',
      message: t('profile.errorLoading', { error: error.message })
    }
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  saving.value = true
  saveResult.value = null
  
  try {
    const currentUserId = databaseService.getCurrentUserId()
    if (!currentUserId) {
      throw new Error('No current user')
    }

    // Validate password if any password field is filled
    if (!validatePassword()) {
      saving.value = false
      return
    }

    // Update profile data
    const updateData = {
      displayName: profile.value.displayName,
      profileImage: profile.value.profileImage,
      description: profile.value.description,
      availableForMentoring: profile.value.attributes.availableForMentoring
    }

    const result = await databaseService.updateUserProfile(currentUserId, updateData)
    
    if (!result.success) {
      throw new Error(result.error)
    }

    // Change password if provided
    if (passwordData.value.currentPassword && passwordData.value.newPassword) {
      const passwordResult = await databaseService.changePassword(
        currentUserId,
        passwordData.value.currentPassword,
        passwordData.value.newPassword
      )
      
      if (!passwordResult.success) {
        throw new Error(passwordResult.error)
      }
      
      // Clear password fields after successful change
      passwordData.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
      passwordError.value = ''
      
      saveResult.value = {
        type: 'success',
        message: t('profile.profileSaved') + ' ' + t('profile.passwordChanged')
      }
    } else {
      saveResult.value = {
        type: 'success',
        message: t('profile.profileSaved')
      }
    }
    
    // Update original profile for reset functionality
    originalProfile.value = JSON.parse(JSON.stringify(profile.value))
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      saveResult.value = null
    }, 3000)
  } catch (error) {
    console.error('Error saving profile:', error)
    if (error.message.includes('password')) {
      saveResult.value = {
        type: 'error',
        message: t('profile.errorChangingPassword', { error: error.message })
      }
    } else {
      saveResult.value = {
        type: 'error',
        message: t('profile.errorSaving', { error: error.message })
      }
    }
  } finally {
    saving.value = false
  }
}

const resetProfile = () => {
  if (originalProfile.value) {
    profile.value = JSON.parse(JSON.stringify(originalProfile.value))
    
    // Update text fields
    skillsText.value = profile.value.attributes.skills.join(', ')
    learningGoalsText.value = profile.value.attributes.learningGoals.join(', ')
    expertiseText.value = profile.value.attributes.expertise.join(', ')
    
    // Reset password fields
    passwordData.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    passwordError.value = ''
    
    saveResult.value = null
  }
}

const validatePassword = () => {
  passwordError.value = ''
  
  if (passwordData.value.newPassword || passwordData.value.confirmPassword || passwordData.value.currentPassword) {
    if (!passwordData.value.currentPassword) {
      passwordError.value = t('profile.help.passwordHelp')
      return false
    }
    
    if (passwordData.value.newPassword.length < 6) {
      passwordError.value = t('profile.help.passwordTooShort')
      return false
    }
    
    if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
      passwordError.value = t('profile.help.passwordMismatch')
      return false
    }
  }
  
  return true
}
</script>

<style scoped>
.profile-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-2xl);
}

.profile-header {
  text-align: center;
  margin-bottom: var(--spacing-3xl);
}

.profile-header h2 {
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.profile-description {
  color: var(--color-text-tertiary);
  font-size: 1rem;
}

.loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-tertiary);
}

.profile-form {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-base);
  overflow: hidden;
}

.form-sections {
  padding: var(--spacing-2xl);
}

.form-section {
  margin-bottom: var(--spacing-2xl);
  padding-bottom: var(--spacing-2xl);
  border-bottom: 1px solid var(--color-border-light);
}

.form-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.form-section h3 {
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xl);
  font-size: 1.2rem;
  font-weight: var(--font-weight-semibold);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-xl);
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
}

.form-input,
.form-select,
.form-textarea {
  padding: var(--spacing-md);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background-color: var(--color-input-bg);
  color: var(--color-text-primary);
  transition: border-color var(--transition-base);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-input-focus);
}

.form-input.readonly {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-tertiary);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-help {
  margin-top: var(--spacing-xs);
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.form-actions {
  padding: var(--spacing-xl) var(--spacing-2xl);
  background-color: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  gap: var(--spacing-lg);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
}

.btn-primary {
  background: var(--color-primary-gradient);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-medium);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-message {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  border-radius: var(--radius-sm);
  text-align: center;
}

.result-message.success {
  background-color: var(--color-success-light);
  color: var(--color-success-dark);
  border: 1px solid var(--color-success);
}

.result-message.error {
  background-color: var(--color-error-light);
  color: var(--color-error-dark);
  border: 1px solid var(--color-error);
}

.error-message {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background-color: var(--color-error-light);
  color: var(--color-error-dark);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .profile-container {
    padding: 1rem;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>