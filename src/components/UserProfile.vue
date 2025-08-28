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
              <label for="role">{{ $t('profile.role') }}</label>
              <select 
                id="role"
                v-model="profile.role" 
                class="form-select"
                :disabled="!canChangeRole"
              >
                <option value="mentee">Mentee</option>
                <option value="mentor">Mentor</option>
                <option value="admin" v-if="canChangeRole">Admin</option>
              </select>
              <small class="form-help" v-if="!canChangeRole">
                {{ $t('profile.help.roleRequiresAdmin') }}
              </small>
            </div>
          </div>
        </div>

        <!-- Profile Details -->
        <div class="form-section">
          <h3>{{ $t('profile.profileDetails') }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="department">{{ $t('profile.department') }}</label>
              <input 
                id="department"
                type="text" 
                v-model="profile.attributes.department"
                class="form-input"
                placeholder="e.g. Engineering, Marketing"
              />
            </div>

            <div class="form-group">
              <label for="location">{{ $t('profile.location') }}</label>
              <input 
                id="location"
                type="text" 
                v-model="profile.attributes.location"
                class="form-input"
                placeholder="e.g. San Francisco, Remote"
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
          </div>
        </div>

        <!-- Skills -->
        <div class="form-section">
          <h3>{{ $t('profile.skills') }}</h3>
          <div class="form-group">
            <label for="skills">{{ $t('profile.skills') }} (comma-separated)</label>
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
            <label for="learningGoals">{{ $t('profile.learningGoals') }} (comma-separated)</label>
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

        <!-- Mentor-specific fields -->
        <div v-if="profile.role === 'mentor'" class="form-section">
          <h3>{{ $t('profile.mentorSettings') }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="mentoringCapacity">{{ $t('profile.mentoringCapacity') }}</label>
              <input 
                id="mentoringCapacity"
                type="number" 
                v-model.number="profile.attributes.mentoringCapacity"
                class="form-input"
                min="1"
                max="20"
              />
              <small class="form-help">{{ $t('profile.help.mentoringCapacityDescription') }}</small>
            </div>

            <div class="form-group">
              <label for="expertise">{{ $t('profile.expertise') }} (comma-separated)</label>
              <textarea 
                id="expertise"
                v-model="expertiseText"
                class="form-textarea"
                placeholder="e.g. Software Engineering, Product Management, Startups"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="profile.attributes.canCreateCourses"
                />
                <span>{{ $t('profile.canCreateCourses') }}</span>
              </label>
            </div>
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
import { authService } from '../services/auth.js'
import { databaseService } from '../services/database.js'

const { t } = useI18n()

const loading = ref(true)
const saving = ref(false)
const saveResult = ref(null)
const originalProfile = ref(null)
const profile = ref({
  email: '',
  displayName: '',
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
    const currentUser = authService.getCurrentUser()
    if (!currentUser) {
      throw new Error('No authenticated user')
    }

    const userProfile = await authService.getCurrentUserProfile()
    
    if (userProfile) {
      profile.value = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        role: userProfile.role || 'mentee',
        attributes: {
          department: userProfile.attributes?.department || '',
          location: userProfile.attributes?.location || '',
          experience: userProfile.attributes?.experience || 0,
          skills: userProfile.attributes?.skills || [],
          learningGoals: userProfile.attributes?.learningGoals || [],
          expertise: userProfile.attributes?.expertise || [],
          mentoringCapacity: userProfile.attributes?.mentoringCapacity || 5,
          canCreateCourses: userProfile.attributes?.canCreateCourses || false,
          availableForMentoring: userProfile.attributes?.availableForMentoring !== false,
          ...userProfile.attributes
        }
      }
    } else {
      // New user profile
      profile.value = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
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
      }
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
      message: `Failed to load profile: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  saving.value = true
  saveResult.value = null
  
  try {
    // Update Firebase Auth display name if changed
    const currentUser = authService.getCurrentUser()
    if (currentUser && currentUser.displayName !== profile.value.displayName) {
      const { updateProfile } = await import('firebase/auth')
      await updateProfile(currentUser, {
        displayName: profile.value.displayName
      })
    }

    // Prepare profile data for Firestore
    const profileData = {
      displayName: profile.value.displayName,
      role: profile.value.role,
      attributes: { ...profile.value.attributes }
    }

    // Check if profile exists
    const existingProfile = await databaseService.getUserProfile(profile.value.uid)
    
    let result
    if (existingProfile.success) {
      // Update existing profile
      result = await databaseService.updateUserProfile(profileData)
    } else {
      // Create new profile
      result = await databaseService.createUserProfile({
        ...profileData,
        email: profile.value.email
      })
    }

    if (result.success) {
      saveResult.value = {
        type: 'success',
        message: t('profile.profileSaved')
      }
      
      // Update original profile for reset functionality
      originalProfile.value = JSON.parse(JSON.stringify(profile.value))
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        saveResult.value = null
      }, 3000)
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('Error saving profile:', error)
    saveResult.value = {
      type: 'error',
      message: `Failed to save profile: ${error.message}`
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
    
    saveResult.value = null
  }
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