require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function setup() {
    try {
        await client.connect();
        console.log('Connected to database.');
        const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        await client.query(sql);
        console.log('Tables created successfully.');
    } catch (err) {
        console.error('Error executing init.sql:', err);
    } finally {
        await client.end();
    }
}

setup();
