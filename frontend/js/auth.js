// ==================== AUTHENTICATION FUNCTIONS ====================

/**
 * Initialize authentication on page load
 */
function initAuth() {
    // Check if user is already logged in
    if (isAuthenticated()) {
        const user = getUserData();
        if (user) {
            if (user.role === 'admin') {
                showPage('adminDashboard');
                loadAdminDashboard();
            } else {
                showPage('userDashboard');
                loadUserDashboard();
            }
        }
    } else {
        showPage('loginPage');
    }

    // Setup form event listeners
    setupAuthForms();
}

/**
 * Setup authentication form event listeners
 */
function setupAuthForms() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Validation
    if (!username || !password) {
        showToast('Username dan password harus diisi', 'error');
        return;
    }

    try {
        showLoading();

        const response = await apiRequest(API_ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.success) {
            // Save token and user data
            setAuthToken(response.data.token);
            setUserData(response.data.user);

            showToast('Login berhasil!', 'success');

            // Redirect based on role
            setTimeout(() => {
                if (response.data.user.role === 'admin') {
                    showPage('adminDashboard');
                    loadAdminDashboard();
                } else {
                    showPage('userDashboard');
                    loadUserDashboard();
                }
            }, 500);
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message || 'Login gagal. Silakan coba lagi.', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle register form submission
 */
async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const fullName = document.getElementById('registerFullName').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Validation
    if (!username || !email || !fullName || !password || !confirmPassword) {
        showToast('Semua field wajib diisi kecuali nomor telepon', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showToast('Format email tidak valid', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password minimal 6 karakter', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('Password dan konfirmasi password tidak cocok', 'error');
        return;
    }

    try {
        showLoading();

        const response = await apiRequest(API_ENDPOINTS.AUTH.REGISTER, {
            method: 'POST',
            body: JSON.stringify({
                username,
                email,
                full_name: fullName,
                phone: phone || undefined,
                password
            })
        });

        if (response.success) {
            // Save token and user data
            setAuthToken(response.data.token);
            setUserData(response.data.user);

            showToast('Registrasi berhasil!', 'success');

            // Redirect to user dashboard
            setTimeout(() => {
                showPage('userDashboard');
                loadUserDashboard();
            }, 500);
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast(error.message || 'Registrasi gagal. Silakan coba lagi.', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Logout user
 */
function logout() {
    if (confirmAction('Apakah Anda yakin ingin logout?')) {
        // Clear all data
        removeAuthToken();
        removeUserData();
        localStorage.removeItem(STORAGE_KEYS.CART);

        showToast('Logout berhasil', 'success');

        // Redirect to login page
        setTimeout(() => {
            showPage('loginPage');

            // Reset forms
            document.getElementById('loginForm').reset();
            document.getElementById('registerForm').reset();
        }, 500);
    }
}

/**
 * Get current user info from API
 */
async function getCurrentUser() {
    try {
        const response = await apiRequest(API_ENDPOINTS.AUTH.ME, {
            method: 'GET'
        });

        if (response.success) {
            setUserData(response.data);
            return response.data;
        }
    } catch (error) {
        console.error('Get current user error:', error);
        // If token is invalid, logout
        if (error.message.includes('Token')) {
            logout();
        }
        return null;
    }
}

/**
 * Update user display name in navbar
 */
function updateUserDisplay() {
    const user = getUserData();
    if (!user) return;

    // Update admin navbar
    const adminUserName = document.getElementById('adminUserName');
    if (adminUserName) {
        adminUserName.textContent = user.full_name || user.username;
    }

    // Update user navbar
    const userUserName = document.getElementById('userUserName');
    if (userUserName) {
        userUserName.textContent = user.full_name || user.username;
    }
}

/**
 * Check authentication and redirect if needed
 */
function requireAuth() {
    if (!isAuthenticated()) {
        showToast('Anda harus login terlebih dahulu', 'warning');
        showPage('loginPage');
        return false;
    }
    return true;
}

/**
 * Check admin role and redirect if not admin
 */
function requireAdmin() {
    if (!isAuthenticated()) {
        showToast('Anda harus login terlebih dahulu', 'warning');
        showPage('loginPage');
        return false;
    }

    if (!isAdmin()) {
        showToast('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.', 'error');
        showPage('userDashboard');
        loadUserDashboard();
        return false;
    }

    return true;
}

// Initialize auth when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
