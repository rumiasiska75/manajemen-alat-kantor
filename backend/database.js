const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './database.sqlite';

class Database {
  constructor() {
    this.db = null;
  }

  // Initialize database connection
  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error connecting to database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.db.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  // Initialize all tables
  async initialize() {
    try {
      await this.connect();
      await this.createTables();
      await this.migrateToolsSchema();
      await this.createDefaultAdmin();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  // Create all necessary tables
  createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) console.error('Error creating users table:', err);
        });

        // Tools/Equipment table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serial_number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            item_type TEXT,
            accessories TEXT,
            description TEXT,
            purchase_month INTEGER,
            purchase_year INTEGER,
            quantity INTEGER NOT NULL DEFAULT 1,
            available_quantity INTEGER NOT NULL DEFAULT 1,
            condition TEXT CHECK(condition IN ('baik', 'rusak ringan', 'rusak berat')) DEFAULT 'baik',
            qr_code_path TEXT,
            image_path TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) console.error('Error creating tools table:', err);
        });

        // Borrowing transactions table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS borrowings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('pending', 'approved', 'active', 'returned', 'cancelled')) DEFAULT 'active',
            borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expected_return_date DATETIME,
            actual_return_date DATETIME,
            notes TEXT,
            photo_evidence TEXT,
            approved_by INTEGER,
            approved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (approved_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) console.error('Error creating borrowings table:', err);
        });

        // Borrowing items detail table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS borrowing_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrowing_id INTEGER NOT NULL,
            tool_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            condition_before TEXT CHECK(condition_before IN ('baik', 'rusak ringan', 'rusak berat')) DEFAULT 'baik',
            condition_after TEXT CHECK(condition_after IN ('baik', 'rusak ringan', 'rusak berat')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE,
            FOREIGN KEY (tool_id) REFERENCES tools(id)
          )
        `, (err) => {
          if (err) console.error('Error creating borrowing_items table:', err);
        });

        // Activity log table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            description TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating activity_logs table:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  async migrateToolsSchema() {
    const columns = await this.query(`PRAGMA table_info(tools)`);
    if (!columns || columns.length === 0) {
      return;
    }

    const columnNames = columns.map((column) => column.name);

    if (columnNames.includes('tool_code')) {
      await this.run('PRAGMA foreign_keys = OFF');
      await this.run('BEGIN TRANSACTION');

      try {
        await this.run(`
          CREATE TABLE tools_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serial_number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            item_type TEXT,
            accessories TEXT,
            description TEXT,
            purchase_month INTEGER,
            purchase_year INTEGER,
            quantity INTEGER NOT NULL DEFAULT 1,
            available_quantity INTEGER NOT NULL DEFAULT 1,
            condition TEXT CHECK(condition IN ('baik', 'rusak ringan', 'rusak berat')) DEFAULT 'baik',
            qr_code_path TEXT,
            image_path TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `);

        await this.run(`
          INSERT INTO tools_new (
            id,
            serial_number,
            name,
            category,
            item_type,
            accessories,
            description,
            purchase_month,
            purchase_year,
            quantity,
            available_quantity,
            condition,
            qr_code_path,
            image_path,
            created_by,
            created_at,
            updated_at
          )
          SELECT
            id,
            tool_code,
            name,
            category,
            COALESCE(NULLIF(location, ''), category),
            NULL,
            description,
            NULL,
            NULL,
            COALESCE(quantity, 1),
            COALESCE(available_quantity, quantity, 1),
            COALESCE(condition, 'baik'),
            qr_code_path,
            image_path,
            created_by,
            created_at,
            updated_at
          FROM tools
        `);

        await this.run('DROP TABLE tools');
        await this.run('ALTER TABLE tools_new RENAME TO tools');
        await this.run('COMMIT');
      } catch (error) {
        await this.run('ROLLBACK');
        throw error;
      } finally {
        await this.run('PRAGMA foreign_keys = ON');
      }

      return;
    }

    const addColumnStatements = [];

    if (!columnNames.includes('item_type')) {
      addColumnStatements.push(`ALTER TABLE tools ADD COLUMN item_type TEXT`);
    }
    if (!columnNames.includes('accessories')) {
      addColumnStatements.push(`ALTER TABLE tools ADD COLUMN accessories TEXT`);
    }
    if (!columnNames.includes('purchase_month')) {
      addColumnStatements.push(
        `ALTER TABLE tools ADD COLUMN purchase_month INTEGER`,
      );
    }
    if (!columnNames.includes('purchase_year')) {
      addColumnStatements.push(
        `ALTER TABLE tools ADD COLUMN purchase_year INTEGER`,
      );
    }

    for (const statement of addColumnStatements) {
      await this.run(statement);
    }
  }

  // Create default admin account
  async createDefaultAdmin() {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@kantor.com';

    return new Promise((resolve, reject) => {
      // Check if admin already exists
      this.db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          // Create default admin
          const hashedPassword = await bcrypt.hash(password, 10);
          this.db.run(
            `INSERT INTO users (username, email, password, full_name, role)
             VALUES (?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, 'Administrator', 'admin'],
            (err) => {
              if (err) {
                console.error('Error creating default admin:', err);
                reject(err);
              } else {
                console.log('Default admin account created successfully');
                console.log(`Username: ${username}`);
                console.log(`Password: ${password}`);
                resolve();
              }
            }
          );
        } else {
          console.log('Admin account already exists');
          resolve();
        }
      });
    });
  }

  // Generic query method
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Generic run method (for INSERT, UPDATE, DELETE)
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Get single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
const database = new Database();
module.exports = database;
