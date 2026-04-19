// ==================== ADMIN DASHBOARD FUNCTIONS ====================

/**
 * Helper function untuk format tanggal WIB
 */
function formatDateWIB(dateString) {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);

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
    const date = new Date(dateString);

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
      loadCategories();
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
      displayTools(allTools);
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
    return;
  }

  container.innerHTML = tools
    .map(
      (tool) => `
        <div class="tool-card" onclick="showToolDetail(${tool.id})">
            <img src="${getImageUrl(tool.image_path)}" alt="${tool.name}" class="tool-card-image" onerror="this.src='/images/placeholder.png'">
            <div class="tool-card-body">
                <div class="tool-card-header">
                    <div>
                        <div class="tool-card-title">${tool.name}</div>
                        <div class="tool-card-code">#${tool.tool_code}</div>
                    </div>
                    ${getConditionBadge(tool.condition)}
                </div>
                <div class="tool-card-info">
                    <p><i class="fas fa-layer-group"></i> ${tool.category}</p>
                    <p><i class="fas fa-boxes"></i> ${tool.available_quantity}/${tool.quantity} tersedia</p>
                    ${tool.location ? `<p><i class="fas fa-map-marker-alt"></i> ${tool.location}</p>` : ""}
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
async function loadCategories() {
  try {
    const response = await apiRequest(API_ENDPOINTS.TOOLS.CATEGORIES, {
      method: "GET",
    });

    if (response.success) {
      const categoryFilter = document.getElementById("categoryFilter");
      const categoryList = document.getElementById("categoryList");

      const options = response.data
        .map((cat) => `<option value="${cat}">${cat}</option>`)
        .join("");

      if (categoryFilter) {
        categoryFilter.innerHTML =
          '<option value="">Semua Kategori</option>' + options;
      }

      if (categoryList) {
        categoryList.innerHTML = response.data
          .map((cat) => `<option value="${cat}">`)
          .join("");
      }
    }
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

/**
 * Show add tool modal
 */
function showAddToolModal() {
  currentEditingTool = null;
  document.getElementById("toolModalTitle").textContent = "Tambah Alat Baru";
  document.getElementById("toolForm").reset();
  document.getElementById("toolId").value = "";
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

      document.getElementById("toolModalTitle").textContent = "Edit Alat";
      document.getElementById("toolId").value = response.data.id;
      document.getElementById("toolCode").value = response.data.tool_code;
      document.getElementById("toolName").value = response.data.name;
      document.getElementById("toolCategory").value = response.data.category;
      document.getElementById("toolQuantity").value = response.data.quantity;
      document.getElementById("toolCondition").value = response.data.condition;
      document.getElementById("toolLocation").value =
        response.data.location || "";
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
            toolId ? "Alat berhasil diperbarui" : "Alat berhasil ditambahkan",
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
});

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
      showToast("Alat berhasil dihapus", "success");
      loadTools();
    }
  } catch (error) {
    console.error("Error deleting tool:", error);
    showToast(error.message || "Gagal menghapus alat", "error");
  } finally {
    hideLoading();
  }
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
                ${tool.image_path ? `<img src="${getImageUrl(tool.image_path)}" alt="${tool.name}" class="tool-detail-image">` : ""}

                <div class="tool-detail-grid">
                    <div class="detail-item">
                        <label>Kode Alat</label>
                        <p>${tool.tool_code}</p>
                    </div>
                    <div class="detail-item">
                        <label>Nama Alat</label>
                        <p>${tool.name}</p>
                    </div>
                    <div class="detail-item">
                        <label>Kategori</label>
                        <p>${tool.category}</p>
                    </div>
                    <div class="detail-item">
                        <label>Kondisi</label>
                        <p>${getConditionBadge(tool.condition)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Jumlah Total</label>
                        <p>${tool.quantity}</p>
                    </div>
                    <div class="detail-item">
                        <label>Tersedia</label>
                        <p>${tool.available_quantity}</p>
                    </div>
                    ${
                      tool.location
                        ? `
                    <div class="detail-item">
                        <label>Lokasi</label>
                        <p>${tool.location}</p>
                    </div>
                    `
                        : ""
                    }
                    <div class="detail-item">
                        <label>Dibuat oleh</label>
                        <p>${tool.created_by_name || tool.created_by_username || "-"}</p>
                    </div>
                </div>

                ${
                  tool.description
                    ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <label>Deskripsi</label>
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
                        <button class="btn btn-sm btn-primary" onclick="downloadQRCode('${getImageUrl(tool.qr_code_path)}', '${tool.tool_code}')">
                            <i class="fas fa-download"></i> Download QR Code
                        </button>
                    </p>
                </div>
                `
                    : ""
                }
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
    .map(
      (borrowing) => `
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
    `,
    )
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
                <div class="tool-detail-grid">
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

                <h4 style="margin-top: 20px; margin-bottom: 15px;">
                    <i class="fas fa-box"></i> Alat yang Dipinjam
                </h4>
                <div class="borrowings-list">
                    ${borrowing.items
                      .map(
                        (item) => `
                        <div class="borrowing-item" style="padding: 12px; background: var(--light-color); border-radius: 8px; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                ${item.image_path ? `<img src="${getImageUrl(item.image_path)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` : ""}
                                <div style="flex: 1;">
                                    <strong>${item.tool_name}</strong>
                                    <p style="font-size: 12px; color: var(--text-secondary);">
                                        Kode: ${item.tool_code} | Jumlah: ${item.quantity}
                                    </p>
                                    <p style="font-size: 12px;">
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
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 10px; font-weight: 600;">Foto Bukti</label>
                    <img src="${getImageUrl(borrowing.photo_evidence)}" style="max-width: 100%; border-radius: 8px;">
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

/**
 * Load all users
 */
async function loadUsers(filters = {}) {
  try {
    showLoading();

    let url = `${API_BASE_URL}/users`;
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
    <div class="user-item">
      <div class="user-info">
        <div class="user-avatar">
          ${user.full_name.charAt(0).toUpperCase()}
        </div>
        <div class="user-details">
          <h4>${user.full_name}</h4>
          <p>@${user.username} • ${user.email}</p>
          <p>
            ${user.role === "admin" ? '<span class="badge badge-primary">Admin</span>' : '<span class="badge badge-info">User</span>'}
            ${user.phone ? `• ${user.phone}` : ""}
          </p>
        </div>
      </div>
      <div class="user-actions">
        <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
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

    const response = await apiRequest(`${API_BASE_URL}/users/${userId}`, {
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

    const response = await apiRequest(`${API_BASE_URL}/users/${userId}`, {
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
