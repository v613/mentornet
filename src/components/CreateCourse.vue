<template>
  <div class="create-course-overlay" @click="closeModal">
    <div class="create-course-modal" @click.stop>
      <div class="modal-header">
        <h2>Create New Course</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="createCourse" class="course-form">
        <div class="form-group">
          <label for="title">Course Title *</label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            required
            placeholder="Enter course title"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label for="description">Course Description *</label>
          <textarea
            id="description"
            v-model="form.description"
            required
            placeholder="Describe what students will learn in this course"
            rows="4"
            class="form-textarea"
          ></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="category">Category *</label>
            <select
              id="category"
              v-model="form.category"
              required
              class="form-select"
            >
              <option value="">Select category</option>
              <option value="technical">Technical Skills</option>
              <option value="leadership">Leadership</option>
              <option value="communication">Communication</option>
              <option value="career">Career Development</option>
              <option value="business">Business Skills</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="level">Difficulty Level *</label>
            <select
              id="level"
              v-model="form.level"
              required
              class="form-select"
            >
              <option value="">Select level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="duration">Duration (weeks) *</label>
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
            <label for="maxEnrollment">Max Students *</label>
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
          <label>Skills Covered</label>
          <div class="skills-section">
            <div 
              v-for="(skill, index) in form.skills" 
              :key="index"
              class="skill-item"
            >
              <input
                v-model="form.skills[index]"
                type="text"
                placeholder="Enter skill"
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
              + Add Skill
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>Prerequisites</label>
          <div class="prerequisites-section">
            <div 
              v-for="(prerequisite, index) in form.prerequisites" 
              :key="index"
              class="prerequisite-item"
            >
              <input
                v-model="form.prerequisites[index]"
                type="text"
                placeholder="Enter prerequisite"
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
              + Add Prerequisite
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="objectives">Learning Objectives</label>
          <textarea
            id="objectives"
            v-model="form.objectives"
            placeholder="What will students achieve after completing this course?"
            rows="3"
            class="form-textarea"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Course Settings</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input 
                v-model="form.isPublic" 
                type="checkbox"
                class="checkbox-input"
              />
              Make course publicly visible
            </label>
            <label class="checkbox-label">
              <input 
                v-model="form.allowSelfEnrollment" 
                type="checkbox"
                class="checkbox-input"
              />
              Allow students to apply directly
            </label>
            <label class="checkbox-label">
              <input 
                v-model="form.certificateOffered" 
                type="checkbox"
                class="checkbox-input"
              />
              Offer certificate upon completion
            </label>
          </div>
        </div>
        
        <div class="form-actions">
          <button 
            type="button" 
            @click="closeModal"
            class="cancel-btn"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="saveDraft"
            :disabled="loading"
            class="draft-btn"
          >
            Save as Draft
          </button>
          <button 
            type="submit" 
            :disabled="loading"
            class="submit-btn"
          >
            <span v-if="loading">Creating...</span>
            <span v-else>Create & Publish</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { databaseService } from '../services/database'

const emit = defineEmits(['close', 'course-created'])

const loading = ref(false)

const form = ref({
  title: '',
  description: '',
  category: '',
  level: '',
  duration: 8,
  maxEnrollment: 20,
  skills: [''],
  prerequisites: [''],
  objectives: '',
  isPublic: true,
  allowSelfEnrollment: true,
  certificateOffered: false
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
    
    const courseData = {
      title: form.value.title,
      description: form.value.description,
      category: form.value.category,
      level: form.value.level,
      duration: form.value.duration,
      maxEnrollment: form.value.maxEnrollment,
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
    
    const result = await databaseService.createCourse(courseData)
    
    if (result.success) {
      emit('course-created', {
        id: result.courseId,
        ...courseData
      })
      
      // Reset form
      form.value = {
        title: '',
        description: '',
        category: '',
        level: '',
        duration: 8,
        maxEnrollment: 20,
        skills: [''],
        prerequisites: [''],
        objectives: '',
        isPublic: true,
        allowSelfEnrollment: true,
        certificateOffered: false
      }
      
      alert(`Course ${status === 'draft' ? 'saved as draft' : 'created and published'} successfully!`)
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('Error creating course:', error)
    alert('Error creating course: ' + error.message)
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