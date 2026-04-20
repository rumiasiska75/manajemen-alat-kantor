const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const database = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

async function getUserBorrowingTimeline(userId, { statuses = null } = {}) {
  const statusFilter = Array.isArray(statuses) && statuses.length > 0;
  const placeholders = statusFilter ? statuses.map(() => '?').join(', ') : '';
  const borrowings = await database.query(
    `SELECT
       b.id,
       b.user_id,
       b.status,
       b.borrow_date,
       b.expected_return_date,
       b.actual_return_date,
       b.notes,
       b.photo_evidence,
       b.created_at,
       b.updated_at
     FROM borrowings b
     WHERE b.user_id = ?
       ${statusFilter ? `AND b.status IN (${placeholders})` : ''}
     ORDER BY
       CASE WHEN b.status IN ('active', 'approved') THEN 0 ELSE 1 END,
       COALESCE(b.actual_return_date, b.borrow_date, b.created_at) DESC,
       b.id DESC`,
    statusFilter ? [userId, ...statuses] : [userId]
  );

  for (const borrowing of borrowings) {
    const items = await database.query(
      `SELECT
         bi.id,
         bi.tool_id,
         bi.quantity,
         bi.condition_before,
         bi.condition_after,
         bi.notes,
         t.name AS tool_name,
         t.serial_number,
         t.category,
         t.item_type,
         t.image_path
       FROM borrowing_items bi
       JOIN tools t ON t.id = bi.tool_id
       WHERE bi.borrowing_id = ?
       ORDER BY t.name ASC`,
      [borrowing.id]
    );

    borrowing.items = items;
    borrowing.items_count = items.length;
  }

  return borrowings;
}

async function getUserAuditPayload(userId) {
  const user = await database.get(
    `SELECT id, username, email, full_name, role, phone, created_at, updated_at
     FROM users
     WHERE id = ?`,
    [userId]
  );

  if (!user) {
    return null;
  }

  const [activeBorrowings, borrowingHistory, stats] = await Promise.all([
    getUserBorrowingTimeline(userId, { statuses: ['active', 'approved'] }),
    getUserBorrowingTimeline(userId, {
      statuses: ['returned', 'cancelled'],
    }),
    (async () => {
      const [totalBorrowings, activeCount, returnedCount, cancelledCount] =
        await Promise.all([
          database.get('SELECT COUNT(*) as count FROM borrowings WHERE user_id = ?', [
            userId,
          ]),
          database.get(
            'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status IN ("active", "approved")',
            [userId]
          ),
          database.get(
            'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = "returned"',
            [userId]
          ),
          database.get(
            'SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = "cancelled"',
            [userId]
          ),
        ]);

      return {
        total_borrowings: totalBorrowings.count,
        active_borrowings: activeCount.count,
        returned_borrowings: returnedCount.count,
        cancelled_borrowings: cancelledCount.count,
      };
    })(),
  ]);

  user.statistics = stats;

  return {
    user,
    active_borrowings: activeBorrowings,
    borrowing_history: borrowingHistory,
  };
}

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.phone,
        u.created_at,
        u.updated_at,
        COALESCE(total_stats.total_borrowings, 0) AS total_borrowings,
        COALESCE(active_stats.active_borrowings, 0) AS active_borrowings,
        COALESCE(returned_stats.returned_borrowings, 0) AS returned_borrowings,
        COALESCE(active_tools.active_tool_names, '') AS active_tool_names
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS total_borrowings
        FROM borrowings
        GROUP BY user_id
      ) total_stats ON total_stats.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS active_borrowings
        FROM borrowings
        WHERE status IN ('active', 'approved')
        GROUP BY user_id
      ) active_stats ON active_stats.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS returned_borrowings
        FROM borrowings
        WHERE status = 'returned'
        GROUP BY user_id
      ) returned_stats ON returned_stats.user_id = u.id
      LEFT JOIN (
        SELECT
          current_borrowings.user_id,
          GROUP_CONCAT(current_borrowings.tool_name, ', ') AS active_tool_names
        FROM (
          SELECT DISTINCT
            b.user_id,
            t.name AS tool_name
          FROM borrowings b
          JOIN borrowing_items bi ON bi.borrowing_id = b.id
          JOIN tools t ON t.id = bi.tool_id
          WHERE b.status IN ('active', 'approved')
          ORDER BY t.name ASC
        ) current_borrowings
        GROUP BY current_borrowings.user_id
      ) active_tools ON active_tools.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY u.created_at DESC';

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

// @route   GET /api/users/:id/audit
// @desc    Get borrowing audit for single user (Admin only)
// @access  Private (Admin)
router.get('/:id(\\d+)/audit', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await getUserAuditPayload(id);

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    res.json({
      success: true,
      data: audit
    });
  } catch (error) {
    console.error('Error getting user audit:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil audit pengguna.',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id/export
// @desc    Get user audit export payload (Admin only)
// @access  Private (Admin)
router.get('/:id(\\d+)/export', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await getUserAuditPayload(id);

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    const summaryRows = [
      {
        'Nama Lengkap': audit.user.full_name,
        Username: audit.user.username,
        Email: audit.user.email,
        Role: audit.user.role,
        Telepon: audit.user.phone || '-',
        'Tanggal Dibuat': audit.user.created_at,
        'Total Peminjaman': audit.user.statistics.total_borrowings,
        'Peminjaman Aktif': audit.user.statistics.active_borrowings,
        'Peminjaman Dikembalikan': audit.user.statistics.returned_borrowings,
        'Peminjaman Dibatalkan': audit.user.statistics.cancelled_borrowings,
      },
    ];

    const activeRows = audit.active_borrowings.flatMap((borrowing) =>
      borrowing.items.map((item) => ({
        'ID Peminjaman': borrowing.id,
        Status: borrowing.status,
        'Tanggal Pinjam': borrowing.borrow_date || '-',
        'Rencana Kembali': borrowing.expected_return_date || '-',
        'Nama Barang': item.tool_name,
        'Serial Number': item.serial_number,
        Kategori: item.category || '-',
        Jenis: item.item_type || '-',
        Jumlah: item.quantity,
        'Kondisi Awal': item.condition_before || '-',
        Catatan: item.notes || borrowing.notes || '-',
      }))
    );

    const historyRows = audit.borrowing_history.flatMap((borrowing) =>
      borrowing.items.map((item) => ({
        'ID Peminjaman': borrowing.id,
        Status: borrowing.status,
        'Tanggal Pinjam': borrowing.borrow_date || '-',
        'Rencana Kembali': borrowing.expected_return_date || '-',
        'Tanggal Kembali': borrowing.actual_return_date || '-',
        'Nama Barang': item.tool_name,
        'Serial Number': item.serial_number,
        Kategori: item.category || '-',
        Jenis: item.item_type || '-',
        Jumlah: item.quantity,
        'Kondisi Awal': item.condition_before || '-',
        'Kondisi Akhir': item.condition_after || '-',
        Catatan: item.notes || borrowing.notes || '-',
      }))
    );

    res.json({
      success: true,
      data: {
        user: audit.user,
        summary: summaryRows,
        active_borrowings: activeRows,
        borrowing_history: historyRows,
      }
    });
  } catch (error) {
    console.error('Error exporting user audit:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menyiapkan export audit pengguna.',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user (Admin only)
// @access  Private (Admin)
router.get('/:id(\\d+)', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const audit = await getUserAuditPayload(id);

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    res.json({
      success: true,
      data: {
        ...audit.user,
        active_borrowings_detail: audit.active_borrowings,
        borrowing_history: audit.borrowing_history,
      }
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
router.put('/:id(\\d+)', authenticateToken, isAdmin, async (req, res) => {
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
router.delete('/:id(\\d+)', authenticateToken, isAdmin, async (req, res) => {
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
