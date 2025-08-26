#!/usr/bin/env node

/**
 * Firebase to Permit.io User Migration CLI
 * 
 * This script migrates users from Firebase Firestore to Permit.io
 * using REST API calls.
 * 
 * Usage:
 *   node migrate-users.js [options]
 * 
 * Options:
 *   --all                Migrate all users
 *   --user <userId>      Migrate specific user by ID
 *   --dry-run           Show what would be migrated without actually doing it
 *   --init-roles        Initialize roles and permissions in Permit.io first
 *   --help              Show this help message
 * 
 * Environment Variables:
 *   FIREBASE_PROJECT_ID      - Firebase project ID
 *   PERMIT_API_KEY          - Permit.io API key
 *   FIREBASE_SERVICE_ACCOUNT - Path to Firebase service account JSON (optional)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  permitApiKey: process.env.PERMIT_API_KEY || process.env.VITE_PERMIT_API_KEY,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT,
  permitBaseUrl: 'https://api.permit.io',
  permitPdpUrl: 'https://cloudpdp.api.permit.io',
  dryRun: process.argv.includes('--dry-run'),
  initRoles: process.argv.includes('--init-roles'),
  help: process.argv.includes('--help'),
  migrateAll: process.argv.includes('--all'),
  specificUser: getArgValue('--user')
};

// Initialize Firebase Admin
let db;

function getArgValue(argName) {
  const index = process.argv.indexOf(argName);
  return index !== -1 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

function showHelp() {
  console.log(`
Firebase to Permit.io User Migration CLI

Usage:
  node migrate-users.js [options]

Options:
  --all                Migrate all users from Firebase to Permit.io
  --user <userId>      Migrate specific user by ID
  --dry-run           Show what would be migrated without actually doing it
  --init-roles        Initialize roles and permissions in Permit.io first
  --help              Show this help message

Environment Variables:
  FIREBASE_PROJECT_ID      Firebase project ID (required)
  PERMIT_API_KEY          Permit.io API key (required)
  FIREBASE_SERVICE_ACCOUNT Path to Firebase service account JSON (optional)

Examples:
  # Initialize roles first
  node migrate-users.js --init-roles
  
  # Migrate all users
  node migrate-users.js --all
  
  # Migrate specific user
  node migrate-users.js --user abc123
  
  # Dry run to see what would be migrated
  node migrate-users.js --all --dry-run
`);
}

async function initializeFirebase() {
  try {
    let app;
    
    if (CONFIG.serviceAccountPath && fs.existsSync(CONFIG.serviceAccountPath)) {
      // Use service account file
      const serviceAccount = JSON.parse(fs.readFileSync(CONFIG.serviceAccountPath, 'utf8'));
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: CONFIG.firebaseProjectId || serviceAccount.project_id
      });
      console.log('✅ Firebase initialized with service account');
    } else {
      // Use default credentials (ADC)
      app = initializeApp({
        projectId: CONFIG.firebaseProjectId
      });
      console.log('✅ Firebase initialized with default credentials');
    }
    
    db = getFirestore(app);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    return false;
  }
}

async function makePermitApiCall(endpoint, method = 'GET', body = null) {
  const url = `${CONFIG.permitBaseUrl}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CONFIG.permitApiKey}`,
      'Content-Type': 'application/json',
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  if (CONFIG.dryRun && method !== 'GET') {
    console.log(`[DRY RUN] ${method} ${url}`);
    if (body) console.log('[DRY RUN] Body:', JSON.stringify(body, null, 2));
    return { success: true, dryRun: true };
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function initializeRoles() {
  console.log('\n🚀 Initializing roles and permissions...');
  
  const roles = [
    {
      key: 'mentee',
      name: 'Mentee',
      description: 'Students seeking mentorship',
      permissions: ['course:read', 'session:create', 'session:read', 'session:update', 'application:create']
    },
    {
      key: 'mentor', 
      name: 'Mentor',
      description: 'Experienced professionals providing mentorship',
      permissions: ['course:create', 'course:read', 'course:update', 'session:create', 'session:read', 'session:update', 'application:read', 'application:update']
    },
    {
      key: 'admin',
      name: 'Administrator', 
      description: 'System administrators with full access',
      permissions: ['*']
    }
  ];

  let successCount = 0;
  
  for (const role of roles) {
    const result = await makePermitApiCall('/v2/schema/roles', 'POST', role);
    
    if (result.success) {
      console.log(`✅ Role '${role.key}' created successfully`);
      successCount++;
    } else if (result.error?.includes('409') || result.error?.includes('already exists')) {
      console.log(`⚠️  Role '${role.key}' already exists`);
      successCount++;
    } else {
      console.log(`❌ Failed to create role '${role.key}': ${result.error}`);
    }
  }
  
  console.log(`\n📊 Role initialization complete: ${successCount}/${roles.length} roles ready`);
  return successCount === roles.length;
}

async function migrateUser(userId, userData) {
  const permitUser = {
    key: userId,
    email: userData.email || `${userId}@example.com`,
    first_name: userData.displayName?.split(' ')[0] || userData.email?.split('@')[0] || userId,
    last_name: userData.displayName?.split(' ').slice(1).join(' ') || '',
    attributes: {
      firebase_uid: userId,
      email_verified: userData.emailVerified !== false,
      creation_time: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      last_sign_in: userData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      role: userData.role || 'mentee',
      ...(userData.attributes || {})
    }
  };

  // Create/update user in Permit.io
  let userResult = await makePermitApiCall('/v2/facts/users', 'POST', permitUser);
  
  if (!userResult.success && (userResult.error?.includes('409') || userResult.error?.includes('already exists'))) {
    // User exists, try to update
    userResult = await makePermitApiCall(`/v2/facts/users/${userId}`, 'PATCH', {
      email: permitUser.email,
      first_name: permitUser.first_name,
      last_name: permitUser.last_name,
      attributes: permitUser.attributes
    });
  }

  if (!userResult.success && !userResult.dryRun) {
    return { success: false, error: userResult.error };
  }

  // Assign role if user creation/update was successful
  const role = userData.role || 'mentee';
  const roleResult = await makePermitApiCall('/v2/facts/role_assignments', 'POST', {
    user: userId,
    role: role,
    tenant: 'default'
  });

  return {
    success: true,
    userCreated: userResult.success || userResult.dryRun,
    roleAssigned: roleResult.success || roleResult.dryRun,
    role: role,
    email: userData.email,
    dryRun: CONFIG.dryRun
  };
}

async function migrateAllUsers() {
  console.log('\n🚀 Starting bulk user migration...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.docs.length;
    
    console.log(`📊 Found ${totalUsers} users to migrate`);
    
    if (totalUsers === 0) {
      console.log('⚠️  No users found in Firebase');
      return { success: true, totalSynced: 0, totalFailed: 0, results: [] };
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      
      console.log(`\n🔄 Migrating user: ${userId} (${userData.email || 'no-email'})`);
      
      try {
        const result = await migrateUser(userId, userData);
        
        results.push({
          userId: userId,
          email: userData.email,
          role: userData.role,
          ...result
        });
        
        if (result.success) {
          successCount++;
          console.log(`✅ User ${userId} migrated successfully`);
        } else {
          errorCount++;
          console.log(`❌ User ${userId} failed: ${result.error}`);
        }
      } catch (error) {
        errorCount++;
        const errorResult = {
          userId: userId,
          email: userData.email,
          role: userData.role,
          success: false,
          error: error.message
        };
        results.push(errorResult);
        console.log(`❌ User ${userId} failed: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Migration completed:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📈 Total: ${totalUsers}`);

    return {
      success: true,
      totalSynced: successCount,
      totalFailed: errorCount,
      totalProcessed: totalUsers,
      results: results
    };
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function migrateSpecificUser(userId) {
  console.log(`\n🔄 Migrating specific user: ${userId}`);
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found in Firebase`);
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    const result = await migrateUser(userId, userData);
    
    if (result.success) {
      console.log(`✅ User ${userId} migrated successfully`);
    } else {
      console.log(`❌ User ${userId} failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Failed to migrate user ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔥 Firebase to Permit.io Migration CLI\n');

  // Show help
  if (CONFIG.help) {
    showHelp();
    return;
  }

  // Validate configuration
  if (!CONFIG.permitApiKey) {
    console.error('❌ Error: PERMIT_API_KEY environment variable is required');
    console.log('Set it with: export PERMIT_API_KEY=your_permit_api_key_here');
    process.exit(1);
  }

  if (!CONFIG.firebaseProjectId && !CONFIG.serviceAccountPath) {
    console.error('❌ Error: FIREBASE_PROJECT_ID environment variable is required');
    console.log('Set it with: export FIREBASE_PROJECT_ID=your_project_id_here');
    process.exit(1);
  }

  if (CONFIG.dryRun) {
    console.log('🧪 DRY RUN MODE - No actual changes will be made\n');
  }

  // Initialize Firebase
  const firebaseReady = await initializeFirebase();
  if (!firebaseReady) {
    process.exit(1);
  }

  try {
    // Initialize roles if requested
    if (CONFIG.initRoles) {
      const rolesReady = await initializeRoles();
      if (!rolesReady) {
        console.log('⚠️  Some roles failed to initialize, but continuing...');
      }
    }

    // Perform migration
    if (CONFIG.migrateAll) {
      const result = await migrateAllUsers();
      process.exit(result.success ? 0 : 1);
    } else if (CONFIG.specificUser) {
      const result = await migrateSpecificUser(CONFIG.specificUser);
      process.exit(result.success ? 0 : 1);
    } else {
      console.log('❌ Error: Specify --all, --user <userId>, or --help');
      console.log('Run with --help for usage information');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the CLI
main();