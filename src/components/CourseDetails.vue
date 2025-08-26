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
              <h4>Course Information</h4>
              <div class="info-item">
                <span class="label">Category:</span>
                <span class="value">{{ course.category || 'Not specified' }}</span>
              </div>
              <div class="info-item">
                <span class="label">Level:</span>
                <span class="value">{{ course.level || 'Not specified' }}</span>
              </div>
              <div class="info-item">
                <span class="label">Duration:</span>
                <span class="value">{{ course.duration || 'N/A' }} weeks</span>
              </div>
              <div class="info-item">
                <span class="label">Enrollment:</span>
                <span class="value">{{ course.enrolledCount || 0 }} / {{ course.maxEnrollment || 20 }}</span>
              </div>
              <div class="info-item">
                <span class="label">Created by:</span>
                <span class="value">{{ course.creatorName }}</span>
              </div>
              <div class="info-item">
                <span class="label">Created:</span>
                <span class="value">{{ formatDate(course.createdAt) }}</span>
              </div>
            </div>
          </div>
          
          <div class="description-section">
            <h4>Description</h4>
            <p>{{ course.description || 'No description available' }}</p>
          </div>
          
          <div v-if="course.objectives" class="objectives-section">
            <h4>Learning Objectives</h4>
            <p>{{ course.objectives }}</p>
          </div>
          
          <div v-if="course.skills && course.skills.length > 0" class="skills-section">
            <h4>Skills You'll Learn</h4>
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
            <h4>Prerequisites</h4>
            <ul class="prerequisites-list">
              <li v-for="prereq in course.prerequisites" :key="prereq">
                {{ prereq }}
              </li>
            </ul>
          </div>
          
          <div v-if="course.settings" class="settings-section">
            <h4>Course Settings</h4>
            <div class="settings-grid">
              <div class="setting-item">
                <span class="setting-icon">{{ course.settings.isPublic ? '🌍' : '🔒' }}</span>
                <span>{{ course.settings.isPublic ? 'Public Course' : 'Private Course' }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-icon">{{ course.settings.allowSelfEnrollment ? '✅' : '❌' }}</span>
                <span>{{ course.settings.allowSelfEnrollment ? 'Open Applications' : 'Invitation Only' }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-icon">{{ course.settings.certificateOffered ? '🏆' : '📝' }}</span>
                <span>{{ course.settings.certificateOffered ? 'Certificate Offered' : 'No Certificate' }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Applications section for course owners -->
        <div v-if="showApplications || (userRole === 'mentor' && isOwner)" class="applications-section">
          <h3>Course Applications</h3>
          <div v-if="applications.length === 0" class="no-applications">
            <p>No applications yet.</p>
          </div>
          <div v-else class="applications-list">
            <div 
              v-for="application in applications" 
              :key="application.id"
              class="application-card"
            >
              <div class="applicant-info">
                <h5>{{ application.applicantName }}</h5>
                <p class="application-date">Applied: {{ formatDate(application.appliedAt) }}</p>
              </div>
              <div class="application-content">
                <p><strong>Motivation:</strong> {{ application.motivation || 'Not provided' }}</p>
                <p><strong>Experience:</strong> {{ application.experience || 'Not provided' }}</p>
              </div>
              <div class="application-actions">
                <button 
                  @click="updateApplicationStatus(application.id, 'approved')"
                  v-if="application.status === 'pending'"
                  class="approve-btn"
                >
                  Approve
                </button>
                <button 
                  @click="updateApplicationStatus(application.id, 'rejected')"
                  v-if="application.status === 'pending'"
                  class="reject-btn"
                >
                  Reject
                </button>
                <span v-else :class="['status', application.status]">
                  {{ application.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Course actions -->
        <div class="course-actions">
          <template v-if="userRole === 'mentor' && isOwner">
            <button 
              @click="editCourse" 
              class="action-btn primary"
            >
              Edit Course
            </button>
            
            <button 
              @click="viewApplications" 
              class="action-btn secondary"
            >
              View Applications
            </button>
            
            <button 
              v-if="course.status === 'draft'"
              @click="publishCourse" 
              class="action-btn success"
            >
              Publish Course
            </button>
            
            <button 
              v-if="course.status === 'published'"
              @click="archiveCourse" 
              class="action-btn warning"
            >
              Archive Course
            </button>
          </template>
          
          <template v-else-if="course.status === 'published'">
            <button 
              @click="applyCourse" 
              :disabled="course.enrolledCount >= course.maxEnrollment"
              class="action-btn primary"
            >
              {{ course.enrolledCount >= course.maxEnrollment ? 'Course Full' : 'Apply to Course' }}
            </button>
          </template>
          
          <template v-if="userRole === 'admin'">
            <button 
              @click="moderateCourse" 
              class="action-btn danger"
            >
              Moderate Course
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { databaseService } from '../services/database'

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

const emit = defineEmits(['close', 'update-course'])

const applications = ref([])
const showApplications = computed(() => props.course.showApplications)
const isOwner = computed(() => {
  // This would check if current user is the course creator
  return true // Placeholder
})

onMounted(async () => {
  if (showApplications.value || (props.userRole === 'mentor' && isOwner.value)) {
    await loadApplications()
  }
})

const closeModal = () => {
  emit('close')
}

const getStatusText = (status) => {
  const statusTexts = {
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    suspended: 'Suspended'
  }
  return statusTexts[status] || status
}

const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown'
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } catch (error) {
    return 'Invalid date'
  }
}

const loadApplications = async () => {
  try {
    const result = await databaseService.getCourseApplications(props.course.id)
    if (result.success) {
      applications.value = result.applications
    }
  } catch (error) {
    console.error('Error loading applications:', error)
  }
}

const updateApplicationStatus = async (applicationId, status) => {
  try {
    const result = await databaseService.updateApplicationStatus(applicationId, status)
    if (result.success) {
      // Update local application status
      const app = applications.value.find(a => a.id === applicationId)
      if (app) {
        app.status = status
      }
      alert(`Application ${status} successfully!`)
    }
  } catch (error) {
    console.error('Error updating application:', error)
    alert('Error updating application: ' + error.message)
  }
}

const editCourse = () => {
  // Implement edit functionality
  alert('Edit functionality would be implemented here')
}

const viewApplications = () => {
  // Toggle applications view
  loadApplications()
}

const publishCourse = () => {
  if (confirm('Are you sure you want to publish this course?')) {
    emit('update-course', props.course.id, { status: 'published' })
    closeModal()
  }
}

const archiveCourse = () => {
  if (confirm('Are you sure you want to archive this course?')) {
    emit('update-course', props.course.id, { status: 'archived' })
    closeModal()
  }
}

const applyCourse = async () => {
  try {
    const applicationData = {
      motivation: prompt('Why are you interested in this course?') || 'Interested in learning',
      experience: prompt('What\'s your experience level?') || 'Beginner'
    }
    
    if (applicationData.motivation) {
      const result = await databaseService.applyToCourse(props.course.id, applicationData)
      if (result.success) {
        alert('Application submitted successfully!')
        closeModal()
      } else {
        alert('Error: ' + result.error)
      }
    }
  } catch (error) {
    console.error('Error applying to course:', error)
    alert('Error applying to course: ' + error.message)
  }
}

const moderateCourse = () => {
  const action = confirm('Suspend this course?') ? 'suspended' : null
  if (action) {
    emit('update-course', props.course.id, { status: action })
    closeModal()
  }
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

.modal-header h2 {
  margin: 0;
  color: #333;
  flex: 1;
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

.course-info-section h4 {
  color: #333;
  margin: 0 0 1rem 0;
  border-bottom: 2px solid #4CAF50;
  padding-bottom: 0.5rem;
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

.value {
  color: #333;
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

.description-section p,
.objectives-section p {
  line-height: 1.6;
  color: #666;
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

.applicant-info h5 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.application-date {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.application-content {
  margin: 1rem 0;
}

.application-content p {
  margin: 0.5rem 0;
  color: #666;
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