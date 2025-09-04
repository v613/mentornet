<template>
  <div class="course-details-overlay" @click="closeModal">
    <div class="course-details-modal" @click.stop>
      <div class="modal-header">
        <h2>{{ course.title }}</h2>
        <span :class="['status', course.status]">
          {{ getStatusText(course.status) }}
        </span>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-content">
        <div class="course-info-section">
          <div class="info-grid">
            <div class="info-card">
              <h4>{{ t('courses.details.courseInformation') }}</h4>
              <div class="info-item">
                <span class="label">{{ t('courses.details.category') }}:</span>
                <span class="value">{{ course.category ? t(`courses.categories.${course.category}`) : t('courses.details.notSpecified') }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ t('courses.details.level') }}:</span>
                <span class="value">{{ course.level ? t(`courses.levels.${course.level}`) : t('courses.details.notSpecified') }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ t('courses.details.duration') }}:</span>
                <span class="value">{{ course.duration || t('courses.details.na') }} {{ t('courses.details.weeks') }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ t('courses.details.enrollment') }}:</span>
                <span class="value">{{ course.enrolledCount || 0 }} / {{ course.maxEnrollment || 20 }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ t('courses.details.createdBy') }}:</span>
                <span class="value">{{ course.creatorName }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ t('courses.details.created') }}:</span>
                <span class="value">{{ formatDate(course.createdAt) }}</span>
              </div>
            </div>
          </div>
          
          <div class="description-section">
            <h4>{{ t('courses.details.description') }}</h4>
            <p>{{ course.description || t('courses.details.noDescriptionAvailable') }}</p>
          </div>
          
          <div v-if="course.objectives" class="objectives-section">
            <h4>{{ t('courses.details.learningObjectives') }}</h4>
            <p>{{ course.objectives }}</p>
          </div>
          
          <div v-if="course.skills && course.skills.length > 0" class="skills-section">
            <h4>{{ t('courses.details.skillsYouWillLearn') }}</h4>
            <div class="skills-tags">
              <span 
                v-for="skill in course.skills" 
                :key="skill"
                class="skill-tag"
              >
                {{ skill }}
              </span>
            </div>
          </div>
          
          <div v-if="course.prerequisites && course.prerequisites.length > 0" class="prerequisites-section">
            <h4>{{ t('courses.details.prerequisites') }}</h4>
            <ul class="prerequisites-list">
              <li v-for="prereq in course.prerequisites" :key="prereq">
                {{ prereq }}
              </li>
            </ul>
          </div>
          
          <div v-if="course.settings" class="settings-section">
            <h4>{{ t('courses.details.courseSettings') }}</h4>
            <div class="settings-grid">
              <div class="setting-item">
                <span class="setting-icon">{{ course.settings.isPublic ? '🌍' : '🔒' }}</span>
                <span>{{ course.settings.isPublic ? t('courses.details.publicCourse') : t('courses.details.privateCourse') }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-icon">{{ course.settings.allowSelfEnrollment ? '✅' : '❌' }}</span>
                <span>{{ course.settings.allowSelfEnrollment ? t('courses.details.openApplications') : t('courses.details.invitationOnly') }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-icon">{{ course.settings.certificateOffered ? '🏆' : '📝' }}</span>
                <span>{{ course.settings.certificateOffered ? t('courses.details.certificateOffered') : t('courses.details.noCertificate') }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Applications section for course owners -->
        <div v-if="showApplications" class="applications-section">
          <h3>{{ t('courses.details.courseApplications') }}</h3>
          <div v-if="applications.length === 0" class="no-applications">
            <p>{{ t('courses.details.noApplicationsYet') }}</p>
          </div>
          <div v-else class="applications-list">
            <div 
              v-for="application in applications" 
              :key="application.id"
              class="application-card"
            >
              <div class="applicant-info">
                <h5>{{ application.applicantName }}</h5>
                <p class="application-date">{{ t('courses.details.applied') }}: {{ formatDate(application.appliedAt) }}</p>
              </div>
              <div class="application-content">
                <p><strong>{{ t('courses.details.motivation') }}:</strong> {{ application.motivation || t('courses.details.notProvided') }}</p>
                <p><strong>{{ t('courses.details.experience') }}:</strong> {{ application.experience || t('courses.details.notProvided') }}</p>
              </div>
              <div class="application-actions">
                <button 
                  @click="updateApplicationStatus(application.id, 'approved')"
                  v-if="application.status === 'pending'"
                  class="approve-btn"
                >
                  {{ t('courses.details.approve') }}
                </button>
                <button 
                  @click="updateApplicationStatus(application.id, 'rejected')"
                  v-if="application.status === 'pending'"
                  class="reject-btn"
                >
                  {{ t('courses.details.reject') }}
                </button>
                <span v-else :class="['status', application.status]">
                  {{ t(`courses.status.${application.status}`) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Course actions -->
        <div class="course-actions">
          <template v-if="canManageCourse">
            <button 
              @click="editCourse" 
              class="action-btn primary"
            >
              {{ t('courses.details.editCourse') }}
            </button>
            
            <button 
              @click="viewApplications" 
              class="action-btn secondary"
            >
              {{ showApplications ? t('courses.details.hideApplications') : t('courses.details.viewApplications') }}
            </button>
            
            <button 
              v-if="course.status === 'draft'"
              @click="publishCourse" 
              class="action-btn success"
            >
              {{ t('courses.details.publishCourse') }}
            </button>
            
            <button 
              v-if="course.status === 'published'"
              @click="archiveCourse" 
              class="action-btn warning"
            >
              {{ t('courses.details.archiveCourse') }}
            </button>
          </template>
          
          <template v-else-if="course.status === 'published'">
            <button 
              @click="applyCourse" 
              :disabled="course.enrolledCount >= course.maxEnrollment"
              class="action-btn primary"
            >
              {{ course.enrolledCount >= course.maxEnrollment ? t('courses.details.courseFull') : t('courses.details.applyCourse') }}
            </button>
          </template>
          
          <template v-if="userRole === 'admin'">
            <button 
              @click="moderateCourse" 
              class="action-btn danger"
            >
              {{ t('courses.details.moderateCourse') }}
            </button>
          </template>
        </div>
      </div>
      
      <!-- Save Result -->
      <div v-if="saveResult" class="result-message" :class="saveResult.type">
        <p>{{ saveResult.message }}</p>
      </div>
    </div>
    
    <!-- Time Slot Selection Modal -->
    <div v-if="showTimeSlotSelection" class="time-slot-overlay" @click="cancelTimeSlotSelection">
      <div class="time-slot-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ t('courses.details.selectTimeSlot') }}</h3>
          <button @click="cancelTimeSlotSelection" class="close-btn">&times;</button>
        </div>
        <div class="time-slot-content">
          <p>{{ t('courses.details.choosePreferredTime') }}</p>
          <div class="time-slots-list">
            <label 
              v-for="(slot, index) in course.timeSlots" 
              :key="index"
              class="time-slot-option"
            >
              <input 
                type="radio" 
                :value="slot" 
                v-model="selectedTimeSlot"
                name="timeSlot"
              />
              <span class="time-slot-label">{{ formatTimeSlot(slot) }}</span>
            </label>
          </div>
          <div class="time-slot-actions">
            <button @click="cancelTimeSlotSelection" class="btn-secondary">
              {{ t('common.cancel') }}
            </button>
            <button @click="submitTimeSlotApplication" class="btn-primary">
              {{ t('courses.details.applyWithTimeSlot') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'

const { t } = useI18n()

const props = defineProps({
  course: {
    type: Object,
    required: true
  },
  userRole: {
    type: String,
    default: 'mentee'
  }
})

const emit = defineEmits(['close', 'update-course', 'edit-course', 'refresh-course-data'])

const applications = ref([])
const showApplicationsModal = ref(props.course.showApplications || false)
const showApplications = computed(() => showApplicationsModal.value)
const currentUser = ref(null)
const isOwner = computed(() => {
  if (!currentUser.value || !props.course.mentorId) return false
  return currentUser.value.uid === props.course.mentorId
})
const isAdmin = computed(() => {
  return props.userRole === 'admin'
})
const canManageCourse = computed(() => {
  return isOwner.value || isAdmin.value
})
const saveResult = ref(null)
const selectedTimeSlot = ref(null)
const showTimeSlotSelection = ref(false)

onMounted(async () => {
  // Get current user information
  try {
    if (apiService.isAuthenticated()) {
      const user = apiService.getCurrentUserFromToken()
      if (user) {
        currentUser.value = { uid: user.userId || user.id }
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error)
  }
  
  if (showApplications.value || (props.userRole === 'mentor' && canManageCourse.value)) {
    await loadApplications()
  }
})

const closeModal = () => {
  emit('close')
}

const getStatusText = (status) => {
  return t(`courses.status.${status}`) || status
}

const formatDate = (timestamp) => {
  if (!timestamp) return t('common.unknown')
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('ro-RO') + ' at ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } catch (error) {
    return t('common.invalidDate')
  }
}

const loadApplications = async () => {
  try {
    const result = await apiService.getCourseApplications(props.course.courseId)
    applications.value = result.applications || []
  } catch (error) {
    console.error('Error loading applications:', error)
  }
}

const updateApplicationStatus = async (applicationId, status) => {
  try {
    const result = await apiService.updateApplicationStatus(props.course.courseId, applicationId, status)
    if (result.success) {
      // Update local application status
      const app = applications.value.find(a => a.id === applicationId)
      if (app) {
        app.status = status
      }
      saveResult.value = {
        type: 'success',
        message: t('courses.details.applicationStatusUpdated', { status: t(`courses.status.${status}`) })
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        saveResult.value = null
      }, 3000)
      
      // Reload applications to get fresh data\
      await loadApplications()
      
      // Emit event to refresh course data in parent component
      emit('refresh-course-data')
    }
  } catch (error) {
    console.error('Error updating application:', error)
    saveResult.value = {
      type: 'error',
      message: t('courses.details.applicationStatusError') + ': ' + error.message
    }
  }
}

const editCourse = () => {
  emit('close')
  emit('edit-course', props.course)
}

const viewApplications = async () => {
  showApplicationsModal.value = !showApplicationsModal.value
  if (showApplicationsModal.value) {
    await loadApplications()
  }
}

const publishCourse = () => {
  if (confirm(t('courses.details.publishConfirm'))) {
    emit('update-course', props.course.courseId, { status: 'published' })
    closeModal()
  }
}

const archiveCourse = () => {
  if (confirm(t('courses.details.archiveConfirm'))) {
    emit('update-course', props.course.courseId, { status: 'archived' })
    closeModal()
  }
}

const applyCourse = async () => {
  try {
    // Try to get user profile data for defaults
    let profileData = {}
    try {
      profileData = await apiService.getUserWithRoles()
    } catch (error) {
      console.log('Could not load profile data for application')
    }

    // Create experience summary from profile
    let experienceDefault = t('courses.details.beginner')
    if (profileData.experience && profileData.experience > 0) {
      experienceDefault = `${profileData.experience} ${t('profile.experience').toLowerCase()}`
      if (profileData.skills && profileData.skills.length > 0) {
        experienceDefault += ` - ${profileData.skills.slice(0, 3).join(', ')}`
      }
    }

    // Check if course has time slots for selection
    const timeSlots = props.course.timeSlots
    if (timeSlots && timeSlots.length > 0) {
      showTimeSlotSelection.value = true
      return
    }
    
    // If no time slots, proceed with basic application
    const applicationData = {
      motivation: prompt(t('courses.details.whyInterested')) || t('courses.details.interestedInLearning'),
      experience: prompt(t('courses.details.experienceLevel'), experienceDefault) || experienceDefault
    }
    
    if (applicationData.motivation) {
      const result = await apiService.applyToCourse(
        props.course.courseId, 
        applicationData.motivation, 
        applicationData.experience
      )
      if (result.success) {
        saveResult.value = {
          type: 'success',
          message: t('courses.details.applicationSuccess')
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          saveResult.value = null
        }, 3000)
        closeModal()
      } else {
        saveResult.value = {
          type: 'error',
          message: t(result.error)
        }
      }
    }
  } catch (error) {
    console.error('Error applying to course:', error)
    saveResult.value = {
      type: 'error',
      message: t('courses.details.applicationError') + ': ' + error.message
    }
  }
}

const moderateCourse = () => {
  const action = confirm(t('courses.details.suspendConfirm')) ? 'suspended' : null
  if (action) {
    emit('update-course', props.course.courseId, { status: action })
    closeModal()
  }
}

const submitTimeSlotApplication = async () => {
  if (!selectedTimeSlot.value) {
    saveResult.value = {
      type: 'error',
      message: t('courses.details.pleaseSelectTimeSlot')
    }
    return
  }
  
  const applicationData = {
    motivation: prompt(t('courses.details.whyInterested')) || t('courses.details.interestedInLearning'),
    experience: prompt(t('courses.details.experienceLevel')) || t('courses.details.beginner'),
    timeSlotId: selectedTimeSlot.value.id || selectedTimeSlot.value
  }
  
  if (applicationData.motivation) {
    try {
      const result = await apiService.applyToCourse(
        props.course.courseId, 
        applicationData.motivation, 
        applicationData.experience, 
        applicationData.timeSlotId
      )
      if (result.success) {
        saveResult.value = {
          type: 'success',
          message: t('courses.details.applicationSuccess')
        }
        
        showTimeSlotSelection.value = false
        selectedTimeSlot.value = null
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          saveResult.value = null
        }, 3000)
        closeModal()
      } else {
        saveResult.value = {
          type: 'error',
          message: t(result.error)
        }
      }
    } catch (error) {
      console.error('Error applying to course:', error)
      saveResult.value = {
        type: 'error',
        message: t('courses.details.applicationError') + ': ' + error.message
      }
    }
  }
}

const cancelTimeSlotSelection = () => {
  showTimeSlotSelection.value = false
  selectedTimeSlot.value = null
}

const formatTimeSlot = (slot) => {
  const day = t(`days.${slot.dayOfWeek}`)
  return `${day} ${slot.startTime} - ${slot.endTime} (${slot.maxParticipants} ${t('courses.maxParticipants')})`
}
</script>

<style scoped>
.course-details-overlay {
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

.course-details-modal {
  background: white;
  border-radius: 8px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
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
    background-color: var(--vt-c-black);
    position: sticky;
    top: 0;
    z-index: 1001;
  }
}

.modal-header h2 {
  margin: 0;
  color: #333;
  flex: 1;
}

@media (prefers-color-scheme: dark) {
  .modal-header h2 {
    margin: 0;
    color: var(--vt-c-text-dark-2);
    flex: 1;
  }
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  margin-right: 1rem;
}

.status.draft { background-color: #fff3e0; color: #f57c00; }
.status.published { background-color: #e8f5e8; color: #388e3c; }
.status.archived { background-color: #f5f5f5; color: #757575; }
.status.suspended { background-color: #ffebee; color: #d32f2f; }
.status.approved { background-color: #e8f5e8; color: #388e3c; }
.status.rejected { background-color: #ffebee; color: #d32f2f; }
.status.pending { background-color: #fff3e0; color: #f57c00; }
.status.cancelled { background-color: #ffebee; color: #d32f2f; }

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

.modal-content {
  padding: 1.5rem;
}

@media (prefers-color-scheme: dark) {
  .modal-content {
    padding: 1.5rem;
    background-color: var(--vt-c-black);
  }
}

.course-info-section h4 {
  color: #333;
  margin: 0 0 1rem 0;
  border-bottom: 2px solid #4CAF50;
  padding-bottom: 0.5rem;
}

@media (prefers-color-scheme: dark) {
  .course-info-section h4 {
    color: var(--vt-c-text-dark-2);
    margin: 0 0 1rem 0;
    border-bottom: 2px solid #4CAF50;
    padding-bottom: 0.5rem;
  }
}

.info-grid {
  margin-bottom: 2rem;
}

.info-card {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  .info-card {
    background-color: var(--vt-c-black);
    padding: 1.5rem;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: 500;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .label {
    font-weight: 500;
    color: var(--vt-c-text-dark-2);
  }
}

.value {
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .value {
    color: var(--vt-c-text-dark-2);
  }
}

.description-section,
.objectives-section,
.skills-section,
.prerequisites-section,
.settings-section,
.applications-section {
  margin-bottom: 2rem;
}

.description-section h4,
.objectives-section h4,
.skills-section h4,
.prerequisites-section h4,
.settings-section h4 {
  color: #333;
  margin-bottom: 0.5rem;
}
@media (prefers-color-scheme: dark) {
  .description-section h4,
  .objectives-section h4,
  .skills-section h4,
  .prerequisites-section h4,
  .settings-section h4 {
    color: var(--vt-c-text-dark-2);
    margin-bottom: 0.5rem;
  }
}

.description-section p,
.objectives-section p {
  line-height: 1.6;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .description-section p,
  .objectives-section p {
    line-height: 1.6;
    color: var(--vt-c-text-dark-2);
  }
}

.skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.skill-tag {
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.9rem;
}

.prerequisites-list {
  margin: 0;
  padding-left: 1.5rem;
}

.prerequisites-list li {
  margin-bottom: 0.5rem;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .prerequisites-list li {
    margin-bottom: 0.5rem;
    color: var(--vt-c-text-dark-2);
  }
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  .setting-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: var(--vt-c-black);
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }
}

.setting-icon {
  font-size: 1.2rem;
}

.applications-section h3 {
  color: #333;
  margin-bottom: 1rem;
  border-bottom: 2px solid #4CAF50;
  padding-bottom: 0.5rem;
}

.no-applications {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.applications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.application-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 1rem;
  background-color: #f8f9fa;
}

@media (prefers-color-scheme: dark) {
  .application-card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 1rem;
    background-color: var(--vt-c-black-soft);
  }
}

.applicant-info h5 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

@media (prefers-color-scheme: dark) {
    .applicant-info h5 {
      margin: 0 0 0.5rem 0;
      color: var(--vt-c-text-dark-1);
  }
}

.application-date {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .application-date {
    margin: 0;
    color: var(--vt-c-text-dark-2);
    font-size: 0.9rem;
  }
}

.application-content {
  margin: 1rem 0;
}

.application-content p {
  margin: 0.5rem 0;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .application-content p {
    margin: 0.5rem 0;
    color: var(--vt-c-text-dark-2);
  }
}

.application-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.approve-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.approve-btn:hover {
  background-color: #45a049;
}

.reject-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.reject-btn:hover {
  background-color: #da190b;
}

.course-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
  position: sticky;
  bottom: 0;
  background: white;
}

@media (prefers-color-scheme: dark) {
  .course-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
    position: sticky;
    bottom: 0;
    background: var(--vt-c-black);
  }
}

.action-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background-color: #4CAF50;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background-color: #45a049;
}

.action-btn.secondary {
  background-color: #2196F3;
  color: white;
}

.action-btn.secondary:hover:not(:disabled) {
  background-color: #1976d2;
}

.action-btn.success {
  background-color: #8bc34a;
  color: white;
}

.action-btn.success:hover:not(:disabled) {
  background-color: #7cb342;
}

.action-btn.warning {
  background-color: #ff9800;
  color: white;
}

.action-btn.warning:hover:not(:disabled) {
  background-color: #f57c00;
}

.action-btn.danger {
  background-color: #f44336;
  color: white;
}

.action-btn.danger:hover:not(:disabled) {
  background-color: #da190b;
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

/* Time Slot Selection Modal */
.time-slot-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
}

.time-slot-modal {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.time-slot-content {
  padding: 1.5rem;
}

.time-slots-list {
  margin: 1rem 0;
}

.time-slot-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.time-slot-option:hover {
  background-color: #f8f9fa;
}

.time-slot-option input[type="radio"] {
  margin: 0;
}

.time-slot-label {
  font-weight: 500;
  color: #333;
}

.time-slot-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary:hover {
  background-color: #45a049;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

@media (max-width: 768px) {
  .course-details-overlay {
    padding: 1rem;
  }
  
  .modal-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .modal-header h2 {
    width: 100%;
  }
  
  .status {
    margin-right: 0;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .course-actions {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>