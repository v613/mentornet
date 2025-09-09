<template>
  <div v-if="showModal" class="time-slot-overlay" @click="handleCancel">
    <div class="time-slot-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ t('courses.details.selectTimeSlot') }}</h3>
        <button @click="handleCancel" class="close-btn">&times;</button>
      </div>
      <div class="time-slot-content">
        <p>{{ t('courses.details.choosePreferredTime') }}</p>
        <div class="time-slots-list">
          <label 
            v-for="(slot, index) in timeSlots" 
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
          <button @click="handleCancel" class="btn-secondary">
            {{ t('common.cancel') }}
          </button>
          <button @click="handleApply" class="btn-primary">
            {{ t('courses.details.applyWithTimeSlot') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  showModal: {
    type: Boolean,
    default: false
  },
  timeSlots: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['apply', 'cancel'])

const selectedTimeSlot = ref(null)

watch(() => props.showModal, (newValue) => {
  if (newValue) {
    selectedTimeSlot.value = null
  }
})

const formatTimeSlot = (slot) => {
  const day = t(`days.${slot.dayOfWeek}`)
  return `${day} ${slot.startTime} - ${slot.endTime} (${slot.maxParticipants} ${t('courses.maxParticipants')})`
}

const handleApply = () => {
  if (!selectedTimeSlot.value) {
    return
  }
  emit('apply', selectedTimeSlot.value)
}

const handleCancel = () => {
  selectedTimeSlot.value = null
  emit('cancel')
}
</script>

<style scoped>
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

@media (prefers-color-scheme: dark) {
  .time-slot-modal {
    background: var(--vt-c-black);
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
    background-color: var(--vt-c-black);
    border-bottom: 1px solid #e0e0e0;
  }
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .modal-header h3 {
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

.time-slot-content {
  padding: 1.5rem;
}

@media (prefers-color-scheme: dark) {
  .time-slot-content {
    background-color: var(--vt-c-black);
  }
}

.time-slot-content p {
  color: #666;
  margin-bottom: 1rem;
}

@media (prefers-color-scheme: dark) {
  .time-slot-content p {
    color: var(--vt-c-text-dark-2);
  }
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

@media (prefers-color-scheme: dark) {
  .time-slot-option:hover {
    background-color: var(--vt-c-black-soft);
  }
}

.time-slot-option input[type="radio"] {
  margin: 0;
}

.time-slot-label {
  font-weight: 500;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .time-slot-label {
    color: var(--vt-c-text-dark-2);
  }
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
</style>