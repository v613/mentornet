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
          
          <!-- <div class="form-grid">
            <div class="form-group">
              <label for="department">{{ $t('profile.department') }}</label>
              <input 
                id="department"
                type="text" 
                v-model="profile.attributes.department"
                class="form-input"
                placeholder="Engineering, Marketing, etc."
              />
            </div>

            <div class="form-group">
              <label for="location">{{ $t('profile.location') }}</label>
              <input 
                id="location"
                type="text" 
                v-model="profile.attributes.location"
                class="form-input"
                placeholder="City, Country"
              />
            </div>

            <div class="form-group">
              <label for="experience">{{ $t('profile.experience') }}</label>
              <input 
                id="experience"
                type="number" 
                v-model.number="profile.attributes.experience"
                class="form-input"
                min="0"
                max="50"
              />
            </div>
          </div> -->

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

          <div class="form-group">
            <label for="skills">{{ $t('profile.skills') }}</label>
            <textarea 
              id="skills"
              v-model="skillsText"
              class="form-textarea"
              :placeholder="$t('profile.skillsPlaceholder')"
              rows="3"
            ></textarea>
            <small class="form-help">{{ $t('profile.help.skillsRelevant') }}</small>
          </div>

          <div class="form-group">
            <label for="learningGoals">{{ $t('profile.learningGoals') }}</label>
            <textarea 
              id="learningGoals"
              v-model="learningGoalsText"
              class="form-textarea"
              :placeholder="$t('profile.learningGoalsPlaceholder')"
              rows="3"
            ></textarea>
            <small class="form-help">{{ $t('profile.help.learningGoalsDescription') }}</small>
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
          
          <!-- TOTP Section -->
          <div class="totp-section">
            <div class="totp-info">
              <h4>{{ $t('profile.twoFactorAuth') }}</h4>
              <p class="totp-description">{{ $t('profile.totpDescription') }}</p>
              <div class="totp-status">
                <span class="status-indicator" :class="{ 'enabled': totpEnabled }">
                  {{ totpEnabled ? $t('profile.totpEnabled') : $t('profile.totpDisabled') }}
                </span>
              </div>
            </div>
            
            <div class="totp-actions">
              <button 
                v-if="!totpEnabled"
                type="button" 
                @click="showTotpSetup = true" 
                class="btn-totp-enable"
                :disabled="saving"
              >
                {{ $t('profile.enableTotp') }}
              </button>
              
              <button 
                v-else
                type="button" 
                @click="showTotpDisable = true" 
                class="btn-totp-disable"
                :disabled="saving"
              >
                {{ $t('profile.disableTotp') }}
              </button>
            </div>
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
  
  <!-- TOTP Setup Modal -->
  <TOTPSetup
    v-if="showTotpSetup"
    @cancel="showTotpSetup = false"
    @complete="onTotpSetupComplete"
  />

  <!-- TOTP Disable Confirmation Modal -->
  <div v-if="showTotpDisable" class="totp-disable-modal">
    <div class="modal-overlay" @click="showTotpDisable = false"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('profile.disableTotpConfirm') }}</h3>
      </div>
      <div class="modal-body">
        <p>{{ $t('profile.disableTotpWarning') }}</p>
        <div class="form-group">
          <label for="disablePassword">{{ $t('profile.confirmPassword') }}</label>
          <input
            id="disablePassword"
            v-model="disablePassword"
            type="password"
            class="form-input"
            :placeholder="$t('profile.enterPassword')"
            required
          />
        </div>
        <div v-if="disableError" class="error-message">{{ disableError }}</div>
      </div>
      <div class="modal-actions">
        <button @click="showTotpDisable = false" class="btn-secondary">
          {{ $t('profile.cancel') }}
        </button>
        <button @click="disableTotp" :disabled="disablingTotp || !disablePassword" class="btn-danger">
          {{ disablingTotp ? $t('profile.disabling') : $t('profile.disableTotp') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'
import TOTPSetup from './TOTPSetup.vue'

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

// TOTP variables
const totpEnabled = ref(false)
const showTotpSetup = ref(false)
const showTotpDisable = ref(false)
const disablePassword = ref('')
const disableError = ref('')
const disablingTotp = ref(false)

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
    if (!apiService.isAuthenticated()) {
      throw new Error('No current user')
    }

    const userData = await apiService.getUserWithRoles()
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

    // Set TOTP status from API response
    totpEnabled.value = userData.totpEnabled || false
    
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

const onTotpSetupComplete = () => {
  showTotpSetup.value = false
  totpEnabled.value = true
  saveResult.value = {
    type: 'success',
    message: t('profile.totpEnabledSuccess')
  }
}

const disableTotp = async () => {
  disablingTotp.value = true
  disableError.value = ''
  
  try {
    const response = await apiService.disableTotp(disablePassword.value)
    if (response.success) {
      totpEnabled.value = false
      showTotpDisable.value = false
      disablePassword.value = ''
      saveResult.value = {
        type: 'success',
        message: t('profile.totpDisabledSuccess')
      }
    } else {
      const errorMap = {
        'INVALID_PASSWORD': 'profile.errors.invalidPassword',
        'TOTP_NOT_ENABLED': 'profile.errors.totpNotEnabled'
      }
      const errorKey = errorMap[response.errorCode]
      disableError.value = errorKey ? t(errorKey) : (response.error || t('profile.errors.disableFailed'))
    }
  } catch (error) {
    disableError.value = t('profile.errors.networkError')
  } finally {
    disablingTotp.value = false
  }
}

const saveProfile = async () => {
  saving.value = true
  saveResult.value = null
  
  try {
    if (!apiService.isAuthenticated()) {
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

    const result = await apiService.updateUserProfile(updateData)
    
    if (!result.success) {
      throw new Error(result.error)
    }

    // Change password if provided
    if (passwordData.value.currentPassword && passwordData.value.newPassword) {
      const passwordResult = await apiService.changePassword(
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

@media (prefers-color-scheme: dark) {
  .profile-header h2 {
    color: var(--vt-c-text-dark-2);
    margin-bottom: var(--spacing-sm);
  }
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

@media (prefers-color-scheme: dark) {
  .profile-form {
    background: var(--vt-c-black-mute);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-base);
    overflow: hidden;
  }
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

@media (prefers-color-scheme: dark) {
  .form-section h3 {
    color: var(--vt-c-text-dark-2);
    margin-bottom: var(--spacing-xl);
    font-size: 1.2rem;
    font-weight: var(--font-weight-semibold);
  }
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

@media (prefers-color-scheme: dark) {
  .form-group label {
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--spacing-sm);
    color: var(--vt-c-text-dark-2);
  }
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

@media (prefers-color-scheme: dark) {
  .form-input,
  .form-select,
  .form-textarea {
    padding: var(--spacing-md);
    border: 1px solid var(--color-input-border);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    background-color: var(--vt-c-black-soft);
    color: var(--vt-c-text-dark-1);
    transition: border-color var(--transition-base);
  }
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

@media (prefers-color-scheme: dark) {
  .form-input.readonly {
    background-color: var(--vt-c-black);
    color: var(--vt-c-text-dark-2);
  }
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

@media (prefers-color-scheme: dark) {
  .form-actions {
    padding: var(--spacing-xl) var(--spacing-2xl);
    background-color: var(--vt-c-black-soft);
    border-top: 1px solid var(--color-border-light);
    display: flex;
    gap: var(--spacing-lg);
    justify-content: flex-end;
  }
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

@media (prefers-color-scheme: dark) {
  .btn-secondary {
    background-color: var(--vt-c-black-mute);
    color: var(--vt-c-text-dark-1);
    border: 1px solid var(--color-border-medium);
  }
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}

@media (prefers-color-scheme: dark) {
  .btn-secondary:hover:not(:disabled) {
    background-color: var(--vt-c-divider-dark-1);
    border-color: var(--vt-c-divider-dark-1);
  }
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

.totp-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
  margin-top: var(--spacing-lg);
}

@media (prefers-color-scheme: dark) {
  .totp-section {
    background: var(--vt-c-black);
    border: 1px solid var(--vt-c-divider-dark-1);
  }
}

.totp-info h4 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
}

@media (prefers-color-scheme: dark) {
  .totp-info h4 {
    color: var(--vt-c-text-dark-2);
  }
}

.totp-description {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .totp-description {
    color: var(--vt-c-text-dark-2);
  }
}

.status-indicator {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  background: var(--color-gray-100);
  color: var(--color-text-tertiary);
}

@media (prefers-color-scheme: dark) {
  .status-indicator {
    background: var(--vt-c-black-mute);
    color: var(--vt-c-text-dark-2);
  }
}

.status-indicator.enabled {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.btn-totp-enable,
.btn-totp-disable {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
  font-size: 0.9rem;
}

.btn-totp-enable {
  background: var(--color-success);
  color: white;
}

.btn-totp-enable:hover:not(:disabled) {
  background: var(--color-success-dark);
  transform: translateY(-1px);
}

.btn-totp-disable {
  background: var(--color-error);
  color: white;
}

.btn-totp-disable:hover:not(:disabled) {
  background: var(--color-error-dark);
  transform: translateY(-1px);
}

.btn-totp-enable:disabled,
.btn-totp-disable:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.totp-disable-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 400px;
}

@media (prefers-color-scheme: dark) {
  .modal-content {
    background: var(--vt-c-black-mute);
  }
}

.modal-header {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  font-weight: var(--font-weight-semibold);
}

@media (prefers-color-scheme: dark) {
  .modal-header h3 {
    color: var(--vt-c-text-dark-2);
  }
}

.modal-body {
  padding: var(--spacing-xl);
}

.modal-body p {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .modal-body p {
    color: var(--vt-c-text-dark-2);
  }
}

.modal-actions {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: flex-end;
  padding: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
}

.btn-danger {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
  background: var(--color-error);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-error-dark);
  transform: translateY(-1px);
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>