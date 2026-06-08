require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing and CORS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Configure PostgreSQL
const dbUrl = process.env.DATABASE_URL || '';
const pool = new Pool({
    connectionString: dbUrl,
    // When deploying to Railway production with a public URL, SSL is required.
    ssl: dbUrl.includes('railway.internal') ? false : { rejectUnauthorized: false }
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- API ENDPOINTS ---

// GET /api/content
// Returns the CMS state as a JSON object, mapping keys to values
app.get('/api/content', async (req, res) => {
    try {
        const result = await pool.query('SELECT key, value FROM cms_data');
        const items = {};
        result.rows.forEach(row => {
            items[row.key] = row.value;
        });
        res.json({ version: 1, items: items });
    } catch (err) {
        console.error('Error fetching content:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/content
// Receives the entire CMS items object and updates the database
app.post('/api/content', async (req, res) => {
    const { items } = req.body;
    if (!items || typeof items !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Very basic approach: update or insert keys
        for (const [key, value] of Object.entries(items)) {
            let finalValue = value;
            
            // If the value is a base64 data URL, upload to Cloudinary
            if (typeof value === 'string' && value.startsWith('data:image')) {
                console.log(`Uploading ${key} to Cloudinary...`);
                const uploadRes = await cloudinary.uploader.upload(value, {
                    folder: 'portfolio'
                });
                finalValue = uploadRes.secure_url;
            } else if (typeof value === 'string' && value.startsWith('data:video')) {
                console.log(`Uploading video ${key} to Cloudinary...`);
                const uploadRes = await cloudinary.uploader.upload(value, {
                    resource_type: 'video',
                    folder: 'portfolio'
                });
                finalValue = uploadRes.secure_url;
            }

            await client.query(
                `INSERT INTO cms_data (key, value) 
                 VALUES ($1, $2) 
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [key, finalValue]
            );
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Content saved successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving content:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// --- STATIC FILES ---
app.use(express.static(path.join(__dirname)));

// Catch-all route to serve index.html for unknown routes (like frontend routing if any)
app.get('*', (req, res, next) => {
    if (!req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        next();
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de Lucia Montaña corriendo en el puerto ${PORT}`);
});
