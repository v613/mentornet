// Runtime environment configuration
export function getEnvConfig() {
  // In development, use Vite's import.meta.env
  if (import.meta.env.DEV) {
    return {
      FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
      PERMIT_API_KEY: import.meta.env.VITE_PERMIT_API_KEY
    };
  }
  
  // In production, use runtime config from window
  return window.ENV_CONFIG || {
    FIREBASE_API_KEY: '',
    FIREBASE_AUTH_DOMAIN: '',
    FIREBASE_PROJECT_ID: '',
    FIREBASE_STORAGE_BUCKET: '',
    FIREBASE_MESSAGING_SENDER_ID: '',
    FIREBASE_APP_ID: '',
    PERMIT_API_KEY: ''
  };
}

export default getEnvConfig;