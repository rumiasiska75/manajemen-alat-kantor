// ==================== USER DASHBOARD FUNCTIONS ====================

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

let borrowCart = [];
let qrScanner = null;
let isScannerActive = false;

/**
 * Load user dashboard
 */
async function loadUserDashboard() {
  if (!requireAuth()) return;

  updateUserDisplay();
  showUserSection("userDashboardSection");
  await loadUserStats();
  loadCart();
}

/**
 * Show user section
 */
function showUserSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".user-section").forEach((section) => {
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
    case "userDashboardSection":
      loadUserStats();
      break;
    case "borrowToolsSection":
      // Scanner will be initialized when user clicks start
      break;
    case "myBorrowingsSection":
      loadMyBorrowings();
      break;
  }
}

/**
 * Load user statistics
 */
async function loadUserStats() {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.DASHBOARD.USER_STATS, {
      method: "GET",
    });

    if (response.success) {
      const stats = response.data;

      // Update stat cards
      document.getElementById("userStatActive").textContent =
        stats.active_borrowings || 0;
      document.getElementById("userStatReturned").textContent =
        stats.returned_borrowings || 0;
      document.getElementById("userStatTotal").textContent =
        stats.total_borrowings || 0;

      // Display recent borrowings
      displayUserRecentBorrowings(stats.recent_borrowings || []);
    }
  } catch (error) {
    console.error("Error loading user stats:", error);
    showToast("Gagal memuat statistik", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Display user recent borrowings
 */
function displayUserRecentBorrowings(borrowings) {
  const container = document.getElementById("userRecentBorrowings");
  if (!container) return;

  if (borrowings.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Belum ada peminjaman</p>
                <small>Mulai pinjam alat dengan scan QR Code</small>
            </div>
        `;
    return;
  }

  container.innerHTML = borrowings
    .map(
      (borrowing) => `
        <div class="borrowing-card" onclick="showBorrowingDetail(${borrowing.id})">
            <div class="borrowing-header">
                <div class="borrowing-date">
                    <i class="fas fa-calendar"></i> ${formatDate(borrowing.borrow_date)}
                </div>
                ${getStatusBadge(borrowing.status)}
            </div>
            <div class="borrowing-items">
                <p><strong>${borrowing.items_count || 0} alat</strong></p>
            </div>
        </div>
    `,
    )
    .join("");
}

// ==================== QR SCANNER FUNCTIONS ====================

/**
 * Toggle QR Scanner
 */
function toggleQRScanner() {
  if (isScannerActive) {
    stopQRScanner();
  } else {
    startQRScanner();
  }
}

/**
 * Start QR Scanner
 */
async function startQRScanner() {
  try {
    const qrReaderElement = document.getElementById("qrReader");
    if (!qrReaderElement) {
      showToast("QR Reader element not found", "error");
      return;
    }

    // Initialize scanner if not already initialized
    if (!qrScanner) {
      qrScanner = new Html5Qrcode("qrReader");
    }

    // Get camera permissions and start scanning
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    await qrScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanError,
    );

    isScannerActive = true;
    document.getElementById("scannerToggleText").textContent = "Stop Scan";
    showToast("Scanner aktif", "info");
  } catch (error) {
    console.error("Error starting QR scanner:", error);

    // Try with user-facing camera if environment camera fails
    try {
      if (qrScanner) {
        await qrScanner.start(
          { facingMode: "user" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          onScanError,
        );
        isScannerActive = true;
        document.getElementById("scannerToggleText").textContent = "Stop Scan";
        showToast("Scanner aktif (kamera depan)", "info");
      }
    } catch (fallbackError) {
      showToast(
        "Gagal mengakses kamera. Pastikan browser memiliki izin kamera.",
        "error",
      );
    }
  }
}

/**
 * Stop QR Scanner
 */
async function stopQRScanner() {
  try {
    if (qrScanner && isScannerActive) {
      await qrScanner.stop();
      isScannerActive = false;
      document.getElementById("scannerToggleText").textContent = "Mulai Scan";
      showToast("Scanner dihentikan", "info");
    }
  } catch (error) {
    console.error("Error stopping QR scanner:", error);
  }
}

/**
 * Handle successful QR scan
 */
async function onScanSuccess(decodedText, decodedResult) {
  console.log("QR Code detected:", decodedText);

  try {
    // Parse QR code data
    const qrData = JSON.parse(decodedText);

    if (qrData.tool_id && qrData.tool_code) {
      // Stop scanner temporarily
      await stopQRScanner();

      // Fetch tool details
      await addToolToCart(qrData.tool_id, qrData.tool_code);
    } else {
      showToast("QR Code tidak valid", "error");
    }
  } catch (error) {
    // If not JSON, try to use it as tool code
    console.log("Trying as tool code:", decodedText);

    try {
      await stopQRScanner();
      await addToolByCode(decodedText);
    } catch (codeError) {
      console.error("Error processing QR code:", error);
      showToast("Format QR Code tidak valid", "error");
    }
  }
}

/**
 * Handle QR scan error (silent)
 */
function onScanError(error) {
  // Ignore scan errors (they're normal when no QR code is visible)
}

/**
 * Add tool to cart by ID
 */
async function addToolToCart(toolId, toolCode) {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.GET(toolId), {
      method: "GET",
    });

    if (response.success) {
      const tool = response.data;

      // Check if tool is available
      if (tool.available_quantity <= 0) {
        showToast("Alat tidak tersedia untuk dipinjam", "warning");
        return;
      }

      // Check if already in cart
      const existingItem = borrowCart.find((item) => item.tool_id === tool.id);
      if (existingItem) {
        showToast("Alat sudah ada di keranjang", "warning");
        return;
      }

      // Add to cart
      borrowCart.push({
        tool_id: tool.id,
        tool_code: tool.tool_code,
        name: tool.name,
        category: tool.category,
        image_path: tool.image_path,
        quantity: 1,
        condition_before: tool.condition,
      });

      saveCart();
      displayCart();
      showToast(`${tool.name} ditambahkan ke keranjang`, "success");
    }
  } catch (error) {
    console.error("Error adding tool to cart:", error);
    showToast(error.message || "Gagal menambahkan alat ke keranjang", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Add tool by code (alternative method)
 */
async function addToolByCode(toolCode) {
  try {
    showLoading();

    const response = await apiRequest(API_ENDPOINTS.TOOLS.BY_CODE(toolCode), {
      method: "GET",
    });

    if (response.success) {
      const tool = response.data;
      await addToolToCart(tool.id, tool.tool_code);
    }
  } catch (error) {
    console.error("Error adding tool by code:", error);
    showToast(error.message || "Alat tidak ditemukan", "error");
  } finally {
    hideLoading();
  }
}

// ==================== CART MANAGEMENT ====================

/**
 * Load cart from localStorage
 */
function loadCart() {
  const cartData = localStorage.getItem(STORAGE_KEYS.CART);
  if (cartData) {
    try {
      borrowCart = JSON.parse(cartData);
      displayCart();
    } catch (error) {
      console.error("Error loading cart:", error);
      borrowCart = [];
    }
  }
}

/**
 * Save cart to localStorage
 */
function saveCart() {
  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(borrowCart));
}

/**
 * Display cart items
 */
function displayCart() {
  const cartContainer = document.getElementById("cartItems");
  const cartActions = document.getElementById("cartActions");
  const cartCount = document.getElementById("cartCount");

  if (!cartContainer) return;

  // Update cart count
  if (cartCount) {
    cartCount.textContent = borrowCart.length;
  }

  // Show/hide cart actions
  if (cartActions) {
    if (borrowCart.length > 0) {
      cartActions.classList.remove("hidden");
    } else {
      cartActions.classList.add("hidden");
    }
  }

  // Display cart items
  if (borrowCart.length === 0) {
    cartContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Keranjang kosong</p>
                <small>Scan QR Code alat untuk menambahkan</small>
            </div>
        `;
    return;
  }

  cartContainer.innerHTML = borrowCart
    .map(
      (item, index) => `
        <div class="cart-item">
            <img src="${getImageUrl(item.image_path)}" alt="${item.name}" class="cart-item-image" onerror="this.src='/images/placeholder.png'">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-code">#${item.tool_code}</div>
                <small>${item.category}</small>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `,
    )
    .join("");
}

/**
 * Remove item from cart
 */
function removeFromCart(index) {
  if (index >= 0 && index < borrowCart.length) {
    const item = borrowCart[index];
    borrowCart.splice(index, 1);
    saveCart();
    displayCart();
    showToast(`${item.name} dihapus dari keranjang`, "info");
  }
}

/**
 * Clear cart
 */
function clearCart() {
  if (borrowCart.length === 0) return;

  if (confirmAction("Kosongkan keranjang?")) {
    borrowCart = [];
    saveCart();
    displayCart();
    showToast("Keranjang dikosongkan", "info");
  }
}

/**
 * Checkout borrowing
 */
async function checkoutBorrowing() {
  if (borrowCart.length === 0) {
    showToast("Keranjang kosong", "warning");
    return;
  }

  const expectedReturnDate =
    document.getElementById("expectedReturnDate").value;
  const notes = document.getElementById("borrowNotes").value;
  const photoInput = document.getElementById("borrowPhoto");

  // Validate photo
  if (!photoInput.files || photoInput.files.length === 0) {
    if (!confirmAction("Anda belum menambahkan foto bukti. Lanjutkan?")) {
      return;
    }
  }

  try {
    showLoading();

    // Prepare form data
    const formData = new FormData();
    formData.append("items", JSON.stringify(borrowCart));

    if (expectedReturnDate) {
      formData.append("expected_return_date", expectedReturnDate);
    }

    if (notes) {
      formData.append("notes", notes);
    }

    if (photoInput.files && photoInput.files.length > 0) {
      formData.append("photo_evidence", photoInput.files[0]);
    }

    const response = await apiRequest(API_ENDPOINTS.BORROWINGS.CREATE, {
      method: "POST",
      body: formData,
    });

    if (response.success) {
      showToast("Peminjaman berhasil dibuat!", "success");

      // Clear cart and form
      borrowCart = [];
      saveCart();
      displayCart();
      document.getElementById("expectedReturnDate").value = "";
      document.getElementById("borrowNotes").value = "";
      document.getElementById("borrowPhoto").value = "";

      // Redirect to history
      setTimeout(() => {
        showUserSection("myBorrowingsSection");
      }, 1000);
    }
  } catch (error) {
    console.error("Error creating borrowing:", error);
    showToast(error.message || "Gagal membuat peminjaman", "error");
  } finally {
    hideLoading();
  }
}

// ==================== BORROWING HISTORY ====================

/**
 * Load user's borrowings
 */
async function loadMyBorrowings() {
  try {
    showLoading();

    let url = API_ENDPOINTS.BORROWINGS.LIST;
    const status = document.getElementById("myBorrowingStatusFilter")?.value;

    if (status) {
      url += `?status=${status}`;
    }

    const response = await apiRequest(url, {
      method: "GET",
    });

    if (response.success) {
      displayMyBorrowings(response.data);
    }
  } catch (error) {
    console.error("Error loading borrowings:", error);
    showToast("Gagal memuat riwayat peminjaman", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Display user's borrowings
 */
function displayMyBorrowings(borrowings) {
  const container = document.getElementById("myBorrowingsList");
  if (!container) return;

  if (borrowings.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Belum ada riwayat peminjaman</p>
                <small>Mulai pinjam alat dengan scan QR Code</small>
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
                    <div class="borrowing-date">
                        <i class="fas fa-calendar"></i> Dipinjam: ${formatDateShortWIB(borrowing.borrow_date)}
                    </div>
                    ${
                      borrowing.expected_return_date
                        ? `
                        <div class="borrowing-date" style="font-size: 12px; margin-top: 3px;">
                            <i class="fas fa-clock"></i> Rencana kembali: ${formatDateShortWIB(borrowing.expected_return_date)}
                        </div>
                    `
                        : ""
                    }
                    ${
                      borrowing.actual_return_date
                        ? `
                        <div class="borrowing-date" style="font-size: 12px; margin-top: 3px; color: var(--success-color);">
                            <i class="fas fa-check"></i> Dikembalikan: ${formatDateWIB(borrowing.actual_return_date)}
                        </div>
                    `
                        : ""
                    }
                </div>
                ${getStatusBadge(borrowing.status)}
            </div>
            <div class="borrowing-items">
                <p><strong>${borrowing.items ? borrowing.items.length : 0} alat dipinjam</strong></p>
                ${
                  borrowing.items
                    ? borrowing.items
                        .slice(0, 3)
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
                ${
                  borrowing.items && borrowing.items.length > 3
                    ? `
                    <div class="borrowing-item">
                        <i class="fas fa-ellipsis-h"></i>
                        <span>dan ${borrowing.items.length - 3} lainnya</span>
                    </div>
                `
                    : ""
                }
            </div>
            ${
              borrowing.status === "active"
                ? `
            <div class="borrowing-actions">
                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); showReturnModal(${borrowing.id})">
                    <i class="fas fa-undo"></i> Kembalikan
                </button>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); cancelBorrowing(${borrowing.id})">
                    <i class="fas fa-times"></i> Batalkan
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

// ==================== RETURN TOOL ====================

/**
 * Show return modal
 */
async function showReturnModal(borrowingId) {
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

      document.getElementById("returnBorrowingId").value = borrowing.id;

      // Display items to return
      const itemsList = document.getElementById("returnItemsList");
      if (itemsList) {
        itemsList.innerHTML = borrowing.items
          .map(
            (item) => `
                    <div class="return-item">
                        <div class="return-item-header">
                            ${item.tool_name} (${item.quantity}x)
                        </div>
                        <label style="font-size: 13px; margin-top: 8px; display: block;">Kondisi Alat:</label>
                        <select name="condition_${item.tool_id}" data-tool-id="${item.tool_id}">
                            <option value="baik">Baik (Normal)</option>
                            <option value="rusak ringan">Rusak Ringan</option>
                            <option value="rusak berat">Rusak Berat</option>
                        </select>
                        <label style="font-size: 13px; margin-top: 8px; display: block;">Catatan (Opsional):</label>
                        <input type="text" placeholder="Catatan kondisi..." name="notes_${item.tool_id}" data-tool-id="${item.tool_id}" style="width: 100%; padding: 8px; border: 2px solid var(--border-color); border-radius: 8px; margin-top: 5px;">
                    </div>
                `,
          )
          .join("");
      }

      document.getElementById("returnModal").classList.add("active");
    }
  } catch (error) {
    console.error("Error loading borrowing for return:", error);
    showToast("Gagal memuat data peminjaman", "error");
  } finally {
    hideLoading();
  }
}

/**
 * Close return modal
 */
function closeReturnModal() {
  document.getElementById("returnModal").classList.remove("active");
  document.getElementById("returnForm").reset();
}

/**
 * Handle return form submission
 */
document.addEventListener("DOMContentLoaded", () => {
  const returnForm = document.getElementById("returnForm");
  if (returnForm) {
    returnForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const borrowingId = document.getElementById("returnBorrowingId").value;
      const notes = document.getElementById("returnNotes").value;
      const photoInput = document.getElementById("returnPhoto");

      try {
        showLoading();

        // Collect condition data for each item
        const items = [];
        document.querySelectorAll("[data-tool-id]").forEach((input) => {
          const toolId = parseInt(input.dataset.toolId);

          if (input.tagName === "SELECT") {
            const existingItem = items.find((item) => item.tool_id === toolId);
            if (existingItem) {
              existingItem.condition_after = input.value;
            } else {
              items.push({
                tool_id: toolId,
                condition_after: input.value,
              });
            }
          } else if (input.tagName === "INPUT" && input.value) {
            const existingItem = items.find((item) => item.tool_id === toolId);
            if (existingItem) {
              existingItem.notes = input.value;
            } else {
              items.push({
                tool_id: toolId,
                notes: input.value,
              });
            }
          }
        });

        // Prepare form data
        const formData = new FormData();
        formData.append("items", JSON.stringify(items));

        if (notes) {
          formData.append("notes", notes);
        }

        if (photoInput.files && photoInput.files.length > 0) {
          formData.append("photo_evidence", photoInput.files[0]);
        }

        const response = await apiRequest(
          API_ENDPOINTS.BORROWINGS.RETURN(borrowingId),
          {
            method: "PUT",
            body: formData,
          },
        );

        if (response.success) {
          showToast("Alat berhasil dikembalikan!", "success");
          closeReturnModal();
          loadMyBorrowings();
          loadUserStats();
        }
      } catch (error) {
        console.error("Error returning borrowing:", error);
        showToast(error.message || "Gagal mengembalikan alat", "error");
      } finally {
        hideLoading();
      }
    });
  }
});

// ==================== CLEANUP ====================

/**
 * Cleanup when leaving borrow section
 */
window.addEventListener("beforeunload", () => {
  if (qrScanner && isScannerActive) {
    stopQRScanner();
  }
});
