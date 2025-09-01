<template>
  <div class="admin-container">
    <div class="admin-header">
      <h2>{{ $t('admin.userManagement') }}</h2>
      <p class="admin-description">{{ $t('admin.manageAllUsers') }}</p>
    </div>

    <div v-if="loading" class="loading">
      <p>{{ $t('admin.loadingUsers') }}</p>
    </div>

    <div v-else class="users-section">
      <!-- Filters and Search -->
      <div class="filters-section">
        <div class="filter-group">
          <label for="roleFilter">{{ $t('admin.filterByRole') }}</label>
          <select id="roleFilter" v-model="selectedRole" @change="handleFilterChange" class="filter-select">
            <option value="">{{ $t('admin.allRoles') }}</option>
            <option value="mentee">{{ $t('dashboard.userRole.mentee') }}</option>
            <option value="mentor">{{ $t('dashboard.userRole.mentor') }}</option>
            <option value="admin">{{ $t('dashboard.userRole.admin') }}</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label for="searchInput">{{ $t('admin.searchUsers') }}</label>
          <input 
            id="searchInput"
            type="text" 
            v-model="searchTerm" 
            @input="handleSearchInput"
            :placeholder="$t('admin.searchPlaceholder')"
            class="search-input"
          />
        </div>
        
        <div class="results-info">
          <span>{{ $t('admin.showingResults', { 
            start: ((currentPage - 1) * pageSize) + 1, 
            end: Math.min(currentPage * pageSize, totalUsers), 
            total: totalUsers 
          }) }}</span>
        </div>
      </div>

      <div class="users-list">
        <div class="user-card" v-for="user in users" :key="user.id">
          <div class="user-info">
            <div class="user-avatar">
              <img v-if="user.img" :src="user.img" :alt="user.displayName" />
              <div v-else class="avatar-placeholder">
                {{ (user.displayName || user.userid).substring(0, 2).toUpperCase() }}
              </div>
            </div>
            <div class="user-details">
              <h3>{{ user.displayName || user.userid }}</h3>
              <p class="user-email">{{ user.email }}</p>
              <div class="user-meta">
                <span class="role-badge" :class="user.role">{{ $t('dashboard.userRole.' + user.role) }}</span>
                <span v-if="user.isBlocked" class="blocked-badge">{{ $t('admin.blocked') }}</span>
              </div>
            </div>
          </div>
          <div class="user-actions">
            <button @click="editUser(user)" class="btn-secondary">
              {{ $t('admin.editProfile') }}
            </button>
            <button 
              v-if="user.role === 'mentee'"
              @click="toggleUserBlock(user)" 
              :class="user.isBlocked ? 'btn-success' : 'btn-danger'"
              :disabled="updatingUser === user.id"
            >
              {{ updatingUser === user.id ? $t('admin.updating') : (user.isBlocked ? $t('admin.unblock') : $t('admin.block')) }}
            </button>
          </div>
        </div>
        
        <!-- Pagination -->
        <div class="pagination-section" v-if="totalPages > 1">
          <div class="pagination-controls">
            <button 
              @click="goToPage(currentPage - 1)" 
              :disabled="currentPage === 1"
              class="pagination-btn"
            >
              {{ $t('admin.previous') }}
            </button>
            
            <div class="page-numbers">
              <button 
                v-for="page in visiblePages" 
                :key="page"
                @click="goToPage(page)"
                :class="['page-btn', { active: page === currentPage }]"
              >
                {{ page }}
              </button>
            </div>
            
            <button 
              @click="goToPage(currentPage + 1)" 
              :disabled="currentPage === totalPages"
              class="pagination-btn"
            >
              {{ $t('admin.next') }}
            </button>
          </div>
          
          <div class="pagination-info">
            <span>{{ $t('admin.pageInfo', { current: currentPage, total: totalPages }) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- User Profile Edit Modal -->
    <div v-if="editingUser" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('admin.editUserProfile') }}</h3>
          <button @click="closeEditModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <UserProfileEdit 
            :user="editingUser" 
            :is-admin-editing="true"
            @save="saveUserProfile"
            @cancel="closeEditModal"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'
import UserProfileEdit from './UserProfileEdit.vue'

const { t } = useI18n()

const loading = ref(true)
const users = ref([])
const editingUser = ref(null)
const updatingUser = ref(null)

// Pagination and filtering
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(0)
const totalUsers = ref(0)
const selectedRole = ref('')
const searchTerm = ref('')
let searchTimeout = null

onMounted(async () => {
  await loadUsers()
})

const loadUsers = async (resetPage = false) => {
  if (resetPage) currentPage.value = 1
  
  loading.value = true
  try {
    const result = await apiService.getAllUsers(
      currentPage.value, 
      pageSize.value, 
      selectedRole.value || null, 
      searchTerm.value || null
    )
    
    users.value = result.users
    totalPages.value = result.pagination.totalPages || 0
    totalUsers.value = result.pagination.totalUsers || 0
  } catch (error) {
    console.error('Error loading users:', error)
    users.value = []
  } finally {
    loading.value = false
  }
}

// Computed property for visible page numbers
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

// Navigation methods
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    loadUsers()
  }
}

const handleFilterChange = () => {
  loadUsers(true) // Reset to first page when filtering
}

const handleSearchInput = () => {
  // Debounce search to avoid too many API calls
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadUsers(true) // Reset to first page when searching
  }, 500)
}

const editUser = (user) => {
  editingUser.value = { ...user }
}

const closeEditModal = () => {
  editingUser.value = null
}

const saveUserProfile = async (updatedUser) => {
  try {
    const result = await apiService.updateAnyUserProfile(updatedUser.id, {
      displayName: updatedUser.displayName,
      img: updatedUser.img,
      description: updatedUser.description,
      // department: updatedUser.department,
      location: updatedUser.location,
      experience: updatedUser.experience,
      skills: updatedUser.skills,
      learningGoals: updatedUser.learningGoals,
      availableForMentoring: updatedUser.availableForMentoring
    })
    
    if (result.success) {
      // Update local user data
      const userIndex = users.value.findIndex(u => u.id === updatedUser.id)
      if (userIndex !== -1) {
        users.value[userIndex] = { ...users.value[userIndex], ...updatedUser }
      }
      closeEditModal()
    }
  } catch (error) {
    console.error('Error updating user profile:', error)
  }
}

const toggleUserBlock = async (user) => {
  if (user.role !== 'mentee') return
  
  updatingUser.value = user.id
  try {
    const result = await apiService.updateUserBlockStatus(user.id, !user.isBlocked)
    if (result.success) {
      user.isBlocked = !user.isBlocked
    }
  } catch (error) {
    console.error('Error updating user block status:', error)
  } finally {
    updatingUser.value = null
  }
}
</script>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-2xl);
}

.admin-header {
  text-align: center;
  margin-bottom: var(--spacing-3xl);
}

.admin-header h2 {
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.admin-description {
  color: var(--color-text-tertiary);
  font-size: 1rem;
}

.loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-tertiary);
}

.filters-section {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.filter-group label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.filter-select,
.search-input {
  padding: var(--spacing-md);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background-color: var(--color-input-bg);
  color: var(--color-text-primary);
  transition: border-color var(--transition-base);
}

.filter-select:focus,
.search-input:focus {
  outline: none;
  border-color: var(--color-input-focus);
}

.results-info {
  display: flex;
  align-items: center;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

.users-list {
  display: grid;
  gap: var(--spacing-lg);
}

.pagination-section {
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.pagination-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-border-medium);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: var(--spacing-xs);
}

.page-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-medium);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  min-width: 40px;
  text-align: center;
}

.page-btn:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}

.page-btn.active {
  background: var(--color-primary-start);
  color: var(--color-text-inverse);
  border-color: var(--color-primary-start);
}

.pagination-info {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
}

.user-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all var(--transition-base);
}

.user-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-medium);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-full);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-primary-gradient);
  color: var(--color-text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: 1.2rem;
}

.user-details h3 {
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
}

.user-email {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.user-meta {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.role-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.mentee {
  background-color: var(--color-role-mentee-bg);
  color: var(--color-role-mentee-text);
}

.role-badge.mentor {
  background-color: var(--color-role-mentor-bg);
  color: var(--color-role-mentor-text);
}

.role-badge.admin {
  background-color: var(--color-role-admin-bg);
  color: var(--color-role-admin-text);
}

.blocked-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: var(--color-error-light);
  color: var(--color-error-dark);
}

.user-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-secondary,
.btn-danger,
.btn-success {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
  font-size: 0.9rem;
}

.btn-secondary {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-medium);
}

.btn-secondary:hover {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-dark);
}

.btn-danger {
  background-color: var(--color-error);
  color: var(--color-text-inverse);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-dark);
}

.btn-success {
  background-color: var(--color-success);
  color: var(--color-text-inverse);
}

.btn-success:hover:not(:disabled) {
  background-color: var(--color-success-dark);
}

.btn-danger:disabled,
.btn-success:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  max-width: 800px;
  max-height: 90vh;
  width: 90%;
  overflow: hidden;
  box-shadow: var(--shadow-modal);
}

.modal-header {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-base);
}

.close-btn:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.modal-body {
  max-height: calc(90vh - 80px);
  overflow-y: auto;
}

@media (max-width: 768px) {
  .admin-container {
    padding: var(--spacing-lg);
  }
  
  .user-card {
    flex-direction: column;
    gap: var(--spacing-lg);
  }
  
  .user-info {
    width: 100%;
    text-align: center;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .user-actions {
    width: 100%;
    justify-content: center;
  }
  
  .btn-secondary,
  .btn-danger,
  .btn-success {
    flex: 1;
  }
}
</style>