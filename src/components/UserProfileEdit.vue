<template>
  <form @submit.prevent="saveProfile" class="profile-form">
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
              placeholder="Display name"
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
          </div>
        </div>
      </div>

      <!-- Profile Details -->
      <div class="form-section">
        <h3>{{ $t('profile.profileDetails') }}</h3>
        
        <div class="form-grid">
          <!-- <div class="form-group">
            <label for="department">{{ $t('profile.department') }}</label>
            <input 
              id="department"
              type="text" 
              v-model="profile.department"
              class="form-input"
              placeholder="Engineering, Marketing, etc."
            />
          </div> -->

          <div class="form-group">
            <label for="location">{{ $t('profile.location') }}</label>
            <input 
              id="location"
              type="text" 
              v-model="profile.location"
              class="form-input"
              placeholder="City, Country"
            />
          </div>

          <div class="form-group">
            <label for="experience">{{ $t('profile.experience') }}</label>
            <input 
              id="experience"
              type="number" 
              v-model.number="profile.experience"
              class="form-input"
              min="0"
              max="50"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="description">{{ $t('profile.description') }}</label>
          <textarea 
            id="description"
            v-model="profile.description"
            class="form-textarea"
            :placeholder="$t('profile.descriptionPlaceholder')"
            rows="4"
          ></textarea>
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
        </div>
      </div>

      <!-- Availability -->
      <div class="form-section">
        <h3>{{ $t('profile.availability') }}</h3>
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="profile.availableForMentoring"
            />
            <span>{{ $t('profile.availableForMentoring') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button type="button" @click="$emit('cancel')" class="btn-secondary" :disabled="saving">
        {{ $t('profile.cancel') }}
      </button>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? $t('profile.saving') : $t('profile.saveProfile') }}
      </button>
    </div>

    <!-- Save Result -->
    <div v-if="saveResult" class="result-message" :class="saveResult.type">
      <p>{{ saveResult.message }}</p>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  user: {
    type: Object,
    required: true
  },
  isAdminEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'cancel'])

const saving = ref(false)
const saveResult = ref(null)

const profile = ref({
  id: '',
  email: '',
  displayName: '',
  profileImage: '',
  description: '',
  role: 'mentee',
  department: '',
  location: '',
  experience: 0,
  skills: [],
  learningGoals: [],
  availableForMentoring: true
})

// Text representations for array fields
const skillsText = ref('')
const learningGoalsText = ref('')

// Watch for changes in text fields to update arrays
watch(skillsText, (newValue) => {
  profile.value.skills = newValue
    .split(',')
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0)
})

watch(learningGoalsText, (newValue) => {
  profile.value.learningGoals = newValue
    .split(',')
    .map(goal => goal.trim())
    .filter(goal => goal.length > 0)
})

onMounted(() => {
  // Initialize profile with user data
  profile.value = {
    id: props.user.id,
    email: props.user.email,
    displayName: props.user.displayName || props.user.userid,
    profileImage: props.user.profileImage || '',
    description: props.user.description || '',
    role: props.user.role,
    department: props.user.department || '',
    location: props.user.location || '',
    experience: props.user.experience || 0,
    skills: props.user.skills || [],
    learningGoals: props.user.learningGoals || [],
    availableForMentoring: props.user.availableForMentoring !== false
  }

  // Update text fields
  skillsText.value = profile.value.skills.join(', ')
  learningGoalsText.value = profile.value.learningGoals.join(', ')
})

const saveProfile = async () => {
  saving.value = true
  saveResult.value = null
  
  try {
    emit('save', profile.value)
  } catch (error) {
    console.error('Error saving profile:', error)
    saveResult.value = {
      type: 'error',
      message: t('profile.errorSaving', { error: error.message })
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-form {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .profile-form {
    background: var(--vt-c-black-mute);
    border-radius: var(--radius-lg);
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
    background-color: var(--vt-c-black);
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
    background-color: var(--vt-c-black-mute);
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
    background-color: var(--vt-c-black-mute);
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

@media (max-width: 768px) {
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