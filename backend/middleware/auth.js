const jwt = require('jsonwebtoken');
const database = require('../database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production-12345';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan. Silakan login terlebih dahulu.'
      });
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Token tidak valid atau telah kadaluarsa.'
        });
      }

      // Get user from database
      try {
        const user = await database.get(
          'SELECT id, username, email, full_name, role, phone FROM users WHERE id = ?',
          [decoded.userId]
        );

        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User tidak ditemukan.'
          });
        }

        // Attach user to request
        req.user = user;
        next();
      } catch (dbError) {
        console.error('Database error in auth middleware:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Terjadi kesalahan pada server.'
        });
      }
    });
  } catch (error) {
    console.error('Error in authenticateToken middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server.'
    });
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Anda harus login terlebih dahulu.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin yang dapat mengakses resource ini.'
    });
  }

  next();
};

// Middleware to check if user is authenticated (admin or regular user)
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Anda harus login terlebih dahulu.'
    });
  }

  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        req.user = null;
        return next();
      }

      try {
        const user = await database.get(
          'SELECT id, username, email, full_name, role, phone FROM users WHERE id = ?',
          [decoded.userId]
        );

        req.user = user || null;
        next();
      } catch (dbError) {
        req.user = null;
        next();
      }
    });
  } catch (error) {
    req.user = null;
    next();
  }
};

// Generate JWT token
const generateToken = (userId, username, role) => {
  return jwt.sign(
    { userId, username, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

module.exports = {
  authenticateToken,
  isAdmin,
  isAuthenticated,
  optionalAuth,
  generateToken
};
