// Server-side only database connection
// This file should only be imported in server-side code or API routes

let db = null;

// Initialize database connection (lazy loading for server-side)
export async function initDatabase() {
  // WARNING: Direct database connection from client-side is NOT recommended for production
  // This should be replaced with proper API endpoints
  if (!db) {
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const { neon } = await import('@neondatabase/serverless');
    const schema = await import('./schema.js');
    
    const dotenv = await import('dotenv');
    dotenv.config();

    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
    }

    // Create Neon serverless connection
    const sql = neon(connectionString);

    // Create Drizzle database instance
    db = drizzle(sql, {schema: schema,logger: process.env.NODE_ENV === 'development'});
  }

  return db;
}

// Export db getter function instead of direct instance
export async function getDb() {
  return await initDatabase();
}

// Connection health check
export async function checkDatabaseConnection() {
  try {
    const result = await sql`SELECT 1 as health_check`;
    return {success: true,
      message: 'Database connection healthy',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {success: false,message: 'Database connection failed',error: error.message,timestamp: new Date().toISOString()};
  }
}

// Connection pool statistics (for monitoring)
export async function getDatabaseStats() {
  try {
    const result = await sql`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as version,
        now() as server_time
    `;
    return {success: true,stats: result[0]};
  } catch (error) {
    return {success: false,error: error.message};
  }
}