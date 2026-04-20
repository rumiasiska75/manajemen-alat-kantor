// Set timezone to Asia/Jakarta (WIB)
process.env.TZ = "Asia/Jakarta";

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
require("dotenv").config();

const database = require("./database");

// Import routes
const authRoutes = require("./routes/auth");
const toolsRoutes = require("./routes/tools");
const borrowingsRoutes = require("./routes/borrowings");
const usersRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const {
  authenticateToken,
  authenticateAssetToken,
  isAdmin,
} = require("./middleware/auth");

function serveProtectedAsset(baseDir) {
  return (req, res) => {
    const requestedPath = req.path.replace(/^\/+/, "");
    const absolutePath = path.normalize(path.join(baseDir, requestedPath));

    if (!absolutePath.startsWith(path.normalize(baseDir))) {
      return res.status(403).json({
        success: false,
        message: "Akses file tidak valid.",
      });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File tidak ditemukan.",
      });
    }

    res.sendFile(absolutePath);
  };
}

// Protected asset files
app.get(
  "/uploads/*",
  authenticateAssetToken,
  serveProtectedAsset(path.join(__dirname, "uploads")),
);
app.get(
  "/qrcodes/*",
  authenticateAssetToken,
  serveProtectedAsset(path.join(__dirname, "qrcodes")),
);

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/borrowings", borrowingsRoutes);
app.use("/api/users", usersRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
    timezone: "Asia/Jakarta (WIB)",
    environment: process.env.NODE_ENV || "development",
  });
});

// Dashboard stats endpoint (Admin only)
app.get(
  "/api/dashboard/stats",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const stats = {};

      // Total users
      const usersResult = await database.get(
        "SELECT COUNT(*) as count FROM users",
      );
      stats.total_users = usersResult.count;

      // Total tools
      const toolsResult = await database.get(
        "SELECT COUNT(*) as count FROM tools",
      );
      stats.total_tools = toolsResult.count;

      // Available tools
      const availableResult = await database.get(
        "SELECT COUNT(*) as count FROM tools WHERE available_quantity > 0",
      );
      stats.available_tools = availableResult.count;

      // Borrowed tools
      const borrowedResult = await database.get(
        "SELECT COUNT(*) as count FROM tools WHERE available_quantity < quantity",
      );
      stats.borrowed_tools = borrowedResult.count;

      // Active borrowings
      const activeBorrowings = await database.get(
        "SELECT COUNT(*) as count FROM borrowings WHERE status = 'active'",
      );
      stats.active_borrowings = activeBorrowings.count;

      // Pending borrowings
      const pendingBorrowings = await database.get(
        "SELECT COUNT(*) as count FROM borrowings WHERE status = 'pending'",
      );
      stats.pending_borrowings = pendingBorrowings.count;

      // Recent activities
      const recentActivities = await database.query(
        `SELECT al.*, u.username, u.full_name
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 10`,
      );
      stats.recent_activities = recentActivities;

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil statistik.",
        error: error.message,
      });
    }
  },
);

// User dashboard stats
app.get(
  "/api/dashboard/user-stats",
  authenticateToken,
  async (req, res) => {
    try {
      const stats = {};

      // User's active borrowings
      const activeBorrowings = await database.get(
        "SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = 'active'",
        [req.user.id],
      );
      stats.active_borrowings = activeBorrowings.count;

      // User's total borrowings
      const totalBorrowings = await database.get(
        "SELECT COUNT(*) as count FROM borrowings WHERE user_id = ?",
        [req.user.id],
      );
      stats.total_borrowings = totalBorrowings.count;

      // User's returned items
      const returnedBorrowings = await database.get(
        "SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = 'returned'",
        [req.user.id],
      );
      stats.returned_borrowings = returnedBorrowings.count;

      // User's recent borrowings
      const recentBorrowings = await database.query(
        `SELECT b.*, COUNT(bi.id) as items_count
       FROM borrowings b
       LEFT JOIN borrowing_items bi ON b.id = bi.borrowing_id
       WHERE b.user_id = ?
       GROUP BY b.id
       ORDER BY b.created_at DESC
       LIMIT 5`,
        [req.user.id],
      );
      stats.recent_borrowings = recentBorrowings;

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil statistik.",
        error: error.message,
      });
    }
  },
);

// Serve frontend HTML for any non-API routes (SPA support)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  } else {
    res.status(404).json({
      success: false,
      message: "API endpoint not found",
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: "Error uploading file",
      error: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Terjadi kesalahan pada server",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log("Initializing database...");
    await database.initialize();

    // Ensure required directories exist
    const dirs = ["uploads", "uploads/evidence", "qrcodes"];
    dirs.forEach((dir) => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });

    app.listen(PORT, () => {
      console.log("=".repeat(50));
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`Timezone: Asia/Jakarta (WIB)`);
      console.log(
        `Current time: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
      );
      console.log(`API URL: http://localhost:${PORT}/api`);
      console.log(`Frontend URL: http://localhost:${PORT}`);
      console.log("=".repeat(50));
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  try {
    await database.close();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  try {
    await database.close();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

// Start the server
startServer();
