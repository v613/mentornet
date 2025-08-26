#!/usr/bin/env node

// Build-time script to populate config.js with environment variables
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configTemplate = `// Runtime configuration - populated during build
window.ENV_CONFIG = {
  FIREBASE_API_KEY: '${process.env.VITE_FIREBASE_API_KEY || ''}',
  FIREBASE_AUTH_DOMAIN: '${process.env.VITE_FIREBASE_AUTH_DOMAIN || ''}',
  FIREBASE_PROJECT_ID: '${process.env.VITE_FIREBASE_PROJECT_ID || ''}',
  FIREBASE_STORAGE_BUCKET: '${process.env.VITE_FIREBASE_STORAGE_BUCKET || ''}',
  FIREBASE_MESSAGING_SENDER_ID: '${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}',
  FIREBASE_APP_ID: '${process.env.VITE_FIREBASE_APP_ID || ''}',
  PERMIT_API_KEY: '${process.env.VITE_PERMIT_API_KEY || ''}'
};`;

const outputPath = join(__dirname, '../dist/config.js');

try {
  writeFileSync(outputPath, configTemplate);
  console.log('✅ Runtime configuration built successfully');
  console.log(`📁 Config written to: ${outputPath}`);
} catch (error) {
  console.error('❌ Failed to build runtime configuration:', error);
  process.exit(1);
}