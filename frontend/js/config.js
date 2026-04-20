// ==================== API CONFIGURATION ====================
const API_BASE_URL = window.location.origin + "/api";

const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    ME: `${API_BASE_URL}/auth/me`,
  },
  // Tools endpoints
  TOOLS: {
    LIST: `${API_BASE_URL}/tools`,
    CREATE: `${API_BASE_URL}/tools`,
    BATCH_CREATE: `${API_BASE_URL}/tools/batch`,
    BATCH_DELETE: `${API_BASE_URL}/tools/batch-delete`,
    GET: (id) => `${API_BASE_URL}/tools/${id}`,
    LOGS: (id) => `${API_BASE_URL}/tools/${id}/logs`,
    UPDATE: (id) => `${API_BASE_URL}/tools/${id}`,
    DELETE: (id) => `${API_BASE_URL}/tools/${id}`,
    BY_CODE: (code) => `${API_BASE_URL}/tools/code/${code}`,
    CATEGORIES: `${API_BASE_URL}/tools/categories/list`,
    METADATA: `${API_BASE_URL}/tools/metadata/list`,
    REGENERATE_QR: (id) => `${API_BASE_URL}/tools/${id}/regenerate-qr`,
    EXPORT_ALL: `${API_BASE_URL}/tools/export/all`,
  },
  // Borrowings endpoints
  BORROWINGS: {
    LIST: `${API_BASE_URL}/borrowings`,
    CREATE: `${API_BASE_URL}/borrowings`,
    GET: (id) => `${API_BASE_URL}/borrowings/${id}`,
    ACTIVE: `${API_BASE_URL}/borrowings/active`,
    RETURN: (id) => `${API_BASE_URL}/borrowings/${id}/return`,
    APPROVE: (id) => `${API_BASE_URL}/borrowings/${id}/approve`,
    CANCEL: (id) => `${API_BASE_URL}/borrowings/${id}/cancel`,
    STATS: `${API_BASE_URL}/borrowings/stats/summary`,
  },
  // Dashboard endpoints
  DASHBOARD: {
    STATS: `${API_BASE_URL}/dashboard/stats`,
    USER_STATS: `${API_BASE_URL}/dashboard/user-stats`,
  },
  ACTIVITY_LOGS: `${API_BASE_URL}/activity-logs`,
  // Users endpoints
  USERS: {
    LIST: `${API_BASE_URL}/users`,
    GET: (id) => `${API_BASE_URL}/users/${id}`,
    AUDIT: (id) => `${API_BASE_URL}/users/${id}/audit`,
    EXPORT: (id) => `${API_BASE_URL}/users/${id}/export`,
  },
};

// ==================== LOCAL STORAGE KEYS ====================
const STORAGE_KEYS = {
  TOKEN: "auth_token",
  USER: "user_data",
  CART: "borrow_cart",
};

const DEFAULT_TOOL_PLACEHOLDER = "/images/Placeholder.png";

function parseAppDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;

  const value = String(dateInput).trim();
  if (!value) return null;

  // Date-only values from inputs are treated as WIB calendar dates.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+07:00`);
  }

  // SQLite timestamps like "2026-04-19 12:34:56" are stored as WIB values.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}+07:00`);
  }

  // Treat ISO timestamps without explicit offset as UTC as well.
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) &&
    !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)
  ) {
    return new Date(`${value}Z`);
  }

  return new Date(value);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get auth token from localStorage
 */
function getAuthToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * Set auth token to localStorage
 */
function setAuthToken(token) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
}

/**
 * Remove auth token from localStorage
 */
function removeAuthToken() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

/**
 * Get user data from localStorage
 */
function getUserData() {
  const userData = localStorage.getItem(STORAGE_KEYS.USER);
  return userData ? JSON.parse(userData) : null;
}

/**
 * Set user data to localStorage
 */
function setUserData(user) {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * Remove user data from localStorage
 */
function removeUserData() {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Check if user is admin
 */
function isAdmin() {
  const user = getUserData();
  return user && user.role === "admin";
}

/**
 * Make API request with authentication
 */
async function apiRequest(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  // Add auth token if available and not a FormData request
  if (token && !(options.body instanceof FormData)) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add Content-Type for JSON if not FormData
  if (!(options.body instanceof FormData) && options.body) {
    headers["Content-Type"] = "application/json";
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
}

/**
 * Show loading overlay
 */
function showLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.remove("hidden");
  }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

/**
 * Format date to readable format
 */
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = parseAppDate(dateString);
  if (!date || Number.isNaN(date.getTime())) return dateString;
  return (
    date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

/**
 * Format date to simple format
 */
function formatDateSimple(dateString) {
  if (!dateString) return "-";
  const date = parseAppDate(dateString);
  if (!date || Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
  });
}

/**
 * Get relative time
 */
function getRelativeTime(dateString) {
  if (!dateString) return "-";
  const date = parseAppDate(dateString);
  if (!date || Number.isNaN(date.getTime())) return dateString;
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari yang lalu`;
  if (hours > 0) return `${hours} jam yang lalu`;
  if (minutes > 0) return `${minutes} menit yang lalu`;
  return "Baru saja";
}

/**
 * Show/hide page
 */
function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  // Show selected page
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add("active");
  }
}

/**
 * Toggle password visibility
 */
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.parentElement.querySelector(".toggle-password i");

  if (input.type === "password") {
    input.type = "text";
    button.classList.remove("fa-eye");
    button.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    button.classList.remove("fa-eye-slash");
    button.classList.add("fa-eye");
  }
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
  const statusConfig = {
    active: { class: "badge-warning", text: "Aktif" },
    pending: { class: "badge-info", text: "Pending" },
    approved: { class: "badge-success", text: "Disetujui" },
    returned: { class: "badge-success", text: "Dikembalikan" },
    cancelled: { class: "badge-danger", text: "Dibatalkan" },
  };

  const config = statusConfig[status] || {
    class: "badge-primary",
    text: status,
  };
  return `<span class="badge ${config.class}">${config.text}</span>`;
}

/**
 * Get condition badge HTML
 */
function getConditionBadge(condition) {
  const conditionConfig = {
    baik: { class: "badge-success", text: "Baik" },
    "rusak ringan": { class: "badge-warning", text: "Rusak Ringan" },
    "rusak berat": { class: "badge-danger", text: "Rusak Berat" },
  };

  const config = conditionConfig[condition] || {
    class: "badge-primary",
    text: condition,
  };
  return `<span class="badge ${config.class}">${config.text}</span>`;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Confirm action with user
 */
function confirmAction(message) {
  return confirm(message);
}

/**
 * Get base URL for images
 */
function getImageUrl(path) {
  if (!path) return DEFAULT_TOOL_PLACEHOLDER;
  if (path.startsWith("http")) return path;
  const token = getAuthToken();
  const url = new URL(path, window.location.origin);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

// ==================== DARK MODE FUNCTIONS ====================

/**
 * Initialize dark mode
 */
function initDarkMode() {
  // Check for saved theme preference or default to light mode
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

/**
 * Set theme
 */
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  // Update toggle icon if it exists
  const toggleIcon = document.getElementById("themeToggleIcon");
  if (toggleIcon) {
    if (theme === "dark") {
      toggleIcon.classList.remove("fa-moon");
      toggleIcon.classList.add("fa-sun");
    } else {
      toggleIcon.classList.remove("fa-sun");
      toggleIcon.classList.add("fa-moon");
    }
  }
}

/**
 * Get current theme
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}
