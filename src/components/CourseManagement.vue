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
        {{ $t('courses.myCourses') }}
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

    <CourseDetails 
      v-if="selectedCourse"
      :course="selectedCourse"
      :user-role="userRole"
      @close="selectedCourse = null"
      @update-course="updateCourse"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { databaseService } from '../services/database'
import { abacService } from '../services/abac'
import { authService } from '../services/auth'
import CourseList from './CourseList.vue'
import CourseDetails from './CourseDetails.vue'
import CreateCourse from './CreateCourse.vue'

const { t } = useI18n()

const courses = ref([])
const loading = ref(true)
const activeTab = ref('available')
const showCreateCourse = ref(false)
const selectedCourse = ref(null)
const userRole = ref('mentee')
const currentUser = ref(null)
const canCreateCourse = ref(false)
const isAdmin = ref(false)

const filteredCourses = computed(() => {
  const userId = currentUser.value?.uid
  
  switch (activeTab.value) {
    case 'my-courses':
      return courses.value.filter(course => course.creatorId === userId)
    case 'available':
      return courses.value.filter(course => 
        course.status === 'published' && course.creatorId !== userId
      )
    case 'all-courses':
      return courses.value
    default:
      return courses.value.filter(course => course.status === 'published')
  }
})

onMounted(async () => {
  try {
    currentUser.value = authService.getCurrentUser()
    if (!currentUser.value) return

    userRole.value = await abacService.getUserRole()
    canCreateCourse.value = await abacService.canUserCreateCourse()
    isAdmin.value = await abacService.canUserManageUsers()

    // Set initial tab based on role
    if (userRole.value === 'mentor') {
      activeTab.value = 'my-courses'
    }

    await loadCourses()
  } catch (error) {
    console.error('Error initializing course management:', error)
  } finally {
    loading.value = false
  }
})

const loadCourses = async () => {
  try {
    let filters = {}
    
    if (activeTab.value === 'my-courses') {
      filters.creatorId = currentUser.value?.uid
    } else if (activeTab.value === 'available') {
      filters.status = 'published'
    }

    const result = await databaseService.getCourses(filters)
    if (result.success) {
      courses.value = result.courses
    }
  } catch (error) {
    console.error('Error loading courses:', error)
  }
}

const selectCourse = (course) => {
  selectedCourse.value = course
}

const updateCourse = async (courseId, updates) => {
  try {
    const result = await databaseService.updateCourse(courseId, updates)
    if (result.success) {
      // Update local course data
      const courseIndex = courses.value.findIndex(c => c.id === courseId)
      if (courseIndex !== -1) {
        courses.value[courseIndex] = { ...courses.value[courseIndex], ...updates }
      }
    }
  } catch (error) {
    console.error('Error updating course:', error)
    alert(t('courses.errorUpdating') + ': ' + error.message)
  }
}

const applyToCourse = async (courseId) => {
  try {
    const applicationData = {
      motivation: 'Interested in learning from this course',
      experience: 'Beginner level'
    }
    
    const result = await databaseService.applyToCourse(courseId, applicationData)
    if (result.success) {
      alert(t('courses.applicationSubmitted'))
    } else {
      alert(t('courses.errorApplying') + ': ' + result.error)
    }
  } catch (error) {
    console.error('Error applying to course:', error)
    alert(t('courses.errorApplying') + ': ' + error.message)
  }
}

const handleCourseCreated = async (newCourse) => {
  showCreateCourse.value = false
  courses.value.unshift(newCourse)
  activeTab.value = 'my-courses' // Switch to my courses tab
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
  padding: 2rem;
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.course-header h2 {
  color: #333;
  margin: 0;
}

.create-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.create-btn:hover {
  background-color: #45a049;
}

.course-tabs {
  display: flex;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.tab-btn {
  background: none;
  border: none;
  padding: 1rem 2rem;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
}

.tab-btn:hover {
  color: #333;
  background-color: #f5f5f5;
}

.tab-btn.active {
  color: #4CAF50;
  border-bottom-color: #4CAF50;
}

.course-content {
  min-height: 400px;
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