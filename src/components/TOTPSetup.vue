<template>
  <div class="totp-setup-modal">
    <div class="modal-overlay" @click="$emit('cancel')"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ $t('totp.setup.title') }}</h2>
        <button @click="$emit('cancel')" class="close-button">
          <span>&times;</span>
        </button>
      </div>
      
      <div class="modal-body">
        <div v-if="step === 1" class="setup-step">
          <div class="step-header">
            <h3>{{ $t('totp.setup.step1Title') }}</h3>
            <p>{{ $t('totp.setup.step1Description') }}</p>
          </div>
          
          <div v-if="qrCodeDataUrl" class="qr-section">
            <div class="qr-code-container">
              <img :src="qrCodeDataUrl" :alt="$t('totp.setup.qrCodeAlt')" class="qr-code" />
            </div>
            <div class="secret-text">
              <p>{{ $t('totp.setup.manualEntry') }}</p>
              <code class="secret-code">{{ secret }}</code>
              <button @click="copySecret" class="copy-button">
                {{ copied ? $t('totp.setup.copied') : $t('totp.setup.copy') }}
              </button>
            </div>
          </div>
          
          <div v-else-if="loading" class="loading-section">
            <div class="spinner"></div>
            <p>{{ $t('totp.setup.generatingQr') }}</p>
          </div>
          
          <div v-else-if="error" class="error-section">
            <p class="error-message">{{ error }}</p>
            <button @click="initializeSetup" class="retry-button">
              {{ $t('totp.setup.retry') }}
            </button>
          </div>
          
          <div class="step-actions">
            <button @click="$emit('cancel')" class="btn-secondary">
              {{ $t('totp.setup.cancel') }}
            </button>
            <button @click="nextStep" :disabled="!qrCodeDataUrl" class="btn-primary">
              {{ $t('totp.setup.next') }}
            </button>
          </div>
        </div>
        
        <div v-if="step === 2" class="setup-step">
          <div class="step-header">
            <h3>{{ $t('totp.setup.step2Title') }}</h3>
            <p>{{ $t('totp.setup.step2Description') }}</p>
          </div>
          
          <div class="verification-section">
            <TOTPInput
              v-model="verificationCode"
              :label="$t('totp.setup.verificationLabel')"
              :help-text="$t('totp.setup.verificationHelp')"
              :error-message="verificationError"
              :disabled="verifying"
              @complete="verifySetup"
              ref="totpInput"
            />
          </div>
          
          <div class="step-actions">
            <button @click="previousStep" :disabled="verifying" class="btn-secondary">
              {{ $t('totp.setup.back') }}
            </button>
            <button @click="verifySetup" :disabled="verificationCode.length !== 6 || verifying" class="btn-primary">
              {{ verifying ? $t('totp.setup.verifying') : $t('totp.setup.verify') }}
            </button>
          </div>
        </div>
        
        <div v-if="step === 3" class="setup-step">
          <div class="success-section">
            <div class="success-icon">✓</div>
            <h3>{{ $t('totp.setup.successTitle') }}</h3>
            <p>{{ $t('totp.setup.successDescription') }}</p>
          </div>
          
          <div class="step-actions">
            <button @click="$emit('complete')" class="btn-primary">
              {{ $t('totp.setup.finish') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiService } from '../services/api.js'
import TOTPInput from './TOTPInput.vue'

const { t } = useI18n()
const emit = defineEmits(['cancel', 'complete'])

const step = ref(1)
const loading = ref(false)
const error = ref('')
const qrCodeDataUrl = ref('')
const secret = ref('')
const verificationCode = ref('')
const verificationError = ref('')
const verifying = ref(false)
const copied = ref(false)
const totpInput = ref(null)

onMounted(() => {
  initializeSetup()
})

const initializeSetup = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await apiService.setupTotp()
    if (response.success) {
      qrCodeDataUrl.value = response.qrCodeDataUrl
      secret.value = response.secret
    } else {
      error.value = response.error || t('totp.setup.errors.setupFailed')
    }
  } catch (err) {
    error.value = t('totp.setup.errors.networkError')
  } finally {
    loading.value = false
  }
}

const copySecret = async () => {
  try {
    await navigator.clipboard.writeText(secret.value)
    copied.value = true
    setTimeout(() => {copied.value = false}, 2000)
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = secret.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copied.value = true
    setTimeout(() => {copied.value = false}, 2000)
  }
}

const nextStep = () => {
  step.value = 2
  nextTick(() => {
    if (totpInput.value) {
      totpInput.value.focus()
    }
  })
}

const previousStep = () => {
  step.value = 1
  verificationCode.value = ''
  verificationError.value = ''
}

const verifySetup = async () => {
  if (verificationCode.value.length !== 6) {
    verificationError.value = t('totp.setup.errors.incompleteCode')
    return
  }
  
  verifying.value = true
  verificationError.value = ''
  
  try {
    const response = await apiService.verifyTotpSetup(verificationCode.value)
    if (response.success) {
      step.value = 3
    } else {
      const errorMap = {
        'INVALID_CODE': 'totp.setup.errors.invalidCode',
        'RATE_LIMITED': 'totp.setup.errors.rateLimited',
        'TOTP_ALREADY_ENABLED': 'totp.setup.errors.alreadyEnabled'
      }
      const errorKey = errorMap[response.errorCode]
      verificationError.value = errorKey ? t(errorKey) : (response.error || t('totp.setup.errors.verificationFailed'))
    }
  } catch (err) {
    verificationError.value = t('totp.setup.errors.networkError')
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.totp-setup-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

@media (prefers-color-scheme: dark) {
  .modal-content {
    background: var(--vt-c-black-mute);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.5rem;
  font-weight: var(--font-weight-semibold);
}

@media (prefers-color-scheme: dark) {
  .modal-header h2 {
    color: var(--vt-c-text-dark-2);
  }
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

@media (prefers-color-scheme: dark) {
  .close-button {
    color: var(--vt-c-text-dark-2);
  }
}

.close-button:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

@media (prefers-color-scheme: dark) {
  .close-button:hover {
    background: var(--vt-c-black);
    color: var(--vt-c-text-dark-1);
  }
}

.modal-body {
  padding: var(--spacing-xl);
}

.setup-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.step-header h3 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  font-weight: var(--font-weight-semibold);
}

@media (prefers-color-scheme: dark) {
  .step-header h3 {
    color: var(--vt-c-text-dark-2);
  }
}

.step-header p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .step-header p {
    color: var(--vt-c-text-dark-2);
  }
}

.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xl);
}

.qr-code-container {
  padding: var(--spacing-lg);
  background: white;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.qr-code {
  display: block;
  width: 200px;
  height: 200px;
}

.secret-text {
  text-align: center;
  max-width: 100%;
}

.secret-text p {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .secret-text p {
    color: var(--vt-c-text-dark-2);
  }
}

.secret-code {
  display: inline-block;
  background: var(--color-bg-secondary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  word-break: break-all;
  margin: 0 var(--spacing-sm);
}

@media (prefers-color-scheme: dark) {
  .secret-code {
    background: var(--vt-c-black);
    color: var(--vt-c-text-dark-1);
  }
}

.copy-button {
  background: none;
  border: 1px solid var(--color-primary-start);
  color: var(--color-primary-start);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  margin-left: var(--spacing-sm);
  transition: all var(--transition-base);
}

.copy-button:hover {
  background: var(--color-primary-start);
  color: white;
}

.loading-section,
.error-section {
  text-align: center;
  padding: var(--spacing-xl);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border-light);
  border-top: 3px solid var(--color-primary-start);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--spacing-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  color: var(--color-error);
  margin-bottom: var(--spacing-lg);
}

.retry-button {
  background: var(--color-primary-start);
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.retry-button:hover {
  background: var(--color-primary-hover);
}

.verification-section {
  display: flex;
  justify-content: center;
}

.success-section {
  text-align: center;
  padding: var(--spacing-xl);
}

.success-icon {
  width: 60px;
  height: 60px;
  background: var(--color-success);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  margin: 0 auto var(--spacing-lg);
}

.success-section h3 {
  color: var(--color-success);
  margin-bottom: var(--spacing-sm);
}

.step-actions {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: flex-end;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.btn-primary,
.btn-secondary {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
}

.btn-primary {
  background: var(--color-primary-gradient);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-medium);
}

@media (prefers-color-scheme: dark) {
  .btn-secondary {
    background: var(--vt-c-black-mute);
    color: var(--vt-c-text-dark-1);
  }
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}

@media (prefers-color-scheme: dark) {
  .btn-secondary:hover:not(:disabled) {
    background: var(--vt-c-black);
  }
}

@media (max-width: 768px) {
  .modal-content {
    margin: var(--spacing-lg);
  }
  
  .qr-code {
    width: 160px;
    height: 160px;
  }
  
  .step-actions {
    flex-direction: column;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>