const express = require('express');
const router = express.Router();
const database = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;

  const resolvedPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(resolvedPath)) return;

  try {
    fs.unlinkSync(resolvedPath);
  } catch (error) {
    console.error(`Failed to delete file: ${resolvedPath}`, error);
  }
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeQuantity(value, defaultValue = 1) {
  const parsedValue = parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : defaultValue;
}

async function createToolRecord(toolData, userId) {
  const toolCode = normalizeText(toolData.tool_code);
  const name = normalizeText(toolData.name);
  const category = normalizeText(toolData.category);
  const description = normalizeText(toolData.description);
  const condition = normalizeText(toolData.condition) || 'baik';
  const location = normalizeText(toolData.location);
  const quantity = normalizeQuantity(toolData.quantity);
  const imagePath = toolData.imagePath || null;

  if (!toolCode || !name || !category) {
    const error = new Error('Kode alat, nama, dan kategori wajib diisi.');
    error.status = 400;
    throw error;
  }

  const existingTool = await database.get(
    'SELECT id FROM tools WHERE tool_code = ?',
    [toolCode]
  );

  if (existingTool) {
    const error = new Error(`Kode alat sudah digunakan: ${toolCode}`);
    error.status = 409;
    throw error;
  }

  const insertResult = await database.run(
    `INSERT INTO tools (tool_code, name, category, description, quantity, available_quantity,
                        condition, location, image_path, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toolCode,
      name,
      category,
      description,
      quantity,
      quantity,
      condition,
      location,
      imagePath,
      userId
    ]
  );

  const toolId = insertResult.id;
  let qrCodePath = null;

  try {
    qrCodePath = await generateQRCode(toolCode, toolId);
    await database.run(
      'UPDATE tools SET qr_code_path = ? WHERE id = ?',
      [qrCodePath, toolId]
    );
  } catch (qrError) {
    console.error('QR generation error:', qrError);
  }

  const tool = await database.get('SELECT * FROM tools WHERE id = ?', [toolId]);
  return {
    tool,
    qrCodePath
  };
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    ensureDirectoryExists(uploadDir);
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
    ensureDirectoryExists(qrDir);

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

// @route   POST /api/tools/batch
// @desc    Create multiple tools at once (Admin only)
// @access  Private (Admin)
router.post('/batch', authenticateToken, isAdmin, async (req, res) => {
  try {
    const tools = Array.isArray(req.body.tools) ? req.body.tools : [];

    if (tools.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu alat harus dikirim untuk batch add.'
      });
    }

    const normalizedTools = tools.map((tool) => ({
      tool_code: normalizeText(tool.tool_code),
      name: normalizeText(tool.name),
      category: normalizeText(tool.category),
      description: normalizeText(tool.description),
      quantity: normalizeQuantity(tool.quantity),
      condition: normalizeText(tool.condition) || 'baik',
      location: normalizeText(tool.location)
    }));

    const missingRequired = normalizedTools.find(
      (tool) => !tool.tool_code || !tool.name || !tool.category
    );

    if (missingRequired) {
      return res.status(400).json({
        success: false,
        message: 'Setiap baris batch add wajib memiliki kode alat, nama, dan kategori.'
      });
    }

    const duplicateCodes = normalizedTools
      .map((tool) => tool.tool_code)
      .filter((toolCode, index, array) => array.indexOf(toolCode) !== index);

    if (duplicateCodes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Kode alat duplikat dalam batch: ${[...new Set(duplicateCodes)].join(', ')}`
      });
    }

    const placeholders = normalizedTools.map(() => '?').join(', ');
    const existingTools = await database.query(
      `SELECT tool_code FROM tools WHERE tool_code IN (${placeholders})`,
      normalizedTools.map((tool) => tool.tool_code)
    );

    if (existingTools.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Kode alat sudah digunakan: ${existingTools.map((tool) => tool.tool_code).join(', ')}`
      });
    }

    const createdTools = [];
    const createdQrFiles = [];

    await database.run('BEGIN TRANSACTION');

    try {
      for (const toolData of normalizedTools) {
        const { tool, qrCodePath } = await createToolRecord(toolData, req.user.id);
        createdTools.push(tool);

        if (qrCodePath) {
          createdQrFiles.push(qrCodePath);
        }
      }

      await database.run(
        `INSERT INTO activity_logs (user_id, action, entity_type, description)
         VALUES (?, ?, ?, ?)`,
        [
          req.user.id,
          'BATCH_CREATE',
          'tool',
          `Batch created ${createdTools.length} tools`
        ]
      );

      await database.run('COMMIT');
    } catch (error) {
      await database.run('ROLLBACK');
      createdQrFiles.forEach((filePath) => deleteFileIfExists(filePath));
      throw error;
    }

    res.status(201).json({
      success: true,
      message: `${createdTools.length} alat berhasil ditambahkan.`,
      data: createdTools,
      count: createdTools.length
    });
  } catch (error) {
    console.error('Error creating tools in batch:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat batch add alat.',
      error: error.message
    });
  }
});

// @route   POST /api/tools/batch-delete
// @desc    Delete multiple tools at once (Admin only)
// @access  Private (Admin)
router.post('/batch-delete', authenticateToken, isAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids)
      ? [...new Set(req.body.ids.map((id) => parseInt(id, 10)).filter(Number.isInteger))]
      : [];

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pilih minimal satu alat untuk dihapus.'
      });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const tools = await database.query(
      `SELECT * FROM tools WHERE id IN (${placeholders})`,
      ids
    );

    if (tools.length !== ids.length) {
      return res.status(404).json({
        success: false,
        message: 'Sebagian alat tidak ditemukan. Muat ulang data lalu coba lagi.'
      });
    }

    const activeBorrowings = await database.query(
      `SELECT DISTINCT t.tool_code
       FROM tools t
       JOIN borrowing_items bi ON bi.tool_id = t.id
       JOIN borrowings b ON bi.borrowing_id = b.id
       WHERE t.id IN (${placeholders}) AND b.status IN ('active', 'approved')`,
      ids
    );

    if (activeBorrowings.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus alat yang sedang dipinjam: ${activeBorrowings.map((tool) => tool.tool_code).join(', ')}`
      });
    }

    await database.run('BEGIN TRANSACTION');

    try {
      await database.run(
        `DELETE FROM tools WHERE id IN (${placeholders})`,
        ids
      );

      await database.run(
        `INSERT INTO activity_logs (user_id, action, entity_type, description)
         VALUES (?, ?, ?, ?)`,
        [
          req.user.id,
          'BATCH_DELETE',
          'tool',
          `Batch deleted ${tools.length} tools`
        ]
      );

      await database.run('COMMIT');
    } catch (error) {
      await database.run('ROLLBACK');
      throw error;
    }

    tools.forEach((tool) => {
      deleteFileIfExists(tool.image_path);
      deleteFileIfExists(tool.qr_code_path);
    });

    res.json({
      success: true,
      message: `${tools.length} alat berhasil dihapus.`,
      count: tools.length
    });
  } catch (error) {
    console.error('Error deleting tools in batch:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat batch delete alat.',
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

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const { tool: newTool } = await createToolRecord(
      {
        tool_code,
        name,
        category,
        description,
        quantity,
        condition,
        location,
        imagePath
      },
      req.user.id
    );

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'CREATE', 'tool', newTool.id, `Created tool: ${newTool.name} (${newTool.tool_code})`]
    );

    res.status(201).json({
      success: true,
      message: newTool.qr_code_path
        ? 'Alat berhasil ditambahkan.'
        : 'Alat berhasil ditambahkan, namun QR code gagal dibuat.',
      data: newTool,
      warning: newTool.qr_code_path ? undefined : 'QR code generation failed'
    });
  } catch (error) {
    console.error('Error creating tool:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat menambahkan alat.',
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
      deleteFileIfExists(existingTool.image_path);
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
        deleteFileIfExists(existingTool.qr_code_path);

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
    deleteFileIfExists(tool.image_path);
    deleteFileIfExists(tool.qr_code_path);

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
    deleteFileIfExists(tool.qr_code_path);

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
