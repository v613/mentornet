import { neon } from '@neondatabase/serverless';

let db = null;

/**
 * Get database connection instance
 * @returns {Promise<Function>} Database query function
 */
export async function getDb() {
  if (!db) {
    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
    }
    
    db = neon(connectionString);
  }
  return db;
}

/**
 * Execute database query with error handling
 * @param {string} query SQL query
 * @param {Array} params Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function executeQuery(query, params = []) {
  try {
    const database = await getDb();
    const result = await database(query, params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Database query error:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code || 'DB_ERROR'
    };
  }
}

/**
 * Execute transaction with multiple queries
 * @param {Array<{query: string, params: Array}>} queries Array of query objects
 * @returns {Promise<Object>} Transaction result
 */
export async function executeTransaction(queries) {
  const database = await getDb();
  
  try {
    // Note: Neon serverless doesn't support traditional transactions
    // This is a sequential execution for consistency
    const results = [];
    
    for (const { query, params = [] } of queries) {
      const result = await database(query, params);
      results.push(result);
    }
    
    return { success: true, data: results };
  } catch (error) {
    console.error('Transaction error:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code || 'TRANSACTION_ERROR'
    };
  }
}