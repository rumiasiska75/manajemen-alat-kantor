const express = require("express");
const router = express.Router();
const database = require("../database");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const {
  buildWatermarkText,
  deleteLocalFile,
  processUploadedImage,
} = require("../utils/image-processing");

// Helper function untuk format tanggal WIB
function getWIBDateTime() {
  return new Date()
    .toLocaleString("sv-SE", {
      timeZone: "Asia/Jakarta",
      hour12: false,
    })
    .replace(" ", " ");
}

function formatDateWIB(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getProcessedEvidencePath(file) {
  const parsedFile = path.parse(file.filename);
  return {
    absolutePath: path.join(file.destination, `${parsedFile.name}.jpg`),
    relativePath: `/uploads/evidence/${parsedFile.name}.jpg`,
  };
}

async function processEvidenceUpload(file, { username, actionLabel, timestamp }) {
  const processedPath = getProcessedEvidencePath(file);

  await processUploadedImage({
    inputPath: file.path,
    outputPath: processedPath.absolutePath,
    watermarkText: buildWatermarkText({
      username,
      actionLabel,
      timestamp,
    }),
  });

  return processedPath.relativePath;
}

function getStoredFileAbsolutePath(filePath) {
  if (!filePath) return null;
  const relativePath = String(filePath).replace(/^[/\\]+/, "");
  return path.join(__dirname, "..", relativePath);
}

// Configure multer for photo evidence uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads/evidence";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `evidence-${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Hanya file gambar yang diperbolehkan"));
    }
  },
});

// @route   GET /api/borrowings
// @desc    Get all borrowings (Admin: all, User: own only)
// @access  Private
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status, user_id, from_date, to_date } = req.query;

    let query = `
      SELECT b.*,
             u.username, u.full_name, u.email,
             a.username as approved_by_username, a.full_name as approved_by_name
      FROM borrowings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN users a ON b.approved_by = a.id
      WHERE 1=1
    `;
    const params = [];

    // Users can only see their own borrowings, admins can see all
    if (req.user.role !== "admin") {
      query += " AND b.user_id = ?";
      params.push(req.user.id);
    } else if (user_id) {
      query += " AND b.user_id = ?";
      params.push(user_id);
    }

    if (status) {
      query += " AND b.status = ?";
      params.push(status);
    }

    if (from_date) {
      query += " AND DATE(b.borrow_date) >= DATE(?)";
      params.push(from_date);
    }

    if (to_date) {
      query += " AND DATE(b.borrow_date) <= DATE(?)";
      params.push(to_date);
    }

    query += " ORDER BY b.created_at DESC";

    const borrowings = await database.query(query, params);

    // Get items for each borrowing
    for (let borrowing of borrowings) {
      const items = await database.query(
        `SELECT bi.*, t.name as tool_name, t.serial_number, t.serial_number as tool_code, t.category, t.item_type, t.image_path
         FROM borrowing_items bi
         JOIN tools t ON bi.tool_id = t.id
         WHERE bi.borrowing_id = ?`,
        [borrowing.id],
      );
      borrowing.items = items;
    }

    res.json({
      success: true,
      data: borrowings,
      count: borrowings.length,
    });
  } catch (error) {
    console.error("Error getting borrowings:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data peminjaman.",
      error: error.message,
    });
  }
});

// @route   GET /api/borrowings/active
// @desc    Get active borrowings for current user
// @access  Private
router.get("/active", authenticateToken, async (req, res) => {
  try {
    const borrowings = await database.query(
      `SELECT b.*,
              u.username, u.full_name
       FROM borrowings b
       JOIN users u ON b.user_id = u.id
       WHERE b.user_id = ? AND b.status IN ('active', 'approved')
       ORDER BY b.borrow_date DESC`,
      [req.user.id],
    );

    // Get items for each borrowing
    for (let borrowing of borrowings) {
      const items = await database.query(
        `SELECT bi.*, t.name as tool_name, t.serial_number, t.serial_number as tool_code, t.category, t.item_type, t.image_path
         FROM borrowing_items bi
         JOIN tools t ON bi.tool_id = t.id
         WHERE bi.borrowing_id = ?`,
        [borrowing.id],
      );
      borrowing.items = items;
    }

    res.json({
      success: true,
      data: borrowings,
    });
  } catch (error) {
    console.error("Error getting active borrowings:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data peminjaman aktif.",
      error: error.message,
    });
  }
});

// @route   GET /api/borrowings/:id
// @desc    Get single borrowing details
// @access  Private
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowing = await database.get(
      `SELECT b.*,
              u.username, u.full_name, u.email, u.phone,
              a.username as approved_by_username, a.full_name as approved_by_name
       FROM borrowings b
       JOIN users u ON b.user_id = u.id
       LEFT JOIN users a ON b.approved_by = a.id
       WHERE b.id = ?`,
      [id],
    );

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    // Check permission: user can only view their own borrowings
    if (req.user.role !== "admin" && borrowing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk melihat peminjaman ini.",
      });
    }

    // Get borrowing items
    const items = await database.query(
      `SELECT bi.*, t.name as tool_name, t.serial_number, t.serial_number as tool_code, t.category, t.item_type, t.image_path, t.qr_code_path
       FROM borrowing_items bi
       JOIN tools t ON bi.tool_id = t.id
       WHERE bi.borrowing_id = ?`,
      [id],
    );

    borrowing.items = items;

    res.json({
      success: true,
      data: borrowing,
    });
  } catch (error) {
    console.error("Error getting borrowing:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil detail peminjaman.",
      error: error.message,
    });
  }
});

// @route   POST /api/borrowings
// @desc    Create new borrowing (checkout cart)
// @access  Private
router.post(
  "/",
  authenticateToken,
  upload.single("photo_evidence"),
  async (req, res) => {
    let photoPath = null;
    try {
      const { items, expected_return_date, notes } = req.body;

      // Parse items if it's a JSON string
      let borrowingItems = [];
      try {
        borrowingItems = typeof items === "string" ? JSON.parse(items) : items;
      } catch (parseError) {
        deleteLocalFile(req.file?.path);
        return res.status(400).json({
          success: false,
          message: "Format data alat tidak valid.",
        });
      }

      // Validate
      if (
        !borrowingItems ||
        !Array.isArray(borrowingItems) ||
        borrowingItems.length === 0
      ) {
        deleteLocalFile(req.file?.path);
        return res.status(400).json({
          success: false,
          message: "Minimal harus ada 1 alat yang dipinjam.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Foto bukti peminjaman wajib diunggah.",
        });
      }

      // Validate each item and check availability
      for (let item of borrowingItems) {
        if (!item.tool_id || !item.quantity || item.quantity < 1) {
          deleteLocalFile(req.file?.path);
          return res.status(400).json({
            success: false,
            message: "Data alat tidak valid.",
          });
        }

        const tool = await database.get(
          "SELECT id, name, serial_number, available_quantity FROM tools WHERE id = ?",
          [item.tool_id],
        );

        if (!tool) {
          deleteLocalFile(req.file?.path);
          return res.status(404).json({
            success: false,
            message: `Alat dengan ID ${item.tool_id} tidak ditemukan.`,
          });
        }

        if (tool.available_quantity < item.quantity) {
          deleteLocalFile(req.file?.path);
          return res.status(400).json({
            success: false,
            message: `Peralatan ${tool.name} tidak tersedia dalam jumlah yang diminta. Tersedia: ${tool.available_quantity}`,
          });
        }
      }

      const borrowTimestamp = getWIBDateTime();

      if (req.file) {
        photoPath = await processEvidenceUpload(req.file, {
          username: req.user.username,
          actionLabel: "Pinjam",
          timestamp: borrowTimestamp,
        });
      }

      // Create borrowing transaction
      const borrowingResult = await database.run(
        `INSERT INTO borrowings (
           user_id, status, borrow_date, expected_return_date, notes, photo_evidence, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          "active",
          borrowTimestamp,
          expected_return_date || null,
          notes || null,
          photoPath,
          borrowTimestamp,
          borrowTimestamp,
        ],
      );

      const borrowingId = borrowingResult.id;

      // Insert borrowing items and update tool availability
      for (let item of borrowingItems) {
        // Insert borrowing item
        await database.run(
          `INSERT INTO borrowing_items (borrowing_id, tool_id, quantity, condition_before, notes)
         VALUES (?, ?, ?, ?, ?)`,
          [
            borrowingId,
            item.tool_id,
            item.quantity,
            item.condition_before || "baik",
            item.notes || null,
          ],
        );

        // Update tool available quantity
        await database.run(
          "UPDATE tools SET available_quantity = available_quantity - ? WHERE id = ?",
          [item.quantity, item.tool_id],
        );
      }

      // Log activity
      await database.run(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          "BORROW",
          "borrowing",
          borrowingId,
          `Created borrowing with ${borrowingItems.length} items`,
        ],
      );

      // Get the created borrowing with details
      const newBorrowing = await database.get(
        `SELECT b.*, u.username, u.full_name
       FROM borrowings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
        [borrowingId],
      );

      const items_data = await database.query(
        `SELECT bi.*, t.name as tool_name, t.serial_number, t.serial_number as tool_code, t.category, t.item_type
       FROM borrowing_items bi
       JOIN tools t ON bi.tool_id = t.id
       WHERE bi.borrowing_id = ?`,
        [borrowingId],
      );

      newBorrowing.items = items_data;

      res.status(201).json({
        success: true,
        message: "Peminjaman berhasil dibuat.",
        data: newBorrowing,
      });
    } catch (error) {
      if (photoPath) {
        deleteLocalFile(getStoredFileAbsolutePath(photoPath));
      } else {
        deleteLocalFile(req.file?.path);
      }
      console.error("Error creating borrowing:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat membuat peminjaman.",
        error: error.message,
      });
    }
  },
);

// @route   PUT /api/borrowings/:id/return
// @desc    Return borrowed tools
// @access  Private
router.put(
  "/:id/return",
  authenticateToken,
  upload.single("photo_evidence"),
  async (req, res) => {
    let photoPath = null;
    try {
      const { id } = req.params;
      const { items, notes } = req.body;

      // Get borrowing
      const borrowing = await database.get(
        "SELECT * FROM borrowings WHERE id = ?",
        [id],
      );

      if (!borrowing) {
        deleteLocalFile(req.file?.path);
        return res.status(404).json({
          success: false,
          message: "Peminjaman tidak ditemukan.",
        });
      }

      // Check permission
      if (req.user.role !== "admin" && borrowing.user_id !== req.user.id) {
        deleteLocalFile(req.file?.path);
        return res.status(403).json({
          success: false,
          message:
            "Anda tidak memiliki akses untuk mengembalikan peminjaman ini.",
        });
      }

      // Check if already returned
      if (borrowing.status === "returned") {
        deleteLocalFile(req.file?.path);
        return res.status(400).json({
          success: false,
          message: "Peminjaman ini sudah dikembalikan.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Foto bukti pengembalian wajib diunggah.",
        });
      }

      // Parse items if provided (for condition updates)
      let returnItems = [];
      if (items) {
        returnItems = typeof items === "string" ? JSON.parse(items) : items;
      }

      // Get all borrowing items
      const borrowingItems = await database.query(
        "SELECT * FROM borrowing_items WHERE borrowing_id = ?",
        [id],
      );

      // Update each item's condition and return quantity to available
      for (let item of borrowingItems) {
        // Find condition info from request if provided
        const returnInfo = returnItems.find(
          (ri) => ri.tool_id === item.tool_id,
        );
        const conditionAfter = returnInfo?.condition_after || "baik";
        const itemNotes = returnInfo?.notes || null;

        // Update borrowing item with return condition
        await database.run(
          `UPDATE borrowing_items
         SET condition_after = ?, notes = COALESCE(?, notes)
         WHERE id = ?`,
          [conditionAfter, itemNotes, item.id],
        );

        // Return quantity to tool availability
        await database.run(
          "UPDATE tools SET available_quantity = available_quantity + ? WHERE id = ?",
          [item.quantity, item.tool_id],
        );

        // Update tool condition if damaged
        if (conditionAfter !== "baik") {
          await database.run("UPDATE tools SET condition = ? WHERE id = ?", [
            conditionAfter,
            item.tool_id,
          ]);
        }
      }

      // Update borrowing status
      const returnTimestamp = getWIBDateTime();
      photoPath = await processEvidenceUpload(req.file, {
        username: req.user.username,
        actionLabel: "Kembali",
        timestamp: returnTimestamp,
      });

      await database.run(
        `UPDATE borrowings
       SET status = 'returned',
           actual_return_date = ?,
           photo_evidence = ?,
           notes = COALESCE(?, notes),
           updated_at = ?
       WHERE id = ?`,
        [returnTimestamp, photoPath, notes, returnTimestamp, id],
      );

      if (req.file && borrowing.photo_evidence) {
        deleteLocalFile(getStoredFileAbsolutePath(borrowing.photo_evidence));
      }

      // Log activity
      await database.run(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, "RETURN", "borrowing", id, `Returned borrowing #${id}`],
      );

      // Get updated borrowing
      const updatedBorrowing = await database.get(
        `SELECT b.*, u.username, u.full_name
       FROM borrowings b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
        [id],
      );

      const items_data = await database.query(
        `SELECT bi.*, t.name as tool_name, t.serial_number, t.serial_number as tool_code, t.category, t.item_type
       FROM borrowing_items bi
       JOIN tools t ON bi.tool_id = t.id
       WHERE bi.borrowing_id = ?`,
        [id],
      );

      updatedBorrowing.items = items_data;

      res.json({
        success: true,
        message: "Alat berhasil dikembalikan.",
        data: updatedBorrowing,
      });
    } catch (error) {
      if (photoPath && req.file) {
        deleteLocalFile(getStoredFileAbsolutePath(photoPath));
      } else {
        deleteLocalFile(req.file?.path);
      }
      console.error("Error returning borrowing:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengembalikan alat.",
        error: error.message,
      });
    }
  },
);

// @route   PUT /api/borrowings/:id/approve
// @desc    Approve borrowing (Admin only)
// @access  Private (Admin)
router.put("/:id/approve", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowing = await database.get(
      "SELECT * FROM borrowings WHERE id = ?",
      [id],
    );

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    if (borrowing.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Hanya peminjaman dengan status pending yang dapat disetujui.",
      });
    }

    await database.run(
      `UPDATE borrowings
       SET status = 'approved',
           approved_by = ?,
           approved_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [req.user.id, getWIBDateTime(), getWIBDateTime(), id],
    );

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, "APPROVE", "borrowing", id, `Approved borrowing #${id}`],
    );

    res.json({
      success: true,
      message: "Peminjaman berhasil disetujui.",
    });
  } catch (error) {
    console.error("Error approving borrowing:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menyetujui peminjaman.",
      error: error.message,
    });
  }
});

// @route   PUT /api/borrowings/:id/cancel
// @desc    Cancel borrowing
// @access  Private
router.put("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowing = await database.get(
      "SELECT * FROM borrowings WHERE id = ?",
      [id],
    );

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    // Check permission
    if (req.user.role !== "admin" && borrowing.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk membatalkan peminjaman ini.",
      });
    }

    if (borrowing.status === "returned") {
      return res.status(400).json({
        success: false,
        message: "Peminjaman yang sudah dikembalikan tidak dapat dibatalkan.",
      });
    }

    // Get borrowing items to restore quantity
    const borrowingItems = await database.query(
      "SELECT * FROM borrowing_items WHERE borrowing_id = ?",
      [id],
    );

    // Restore tool quantities
    for (let item of borrowingItems) {
      await database.run(
        "UPDATE tools SET available_quantity = available_quantity + ? WHERE id = ?",
        [item.quantity, item.tool_id],
      );
    }

    // Update borrowing status
    await database.run(
      "UPDATE borrowings SET status = 'cancelled', updated_at = ? WHERE id = ?",
      [getWIBDateTime(), id],
    );

    // Log activity
    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, "CANCEL", "borrowing", id, `Cancelled borrowing #${id}`],
    );

    res.json({
      success: true,
      message: "Peminjaman berhasil dibatalkan.",
    });
  } catch (error) {
    console.error("Error cancelling borrowing:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat membatalkan peminjaman.",
      error: error.message,
    });
  }
});

// @route   GET /api/borrowings/stats/summary
// @desc    Get borrowing statistics
// @access  Private (Admin)
router.get("/stats/summary", authenticateToken, isAdmin, async (req, res) => {
  try {
    const stats = {
      total: 0,
      active: 0,
      returned: 0,
      pending: 0,
      cancelled: 0,
      overdue: 0,
    };

    const totalResult = await database.get(
      "SELECT COUNT(*) as count FROM borrowings",
    );
    stats.total = totalResult.count;

    const activeResult = await database.get(
      "SELECT COUNT(*) as count FROM borrowings WHERE status = 'active'",
    );
    stats.active = activeResult.count;

    const returnedResult = await database.get(
      "SELECT COUNT(*) as count FROM borrowings WHERE status = 'returned'",
    );
    stats.returned = returnedResult.count;

    const pendingResult = await database.get(
      "SELECT COUNT(*) as count FROM borrowings WHERE status = 'pending'",
    );
    stats.pending = pendingResult.count;

    const cancelledResult = await database.get(
      "SELECT COUNT(*) as count FROM borrowings WHERE status = 'cancelled'",
    );
    stats.cancelled = cancelledResult.count;

    const overdueResult = await database.get(
      `SELECT COUNT(*) as count FROM borrowings
       WHERE status IN ('active', 'approved')
       AND expected_return_date < CURRENT_TIMESTAMP`,
    );
    stats.overdue = overdueResult.count;

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting borrowing stats:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil statistik.",
      error: error.message,
    });
  }
});

module.exports = router;
