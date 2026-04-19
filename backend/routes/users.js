const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const database = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = `
      SELECT id, username, email, full_name, role, phone, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    const users = await database.query(query, params);

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data pengguna.',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user (Admin only)
// @access  Private (Admin)
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await database.get(
      'SELECT id, username, email, full_name, role, phone, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    // Get user statistics
    const stats = {};

    const borrowingsCount = await database.get(
      'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ?',
      [id]
    );
    stats.total_borrowings = borrowingsCount.count;

    const activeBorrowings = await database.get(
      'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = "active"',
      [id]
    );
    stats.active_borrowings = activeBorrowings.count;

    const returnedBorrowings = await database.get(
      'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = "returned"',
      [id]
    );
    stats.returned_borrowings = returnedBorrowings.count;

    user.statistics = stats;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data pengguna.',
      error: error.message
    });
  }
});

// @route   POST /api/users
// @desc    Create new user (Admin only)
// @access  Private (Admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
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

    // Validate role
    const userRole = (role === 'admin' || role === 'user') ? role : 'user';

    // Insert new user
    const result = await database.run(
      `INSERT INTO users (username, email, password, full_name, phone, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, full_name, phone || null, userRole]
    );

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'CREATE_USER', 'user', result.id, `Created user: ${username}`]
    );

    // Get created user
    const newUser = await database.get(
      'SELECT id, username, email, full_name, role, phone, created_at FROM users WHERE id = ?',
      [result.id]
    );

    res.status(201).json({
      success: true,
      message: 'Pengguna berhasil dibuat.',
      data: newUser
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat pengguna.',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (Admin only)
// @access  Private (Admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, full_name, phone, role } = req.body;

    // Check if user exists
    const existingUser = await database.get('SELECT * FROM users WHERE id = ?', [id]);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    // Prevent admin from demoting themselves
    if (existingUser.id === req.user.id && role === 'user') {
      return res.status(400).json({
        success: false,
        message: 'Anda tidak dapat mengubah role Anda sendiri.'
      });
    }

    // If username is being changed, check if new username is available
    if (username && username !== existingUser.username) {
      const usernameExists = await database.get(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, id]
      );

      if (usernameExists) {
        return res.status(409).json({
          success: false,
          message: 'Username sudah digunakan.'
        });
      }
    }

    // If email is being changed, check if new email is available
    if (email && email !== existingUser.email) {
      const emailExists = await database.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Email sudah terdaftar.'
        });
      }
    }

    // Prepare update fields
    const updateFields = [];
    const updateParams = [];

    if (username) {
      updateFields.push('username = ?');
      updateParams.push(username);
    }
    if (email) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }
    if (full_name) {
      updateFields.push('full_name = ?');
      updateParams.push(full_name);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateParams.push(phone);
    }
    if (role && (role === 'admin' || role === 'user')) {
      updateFields.push('role = ?');
      updateParams.push(role);
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password minimal 6 karakter.'
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateParams.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data yang diubah.'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    // Update user
    await database.run(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'UPDATE_USER', 'user', id, `Updated user: ${username || existingUser.username}`]
    );

    // Get updated user
    const updatedUser = await database.get(
      'SELECT id, username, email, full_name, role, phone, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Pengguna berhasil diperbarui.',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memperbarui pengguna.',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only)
// @access  Private (Admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await database.get('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Anda tidak dapat menghapus akun Anda sendiri.'
      });
    }

    // Check if user has active borrowings
    const activeBorrowing = await database.get(
      'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status IN ("active", "approved")',
      [id]
    );

    if (activeBorrowing.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus pengguna yang memiliki peminjaman aktif.'
      });
    }

    // Delete user
    await database.run('DELETE FROM users WHERE id = ?', [id]);

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'DELETE_USER', 'user', id, `Deleted user: ${user.username}`]
    );

    res.json({
      success: true,
      message: 'Pengguna berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus pengguna.',
      error: error.message
    });
  }
});

// @route   GET /api/users/stats/summary
// @desc    Get users statistics (Admin only)
// @access  Private (Admin)
router.get('/stats/summary', authenticateToken, isAdmin, async (req, res) => {
  try {
    const stats = {};

    const totalUsers = await database.get('SELECT COUNT(*) as count FROM users');
    stats.total_users = totalUsers.count;

    const adminUsers = await database.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
    stats.admin_users = adminUsers.count;

    const regularUsers = await database.get('SELECT COUNT(*) as count FROM users WHERE role = "user"');
    stats.regular_users = regularUsers.count;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil statistik pengguna.',
      error: error.message
    });
  }
});

module.exports = router;
