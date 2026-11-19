require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'admission_db',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10
});

// Auto-create table on startup
async function initDB() {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS admissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100) NOT NULL,
        phone VARCHAR(25) NOT NULL,
        cnic VARCHAR(25) NOT NULL,
        program VARCHAR(100) NOT NULL,
        marks VARCHAR(50),
        photo LONGTEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    conn.release();
    console.log('Database connected & table ready!');
  } catch (err) {
    console.error('Database Error:', err.message);
  }
}
initDB();

// Admin Auth Middleware
function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Galat Admin Password!' });
  }
  next();
}

// 1. Submit Admission Form (Public)
app.post('/api/admissions', async (req, res) => {
  try {
    const { full_name, father_name, phone, cnic, program, marks, photo } = req.body;
    if (!full_name || !father_name || !phone || !cnic || !program) {
      return res.status(400).json({ error: 'Tamam zaroori fields fill karein.' });
    }

    const [result] = await pool.query(
      `INSERT INTO admissions (full_name, father_name, phone, cnic, program, marks, photo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, father_name, phone, cnic, program, marks || '', photo || '']
    );

    res.status(201).json({ message: 'Application submit ho gayi!', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 2. Get All Admissions (Admin Only)
app.get('/api/admissions', checkAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admissions ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Status (Admin Only)
app.patch('/api/admissions/:id', checkAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE admissions SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status update ho gaya.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Application (Admin Only)
app.delete('/api/admissions/:id', checkAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM admissions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Record delete ho gaya.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;