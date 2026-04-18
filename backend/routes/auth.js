const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const database = require('../database');
const { generateToken } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, role } = req.body;

    // Validation
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, dan nama lengkap wajib diisi.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid.'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter.'
      });
    }

    // Check if username already exists
    const existingUsername = await database.get(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username sudah digunakan.'
      });
    }

    // Check if email already exists
    const existingEmail = await database.get(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Set default role to 'user' if not specified or if trying to register as admin
    const userRole = role === 'admin' ? 'user' : (role || 'user');

    // Insert new user
    const result = await database.run(
      `INSERT INTO users (username, email, password, full_name, phone, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, full_name, phone || null, userRole]
    );

    // Generate token
    const token = generateToken(result.id, username, userRole);

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [result.id, 'REGISTER', 'user', result.id, `User ${username} registered`]
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil.',
      data: {
        user: {
          id: result.id,
          username,
          email,
          full_name,
          phone,
          role: userRole
        },
        token
      }
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.'
      });
    }

    // Find user by username or email
    const user = await database.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.'
      });
    }

    // Generate token
    const token = generateToken(user.id, user.username, user.role);

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, 'LOGIN', 'user', user.id, `User ${user.username} logged in`]
    );

    res.json({
      success: true,
      message: 'Login berhasil.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan.'
      });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production-12345';

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Token tidak valid.'
        });
      }

      const user = await database.get(
        'SELECT id, username, email, full_name, phone, role, created_at FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.'
        });
      }

      res.json({
        success: true,
        data: user
      });
    });
  } catch (error) {
    console.error('Error in get me:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.'
    });
  }
});

module.exports = router;
