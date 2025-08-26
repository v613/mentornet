<template>
  <div class="course-list">
    <div v-if="loading" class="loading">
      <p>{{ $t('courses.loading') }}</p>
    </div>
    
    <div v-else-if="courses.length === 0" class="no-courses">
      <p>{{ getEmptyMessage() }}</p>
    </div>
    
    <div v-else class="courses-grid">
      <div 
        v-for="course in courses" 
        :key="course.id"
        class="course-card"
        @click="$emit('select-course', course)"
      >
        <div class="course-header">
          <h3>{{ course.title }}</h3>
          <span :class="['status', course.status]">
            {{ getStatusText(course.status) }}
          </span>
        </div>
        
        <div class="course-info">
          <p class="description">{{ course.description || 'No description available' }}</p>
          
          <div class="course-meta">
            <div class="meta-item">
              <span class="label">Creator:</span>
              <span class="value">{{ course.creatorName }}</span>
            </div>
            
            <div class="meta-item">
              <span class="label">Enrolled:</span>
              <span class="value">{{ course.enrolledCount || 0 }} / {{ course.maxEnrollment || 20 }}</span>
            </div>
            
            <div v-if="course.skills && course.skills.length > 0" class="meta-item">
              <span class="label">Skills:</span>
              <div class="skills-tags">
                <span 
                  v-for="skill in course.skills.slice(0, 3)" 
                  :key="skill"
                  class="skill-tag"
                >
                  {{ skill }}
                </span>
                <span v-if="course.skills.length > 3" class="skill-more">
                  +{{ course.skills.length - 3 }} more
                </span>
              </div>
            </div>
            
            <div class="meta-item">
              <span class="label">Created:</span>
              <span class="value">{{ formatDate(course.createdAt) }}</span>
            </div>
          </div>
        </div>
        
        <div class="course-actions">
          <!-- Actions for course creators -->
          <template v-if="currentTab === 'my-courses'">
            <button 
              @click.stop="publishCourse(course)"
              v-if="course.status === 'draft'"
              class="action-btn publish"
            >
              Publish
            </button>
            
            <button 
              @click.stop="archiveCourse(course)"
              v-if="course.status === 'published'"
              class="action-btn archive"
            >
              Archive
            </button>
            
            <button 
              @click.stop="editCourse(course)"
              class="action-btn edit"
            >
              Edit
            </button>
            
            <button 
              @click.stop="viewApplications(course)"
              class="action-btn applications"
            >
              Applications ({{ course.applicationsCount || 0 }})
            </button>
          </template>
          
          <!-- Actions for available courses -->
          <template v-else-if="currentTab === 'available'">
            <button 
              @click.stop="applyToCourse(course)"
              :disabled="course.enrolledCount >= course.maxEnrollment"
              class="action-btn apply"
            >
              {{ course.enrolledCount >= course.maxEnrollment ? 'Full' : 'Apply' }}
            </button>
            
            <button 
              @click.stop="viewDetails(course)"
              class="action-btn details"
            >
              View Details
            </button>
          </template>
          
          <!-- Actions for admin view -->
          <template v-else-if="currentTab === 'all-courses'">
            <button 
              @click.stop="moderateCourse(course)"
              v-if="course.status === 'published'"
              class="action-btn moderate"
            >
              Moderate
            </button>
            
            <button 
              @click.stop="viewDetails(course)"
              class="action-btn details"
            >
              Details
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineEmits } from 'vue'

const props = defineProps({
  courses: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  currentTab: {
    type: String,
    default: 'available'
  }
})

const emit = defineEmits(['select-course', 'update-course', 'apply-to-course'])

const getEmptyMessage = () => {
  switch (props.currentTab) {
    case 'my-courses':
      return 'You haven\'t created any courses yet. Click "Create Course" to get started!'
    case 'available':
      return 'No published courses available at the moment.'
    case 'all-courses':
      return 'No courses found in the system.'
    default:
      return 'No courses found.'
  }
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
    return date.toLocaleDateString()
  } catch (error) {
    return 'Invalid date'
  }
}

// Course action handlers
const publishCourse = (course) => {
  if (confirm('Are you sure you want to publish this course?')) {
    emit('update-course', course.id, { status: 'published' })
  }
}

const archiveCourse = (course) => {
  if (confirm('Are you sure you want to archive this course?')) {
    emit('update-course', course.id, { status: 'archived' })
  }
}

const editCourse = (course) => {
  emit('select-course', course)
}

const viewApplications = (course) => {
  // Emit event to show applications modal
  emit('select-course', { ...course, showApplications: true })
}

const applyToCourse = (course) => {
  emit('apply-to-course', course.id)
}

const viewDetails = (course) => {
  emit('select-course', course)
}

const moderateCourse = (course) => {
  // Admin moderation actions
  const action = confirm('Suspend this course?') ? 'suspended' : null
  if (action) {
    emit('update-course', course.id, { status: action })
  }
}
</script>

<style scoped>
.course-list {
  width: 100%;
}

.loading, .no-courses {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
}

.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.course-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.course-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.course-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.3rem;
  line-height: 1.4;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  white-space: nowrap;
}

.status.draft {
  background-color: #fff3e0;
  color: #f57c00;
}

.status.published {
  background-color: #e8f5e8;
  color: #388e3c;
}

.status.archived {
  background-color: #f5f5f5;
  color: #757575;
}

.status.suspended {
  background-color: #ffebee;
  color: #d32f2f;
}

.course-info {
  margin-bottom: 1.5rem;
}

.description {
  color: #666;
  margin-bottom: 1rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.label {
  font-weight: 500;
  color: #666;
  min-width: 70px;
}

.value {
  color: #333;
}

.skills-tags {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.skill-tag {
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.skill-more {
  color: #666;
  font-size: 0.8rem;
  font-style: italic;
}

.course-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  border-top: 1px solid #f0f0f0;
  padding-top: 1rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s;
  flex: 1;
  min-width: 80px;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.publish {
  background-color: #4CAF50;
  color: white;
}

.action-btn.publish:hover:not(:disabled) {
  background-color: #45a049;
}

.action-btn.archive {
  background-color: #ff9800;
  color: white;
}

.action-btn.archive:hover:not(:disabled) {
  background-color: #f57c00;
}

.action-btn.edit {
  background-color: #2196F3;
  color: white;
}

.action-btn.edit:hover:not(:disabled) {
  background-color: #1976d2;
}

.action-btn.applications {
  background-color: #9c27b0;
  color: white;
}

.action-btn.applications:hover:not(:disabled) {
  background-color: #7b1fa2;
}

.action-btn.apply {
  background-color: #4CAF50;
  color: white;
}

.action-btn.apply:hover:not(:disabled) {
  background-color: #45a049;
}

.action-btn.details {
  background-color: #607d8b;
  color: white;
}

.action-btn.details:hover:not(:disabled) {
  background-color: #546e7a;
}

.action-btn.moderate {
  background-color: #f44336;
  color: white;
}

.action-btn.moderate:hover:not(:disabled) {
  background-color: #da190b;
}

@media (max-width: 768px) {
  .courses-grid {
    grid-template-columns: 1fr;
  }
  
  .course-card {
    padding: 1rem;
  }
  
  .course-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .course-actions {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>