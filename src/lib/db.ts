import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// For Supabase, we use their JavaScript client directly in the API routes
// This file provides a simple postgres connection for Drizzle migrations
const connectionString = process.env.DATABASE_URL || '';

const client = postgres(connectionString);
export const db = drizzle(client);
