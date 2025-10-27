// backend/src/db/index.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // For connecting to external servers like AWS RDS
    ssl: {
        rejectUnauthorized: false
    }
});
/**
 * Executes a SQL query against the database.
 * @param text The SQL query string.
 * @param params An array of parameters to pass to the query.
 * @returns A promise that resolves with the query result.
 */
export const query = (text, params) => {
    return pool.query(text, params);
};
console.log('PostgreSQL connection pool initialized.');
//# sourceMappingURL=index.js.map