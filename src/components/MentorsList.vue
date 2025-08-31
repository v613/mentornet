<template>
  <div class="mentors-container">
    <h2>{{ $t('mentors.title') }}</h2>
    
    <div v-if="loading" class="loading">
      {{ $t('common.loading') }}
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else class="mentors-grid">
      <div v-for="mentor in mentors" :key="mentor.id" class="mentor-card">
        <div class="mentor-photo">
          <img 
            v-if="mentor.img" 
            :src="mentor.img" 
            :alt="mentor.displayName || mentor.email"
            class="mentor-image"
            @error="handleImageError($event, mentor)"
          />
          <div v-else class="mentor-placeholder">
            {{ getInitials(mentor.displayName || mentor.email) }}
          </div>
        </div>
        <div class="mentor-info">
          <h3 class="mentor-name">{{ mentor.displayName || mentor.email }}</h3>
          <p class="mentor-email">{{ mentor.email }}</p>
          <p class="mentor-userid">@{{ mentor.userid }}</p>
          <div v-if="mentor.description" class="mentor-skills">
            <p>{{ mentor.description }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="!loading && mentors.length === 0" class="no-mentors">
      {{ $t('mentors.noMentors') }}
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiService } from '../services/api.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const mentors = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  await loadMentors()
})

const loadMentors = async () => {
  loading.value = true
  error.value = null
  
  try {
    const mentors_data = await apiService.getMentors()
    mentors.value = mentors_data || []
  } catch (err) {
    error.value = 'Failed to load mentors'
  } finally {
    loading.value = false
  }
}



const getInitials = (name) => {
  if (!name) return '??'
  const words = name.split(' ')
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const handleImageError = (event, mentor) => {
  mentor.img = null
  event.target.style.display = 'none'
}
</script>

<style scoped>
.mentors-container {
  padding: var(--spacing-lg);
}

.mentors-container h2 {
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xl);
  font-size: 1.8rem;
  font-weight: var(--font-weight-semibold);
}

.loading, .error {
  text-align: center;
  padding: var(--spacing-xl);
  font-size: 1.1rem;
}

.error {
  color: var(--color-error);
  background-color: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: var(--radius-md);
}

.mentors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-xl);
}

.mentor-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  border: 1px solid var(--color-border-light);
}

.mentor-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.mentor-photo {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-lg);
}

.mentor-image {
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border-light);
}

.mentor-placeholder {
  width: 100%;
  height: 250px;
  background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: var(--font-weight-bold);
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.mentor-loading {
  width: 100%;
  height: 250px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border-light);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border-light);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.mentor-info {
  text-align: center;
}

.mentor-name {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  font-weight: var(--font-weight-semibold);
}

.mentor-email {
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.mentor-userid {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  opacity: 0.7;
}

.mentor-skills {
  text-align: left;
  background: var(--color-bg-tertiary, #f8f9fa);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-top: var(--spacing-md);
}

.mentor-skills h4 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mentor-skills p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  line-height: 1.4;
}

.no-mentors {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
}


@media (max-width: 768px) {
  .mentors-grid {
    grid-template-columns: 1fr;
  }
  
  .mentor-card {
    padding: var(--spacing-lg);
  }
}
</style>