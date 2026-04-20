// ==================== ADMIN DASHBOARD FUNCTIONS ====================

/**
 * Helper function untuk format tanggal WIB
 */
function formatDateWIB(dateString) {
  if (!dateString) return "-";

  try {
    const date = parseAppDate(dateString);
    if (!date || Number.isNaN(date.getTime())) return dateString;

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateString).trim())) {
      return (
        date.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }) + " WIB"
      );
    }

    // Format: DD/MM/YYYY HH:mm:ss WIB
    return (
      date.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }) + " WIB"
    );
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
}

/**
 * Helper function untuk format tanggal pendek WIB
 */
function formatDateShortWIB(dateString) {
  if (!dateString) return "-";

  try {
    const date = parseAppDate(dateString);
    if (!date || Number.isNaN(date.getTime())) return dateString;

    // Format: DD/MM/YYYY
    return date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
}

let allTools = [];
let allBorrowings = [];
let currentEditingTool = null;
let selectedToolIds = new Set();
let knownCategories = [];
let knownItemTypes = [];

function formatPurchasePeriod(month, year) {
  if (!month || !year) return "-";
  return `${String(month).padStart(2, "0")}/${year}`;
}

function formatInventoryActivity(value) {
  return value ? formatDateWIB(value) : "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderToolLogRows(logs = []) {
  if (!logs.length) {
    return `
      <div class="empty-state compact-empty-state">
        <i class="fas fa-history"></i>
        <p>Belum ada log peminjaman untuk peralatan ini.</p>
      </div>
    `;
  }

  return `
    <div class="tool-log-table-wrapper">
      <table class="tool-log-table">
        <thead>
          <tr>
            <th>Peminjam</th>
            <th>Dipinjam</th>
            <th>Dikembalikan</th>
            <th>Status</th>
            <th>Kondisi</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${logs
            .map(
              (log) => `
                <tr>
                  <td>${escapeHtml(log.full_name || log.username || "-")}</td>
                  <td>${formatDateWIB(log.borrow_date)}</td>
                  <td>${formatDateWIB(log.actual_return_date)}</td>
                  <td>${getStatusBadge(log.status)}</td>
                  <td>
                    ${getConditionBadge(log.condition_before)}
                    ${
                      log.condition_after
                        ? `<span class="tool-log-arrow">→</span> ${getConditionBadge(log.condition_after)}`
                        : ""
                    }
                  </td>
                  <td>${escapeHtml(log.notes || "-")}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getAvailabilityBadge(status) {
  const normalizedStatus = status || "tersedia";
  const statusConfig = {
    tersedia: { class: "badge-success", text: "Tersedia" },
    dipinjam: { class: "badge-warning", text: "Sedang Dipinjam" },
  };

  const config = statusConfig[normalizedStatus] || {
    class: "badge-primary",
    text: normalizedStatus,
  };

  return `<span class="badge ${config.class}">${config.text}</span>`;
}

/**
 * Load admin dashboard
 */
async function loadAdminDashboard() {
  if (!requireAdmin()) return;

  updateUserDisplay();
  showAdminSection("dashboardSection");
  await loadDashboardStats();
}

/**
 * Show admin section
 */
function showAdminSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".admin-section").forEach((section) => {
    section.classList.remove("active");
  });

  // Show selected section
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add("active");
  }

  // Update navbar active state
  document.querySelectorAll(".navbar-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Load section content
  switch (sectionId) {
    case "dashboardSection":
      loadDashboardStats();
      break;
    case "toolsSection":
      loadTools();
      loadToolMetadata();
      break;
    case "borrowingsSection":
      loadBorrowings();
      break;
    case "usersSection":
      loadUsers();
      break;
  }
}

/**
 * Load dashboard statistics
 */
async function loadDashboardStats() {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.DASHBOARD.STATS, {
      method: "GET",
    });

    if (response.success) {
      const stats = response.data;

      // Update stat cards
      document.getElementById("statTotalTools").textContent =
        stats.total_tools || 0;
      document.getElementById("statAvailableTools").textContent =
        stats.available_tools || 0;
      document.getElementById("statActiveBorrowings").textContent =
        stats.active_borrowings || 0;
      document.getElementById("statTotalUsers").textContent =
        stats.total_users || 0;

      // Load recent activities
      displayRecentActivities(stats.recent_activities || []);
    }
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
    showToast("Gagal memuat statistik dashboard", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Display recent activities
 */
function displayRecentActivities(activities) {
  const container = document.getElementById("recentActivities");
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Belum ada aktivitas</p>
            </div>
        `;
    return;
  }

  container.innerHTML = activities
    .map(
      (activity) => `
        <div class="activity-item">
            <div class="activity-info">
                <strong>${activity.full_name || activity.username}</strong>
                <p>${activity.description || activity.action}</p>
            </div>
            <div class="activity-time">
                ${formatDateWIB(activity.created_at)}
            </div>
        </div>
    `,
    )
    .join("");
}

function getBorrowingCardMarkup(borrowing) {
  return `
    <div class="borrowing-card" onclick="showBorrowingDetail(${borrowing.id})">
        <div class="borrowing-header">
            <div>
                <div class="borrowing-user">
                    <i class="fas fa-user"></i> ${borrowing.full_name || borrowing.username}
                </div>
                <div class="borrowing-date">
                    <i class="fas fa-calendar"></i> ${formatDateShortWIB(borrowing.borrow_date)}
                </div>
            </div>
            ${getStatusBadge(borrowing.status)}
        </div>
        <div class="borrowing-items">
            <p><strong>${borrowing.items ? borrowing.items.length : 0} alat dipinjam</strong></p>
            ${
              borrowing.items
                ? borrowing.items
                    .map(
                      (item) => `
                <div class="borrowing-item">
                    <i class="fas fa-box"></i>
                    <span>${item.tool_name} (${item.quantity}x)</span>
                </div>
            `,
                    )
                    .join("")
                : ""
            }
        </div>
        ${
          borrowing.status === "pending"
            ? `
        <div class="borrowing-actions">
            <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); approveBorrowing(${borrowing.id})">
                <i class="fas fa-check"></i> Setujui
            </button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); cancelBorrowing(${borrowing.id})">
                <i class="fas fa-times"></i> Tolak
            </button>
        </div>
        `
            : ""
        }
    </div>
  `;
}

async function showActiveBorrowingsModal() {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.BORROWINGS.LIST, {
      method: "GET",
    });

    if (!response.success) {
      throw new Error("Gagal mengambil data peminjaman aktif");
    }

    const activeBorrowings = (response.data || []).filter((borrowing) =>
      ["active", "approved"].includes(borrowing.status),
    );

    const container = document.getElementById("activeBorrowingsContent");
    if (!container) return;

    if (!activeBorrowings.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-handshake"></i>
          <p>Tidak ada peminjaman aktif saat ini</p>
          <small>Semua peminjaman sudah dikembalikan atau belum ada transaksi aktif.</small>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="detail-item active-borrowings-summary">
          <label>Total Peminjaman Aktif</label>
          <p>${activeBorrowings.length} transaksi belum dikembalikan</p>
        </div>
        <div class="borrowings-list">
          ${activeBorrowings.map(getBorrowingCardMarkup).join("")}
        </div>
      `;
    }

    document.getElementById("activeBorrowingsModal").classList.add("active");
  } catch (error) {
    console.error("Error showing active borrowings modal:", error);
    showToast(error.message || "Gagal memuat peminjaman aktif", "error");
  } finally {
    hideLoading();
  }
}

function closeActiveBorrowingsModal() {
  const modal = document.getElementById("activeBorrowingsModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// ==================== TOOLS MANAGEMENT ====================

/**
 * Load all tools
 */
async function loadTools(filters = {}) {
  try {
    showLoading();

    let url = API_ENDPOINTS.TOOLS.LIST;
    const params = new URLSearchParams();

    if (filters.category) params.append("category", filters.category);
    if (filters.condition) params.append("condition", filters.condition);
    if (filters.search) params.append("search", filters.search);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    const response = await apiRequest(url, {
      method: "GET",
    });

    if (response.success) {
      allTools = response.data;
      selectedToolIds = new Set(
        [...selectedToolIds].filter((toolId) =>
          allTools.some((tool) => tool.id === toolId),
        ),
      );
      displayTools(allTools);
      updateSelectedToolsUI();
    }
  } catch (error) {
    console.error("Error loading tools:", error);
    showToast("Gagal memuat data alat", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Display tools in grid
 */
function displayTools(tools) {
  const container = document.getElementById("toolsList");
  if (!container) return;

  if (tools.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-toolbox"></i>
                <p>Tidak ada alat ditemukan</p>
                <small>Klik tombol "Tambah Alat" untuk menambahkan alat baru</small>
            </div>
        `;
    updateSelectedToolsUI();
    return;
  }

  container.innerHTML = tools
    .map(
      (tool) => `
        <div class="tool-card inventory-card ${selectedToolIds.has(tool.id) ? "selected" : ""}" onclick="showToolDetail(${tool.id})">
            <input
                type="checkbox"
                class="tool-card-select"
                ${selectedToolIds.has(tool.id) ? "checked" : ""}
                onclick="toggleToolSelection(${tool.id}, event)"
                aria-label="Pilih ${tool.name}"
            >
            <img src="${getImageUrl(tool.image_path)}" alt="${tool.name}" class="tool-card-image" onload="markImageAsLoaded(this)" onerror="handleImageError(this)">
            <div class="tool-card-body">
                <div class="tool-card-header">
                    <div>
                        <div class="tool-card-title">${tool.name}</div>
                        <div class="tool-card-code">SN-${tool.serial_number}</div>
                    </div>
                    ${getAvailabilityBadge(tool.availability_status)}
                </div>
                <div class="inventory-meta-row">
                    <span>${tool.category}</span>
                    <span>${tool.item_type || "-"}</span>
                </div>
                <div class="tool-card-info">
                    <p><i class="fas fa-arrow-down"></i> Barang Masuk: ${formatInventoryActivity(tool.barang_masuk)}</p>
                    <p><i class="fas fa-arrow-up"></i> Barang Keluar: ${formatInventoryActivity(tool.barang_keluar)}</p>
                    <p><i class="fas fa-calendar-alt"></i> Pembelian: ${formatPurchasePeriod(tool.purchase_month, tool.purchase_year)}</p>
                    ${
                      tool.accessories
                        ? `<p><i class="fas fa-plug"></i> Aksesoris: ${tool.accessories}</p>`
                        : ""
                    }
                    <p><i class="fas fa-stethoscope"></i> ${tool.description || "Belum ada keterangan"}</p>
                </div>
                <div class="tool-card-footer">
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); editTool(${tool.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteTool(${tool.id})">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

function updateSelectedToolsUI() {
  const selectedCountElement = document.getElementById("selectedToolsCount");
  const toggleButton = document.getElementById("toggleSelectToolsButton");

  if (selectedCountElement) {
    selectedCountElement.textContent = `${selectedToolIds.size} item dipilih`;
  }

  if (toggleButton) {
    const allVisibleSelected =
      allTools.length > 0 && allTools.every((tool) => selectedToolIds.has(tool.id));
    toggleButton.innerHTML = allVisibleSelected
      ? '<i class="fas fa-square"></i> Batal Pilih Semua'
      : '<i class="fas fa-check-square"></i> Pilih Semua';
  }
}

function toggleToolSelection(toolId, event) {
  event.stopPropagation();

  if (selectedToolIds.has(toolId)) {
    selectedToolIds.delete(toolId);
  } else {
    selectedToolIds.add(toolId);
  }

  displayTools(allTools);
  updateSelectedToolsUI();
}

function toggleSelectAllVisibleTools() {
  if (allTools.length === 0) {
    showToast("Tidak ada alat pada daftar saat ini", "warning");
    return;
  }

  const allVisibleSelected = allTools.every((tool) =>
    selectedToolIds.has(tool.id),
  );

  allTools.forEach((tool) => {
    if (allVisibleSelected) {
      selectedToolIds.delete(tool.id);
    } else {
      selectedToolIds.add(tool.id);
    }
  });

  displayTools(allTools);
  updateSelectedToolsUI();
}

function clearToolSelection() {
  selectedToolIds.clear();
  displayTools(allTools);
  updateSelectedToolsUI();
}

function getSelectedTools() {
  return allTools.filter((tool) => selectedToolIds.has(tool.id));
}

/**
 * Filter tools
 */
function filterTools() {
  const search = document.getElementById("toolSearchInput").value;
  const category = document.getElementById("categoryFilter").value;
  const condition = document.getElementById("conditionFilter").value;

  loadTools({ search, category, condition });
}

/**
 * Load categories for filter
 */
async function loadToolMetadata() {
  try {
    const response = await apiRequest(API_ENDPOINTS.TOOLS.METADATA, {
      method: "GET",
    });

    if (response.success) {
      const categoryFilter = document.getElementById("categoryFilter");
      const categoryList = document.getElementById("categoryList");
      const itemTypeList = document.getElementById("itemTypeList");
      knownCategories = response.data.categories || [];
      knownItemTypes = response.data.item_types || [];

      const categoryOptions = knownCategories
        .map((cat) => `<option value="${cat}">${cat}</option>`)
        .join("");

      if (categoryFilter) {
        categoryFilter.innerHTML =
          '<option value="">Semua Kategori</option>' + categoryOptions;
      }

      if (categoryList) {
        categoryList.innerHTML = knownCategories
          .map((cat) => `<option value="${cat}">`)
          .join("");
      }

      if (itemTypeList) {
        itemTypeList.innerHTML = knownItemTypes
          .map((itemType) => `<option value="${itemType}">`)
          .join("");
      }
    }
  } catch (error) {
    console.error("Error loading tool metadata:", error);
  }
}

/**
 * Show add tool modal
 */
function showAddToolModal() {
  currentEditingTool = null;
  document.getElementById("toolModalTitle").textContent =
    "Tambah Peralatan Baru";
  document.getElementById("toolForm").reset();
  document.getElementById("toolId").value = "";
  loadToolMetadata();
  document.getElementById("toolModal").classList.add("active");
}

/**
 * Close tool modal
 */
function closeToolModal() {
  document.getElementById("toolModal").classList.remove("active");
  document.getElementById("toolForm").reset();
  currentEditingTool = null;
}

function showBatchAddToolModal() {
  const rowsContainer = document.getElementById("batchToolRows");
  if (!rowsContainer) return;

  rowsContainer.innerHTML = "";
  loadToolMetadata();
  addBatchToolRow();
  addBatchToolRow();
  addBatchToolRow();

  document.getElementById("batchToolModal").classList.add("active");
}

function closeBatchAddToolModal() {
  document.getElementById("batchToolModal").classList.remove("active");
  document.getElementById("batchToolForm").reset();
  document.getElementById("batchToolRows").innerHTML = "";
}

function normalizeImportedBatchRow(row = {}) {
  return {
    serial_number: String(
      row.serial_number ??
        row.tool_code ??
        row.kode_alat ??
        row.serial ??
        row.kode ??
        row.code ??
        "",
    ).trim(),
    name: String(row.name ?? row.nama_barang ?? row.nama_alat ?? row.nama ?? "")
      .trim(),
    category: String(row.category ?? row.kategori ?? "").trim(),
    item_type: String(row.item_type ?? row.jenis ?? "").trim(),
    accessories: String(row.accessories ?? row.aksesoris ?? "").trim(),
    purchase_month: String(
      row.purchase_month ?? row.bulan_pembelian ?? row.bulan ?? "",
    ).trim(),
    purchase_year: String(
      row.purchase_year ?? row.tahun_pembelian ?? row.tahun ?? "",
    ).trim(),
    condition: String(row.condition ?? row.kondisi ?? "baik")
      .trim()
      .toLowerCase() || "baik",
    description: String(
      row.description ?? row.keterangan ?? row.deskripsi ?? "",
    ).trim(),
  };
}

async function importBatchToolsFromFile() {
  const fileInput = document.getElementById("batchToolFile");
  const file = fileInput?.files?.[0];

  if (!file) {
    showToast("Pilih file Excel/CSV terlebih dahulu", "warning");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Library import spreadsheet belum siap", "error");
    return;
  }

  try {
    showLoading();

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error("File tidak memiliki sheet/data yang bisa dibaca");
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      throw new Error("File kosong atau header tidak terbaca");
    }

    const normalizedRows = rows
      .map(normalizeImportedBatchRow)
      .filter(
        (row) =>
          row.serial_number || row.name || row.category || row.item_type,
      );

    if (normalizedRows.length === 0) {
      throw new Error("Tidak ada baris alat yang valid di file tersebut");
    }

    const rowsContainer = document.getElementById("batchToolRows");
    rowsContainer.innerHTML = "";
    normalizedRows.forEach((row) => addBatchToolRow(row));

    showToast(
      `${normalizedRows.length} baris peralatan berhasil dimuat dari file`,
      "success",
    );
  } catch (error) {
    console.error("Error importing batch tools:", error);
    showToast(error.message || "Gagal membaca file Excel/CSV", "error");
  } finally {
    hideLoading();
  }
}

function addBatchToolRow(defaultValues = {}) {
  const rowsContainer = document.getElementById("batchToolRows");
  if (!rowsContainer) return;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input type="text" data-field="serial_number" value="${defaultValues.serial_number || ""}" required></td>
    <td><input type="text" data-field="name" value="${defaultValues.name || ""}" required></td>
    <td><input type="text" data-field="category" value="${defaultValues.category || ""}" list="categoryList" required></td>
    <td><input type="text" data-field="item_type" value="${defaultValues.item_type || ""}" list="itemTypeList" required></td>
    <td><input type="number" data-field="purchase_month" value="${defaultValues.purchase_month || ""}" min="1" max="12" placeholder="MM"></td>
    <td><input type="number" data-field="purchase_year" value="${defaultValues.purchase_year || ""}" min="1900" max="2999" placeholder="YYYY"></td>
    <td>
      <select data-field="condition">
        <option value="baik" ${defaultValues.condition === "rusak ringan" || defaultValues.condition === "rusak berat" ? "" : "selected"}>Baik</option>
        <option value="rusak ringan" ${defaultValues.condition === "rusak ringan" ? "selected" : ""}>Rusak Ringan</option>
        <option value="rusak berat" ${defaultValues.condition === "rusak berat" ? "selected" : ""}>Rusak Berat</option>
      </select>
    </td>
    <td><input type="text" data-field="accessories" value="${defaultValues.accessories || ""}" placeholder="Opsional"></td>
    <td><textarea data-field="description" rows="2">${defaultValues.description || ""}</textarea></td>
    <td>
      <button type="button" class="btn btn-danger btn-sm batch-remove-row" onclick="removeBatchToolRow(this)">
        <i class="fas fa-times"></i> Hapus
      </button>
    </td>
  `;

  rowsContainer.appendChild(row);
}

function removeBatchToolRow(button) {
  const rowsContainer = document.getElementById("batchToolRows");
  if (!rowsContainer) return;

  if (rowsContainer.children.length === 1) {
    showToast("Minimal harus ada satu baris pada batch add", "warning");
    return;
  }

  button.closest("tr").remove();
}

/**
 * Edit tool
 */
async function editTool(toolId) {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.GET(toolId), {
      method: "GET",
    });

    if (response.success) {
      currentEditingTool = response.data;
      loadToolMetadata();

      document.getElementById("toolModalTitle").textContent = "Edit Peralatan";
      document.getElementById("toolId").value = response.data.id;
      document.getElementById("toolCode").value = response.data.serial_number;
      document.getElementById("toolName").value = response.data.name;
      document.getElementById("toolCategory").value = response.data.category;
      document.getElementById("toolType").value = response.data.item_type || "";
      document.getElementById("toolPurchaseMonth").value =
        response.data.purchase_month || "";
      document.getElementById("toolPurchaseYear").value =
        response.data.purchase_year || "";
      document.getElementById("toolCondition").value = response.data.condition;
      document.getElementById("toolAccessories").value =
        response.data.accessories || "";
      document.getElementById("toolDescription").value =
        response.data.description || "";

      document.getElementById("toolModal").classList.add("active");
    }
  } catch (error) {
    console.error("Error loading tool:", error);
    showToast("Gagal memuat data alat", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Handle tool form submission
 */
document.addEventListener("DOMContentLoaded", () => {
  const toolForm = document.getElementById("toolForm");
  if (toolForm) {
    toolForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const toolId = document.getElementById("toolId").value;
      const formData = new FormData(toolForm);

      try {
        showLoading();

        let response;
        if (toolId) {
          // Update existing tool
          response = await apiRequest(API_ENDPOINTS.TOOLS.UPDATE(toolId), {
            method: "PUT",
            body: formData,
          });
        } else {
          // Create new tool
          response = await apiRequest(API_ENDPOINTS.TOOLS.CREATE, {
            method: "POST",
            body: formData,
          });
        }

        if (response.success) {
          showToast(
            toolId
              ? "Peralatan berhasil diperbarui"
              : "Peralatan berhasil ditambahkan",
            "success",
          );
          closeToolModal();
          loadTools();
        }
      } catch (error) {
        console.error("Error saving tool:", error);
        showToast(error.message || "Gagal menyimpan alat", "error");
      } finally {
        hideLoading();
      }
    });
  }

  const batchToolForm = document.getElementById("batchToolForm");
  if (batchToolForm) {
    batchToolForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const rows = document.querySelectorAll("#batchToolRows tr");
      const tools = Array.from(rows)
        .map((row) => ({
          serial_number: row
            .querySelector('[data-field="serial_number"]')
            .value.trim(),
          name: row.querySelector('[data-field="name"]').value.trim(),
          category: row.querySelector('[data-field="category"]').value.trim(),
          item_type: row.querySelector('[data-field="item_type"]').value.trim(),
          accessories: row
            .querySelector('[data-field="accessories"]')
            .value.trim(),
          purchase_month: row
            .querySelector('[data-field="purchase_month"]')
            .value.trim(),
          purchase_year: row
            .querySelector('[data-field="purchase_year"]')
            .value.trim(),
          condition: row.querySelector('[data-field="condition"]').value,
          description: row.querySelector('[data-field="description"]').value.trim(),
        }))
        .filter(
          (tool) =>
            tool.serial_number ||
            tool.name ||
            tool.category ||
            tool.item_type,
        );

      if (tools.length === 0) {
        showToast("Isi minimal satu baris batch add", "warning");
        return;
      }

      try {
        showLoading();

        const response = await apiRequest(API_ENDPOINTS.TOOLS.BATCH_CREATE, {
          method: "POST",
          body: JSON.stringify({ tools }),
        });

        if (response.success) {
          showToast(response.message || "Batch add berhasil", "success");
          closeBatchAddToolModal();
          await loadTools();
        }
      } catch (error) {
        console.error("Error saving batch tools:", error);
        showToast(error.message || "Gagal menyimpan batch alat", "error");
      } finally {
        hideLoading();
      }
    });
  }
});

async function exportAllToolsToExcel() {
  if (typeof XLSX === "undefined") {
    showToast("Library Excel belum siap", "error");
    return;
  }

  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.EXPORT_ALL, {
      method: "GET",
    });

    if (!response.success || !response.data?.length) {
      showToast("Tidak ada data peralatan untuk diexport", "warning");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(response.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Peralatan");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `audit-peralatan-${today}.xlsx`);
    showToast("Export Excel berhasil dibuat", "success");
  } catch (error) {
    console.error("Error exporting tools:", error);
    showToast(error.message || "Gagal export Excel", "error");
  } finally {
    hideLoading();
  }
}

async function exportToolLogsToExcel(toolId) {
  if (typeof XLSX === "undefined") {
    showToast("Library Excel belum siap", "error");
    return;
  }

  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.LOGS(toolId), {
      method: "GET",
    });

    if (!response.success) {
      throw new Error("Gagal mengambil log peralatan");
    }

    const { tool, logs } = response.data;

    if (!logs.length) {
      showToast("Belum ada log untuk peralatan ini", "warning");
      return;
    }

    const rows = logs.map((log) => ({
      "Serial Number": tool.serial_number,
      "Nama Barang": tool.name,
      Peminjam: log.full_name || log.username || "-",
      Dipinjam: log.borrow_date || "-",
      Dikembalikan: log.actual_return_date || "-",
      Status: log.status || "-",
      "Kondisi Sebelum": log.condition_before || "-",
      "Kondisi Sesudah": log.condition_after || "-",
      Catatan: log.notes || "-",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log Peralatan");

    XLSX.writeFile(
      workbook,
      `log-${tool.serial_number}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    showToast("Export log peralatan berhasil", "success");
  } catch (error) {
    console.error("Error exporting tool logs:", error);
    showToast(error.message || "Gagal export log peralatan", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Delete tool
 */
async function deleteTool(toolId) {
  if (!confirmAction("Apakah Anda yakin ingin menghapus alat ini?")) {
    return;
  }

  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.DELETE(toolId), {
      method: "DELETE",
    });

    if (response.success) {
      showToast("Peralatan berhasil dihapus", "success");
      loadTools();
    }
  } catch (error) {
    console.error("Error deleting tool:", error);
    showToast(error.message || "Gagal menghapus alat", "error");
  } finally {
    hideLoading();
  }
}

async function deleteSelectedTools() {
  const selectedTools = getSelectedTools();

  if (selectedTools.length === 0) {
    showToast("Pilih alat yang ingin dihapus", "warning");
    return;
  }

  if (
    !confirmAction(
      `Hapus ${selectedTools.length} alat yang dipilih? Alat yang sedang dipinjam tidak akan bisa dihapus.`,
    )
  ) {
    return;
  }

  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.BATCH_DELETE, {
      method: "POST",
      body: JSON.stringify({
        ids: selectedTools.map((tool) => tool.id),
      }),
    });

    if (response.success) {
      showToast(response.message || "Batch remove berhasil", "success");
      clearToolSelection();
      await loadTools();
    }
  } catch (error) {
    console.error("Error deleting selected tools:", error);
    showToast(error.message || "Gagal menghapus alat terpilih", "error");
  } finally {
    hideLoading();
  }
}

function printSelectedToolQRCodes() {
  const selectedTools = getSelectedTools();

  if (selectedTools.length === 0) {
    showToast("Pilih alat yang ingin dicetak QR code-nya", "warning");
    return;
  }

  const printableTools = selectedTools.filter((tool) => tool.qr_code_path);

  if (printableTools.length === 0) {
    showToast("Tidak ada QR code yang siap dicetak", "error");
    return;
  }

  if (printableTools.length !== selectedTools.length) {
    showToast(
      "Sebagian alat belum memiliki QR code dan dilewati saat print",
      "warning",
    );
  }

  const printWindow = window.open("", "_blank");
  const cardsHtml = printableTools
    .map(
      (tool) => `
        <article class="print-card">
          <img src="${getImageUrl(tool.qr_code_path)}" alt="QR ${tool.serial_number}">
          <h3>${tool.name}</h3>
          <p>${tool.serial_number}</p>
        </article>
      `,
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Batch Print QR Code</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            color: #111827;
          }
          .print-header {
            margin-bottom: 20px;
          }
          .print-header h1 {
            margin: 0 0 6px;
            font-size: 22px;
          }
          .print-header p {
            margin: 0;
            color: #4b5563;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 18px;
          }
          .print-card {
            border: 1px solid #d1d5db;
            border-radius: 16px;
            padding: 18px;
            text-align: center;
            break-inside: avoid;
          }
          .print-card img {
            width: 170px;
            height: 170px;
            object-fit: contain;
            margin-bottom: 14px;
          }
          .print-card h3 {
            margin: 0 0 6px;
            font-size: 18px;
          }
          .print-card p {
            margin: 0;
            font-size: 14px;
            letter-spacing: 0.08em;
          }
          @media print {
            body { padding: 12px; }
          }
        </style>
      </head>
      <body>
        <header class="print-header">
          <h1>Batch Print QR Code Peralatan</h1>
          <p>${printableTools.length} item siap dicetak</p>
        </header>
        <section class="print-grid">${cardsHtml}</section>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}

/**
 * Show tool detail modal
 */
async function showToolDetail(toolId) {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.GET(toolId), {
      method: "GET",
    });

    if (response.success) {
      const tool = response.data;

      const content = `
                <img src="${getImageUrl(tool.image_path)}" alt="${tool.name}" class="tool-detail-image" onload="markImageAsLoaded(this)" onerror="handleImageError(this)">

                <div class="tool-detail-grid">
                    <div class="detail-item">
                        <label>Serial Number</label>
                        <p>${tool.serial_number}</p>
                    </div>
                    <div class="detail-item">
                        <label>Nama Barang</label>
                        <p>${tool.name}</p>
                    </div>
                    <div class="detail-item">
                        <label>Kategori</label>
                        <p>${tool.category}</p>
                    </div>
                    <div class="detail-item">
                        <label>Jenis</label>
                        <p>${tool.item_type || "-"}</p>
                    </div>
                    <div class="detail-item">
                        <label>Aksesoris</label>
                        <p>${tool.accessories || "-"}</p>
                    </div>
                    <div class="detail-item">
                        <label>Barang Masuk</label>
                        <p>${formatInventoryActivity(tool.barang_masuk)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Barang Keluar</label>
                        <p>${formatInventoryActivity(tool.barang_keluar)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Pembelian</label>
                        <p>${formatPurchasePeriod(tool.purchase_month, tool.purchase_year)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Status</label>
                        <p>${getAvailabilityBadge(tool.availability_status)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Kondisi</label>
                        <p>${getConditionBadge(tool.condition)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Dibuat oleh</label>
                        <p>${tool.created_by_name || tool.created_by_username || "-"}</p>
                    </div>
                </div>

                ${
                  tool.description
                    ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <label>Keterangan</label>
                    <p>${tool.description}</p>
                </div>
                `
                    : ""
                }

                ${
                  tool.qr_code_path
                    ? `
                <div class="qr-code-display">
                    <label>QR Code</label>
                    <img src="${getImageUrl(tool.qr_code_path)}" alt="QR Code">
                    <p style="margin-top: 10px;">
                        <button class="btn btn-sm btn-primary" onclick="downloadQRCode('${getImageUrl(tool.qr_code_path)}', '${tool.serial_number}')">
                            <i class="fas fa-download"></i> Download QR Code
                        </button>
                    </p>
                </div>
                `
                    : ""
                }

                <div class="tool-log-section">
                    <div class="tool-log-header">
                        <label>Log Peminjaman Per Alat</label>
                        <button class="btn btn-sm btn-outline" onclick="exportToolLogsToExcel(${tool.id})">
                            <i class="fas fa-file-export"></i> Export Log
                        </button>
                    </div>
                    ${renderToolLogRows(tool.borrowing_history || [])}
                </div>
            `;

      document.getElementById("toolDetailContent").innerHTML = content;
      document.getElementById("toolDetailModal").classList.add("active");
    }
  } catch (error) {
    console.error("Error loading tool detail:", error);
    showToast("Gagal memuat detail alat", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Close tool detail modal
 */
function closeToolDetailModal() {
  document.getElementById("toolDetailModal").classList.remove("active");
}

/**
 * Download QR Code
 */
function downloadQRCode(qrUrl, toolCode) {
  const link = document.createElement("a");
  link.href = qrUrl;
  link.download = `QR-${toolCode}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==================== BORROWINGS MANAGEMENT ====================

/**
 * Load all borrowings
 */
async function loadBorrowings(filters = {}) {
  try {
    showLoading();

    let url = API_ENDPOINTS.BORROWINGS.LIST;
    const params = new URLSearchParams();

    const status = document.getElementById("borrowingStatusFilter")?.value;
    if (status) params.append("status", status);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    const response = await apiRequest(url, {
      method: "GET",
    });

    if (response.success) {
      allBorrowings = response.data;
      displayBorrowings(allBorrowings);
    }
  } catch (error) {
    console.error("Error loading borrowings:", error);
    showToast("Gagal memuat data peminjaman", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Display borrowings
 */
function displayBorrowings(borrowings) {
  const container = document.getElementById("borrowingsList");
  if (!container) return;

  if (borrowings.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <p>Tidak ada data peminjaman</p>
            </div>
        `;
    return;
  }

  container.innerHTML = borrowings
    .map(getBorrowingCardMarkup)
    .join("");
}

/**
 * Show borrowing detail
 */
async function showBorrowingDetail(borrowingId) {
  try {
    showLoading();

    const response = await apiRequest(
      API_ENDPOINTS.BORROWINGS.GET(borrowingId),
      {
        method: "GET",
      },
    );

    if (response.success) {
      const borrowing = response.data;

      const content = `
                <div class="tool-detail-grid borrowing-summary-grid">
                    <div class="detail-item">
                        <label>Peminjam</label>
                        <p>${borrowing.full_name || borrowing.username}</p>
                    </div>
                    <div class="detail-item">
                        <label>Status</label>
                        <p>${getStatusBadge(borrowing.status)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Tanggal Pinjam</label>
                        <p>${formatDateWIB(borrowing.borrow_date)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Tanggal Kembali (Rencana)</label>
                        <p>${formatDateWIB(borrowing.expected_return_date)}</p>
                    </div>
                    ${
                      borrowing.actual_return_date
                        ? `
                    <div class="detail-item">
                        <label>Tanggal Kembali (Aktual)</label>
                        <p>${formatDateWIB(borrowing.actual_return_date)}</p>
                    </div>
                    `
                        : ""
                    }
                    ${
                      borrowing.notes
                        ? `
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <label>Catatan</label>
                        <p>${borrowing.notes}</p>
                    </div>
                    `
                        : ""
                    }
                </div>

                <h4 class="detail-section-title">
                    <i class="fas fa-box"></i> Alat yang Dipinjam
                </h4>
                <div class="borrowings-list detail-borrowings-list">
                    ${borrowing.items
                      .map(
                        (item) => `
                        <div class="borrowing-detail-item">
                            <div class="borrowing-detail-row">
                                <img src="${getImageUrl(item.image_path)}" class="borrowing-detail-image" onload="markImageAsLoaded(this)" onerror="handleImageError(this)">
                                <div class="borrowing-detail-copy">
                                    <strong>${item.tool_name}</strong>
                                    <p class="borrowing-detail-meta">
                                        Serial: ${item.serial_number || item.tool_code} | Jumlah: ${item.quantity}
                                    </p>
                                    <p class="borrowing-detail-meta">
                                        Kondisi Awal: ${getConditionBadge(item.condition_before)}
                                        ${item.condition_after ? ` → Kondisi Akhir: ${getConditionBadge(item.condition_after)}` : ""}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>

                ${
                  borrowing.photo_evidence
                    ? `
                <div class="borrowing-proof-section">
                    <label>Foto Bukti</label>
                    <img src="${getImageUrl(borrowing.photo_evidence)}" class="borrowing-proof-image">
                </div>
                `
                    : ""
                }
            `;

      document.getElementById("borrowingDetailContent").innerHTML = content;
      document.getElementById("borrowingDetailModal").classList.add("active");
    }
  } catch (error) {
    console.error("Error loading borrowing detail:", error);
    showToast("Gagal memuat detail peminjaman", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Close borrowing detail modal
 */
function closeBorrowingDetailModal() {
  document.getElementById("borrowingDetailModal").classList.remove("active");
}

/**
 * Approve borrowing
 */
async function approveBorrowing(borrowingId) {
  if (!confirmAction("Setujui peminjaman ini?")) return;

  try {
    showLoading();

    const response = await apiRequest(
      API_ENDPOINTS.BORROWINGS.APPROVE(borrowingId),
      {
        method: "PUT",
      },
    );

    if (response.success) {
      showToast("Peminjaman berhasil disetujui", "success");
      loadBorrowings();
    }
  } catch (error) {
    console.error("Error approving borrowing:", error);
    showToast(error.message || "Gagal menyetujui peminjaman", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Cancel borrowing
 */
async function cancelBorrowing(borrowingId) {
  if (!confirmAction("Batalkan peminjaman ini?")) return;

  try {
    showLoading();

    const response = await apiRequest(
      API_ENDPOINTS.BORROWINGS.CANCEL(borrowingId),
      {
        method: "PUT",
      },
    );

    if (response.success) {
      showToast("Peminjaman berhasil dibatalkan", "success");
      loadBorrowings();
    }
  } catch (error) {
    console.error("Error cancelling borrowing:", error);
    showToast(error.message || "Gagal membatalkan peminjaman", "error");
  } finally {
    hideLoading();
  }
}

// ==================== USERS MANAGEMENT ====================

function renderUserBorrowingItems(items = [], emptyText = "Tidak ada alat") {
  if (!items.length) {
    return `<p class="user-audit-empty">${emptyText}</p>`;
  }

  return `
    <div class="user-borrowed-tools">
      ${items
        .map(
          (item) => `
            <span class="user-borrowed-tool">
              ${escapeHtml(item.tool_name)}
              <small>SN-${escapeHtml(item.serial_number || "-")}</small>
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderUserBorrowingTimeline(
  borrowings = [],
  emptyText = "Belum ada riwayat peminjaman.",
) {
  if (!borrowings.length) {
    return `
      <div class="empty-state compact-empty-state">
        <i class="fas fa-clipboard-list"></i>
        <p>${escapeHtml(emptyText)}</p>
      </div>
    `;
  }

  return borrowings
    .map(
      (borrowing) => `
        <div class="user-audit-borrowing-card">
          <div class="user-audit-borrowing-header">
            <div>
              <strong>Peminjaman #${borrowing.id}</strong>
              <p>Dipinjam ${formatDateWIB(borrowing.borrow_date)}</p>
            </div>
            ${getStatusBadge(borrowing.status)}
          </div>
          <div class="user-audit-borrowing-meta">
            <span><i class="fas fa-box"></i> ${borrowing.items?.length || 0} alat</span>
            <span><i class="fas fa-clock"></i> Rencana kembali: ${formatDateWIB(borrowing.expected_return_date)}</span>
            <span><i class="fas fa-check-circle"></i> Aktual kembali: ${formatDateWIB(borrowing.actual_return_date)}</span>
          </div>
          ${renderUserBorrowingItems(
            borrowing.items || [],
            "Belum ada item alat pada peminjaman ini.",
          )}
          ${
            borrowing.notes
              ? `<p class="user-audit-note">${escapeHtml(borrowing.notes)}</p>`
              : ""
          }
        </div>
      `,
    )
    .join("");
}

async function showUserAudit(userId) {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.USERS.AUDIT(userId), {
      method: "GET",
    });

    if (!response.success) {
      throw new Error("Gagal mengambil audit pengguna");
    }

    const { user, active_borrowings, borrowing_history } = response.data;
    const stats = user.statistics || {};
    const content = `
      <div class="user-audit-header-card">
        <div class="user-audit-user-meta">
          <div class="user-avatar user-avatar-large">
            ${escapeHtml((user.full_name || "?").charAt(0).toUpperCase())}
          </div>
          <div>
            <h3>${escapeHtml(user.full_name)}</h3>
            <p>@${escapeHtml(user.username)} | ${escapeHtml(user.email)}</p>
            <p>
              ${user.role === "admin" ? '<span class="badge badge-primary">Admin</span>' : '<span class="badge badge-info">User</span>'}
              ${user.phone ? `<span class="user-inline-separator">|</span>${escapeHtml(user.phone)}` : ""}
            </p>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="exportUserAuditToExcel(${user.id})">
          <i class="fas fa-file-export"></i> Export Audit
        </button>
      </div>

      <div class="user-audit-stats-grid">
        <div class="detail-item">
          <label>Total Peminjaman</label>
          <p>${stats.total_borrowings || 0}</p>
        </div>
        <div class="detail-item">
          <label>Sedang Meminjam</label>
          <p>${stats.active_borrowings || 0}</p>
        </div>
        <div class="detail-item">
          <label>Sudah Dikembalikan</label>
          <p>${stats.returned_borrowings || 0}</p>
        </div>
        <div class="detail-item">
          <label>Dibatalkan</label>
          <p>${stats.cancelled_borrowings || 0}</p>
        </div>
      </div>

      <div class="tool-log-section">
        <div class="tool-log-header">
          <label>Sedang Dipinjam Saat Ini</label>
        </div>
        <div class="user-audit-section">
          ${renderUserBorrowingTimeline(
            active_borrowings,
            "Pengguna ini tidak sedang meminjam alat.",
          )}
        </div>
      </div>

      <div class="tool-log-section">
        <div class="tool-log-header">
          <label>Riwayat Peminjaman</label>
        </div>
        <div class="user-audit-section">
          ${renderUserBorrowingTimeline(
            borrowing_history,
            "Belum ada riwayat peminjaman.",
          )}
        </div>
      </div>
    `;

    document.getElementById("userAuditModalTitle").textContent =
      `Audit Pengguna: ${user.full_name}`;
    document.getElementById("userAuditContent").innerHTML = content;
    document.getElementById("userAuditModal").classList.add("active");
  } catch (error) {
    console.error("Error showing user audit:", error);
    showToast(error.message || "Gagal memuat audit pengguna", "error");
  } finally {
    hideLoading();
  }
}

function closeUserAuditModal() {
  const modal = document.getElementById("userAuditModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

async function exportUserAuditToExcel(userId) {
  if (typeof XLSX === "undefined") {
    showToast("Library Excel belum siap", "error");
    return;
  }

  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.USERS.EXPORT(userId), {
      method: "GET",
    });

    if (!response.success) {
      throw new Error("Gagal menyiapkan export audit pengguna");
    }

    const { user, summary, active_borrowings, borrowing_history } = response.data;
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summary),
      "Ringkasan",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        active_borrowings.length
          ? active_borrowings
          : [{ Info: "Tidak ada peminjaman aktif" }],
      ),
      "Sedang Dipinjam",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        borrowing_history.length
          ? borrowing_history
          : [{ Info: "Belum ada riwayat peminjaman" }],
      ),
      "Riwayat",
    );

    const today = new Date().toISOString().slice(0, 10);
    const safeUsername = (user.username || "pengguna").replace(/[^\w-]+/g, "-");
    XLSX.writeFile(workbook, `audit-user-${safeUsername}-${today}.xlsx`);
    showToast("Export audit pengguna berhasil", "success");
  } catch (error) {
    console.error("Error exporting user audit:", error);
    showToast(error.message || "Gagal export audit pengguna", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Load all users
 */
async function loadUsers(filters = {}) {
  try {
    showLoading();

    let url = API_ENDPOINTS.USERS.LIST;
    const params = new URLSearchParams();

    const search = document.getElementById("userSearchInput")?.value;
    const role = document.getElementById("userRoleFilter")?.value;

    if (search) params.append("search", search);
    if (role) params.append("role", role);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    const response = await apiRequest(url, {
      method: "GET",
    });

    if (response.success) {
      displayUsers(response.data);
    }
  } catch (error) {
    console.error("Error loading users:", error);
    showToast("Gagal memuat data pengguna", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Display users in list
 */
function displayUsers(users) {
  const container = document.getElementById("usersList");
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <p>Tidak ada pengguna ditemukan</p>
        <small>Klik tombol "Tambah Pengguna" untuk menambahkan pengguna baru</small>
      </div>
    `;
    return;
  }

  container.innerHTML = users
    .map(
      (user) => `
    <div class="user-item user-audit-card" onclick="showUserAudit(${user.id})">
      <div class="user-info">
        <div class="user-avatar">
          ${escapeHtml((user.full_name || "?").charAt(0).toUpperCase())}
        </div>
        <div class="user-details">
          <h4>${escapeHtml(user.full_name)}</h4>
          <p>@${escapeHtml(user.username)} | ${escapeHtml(user.email)}</p>
          <p>
            ${user.role === "admin" ? '<span class="badge badge-primary">Admin</span>' : '<span class="badge badge-info">User</span>'}
            ${user.phone ? ` | ${escapeHtml(user.phone)}` : ""}
          </p>
        </div>
      </div>
      <div class="user-audit-summary">
        <div class="user-audit-summary-row">
          <span class="badge badge-warning">Aktif: ${user.active_borrowings || 0}</span>
          <span class="badge badge-success">Riwayat: ${user.returned_borrowings || 0}</span>
          <span class="badge badge-primary">Total: ${user.total_borrowings || 0}</span>
        </div>
        <div class="user-audit-summary-tools">
          <strong>Sedang meminjam:</strong>
          <span>${escapeHtml(user.active_tool_names || "Tidak ada alat aktif")}</span>
        </div>
      </div>
      <div class="user-actions">
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); showUserAudit(${user.id})">
          <i class="fas fa-clipboard-list"></i> Audit
        </button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); exportUserAuditToExcel(${user.id})">
          <i class="fas fa-file-excel"></i> Export
        </button>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); editUser(${user.id})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteUser(${user.id})">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </div>
    </div>
  `,
    )
    .join("");
}

/**
 * Filter users
 */
function filterUsers() {
  loadUsers();
}

/**
 * Show add user modal
 */
function showAddUserModal() {
  document.getElementById("userModalTitle").textContent =
    "Tambah Pengguna Baru";
  document.getElementById("userForm").reset();
  document.getElementById("userId").value = "";
  document.getElementById("userPassword").required = true;
  document.getElementById("passwordHint").textContent = "Minimal 6 karakter";
  document.getElementById("userModal").classList.add("active");
}

/**
 * Close user modal
 */
function closeUserModal() {
  document.getElementById("userModal").classList.remove("active");
  document.getElementById("userForm").reset();
}

/**
 * Edit user
 */
async function editUser(userId) {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.USERS.GET(userId), {
      method: "GET",
    });

    if (response.success) {
      const user = response.data;

      document.getElementById("userModalTitle").textContent = "Edit Pengguna";
      document.getElementById("userId").value = user.id;
      document.getElementById("userName").value = user.username;
      document.getElementById("userEmail").value = user.email;
      document.getElementById("userFullName").value = user.full_name;
      document.getElementById("userPhone").value = user.phone || "";
      document.getElementById("userRole").value = user.role;
      document.getElementById("userPassword").required = false;
      document.getElementById("passwordHint").textContent =
        "Minimal 6 karakter (kosongkan jika tidak ingin mengubah password)";

      document.getElementById("userModal").classList.add("active");
    }
  } catch (error) {
    console.error("Error loading user:", error);
    showToast("Gagal memuat data pengguna", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Handle user form submission
 */
document.addEventListener("DOMContentLoaded", () => {
  const userForm = document.getElementById("userForm");
  if (userForm) {
    userForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const userId = document.getElementById("userId").value;
      const formData = {
        username: document.getElementById("userName").value,
        email: document.getElementById("userEmail").value,
        full_name: document.getElementById("userFullName").value,
        phone: document.getElementById("userPhone").value,
        role: document.getElementById("userRole").value,
      };

      const password = document.getElementById("userPassword").value;
      if (password) {
        formData.password = password;
      }

      try {
        showLoading();

        let response;
        if (userId) {
          // Update existing user
          response = await apiRequest(`${API_BASE_URL}/users/${userId}`, {
            method: "PUT",
            body: JSON.stringify(formData),
          });
        } else {
          // Create new user
          if (!password) {
            showToast("Password wajib diisi untuk pengguna baru", "error");
            hideLoading();
            return;
          }
          response = await apiRequest(`${API_BASE_URL}/users`, {
            method: "POST",
            body: JSON.stringify(formData),
          });
        }

        if (response.success) {
          showToast(
            userId
              ? "Pengguna berhasil diperbarui"
              : "Pengguna berhasil ditambahkan",
            "success",
          );
          closeUserModal();
          loadUsers();
        }
      } catch (error) {
        console.error("Error saving user:", error);
        showToast(error.message || "Gagal menyimpan pengguna", "error");
      } finally {
        hideLoading();
      }
    });
  }
});

/**
 * Delete user
 */
async function deleteUser(userId) {
  if (!confirmAction("Apakah Anda yakin ingin menghapus pengguna ini?")) {
    return;
  }

  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.USERS.GET(userId), {
      method: "DELETE",
    });

    if (response.success) {
      showToast("Pengguna berhasil dihapus", "success");
      loadUsers();
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    showToast(error.message || "Gagal menghapus pengguna", "error");
  } finally {
    hideLoading();
  }
}
