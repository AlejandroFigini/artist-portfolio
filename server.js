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
if (dbUrl) {
    try {
        const urlObj = new URL(dbUrl);
        console.log(`Conectando a la base de datos en: ${urlObj.hostname}:${urlObj.port || 5432}${urlObj.pathname}`);
    } catch (e) {
        console.log('DATABASE_URL está definida pero no tiene un formato URL válido.');
    }
} else {
    console.error('CRÍTICO: DATABASE_URL no está definida en las variables de entorno.');
}

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

// Auto-initialize PostgreSQL tables
async function initDb() {
    try {
        console.log('Verifying and creating database tables if needed...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cms_data (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                value TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'text',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS multimedia (
                id SERIAL PRIMARY KEY,
                public_id VARCHAR(255) UNIQUE NOT NULL,
                url TEXT NOT NULL,
                format VARCHAR(10),
                type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database tables verified/created successfully.');
    } catch (err) {
        console.error('Error initializing database tables on startup:', err);
    }
}
initDb();

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

const { verify } = require('otplib');

// POST /api/login
// Valida credenciales de administrador y código 2FA (TOTP)
app.post('/api/login', async (req, res) => {
    const { user, pass, code } = req.body;
    
    // Configuramos estas variables en Railway
    const validUser = process.env.ADMIN_USER || 'admin';
    const validPass = process.env.ADMIN_PASS || 'artista2026';
    const secret = process.env.ADMIN_2FA_SECRET || 'RCS2JNYCF3CMDNOGRSHKSDEALFR3U527';

    if (user === validUser && pass === validPass) {
        if (!code) {
             return res.json({ success: true, require2FA: true, message: 'Credenciales válidas, ingrese código 2FA' });
        }
        
        try {
            const result = await verify({ token: code, secret: secret });
            if (result.valid) {
                res.json({ success: true, message: 'Login exitoso' });
            } else {
                res.status(401).json({ success: false, error: 'Código 2FA incorrecto' });
            }
        } catch (err) {
            console.error('Error verificando 2FA:', err);
            res.status(500).json({ success: false, error: 'Error interno verificando código' });
        }
    } else {
        res.status(401).json({ success: false, error: 'Credenciales inválidas' });
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

// POST /api/delete-media
// Deletes an asset from Cloudinary given its secure_url
app.post('/api/delete-media', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
        return res.status(400).json({ error: 'Invalid Cloudinary URL' });
    }

    try {
        // Extract public_id from Cloudinary URL
        // Example: https://res.cloudinary.com/.../upload/v1234567890/portfolio/test/image.webp
        // public_id is "portfolio/test/image"
        const match = url.match(/\/v\d+\/(.+)\.[a-zA-Z0-9]+$/);
        if (!match) {
            return res.status(400).json({ error: 'Could not extract public_id' });
        }
        
        const public_id = match[1];
        const isVideo = url.match(/\.(mp4|webm|mov)$/i);
        const resource_type = isVideo ? 'video' : 'image';

        console.log(`Deleting ${resource_type} from Cloudinary: ${public_id}`);
        const result = await cloudinary.uploader.destroy(public_id, { resource_type });
        
        res.json({ success: true, result });
    } catch (err) {
        console.error('Error deleting media from Cloudinary:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/upload-test
// Receives a base64 string and uploads it to Cloudinary to test optimization.
// Returns original and final size/format details.
app.post('/api/upload-test', async (req, res) => {
    const { base64Data, originalSize, originalName } = req.body;
    if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        let uploadRes;
        if (base64Data.startsWith('data:image')) {
            console.log(`Testing image upload for ${originalName}...`);
            uploadRes = await cloudinary.uploader.upload(base64Data, {
                folder: 'portfolio/test',
                format: 'webp',
                quality: 'auto'
            });
        } else if (base64Data.startsWith('data:video')) {
            console.log(`Testing video upload for ${originalName}...`);
            uploadRes = await cloudinary.uploader.upload(base64Data, {
                resource_type: 'video',
                folder: 'portfolio/test',
                format: 'webm',
                quality: 'auto'
            });
        } else {
             return res.status(400).json({ error: 'Unsupported file type' });
        }

        res.json({
            success: true,
            secure_url: uploadRes.secure_url,
            final_bytes: uploadRes.bytes,
            final_format: uploadRes.format,
            original_size: originalSize,
            original_name: originalName,
            asset_id: uploadRes.asset_id
        });
    } catch (err) {
        console.error('Error during upload test:', err);
        res.status(500).json({ error: 'Internal server error' });
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
