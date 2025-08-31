<template>
  <div class="course-management">
    <div class="course-header">
      <h2>{{ $t('courses.management') }}</h2>
      <button 
        v-if="canCreateCourse" 
        @click="showCreateCourse = true" 
        class="create-btn"
      >
        {{ $t('courses.createCourse') }}
      </button>
    </div>

    <div class="course-tabs">
      <button 
        @click="activeTab = 'my-courses'" 
        :class="{ active: activeTab === 'my-courses' }"
        class="tab-btn"
      >
        {{ userRole === 'mentor' ? $t('courses.myCourses') : $t('courses.myEnrolledCourses') }}
      </button>
      <button 
        @click="activeTab = 'available'" 
        :class="{ active: activeTab === 'available' }"
        class="tab-btn"
      >
        {{ $t('courses.availableCourses') }}
      </button>
      <button 
        v-if="isAdmin"
        @click="activeTab = 'all-courses'" 
        :class="{ active: activeTab === 'all-courses' }"
        class="tab-btn"
      >
        {{ $t('courses.allCourses') }}
      </button>
    </div>

    <div class="course-content">
      <CourseList 
        :courses="filteredCourses" 
        :loading="loading"
        :current-tab="activeTab"
        :user-role="userRole"
        @select-course="selectCourse"
        @update-course="updateCourse"
        @apply-to-course="applyToCourse"
      />
    </div>

    <CreateCourse 
      v-if="showCreateCourse"
      @close="showCreateCourse = false"
      @course-created="handleCourseCreated"
    />

    <CreateCourse 
      v-if="showEditCourse"
      :edit-mode="true"
      :course-data="editingCourse"
      @close="showEditCourse = false; editingCourse = null"
      @course-updated="handleCourseUpdated"
    />

    <CourseDetails 
      v-if="selectedCourse"
      :course="selectedCourse"
      :user-role="userRole"
      @close="selectedCourse = null"
      @update-course="updateCourse"
      @edit-course="handleEditCourse"
      @refresh-course-data="handleRefreshCourseData"
    />
    
    <!-- Save Result -->
    <div v-if="saveResult" class="result-message" :class="saveResult.type">
      <p>{{ saveResult.message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'
import { abacService } from '../services/abac'
import { tokenService } from '../services/tokenService'
import CourseList from './CourseList.vue'
import CourseDetails from './CourseDetails.vue'
import CreateCourse from './CreateCourse.vue'

const { t } = useI18n()

const courses = ref([])
const loading = ref(true)
const activeTab = ref('available')
const showCreateCourse = ref(false)
const showEditCourse = ref(false)
const selectedCourse = ref(null)
const editingCourse = ref(null)
const userRole = ref('mentee')
const currentUser = ref(null)
const canCreateCourse = ref(false)
const isAdmin = ref(false)
const enrolledCourses = ref([])
const saveResult = ref(null)

const filteredCourses = computed(() => {
  const userId = currentUser.value?.uid
  
  switch (activeTab.value) {
    case 'my-courses':
      return userRole.value === 'mentor' 
        ? courses.value.filter(course => course.mentorId === userId)
        : enrolledCourses.value
    case 'available':
      return courses.value.filter(course => 
        course.status === 'published' && course.mentorId !== userId
      )
    case 'all-courses':
      return courses.value
    default:
      return courses.value.filter(course => course.status === 'published')
  }
})

onMounted(async () => {
  try {
    // Get current logged user from token
    const user = await tokenService.getCurrentUser()
    
    if (!user) {
      console.warn('No authenticated user found')
      // Check if there's user data in localStorage as fallback
      const userData = localStorage.getItem('userData')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        currentUser.value = { uid: parsedUser.id, email: parsedUser.email, role: parsedUser.role }
        userRole.value = parsedUser.role
        canCreateCourse.value = parsedUser.role === 'mentor' || parsedUser.role === 'admin'
        isAdmin.value = parsedUser.role === 'admin'
        abacService.setCurrentUser(currentUser.value.uid)
      } else {
        // No authentication available, but still load courses for viewing
        await loadCourses()
        return
      }
    } else {
      currentUser.value = { uid: user.id, email: user.email, role: user.role }
      // Set current user in ABAC service for session management
      abacService.setCurrentUser(currentUser.value.uid)
      
      // Set role directly from token and check permissions
      userRole.value = user.role
      canCreateCourse.value = user.role === 'mentor' || user.role === 'admin'
      isAdmin.value = user.role === 'admin'
    }

    // Set initial tab based on role
    if (userRole.value === 'mentor') {
      activeTab.value = 'my-courses'
    }

    await loadCourses()
    
    // Load enrolled courses for mentees
    if (userRole.value === 'mentee' && currentUser.value?.uid) {
      await loadEnrolledCourses()
    }
  } catch (error) {
    console.error('Error initializing course management:', error)
  } finally {
    loading.value = false
  }
})

const loadCourses = async () => {
  try {
    const result = await apiService.getCourses(1, 10)
    courses.value = result.courses
  } catch (error) {
    console.error('Error loading courses:', error)
  }
}

const loadEnrolledCourses = async () => {
  try {
    const result = await apiService.getMenteeEnrolledCourses()
    enrolledCourses.value = result
  } catch (error) {
    console.error('Error loading enrolled courses:', error)
  }
}

const selectCourse = (course) => {
  if (course.isEdit) {
    console.log('Opening edit modal for course:', course)
    editingCourse.value = { ...course, isEdit: undefined }
    showEditCourse.value = true
  } else {
    selectedCourse.value = course
  }
}

const updateCourse = async (courseId, updates) => {
  try {
    const result = await apiService.updateCourse(courseId, updates)
    if (result.success) {
      // Update local course data
      const courseIndex = courses.value.findIndex(c => c.courseId === courseId)
      if (courseIndex !== -1) {
        courses.value[courseIndex] = { ...courses.value[courseIndex], ...result.course }
      }
      // If currently viewing this course, update the selected course
      if (selectedCourse.value && selectedCourse.value.courseId === courseId) {
        selectedCourse.value = { ...selectedCourse.value, ...result.course }
      }
      saveResult.value = {
        type: 'success',
        message: t('courses.messages.updateSuccess')
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        saveResult.value = null
      }, 3000)
    } else {
      saveResult.value = {
        type: 'error',
        message: t('courses.messages.updateError') + ': ' + t(result.error)
      }
    }
  } catch (error) {
    console.error('Error updating course:', error)
    saveResult.value = {
      type: 'error',
      message: t('courses.messages.updateError') + ': ' + error.message
    }
  }
}

const applyToCourse = async (courseId) => {
  try {
    const applicationData = {
      motivation: 'Interested in learning from this course',
      experience: 'Beginner level'
    }
    
    const result = await apiService.applyToCourse(
      courseId, 
      applicationData.motivation, 
      applicationData.experience
    )
    if (result.success) {
      saveResult.value = {
        type: 'success',
        message: t('courses.applicationSubmitted')
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        saveResult.value = null
      }, 3000)
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
      message: t('courses.errorApplying') + ': ' + error.message
    }
  }
}

const handleCourseCreated = async (newCourse) => {
  showCreateCourse.value = false
  courses.value.unshift(newCourse)
  activeTab.value = 'my-courses'
}

const handleCourseUpdated = async (updatedCourse) => {
  showEditCourse.value = false
  editingCourse.value = null
  
  const courseIndex = courses.value.findIndex(c => c.courseId === updatedCourse.courseId)
  if (courseIndex !== -1) {
    courses.value[courseIndex] = updatedCourse
  }
  
  if (selectedCourse.value && selectedCourse.value.courseId === updatedCourse.courseId) {
    selectedCourse.value = updatedCourse
  }
}

const handleEditCourse = (course) => {
  selectedCourse.value = null
  editingCourse.value = course
  showEditCourse.value = true
}

const handleRefreshCourseData = async () => {
  await loadCourses()
  if (userRole.value === 'mentee' && currentUser.value?.uid) {
    await loadEnrolledCourses()
  }
}

// Watch for tab changes to reload courses
const watchActiveTab = () => {
  loadCourses()
}

// Set up tab watcher
onMounted(() => {
  // Reactive watcher for tab changes
  const unwatchTab = () => loadCourses()
  return unwatchTab
})
</script>

<style scoped>
.course-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-2xl);
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.course-header h2 {
  color: var(--color-text-primary);
  margin: 0;
}

.create-btn {
  background: var(--color-primary-gradient);
  color: var(--color-text-inverse);
  border: none;
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1rem;
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.course-tabs {
  display: flex;
  margin-bottom: var(--spacing-2xl);
  border-bottom: 2px solid var(--color-border-light);
}

.tab-btn {
  background: none;
  border: none;
  padding: var(--spacing-lg) var(--spacing-2xl);
  cursor: pointer;
  font-size: 1rem;
  color: var(--color-text-tertiary);
  border-bottom: 2px solid transparent;
  transition: all var(--transition-base);
  font-weight: var(--font-weight-medium);
}

.tab-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-secondary);
}

.tab-btn.active {
  color: var(--color-primary-start);
  border-bottom-color: var(--color-primary-start);
}

.course-content {
  min-height: 400px;
}

.result-message {
  margin-top: 1rem;
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
  .course-management {
    padding: 1rem;
  }
  
  .course-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .create-btn {
    width: 100%;
  }
  
  .course-tabs {
    flex-wrap: wrap;
  }
  
  .tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
  }
}
</style>