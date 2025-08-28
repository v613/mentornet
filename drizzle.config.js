import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.js',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    connectionString: process.env.NETLIFY_DATABASE_URL,
  },
  verbose: true,
  strict: true,
});