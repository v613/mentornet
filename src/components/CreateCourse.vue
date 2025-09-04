<template>
  <div class="create-course-overlay" @click="closeModal">
    <div class="create-course-modal" @click.stop>
      <div class="modal-header">
        <h2>{{ editMode ? $t('courses.editCourse') : $t('courses.createNewCourse') }}</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="createCourse" class="course-form">
        <div class="form-group">
          <label for="title">{{ $t('courses.form.title') }} *</label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            required
            :placeholder="$t('courses.form.titlePlaceholder')"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label for="description">{{ $t('courses.form.description') }} *</label>
          <textarea
            id="description"
            v-model="form.description"
            required
            :placeholder="$t('courses.form.descriptionPlaceholder')"
            rows="4"
            class="form-textarea"
          ></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="category">{{ $t('courses.form.category') }} *</label>
            <select
              id="category"
              v-model="form.category"
              required
              class="form-select"
            >
              <option value="">{{ $t('courses.form.selectCategory') }}</option>
              <option value="technical">{{ $t('courses.categories.technical') }}</option>
              <option value="leadership">{{ $t('courses.categories.leadership') }}</option>
              <option value="communication">{{ $t('courses.categories.communication') }}</option>
              <option value="career">{{ $t('courses.categories.career') }}</option>
              <option value="business">{{ $t('courses.categories.business') }}</option>
              <option value="other">{{ $t('courses.categories.other') }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="level">{{ $t('courses.form.difficultyLevel') }} *</label>
            <select
              id="level"
              v-model="form.level"
              required
              class="form-select"
            >
              <option value="">{{ $t('courses.form.selectLevel') }}</option>
              <option value="beginner">{{ $t('courses.levels.beginner') }}</option>
              <option value="intermediate">{{ $t('courses.levels.intermediate') }}</option>
              <option value="advanced">{{ $t('courses.levels.advanced') }}</option>
              <option value="expert">{{ $t('courses.levels.expert') }}</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="duration">{{ $t('courses.form.duration') }} *</label>
            <input
              id="duration"
              v-model.number="form.duration"
              type="number"
              min="1"
              max="52"
              required
              placeholder="8"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="maxEnrollment">{{ $t('courses.form.maxStudents') }} *</label>
            <input
              id="maxEnrollment"
              v-model.number="form.maxEnrollment"
              type="number"
              min="1"
              max="100"
              required
              placeholder="20"
              class="form-input"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>{{ $t('courses.form.availableTimeSlots') }}</label>
          <div class="time-slots-section">
            <div 
              v-for="(slot, index) in form.timeSlots" 
              :key="index"
              class="time-slot-item"
            >
              <select
                v-model="form.timeSlots[index].dayOfWeek"
                class="form-select slot-day"
              >
                <option value="">{{ $t('courses.form.selectDay') }}</option>
                <option value="monday">{{ $t('days.monday') }}</option>
                <option value="tuesday">{{ $t('days.tuesday') }}</option>
                <option value="wednesday">{{ $t('days.wednesday') }}</option>
                <option value="thursday">{{ $t('days.thursday') }}</option>
                <option value="friday">{{ $t('days.friday') }}</option>
                <option value="saturday">{{ $t('days.saturday') }}</option>
                <option value="sunday">{{ $t('days.sunday') }}</option>
              </select>
              <input
                v-model="form.timeSlots[index].startTime"
                type="time"
                :placeholder="$t('courses.form.startTime')"
                class="form-input slot-time"
              />
              <input
                v-model="form.timeSlots[index].endTime"
                type="time"
                :placeholder="$t('courses.form.endTime')"
                class="form-input slot-time"
              />
              <input
                v-model.number="form.timeSlots[index].maxParticipants"
                type="number"
                min="1"
                max="50"
                :placeholder="$t('courses.form.maxParticipants')"
                class="form-input slot-participants"
              />
              <button 
                type="button" 
                @click="removeTimeSlot(index)"
                class="remove-btn"
              >
                &times;
              </button>
            </div>
            <button 
              type="button" 
              @click="addTimeSlot"
              class="add-time-slot-btn"
            >
              {{ $t('courses.form.addTimeSlot') }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>{{ $t('courses.form.skillsCovered') }}</label>
          <div class="skills-section">
            <div 
              v-for="(skill, index) in form.skills" 
              :key="index"
              class="skill-item"
            >
              <input
                v-model="form.skills[index]"
                type="text"
                :placeholder="$t('courses.form.enterSkill')"
                class="skill-input"
              />
              <button 
                type="button" 
                @click="removeSkill(index)"
                class="remove-btn"
              >
                &times;
              </button>
            </div>
            <button 
              type="button" 
              @click="addSkill"
              class="add-skill-btn"
            >
              {{ $t('courses.form.addSkill') }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>{{ $t('courses.form.prerequisites') }}</label>
          <div class="prerequisites-section">
            <div 
              v-for="(prerequisite, index) in form.prerequisites" 
              :key="index"
              class="prerequisite-item"
            >
              <input
                v-model="form.prerequisites[index]"
                type="text"
                :placeholder="$t('courses.form.enterPrerequisite')"
                class="prerequisite-input"
              />
              <button 
                type="button" 
                @click="removePrerequisite(index)"
                class="remove-btn"
              >
                &times;
              </button>
            </div>
            <button 
              type="button" 
              @click="addPrerequisite"
              class="add-prerequisite-btn"
            >
              {{ $t('courses.form.addPrerequisite') }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="objectives">{{ $t('courses.form.learningObjectives') }}</label>
          <textarea
            id="objectives"
            v-model="form.objectives"
            :placeholder="$t('courses.form.objectivesPlaceholder')"
            rows="3"
            class="form-textarea"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>{{ $t('courses.form.courseSettings') }}</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input 
                v-model="form.isPublic" 
                type="checkbox"
                class="checkbox-input"
              />
              {{ $t('courses.form.makePublic') }}
            </label>
            <label class="checkbox-label">
              <input 
                v-model="form.allowSelfEnrollment" 
                type="checkbox"
                class="checkbox-input"
              />
              {{ $t('courses.form.allowDirectApplication') }}
            </label>
            <label class="checkbox-label">
              <input 
                v-model="form.certificateOffered" 
                type="checkbox"
                class="checkbox-input"
              />
              {{ $t('courses.form.offerCertificate') }}
            </label>
          </div>
        </div>
        
        <div class="form-actions">
          <button 
            type="button" 
            @click="closeModal"
            class="cancel-btn"
          >
            {{ $t('common.cancel') }}
          </button>
          <button 
            type="button" 
            @click="saveDraft"
            :disabled="loading"
            class="draft-btn"
          >
            {{ $t('courses.form.saveAsDraft') }}
          </button>
          <button 
            type="submit" 
            :disabled="loading"
            class="submit-btn"
          >
            <span v-if="loading">{{ editMode ? $t('courses.form.updating') : $t('courses.form.creating') }}...</span>
            <span v-else>{{ editMode ? $t('courses.form.updateCourse') : $t('courses.form.createAndPublish') }}</span>
          </button>
        </div>
      </form>
      
      <!-- Save Result -->
      <div v-if="saveResult" class="result-message" :class="saveResult.type">
        <p>{{ saveResult.message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'

const props = defineProps({
  editMode: {
    type: Boolean,
    default: false
  },
  courseData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'course-created', 'course-updated'])
const { t } = useI18n()

const loading = ref(false)
const saveResult = ref(null)

const initializeForm = () => ({
  title: '',
  description: '',
  category: '',
  level: '',
  duration: 8,
  maxEnrollment: 20,
  timeSlots: [{
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    maxParticipants: 5
  }],
  skills: [''],
  prerequisites: [''],
  objectives: '',
  isPublic: true,
  allowSelfEnrollment: true,
  certificateOffered: false
})

const form = ref(initializeForm())

const populateFormWithCourseData = (courseData) => {
  if (!courseData) return
  
  form.value = {
    title: courseData.title || '',
    description: courseData.description || '',
    category: courseData.category || '',
    level: courseData.level || '',
    duration: courseData.duration || 8,
    maxEnrollment: courseData.maxEnrollment || 20,
    timeSlots: Array.isArray(courseData.timeSlots) && courseData.timeSlots.length > 0 
      ? courseData.timeSlots 
      : [{ dayOfWeek: '', startTime: '', endTime: '', maxParticipants: 5 }],
    skills: Array.isArray(courseData.skills) && courseData.skills.length > 0 
      ? courseData.skills 
      : [''],
    prerequisites: Array.isArray(courseData.prerequisites) && courseData.prerequisites.length > 0 
      ? courseData.prerequisites 
      : [''],
    objectives: courseData.objectives || '',
    isPublic: courseData.settings?.isPublic ?? true,
    allowSelfEnrollment: courseData.settings?.allowSelfEnrollment ?? true,
    certificateOffered: courseData.settings?.certificateOffered ?? false
  }
}

onMounted(() => {
  if (props.editMode && props.courseData) {
    populateFormWithCourseData(props.courseData)
  }
})

watch(() => props.courseData, (newCourseData) => {
  if (props.editMode && newCourseData) {
    populateFormWithCourseData(newCourseData)
  }
})

const closeModal = () => {
  emit('close')
}

const addSkill = () => {
  form.value.skills.push('')
}

const removeSkill = (index) => {
  if (form.value.skills.length > 1) {
    form.value.skills.splice(index, 1)
  }
}

const addPrerequisite = () => {
  form.value.prerequisites.push('')
}

const removePrerequisite = (index) => {
  if (form.value.prerequisites.length > 1) {
    form.value.prerequisites.splice(index, 1)
  }
}

const addTimeSlot = () => {
  form.value.timeSlots.push({
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    maxParticipants: 5
  })
}

const removeTimeSlot = (index) => {
  if (form.value.timeSlots.length > 1) {
    form.value.timeSlots.splice(index, 1)
  }
}

const saveDraft = async () => {
  await submitCourse('draft')
}

const createCourse = async () => {
  await submitCourse('published')
}

const submitCourse = async (status) => {
  loading.value = true
  
  try {
    // Filter out empty skills and prerequisites
    const skills = form.value.skills.filter(skill => skill.trim() !== '')
    const prerequisites = form.value.prerequisites.filter(prereq => prereq.trim() !== '')
    const timeSlots = form.value.timeSlots.filter(slot => 
      slot.dayOfWeek && slot.startTime && slot.endTime && slot.maxParticipants > 0
    )
    
    const courseData = {
      title: form.value.title,
      description: form.value.description,
      category: form.value.category,
      level: form.value.level,
      duration: form.value.duration,
      maxEnrollment: form.value.maxEnrollment,
      timeSlots: timeSlots.length > 0 ? timeSlots : null,
      skills: skills.length > 0 ? skills : null,
      prerequisites: prerequisites.length > 0 ? prerequisites : null,
      objectives: form.value.objectives || null,
      settings: {
        isPublic: form.value.isPublic,
        allowSelfEnrollment: form.value.allowSelfEnrollment,
        certificateOffered: form.value.certificateOffered
      },
      status: status
    }
    
    let result
    if (props.editMode && props.courseData) {
      // Update existing course
      result = await apiService.updateCourse(props.courseData.courseId, courseData)
    } else {
      // Create new course
      result = await apiService.createCourse(courseData)
    }
    
    if (result.success) {
      if (props.editMode) {
        emit('course-updated', {
          ...props.courseData,
          ...result.course
        })
        saveResult.value = {
          type: 'success',
          message: t('courses.messages.courseUpdated')
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          saveResult.value = null
        }, 3000)
      } else {
        emit('course-created', {
          courseId: result.courseId,
          ...courseData
        })
        
        // Reset form only for create mode
        form.value = initializeForm()
        
        const message = status === 'draft' 
          ? t('courses.messages.draftSaved') 
          : t('courses.messages.courseCreated')
        saveResult.value = {
          type: 'success',
          message: message
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          saveResult.value = null
        }, 3000)
      }
    } else {
      // Handle error - check if it's a translation key or actual error message
      const errorMsg = result.error.startsWith('courses.messages.') 
        ? t(result.error) 
        : result.error
      throw new Error(errorMsg + (result.details ? ': ' + result.details : ''))
    }
  } catch (error) {
    console.error('Error submitting course:', error)
    const errorMessage = props.editMode 
      ? t('courses.messages.updateError') 
      : t('courses.messages.createError')
    saveResult.value = {
      type: 'error',
      message: errorMessage + ': ' + error.message
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-course-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  overflow-y: auto;
  padding: 2rem;
}

.create-course-modal {
  background: white;
  border-radius: 8px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  .create-course-modal {
    background: var(--vt-c-black-mute);
    border-radius: 8px;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 1001;
}

@media (prefers-color-scheme: dark) {
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
    background-color: var(--vt-c-black-soft);
    position: sticky;
    top: 0;
    z-index: 1001;
  }
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .modal-header h2 {
    margin: 0;
    color: var(--vt-c-text-dark-2);
  }
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
  background-color: #e0e0e0;
  border-radius: 50%;
}

.course-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--vt-c-text-dark-2);
  }
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

@media (prefers-color-scheme: dark) {
  .form-input,
  .form-textarea,
  .form-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.3s;
    box-sizing: border-box;
    background-color: var(--vt-c-black-soft);
    color: var(--vt-c-text-dark-1);
  }
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.skills-section,
.prerequisites-section {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  background-color: #f8f9fa;
}

@media (prefers-color-scheme: dark) {
  .skills-section,
  .prerequisites-section {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    background-color: var(--vt-c-black);
  }
}

.skill-item,
.prerequisite-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  align-items: center;
}

.skill-input,
.prerequisite-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

@media (prefers-color-scheme: dark) {
  .skill-input,
  .prerequisite-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: var(--vt-c-black);
    color: var(--vt-c-text-dark-1);
  }
}

.remove-btn {
  background: #f44336;
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #da190b;
}

.add-skill-btn,
.add-prerequisite-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.add-skill-btn:hover,
.add-prerequisite-btn:hover {
  background: #45a049;
}

.time-slots-section {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  background-color: #f8f9fa;
}

@media (prefers-color-scheme: dark) {
  .time-slots-section {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    background-color: var(--vt-c-black-soft);
  }
}

.time-slot-item {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr auto;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  align-items: center;
}

.slot-day {
  min-width: 120px;
}

.slot-time {
  min-width: 100px;
}

.slot-participants {
  min-width: 80px;
}

.add-time-slot-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.add-time-slot-btn:hover {
  background: #1976D2;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-input {
  width: auto;
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
  position: sticky;
  bottom: 0;
  background: white;
}

@media (prefers-color-scheme: dark) {
  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
    position: sticky;
    bottom: 0;
    background: var(--vt-c-black-mute);
  }
}  

.cancel-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.cancel-btn:hover {
  background: #5a6268;
}

.draft-btn {
  background: #ffc107;
  color: #212529;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.draft-btn:hover:not(:disabled) {
  background: #e0a800;
}

.submit-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  min-width: 140px;
}

.submit-btn:hover:not(:disabled) {
  background: #45a049;
}

.submit-btn:disabled,
.draft-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.result-message {
  margin: 1rem 1.5rem;
  padding: 1rem;
  border-radius: 4px;
  text-align: center;
}

.result-message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.result-message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

@media (max-width: 768px) {
  .create-course-overlay {
    padding: 1rem;
  }
  
  .create-course-modal {
    width: 100%;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .cancel-btn,
  .draft-btn,
  .submit-btn {
    width: 100%;
  }
}
</style>