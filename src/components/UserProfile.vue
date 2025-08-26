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
              <small class="form-help">Email cannot be changed</small>
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
                Role changes require admin approval
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
            <small class="form-help">Add skills relevant to mentoring or learning</small>
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
            <small class="form-help">What would you like to learn or improve?</small>
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
              <small class="form-help">Maximum number of mentees you can handle</small>
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
            <small class="form-help">Uncheck if you're temporarily unavailable</small>
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
import { authService } from '../services/auth.js'
import { databaseService } from '../services/database.js'

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
  padding: 2rem;
}

.profile-header {
  text-align: center;
  margin-bottom: 3rem;
}

.profile-header h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.profile-description {
  color: #666;
  font-size: 1rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.profile-form {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.form-sections {
  padding: 2rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.form-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.form-section h3 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.2rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.form-input,
.form-select,
.form-textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4CAF50;
}

.form-input.readonly {
  background-color: #f5f5f5;
  color: #666;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-help {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #666;
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
  padding: 1.5rem 2rem;
  background-color: #f9f9f9;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #45a049;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e9e9e9;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 4px;
  text-align: center;
}

.result-message.success {
  background-color: #f0f8f0;
  color: #4CAF50;
  border: 1px solid #4CAF50;
}

.result-message.error {
  background-color: #fff0f0;
  color: #f44336;
  border: 1px solid #f44336;
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