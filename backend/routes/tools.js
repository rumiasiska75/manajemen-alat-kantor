const express = require("express");
const router = express.Router();
const database = require("../database");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const QRCode = require("qrcode");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;

  const resolvedPath = path.join(__dirname, "..", filePath);
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
  return trimmed === "" ? null : trimmed;
}

function normalizePositiveInteger(value, defaultValue = null) {
  const parsedValue = parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

function formatPurchasePeriod(month, year) {
  if (!month || !year) return "-";
  return `${String(month).padStart(2, "0")}/${year}`;
}

function buildMetricsSelect() {
  return `
    SELECT
      t.*,
      u.username AS created_by_username,
      u.full_name AS created_by_name,
      COALESCE(out_logs.total_out, 0) AS barang_keluar,
      COALESCE(in_logs.total_in, 0) AS barang_masuk,
      CASE
        WHEN t.available_quantity > 0 THEN 'tersedia'
        ELSE 'dipinjam'
      END AS availability_status
    FROM tools t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN (
      SELECT
        bi.tool_id,
        SUM(bi.quantity) AS total_out
      FROM borrowing_items bi
      JOIN borrowings b ON b.id = bi.borrowing_id
      WHERE b.status IN ('active', 'approved', 'returned')
      GROUP BY bi.tool_id
    ) out_logs ON out_logs.tool_id = t.id
    LEFT JOIN (
      SELECT
        bi.tool_id,
        SUM(bi.quantity) AS total_in
      FROM borrowing_items bi
      JOIN borrowings b ON b.id = bi.borrowing_id
      WHERE b.status = 'returned'
      GROUP BY bi.tool_id
    ) in_logs ON in_logs.tool_id = t.id
  `;
}

async function generateQRCode(serialNumber, toolId) {
  const qrDir = "./qrcodes";
  ensureDirectoryExists(qrDir);

  const qrData = JSON.stringify({
    tool_id: toolId,
    serial_number: serialNumber,
    tool_code: serialNumber,
    type: "office_equipment",
  });

  const qrFileName = `qr-${serialNumber}-${Date.now()}.png`;
  const qrFilePath = path.join(qrDir, qrFileName);

  await QRCode.toFile(qrFilePath, qrData, {
    errorCorrectionLevel: "H",
    type: "png",
    quality: 0.92,
    margin: 1,
    width: 300,
  });

  return `/qrcodes/${qrFileName}`;
}

async function attachToolMetrics(toolId) {
  return database.get(
    `${buildMetricsSelect()} WHERE t.id = ?`,
    [toolId],
  );
}

async function createToolRecord(toolData, userId) {
  const serialNumber = normalizeText(
    toolData.serial_number || toolData.tool_code,
  );
  const name = normalizeText(toolData.name);
  const category = normalizeText(toolData.category);
  const itemType = normalizeText(toolData.item_type);
  const description = normalizeText(toolData.description);
  const purchaseMonth = normalizePositiveInteger(toolData.purchase_month);
  const purchaseYear = normalizePositiveInteger(toolData.purchase_year);
  const condition = normalizeText(toolData.condition) || "baik";
  const quantity = normalizePositiveInteger(toolData.quantity, 1) || 1;
  const imagePath = toolData.imagePath || null;

  if (!serialNumber || !name || !category || !itemType) {
    const error = new Error(
      "Serial Number, Nama Barang, Kategori, dan Jenis wajib diisi.",
    );
    error.status = 400;
    throw error;
  }

  const existingTool = await database.get(
    "SELECT id FROM tools WHERE serial_number = ?",
    [serialNumber],
  );

  if (existingTool) {
    const error = new Error(
      `Serial Number sudah digunakan: ${serialNumber}`,
    );
    error.status = 409;
    throw error;
  }

  const insertResult = await database.run(
    `INSERT INTO tools (
      serial_number,
      name,
      category,
      item_type,
      description,
      purchase_month,
      purchase_year,
      quantity,
      available_quantity,
      condition,
      image_path,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      serialNumber,
      name,
      category,
      itemType,
      description,
      purchaseMonth,
      purchaseYear,
      quantity,
      quantity,
      condition,
      imagePath,
      userId,
    ],
  );

  const toolId = insertResult.id;
  let qrCodePath = null;

  try {
    qrCodePath = await generateQRCode(serialNumber, toolId);
    await database.run("UPDATE tools SET qr_code_path = ? WHERE id = ?", [
      qrCodePath,
      toolId,
    ]);
  } catch (qrError) {
    console.error("QR generation error:", qrError);
  }

  const tool = await attachToolMetrics(toolId);
  return { tool, qrCodePath };
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = "./uploads";
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)",
      ),
    );
  },
});

router.get("/export/all", authenticateToken, isAdmin, async (req, res) => {
  try {
    const tools = await database.query(
      `${buildMetricsSelect()} ORDER BY t.created_at DESC`,
    );

    const rows = tools.map((tool) => ({
      "Serial Number": tool.serial_number,
      "Nama Barang": tool.name,
      Kategori: tool.category,
      Jenis: tool.item_type || "-",
      "Barang Masuk": tool.barang_masuk || 0,
      "Barang Keluar": tool.barang_keluar || 0,
      Keterangan: tool.description || "-",
      "Bulan dan Tahun Pembelian": formatPurchasePeriod(
        tool.purchase_month,
        tool.purchase_year,
      ),
      "QR Code": tool.qr_code_path
        ? `${req.protocol}://${req.get("host")}${tool.qr_code_path}`
        : "-",
      Kondisi: tool.condition || "-",
      Status: tool.availability_status || "-",
    }));

    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error exporting tools:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menyiapkan export Excel.",
      error: error.message,
    });
  }
});

router.get("/categories/list", authenticateToken, async (req, res) => {
  try {
    const categories = await database.query(
      "SELECT DISTINCT category FROM tools WHERE category IS NOT NULL ORDER BY category",
    );

    res.json({
      success: true,
      data: categories.map((category) => category.category),
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil kategori.",
      error: error.message,
    });
  }
});

router.get("/code/:serialNumber", authenticateToken, async (req, res) => {
  try {
    const { serialNumber } = req.params;

    const tool = await database.get(
      `${buildMetricsSelect()} WHERE t.serial_number = ?`,
      [serialNumber],
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Peralatan dengan Serial Number tersebut tidak ditemukan.",
      });
    }

    res.json({
      success: true,
      data: {
        ...tool,
        tool_code: tool.serial_number,
      },
    });
  } catch (error) {
    console.error("Error getting tool by serial number:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data peralatan.",
      error: error.message,
    });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { category, condition, available, search } = req.query;

    let query = `${buildMetricsSelect()} WHERE 1 = 1`;
    const params = [];

    if (category) {
      query += " AND t.category = ?";
      params.push(category);
    }

    if (condition) {
      query += " AND t.condition = ?";
      params.push(condition);
    }

    if (available === "true") {
      query += " AND t.available_quantity > 0";
    }

    if (search) {
      query += `
        AND (
          t.name LIKE ?
          OR t.serial_number LIKE ?
          OR t.category LIKE ?
          OR COALESCE(t.item_type, '') LIKE ?
          OR COALESCE(t.description, '') LIKE ?
        )
      `;
      const searchTerm = `%${search}%`;
      params.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    query += " ORDER BY t.created_at DESC";

    const tools = await database.query(query, params);
    const normalizedTools = tools.map((tool) => ({
      ...tool,
      tool_code: tool.serial_number,
    }));

    res.json({
      success: true,
      data: normalizedTools,
      count: normalizedTools.length,
    });
  } catch (error) {
    console.error("Error getting tools:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data peralatan.",
      error: error.message,
    });
  }
});

router.post("/batch", authenticateToken, isAdmin, async (req, res) => {
  try {
    const tools = Array.isArray(req.body.tools) ? req.body.tools : [];

    if (tools.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimal satu peralatan harus dikirim untuk batch add.",
      });
    }

    const normalizedTools = tools.map((tool) => ({
      serial_number: normalizeText(tool.serial_number || tool.tool_code),
      name: normalizeText(tool.name),
      category: normalizeText(tool.category),
      item_type: normalizeText(tool.item_type),
      description: normalizeText(tool.description),
      purchase_month: normalizePositiveInteger(tool.purchase_month),
      purchase_year: normalizePositiveInteger(tool.purchase_year),
      condition: normalizeText(tool.condition) || "baik",
      quantity: normalizePositiveInteger(tool.quantity, 1) || 1,
    }));

    const missingRequired = normalizedTools.find(
      (tool) =>
        !tool.serial_number || !tool.name || !tool.category || !tool.item_type,
    );

    if (missingRequired) {
      return res.status(400).json({
        success: false,
        message:
          "Setiap baris batch add wajib memiliki Serial Number, Nama Barang, Kategori, dan Jenis.",
      });
    }

    const duplicateSerials = normalizedTools
      .map((tool) => tool.serial_number)
      .filter(
        (serialNumber, index, array) =>
          array.indexOf(serialNumber) !== index,
      );

    if (duplicateSerials.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Serial Number duplikat dalam batch: ${[
          ...new Set(duplicateSerials),
        ].join(", ")}`,
      });
    }

    const placeholders = normalizedTools.map(() => "?").join(", ");
    const existingTools = await database.query(
      `SELECT serial_number FROM tools WHERE serial_number IN (${placeholders})`,
      normalizedTools.map((tool) => tool.serial_number),
    );

    if (existingTools.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Serial Number sudah digunakan: ${existingTools
          .map((tool) => tool.serial_number)
          .join(", ")}`,
      });
    }

    const createdTools = [];
    const createdQrFiles = [];

    await database.run("BEGIN TRANSACTION");

    try {
      for (const toolData of normalizedTools) {
        const { tool, qrCodePath } = await createToolRecord(
          toolData,
          req.user.id,
        );
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
          "BATCH_CREATE",
          "tool",
          `Batch created ${createdTools.length} inventory items`,
        ],
      );

      await database.run("COMMIT");
    } catch (error) {
      await database.run("ROLLBACK");
      createdQrFiles.forEach((filePath) => deleteFileIfExists(filePath));
      throw error;
    }

    res.status(201).json({
      success: true,
      message: `${createdTools.length} peralatan berhasil ditambahkan.`,
      data: createdTools,
      count: createdTools.length,
    });
  } catch (error) {
    console.error("Error creating tools in batch:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Terjadi kesalahan saat batch add peralatan.",
      error: error.message,
    });
  }
});

router.post(
  "/batch-delete",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids)
        ? [
            ...new Set(
              req.body.ids
                .map((id) => parseInt(id, 10))
                .filter(Number.isInteger),
            ),
          ]
        : [];

      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Pilih minimal satu peralatan untuk dihapus.",
        });
      }

      const placeholders = ids.map(() => "?").join(", ");
      const tools = await database.query(
        `SELECT * FROM tools WHERE id IN (${placeholders})`,
        ids,
      );

      if (tools.length !== ids.length) {
        return res.status(404).json({
          success: false,
          message:
            "Sebagian peralatan tidak ditemukan. Muat ulang data lalu coba lagi.",
        });
      }

      const activeBorrowings = await database.query(
        `SELECT DISTINCT t.serial_number
         FROM tools t
         JOIN borrowing_items bi ON bi.tool_id = t.id
         JOIN borrowings b ON bi.borrowing_id = b.id
         WHERE t.id IN (${placeholders}) AND b.status IN ('active', 'approved')`,
        ids,
      );

      if (activeBorrowings.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat menghapus peralatan yang sedang dipinjam: ${activeBorrowings
            .map((tool) => tool.serial_number)
            .join(", ")}`,
        });
      }

      await database.run("BEGIN TRANSACTION");

      try {
        await database.run(`DELETE FROM tools WHERE id IN (${placeholders})`, ids);

        await database.run(
          `INSERT INTO activity_logs (user_id, action, entity_type, description)
           VALUES (?, ?, ?, ?)`,
          [
            req.user.id,
            "BATCH_DELETE",
            "tool",
            `Batch deleted ${tools.length} inventory items`,
          ],
        );

        await database.run("COMMIT");
      } catch (error) {
        await database.run("ROLLBACK");
        throw error;
      }

      tools.forEach((tool) => {
        deleteFileIfExists(tool.image_path);
        deleteFileIfExists(tool.qr_code_path);
      });

      res.json({
        success: true,
        message: `${tools.length} peralatan berhasil dihapus.`,
        count: tools.length,
      });
    } catch (error) {
      console.error("Error deleting tools in batch:", error);
      res.status(error.status || 500).json({
        success: false,
        message:
          error.message || "Terjadi kesalahan saat batch delete peralatan.",
        error: error.message,
      });
    }
  },
);

router.post("/", authenticateToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const {
      serial_number,
      tool_code,
      name,
      category,
      item_type,
      description,
      purchase_month,
      purchase_year,
      condition,
      quantity,
    } = req.body;

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const { tool: newTool } = await createToolRecord(
      {
        serial_number: serial_number || tool_code,
        name,
        category,
        item_type,
        description,
        purchase_month,
        purchase_year,
        condition,
        quantity,
        imagePath,
      },
      req.user.id,
    );

    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        "CREATE",
        "tool",
        newTool.id,
        `Created inventory item: ${newTool.name} (${newTool.serial_number})`,
      ],
    );

    res.status(201).json({
      success: true,
      message: newTool.qr_code_path
        ? "Peralatan berhasil ditambahkan."
        : "Peralatan berhasil ditambahkan, namun QR code gagal dibuat.",
      data: {
        ...newTool,
        tool_code: newTool.serial_number,
      },
      warning: newTool.qr_code_path ? undefined : "QR code generation failed",
    });
  } catch (error) {
    console.error("Error creating tool:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Terjadi kesalahan saat menambahkan peralatan.",
      error: error.message,
    });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const tool = await attachToolMetrics(id);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Peralatan tidak ditemukan.",
      });
    }

    const borrowingHistory = await database.query(
      `SELECT
         b.*,
         u.username,
         u.full_name,
         bi.quantity,
         bi.condition_before,
         bi.condition_after
       FROM borrowing_items bi
       JOIN borrowings b ON bi.borrowing_id = b.id
       JOIN users u ON b.user_id = u.id
       WHERE bi.tool_id = ?
       ORDER BY b.borrow_date DESC
       LIMIT 10`,
      [id],
    );

    res.json({
      success: true,
      data: {
        ...tool,
        tool_code: tool.serial_number,
        borrowing_history: borrowingHistory,
      },
    });
  } catch (error) {
    console.error("Error getting tool:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data peralatan.",
      error: error.message,
    });
  }
});

router.put("/:id", authenticateToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const existingTool = await database.get("SELECT * FROM tools WHERE id = ?", [
      id,
    ]);

    if (!existingTool) {
      return res.status(404).json({
        success: false,
        message: "Peralatan tidak ditemukan.",
      });
    }

    const serialNumber = normalizeText(
      req.body.serial_number || req.body.tool_code,
    );

    if (serialNumber && serialNumber !== existingTool.serial_number) {
      const codeExists = await database.get(
        "SELECT id FROM tools WHERE serial_number = ? AND id != ?",
        [serialNumber, id],
      );

      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: "Serial Number sudah digunakan.",
        });
      }
    }

    const updateFields = [];
    const updateParams = [];

    if (serialNumber) {
      updateFields.push("serial_number = ?");
      updateParams.push(serialNumber);
    }
    if (req.body.name) {
      updateFields.push("name = ?");
      updateParams.push(normalizeText(req.body.name));
    }
    if (req.body.category) {
      updateFields.push("category = ?");
      updateParams.push(normalizeText(req.body.category));
    }
    if (req.body.item_type !== undefined) {
      updateFields.push("item_type = ?");
      updateParams.push(normalizeText(req.body.item_type));
    }
    if (req.body.description !== undefined) {
      updateFields.push("description = ?");
      updateParams.push(normalizeText(req.body.description));
    }
    if (req.body.purchase_month !== undefined) {
      updateFields.push("purchase_month = ?");
      updateParams.push(normalizePositiveInteger(req.body.purchase_month));
    }
    if (req.body.purchase_year !== undefined) {
      updateFields.push("purchase_year = ?");
      updateParams.push(normalizePositiveInteger(req.body.purchase_year));
    }
    if (req.body.condition) {
      updateFields.push("condition = ?");
      updateParams.push(normalizeText(req.body.condition) || "baik");
    }
    if (req.file) {
      updateFields.push("image_path = ?");
      updateParams.push(`/uploads/${req.file.filename}`);
      deleteFileIfExists(existingTool.image_path);
    }

    if (updateFields.length === 0) {
      return res.json({
        success: true,
        message: "Tidak ada perubahan data.",
        data: await attachToolMetrics(id),
      });
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateParams.push(id);

    await database.run(
      `UPDATE tools SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams,
    );

    if (serialNumber && serialNumber !== existingTool.serial_number) {
      try {
        deleteFileIfExists(existingTool.qr_code_path);
        const qrCodePath = await generateQRCode(serialNumber, id);
        await database.run("UPDATE tools SET qr_code_path = ? WHERE id = ?", [
          qrCodePath,
          id,
        ]);
      } catch (qrError) {
        console.error("QR regeneration error:", qrError);
      }
    }

    const updatedTool = await attachToolMetrics(id);

    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, "UPDATE", "tool", id, `Updated inventory item: ${updatedTool.name}`],
    );

    res.json({
      success: true,
      message: "Peralatan berhasil diperbarui.",
      data: {
        ...updatedTool,
        tool_code: updatedTool.serial_number,
      },
    });
  } catch (error) {
    console.error("Error updating tool:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memperbarui peralatan.",
      error: error.message,
    });
  }
});

router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tool = await database.get("SELECT * FROM tools WHERE id = ?", [id]);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Peralatan tidak ditemukan.",
      });
    }

    const activeBorrowing = await database.get(
      `SELECT COUNT(*) AS count
       FROM borrowing_items bi
       JOIN borrowings b ON bi.borrowing_id = b.id
       WHERE bi.tool_id = ? AND b.status IN ('active', 'approved')`,
      [id],
    );

    if (activeBorrowing.count > 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat menghapus peralatan yang sedang dipinjam.",
      });
    }

    deleteFileIfExists(tool.image_path);
    deleteFileIfExists(tool.qr_code_path);

    await database.run("DELETE FROM tools WHERE id = ?", [id]);

    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        "DELETE",
        "tool",
        id,
        `Deleted inventory item: ${tool.name} (${tool.serial_number})`,
      ],
    );

    res.json({
      success: true,
      message: "Peralatan berhasil dihapus.",
    });
  } catch (error) {
    console.error("Error deleting tool:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghapus peralatan.",
      error: error.message,
    });
  }
});

router.post("/:id/regenerate-qr", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tool = await database.get("SELECT * FROM tools WHERE id = ?", [id]);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Peralatan tidak ditemukan.",
      });
    }

    deleteFileIfExists(tool.qr_code_path);

    const qrCodePath = await generateQRCode(tool.serial_number, id);
    await database.run("UPDATE tools SET qr_code_path = ? WHERE id = ?", [
      qrCodePath,
      id,
    ]);

    await database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, "REGENERATE_QR", "tool", id, `Regenerated QR for: ${tool.name}`],
    );

    res.json({
      success: true,
      message: "QR Code berhasil dibuat ulang.",
      data: { qr_code_path: qrCodePath },
    });
  } catch (error) {
    console.error("Error regenerating QR code:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat membuat ulang QR code.",
      error: error.message,
    });
  }
});

module.exports = router;
