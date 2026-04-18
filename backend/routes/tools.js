const express = require('express');
const router = express.Router();
const database = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Helper function to generate QR code
async function generateQRCode(toolCode, toolId) {
  try {
    const qrDir = './qrcodes';
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrData = JSON.stringify({
      tool_id: toolId,
      tool_code: toolCode,
      type: 'office_equipment'
    });

    const qrFileName = `qr-${toolCode}-${Date.now()}.png`;
    const qrFilePath = path.join(qrDir, qrFileName);

    await QRCode.toFile(qrFilePath, qrData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      quality: 0.92,
      margin: 1,
      width: 300
    });

    return `/qrcodes/${qrFileName}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// @route   GET /api/tools
// @desc    Get all tools with optional filters
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, condition, available, search } = req.query;

    let query = `
      SELECT t.*, u.username as created_by_username, u.full_name as created_by_name
      FROM tools t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND t.category = ?';
      params.push(category);
    }

    if (condition) {
      query += ' AND t.condition = ?';
      params.push(condition);
    }

    if (available === 'true') {
      query += ' AND t.available_quantity > 0';
    }

    if (search) {
      query += ' AND (t.name LIKE ? OR t.tool_code LIKE ? OR t.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.created_at DESC';

    const tools = await database.query(query, params);

    res.json({
      success: true,
      data: tools,
      count: tools.length
    });
  } catch (error) {
    console.error('Error getting tools:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data alat.',
      error: error.message
    });
  }
});

// @route   GET /api/tools/:id
// @desc    Get single tool by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const tool = await database.get(
      `SELECT t.*, u.username as created_by_username, u.full_name as created_by_name
       FROM tools t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [id]
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Alat tidak ditemukan.'
      });
    }

    // Get borrowing history for this tool
    const borrowingHistory = await database.query(
      `SELECT b.*, u.username, u.full_name, bi.quantity, bi.condition_before, bi.condition_after
       FROM borrowing_items bi
       JOIN borrowings b ON bi.borrowing_id = b.id
       JOIN users u ON b.user_id = u.id
       WHERE bi.tool_id = ?
       ORDER BY b.borrow_date DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...tool,
        borrowing_history: borrowingHistory
      }
    });
  } catch (error) {
    console.error('Error getting tool:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data alat.',
      error: error.message
    });
  }
});

// @route   GET /api/tools/code/:toolCode
// @desc    Get tool by tool code (for QR scan)
// @access  Private
router.get('/code/:toolCode', authenticateToken, async (req, res) => {
  try {
    const { toolCode } = req.params;

    const tool = await database.get(
      `SELECT t.*, u.username as created_by_username, u.full_name as created_by_name
       FROM tools t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.tool_code = ?`,
      [toolCode]
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Alat dengan kode tersebut tidak ditemukan.'
      });
    }

    res.json({
      success: true,
      data: tool
    });
  } catch (error) {
    console.error('Error getting tool by code:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data alat.',
      error: error.message
    });
  }
});

// @route   POST /api/tools
// @desc    Create new tool (Admin only)
// @access  Private (Admin)
router.post('/', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { tool_code, name, category, description, quantity, condition, location } = req.body;

    // Validation
    if (!tool_code || !name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Kode alat, nama, dan kategori wajib diisi.'
      });
    }

    // Check if tool code already exists
    const existingTool = await database.get(
      'SELECT id FROM tools WHERE tool_code = ?',
      [tool_code]
    );

    if (existingTool) {
      return res.status(409).json({
        success: false,
        message: 'Kode alat sudah digunakan.'
      });
    }

    const toolQuantity = parseInt(quantity) || 1;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    // Insert tool first to get ID
    const result = await database.run(
      `INSERT INTO tools (tool_code, name, category, description, quantity, available_quantity,
                          condition, location, image_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tool_code,
        name,
        category,
        description || null,
        toolQuantity,
        toolQuantity,
        condition || 'baik',
        location || null,
        imagePath,
        req.user.id
      ]
    );

    const toolId = result.id;

    // Generate QR code
    try {
      const qrCodePath = await generateQRCode(tool_code, toolId);

      // Update tool with QR code path
      await database.run(
        'UPDATE tools SET qr_code_path = ? WHERE id = ?',
        [qrCodePath, toolId]
      );

      // Get the created tool
      const newTool = await database.get('SELECT * FROM tools WHERE id = ?', [toolId]);

      // Log activity
      await database.run(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'CREATE', 'tool', toolId, `Created tool: ${name} (${tool_code})`]
      );

      res.status(201).json({
        success: true,
        message: 'Alat berhasil ditambahkan.',
        data: newTool
      });
    } catch (qrError) {
      console.error('QR generation error:', qrError);
      // Still return success but note QR generation failed
      const newTool = await database.get('SELECT * FROM tools WHERE id = ?', [toolId]);

      res.status(201).json({
        success: true,
        message: 'Alat berhasil ditambahkan, namun QR code gagal dibuat.',
        data: newTool,
        warning: 'QR code generation failed'
      });
    }
  } catch (error) {
    console.error('Error creating tool:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menambahkan alat.',
      error: error.message
    });
  }
});

// @route   PUT /api/tools/:id
// @desc    Update tool (Admin only)
// @access  Private (Admin)
router.put('/:id', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tool_code, name, category, description, quantity, available_quantity, condition, location } = req.body;

    // Check if tool exists
    const existingTool = await database.get('SELECT * FROM tools WHERE id = ?', [id]);

    if (!existingTool) {
      return res.status(404).json({
        success: false,
        message: 'Alat tidak ditemukan.'
      });
    }

    // If tool_code is being changed, check if new code is available
    if (tool_code && tool_code !== existingTool.tool_code) {
      const codeExists = await database.get(
        'SELECT id FROM tools WHERE tool_code = ? AND id != ?',
        [tool_code, id]
      );

      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: 'Kode alat sudah digunakan.'
        });
      }
    }

    // Prepare update fields
    const updateFields = [];
    const updateParams = [];

    if (tool_code) {
      updateFields.push('tool_code = ?');
      updateParams.push(tool_code);
    }
    if (name) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    if (category) {
      updateFields.push('category = ?');
      updateParams.push(category);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    if (quantity !== undefined) {
      updateFields.push('quantity = ?');
      updateParams.push(parseInt(quantity));
    }
    if (available_quantity !== undefined) {
      updateFields.push('available_quantity = ?');
      updateParams.push(parseInt(available_quantity));
    }
    if (condition) {
      updateFields.push('condition = ?');
      updateParams.push(condition);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateParams.push(location);
    }
    if (req.file) {
      updateFields.push('image_path = ?');
      updateParams.push(`/uploads/${req.file.filename}`);

      // Delete old image if exists
      if (existingTool.image_path) {
        const oldImagePath = path.join(__dirname, '..', existingTool.image_path);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    // Update tool
    await database.run(
      `UPDATE tools SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // If tool_code changed, regenerate QR code
    if (tool_code && tool_code !== existingTool.tool_code) {
      try {
        // Delete old QR code
        if (existingTool.qr_code_path) {
          const oldQRPath = path.join(__dirname, '..', existingTool.qr_code_path);
          if (fs.existsSync(oldQRPath)) {
            fs.unlinkSync(oldQRPath);
          }
        }

        // Generate new QR code
        const qrCodePath = await generateQRCode(tool_code, id);
        await database.run('UPDATE tools SET qr_code_path = ? WHERE id = ?', [qrCodePath, id]);
      } catch (qrError) {
        console.error('QR regeneration error:', qrError);
      }
    }

    // Get updated tool
    const updatedTool = await database.get('SELECT * FROM tools WHERE id = ?', [id]);

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'UPDATE', 'tool', id, `Updated tool: ${updatedTool.name}`]
    );

    res.json({
      success: true,
      message: 'Alat berhasil diperbarui.',
      data: updatedTool
    });
  } catch (error) {
    console.error('Error updating tool:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memperbarui alat.',
      error: error.message
    });
  }
});

// @route   DELETE /api/tools/:id
// @desc    Delete tool (Admin only)
// @access  Private (Admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tool exists
    const tool = await database.get('SELECT * FROM tools WHERE id = ?', [id]);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Alat tidak ditemukan.'
      });
    }

    // Check if tool is currently borrowed
    const activeBorrowing = await database.get(
      `SELECT COUNT(*) as count FROM borrowing_items bi
       JOIN borrowings b ON bi.borrowing_id = b.id
       WHERE bi.tool_id = ? AND b.status IN ('active', 'approved')`,
      [id]
    );

    if (activeBorrowing.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus alat yang sedang dipinjam.'
      });
    }

    // Delete associated files
    if (tool.image_path) {
      const imagePath = path.join(__dirname, '..', tool.image_path);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    if (tool.qr_code_path) {
      const qrPath = path.join(__dirname, '..', tool.qr_code_path);
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
    }

    // Delete tool
    await database.run('DELETE FROM tools WHERE id = ?', [id]);

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'DELETE', 'tool', id, `Deleted tool: ${tool.name} (${tool.tool_code})`]
    );

    res.json({
      success: true,
      message: 'Alat berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error deleting tool:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus alat.',
      error: error.message
    });
  }
});

// @route   GET /api/tools/categories/list
// @desc    Get list of all categories
// @access  Private
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const categories = await database.query(
      'SELECT DISTINCT category FROM tools WHERE category IS NOT NULL ORDER BY category'
    );

    res.json({
      success: true,
      data: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil kategori.',
      error: error.message
    });
  }
});

// @route   POST /api/tools/:id/regenerate-qr
// @desc    Regenerate QR code for a tool (Admin only)
// @access  Private (Admin)
router.post('/:id/regenerate-qr', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tool = await database.get('SELECT * FROM tools WHERE id = ?', [id]);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Alat tidak ditemukan.'
      });
    }

    // Delete old QR code if exists
    if (tool.qr_code_path) {
      const oldQRPath = path.join(__dirname, '..', tool.qr_code_path);
      if (fs.existsSync(oldQRPath)) {
        fs.unlinkSync(oldQRPath);
      }
    }

    // Generate new QR code
    const qrCodePath = await generateQRCode(tool.tool_code, id);
    await database.run('UPDATE tools SET qr_code_path = ? WHERE id = ?', [qrCodePath, id]);

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'REGENERATE_QR', 'tool', id, `Regenerated QR for: ${tool.name}`]
    );

    res.json({
      success: true,
      message: 'QR Code berhasil dibuat ulang.',
      data: { qr_code_path: qrCodePath }
    });
  } catch (error) {
    console.error('Error regenerating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat ulang QR code.',
      error: error.message
    });
  }
});

module.exports = router;
