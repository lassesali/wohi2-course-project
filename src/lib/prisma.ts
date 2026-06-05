import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

// Safely convert mysql:// string into mariadb:// for the adapter compatibility
const nativeConnectionString = connectionString.replace(/^mysql:\/\//, 'mariadb://');

// Instantiate the MariaDB/MySQL adapter directly
const adapter = new PrismaMariaDb(nativeConnectionString);

export const prisma = new PrismaClient({ adapter });