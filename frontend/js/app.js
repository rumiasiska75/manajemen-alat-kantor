// ==================== MAIN APPLICATION ====================

/**
 * Initialize application
 */
function initApp() {
    console.log('Initializing application...');

    // Initialize authentication
    initAuth();

    // Setup global event listeners
    setupGlobalListeners();

    // Close modals when clicking outside
    setupModalHandlers();

    // Initialize date inputs with today's date
    initializeDateInputs();

    console.log('Application initialized successfully');
}

/**
 * Setup global event listeners
 */
function setupGlobalListeners() {
    // Handle escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Prevent default form submission
    document.querySelectorAll('form').forEach(form => {
        if (!form.dataset.listenerAdded) {
            form.addEventListener('submit', (e) => {
                // Only prevent if not handled by specific handler
                if (!form.dataset.handled) {
                    e.preventDefault();
                }
            });
            form.dataset.listenerAdded = 'true';
        }
    });
}

/**
 * Setup modal click handlers
 */
function setupModalHandlers() {
    const modals = document.querySelectorAll('.modal');

    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            // Close modal if clicking on background
            if (e.target === modal) {
                modal.classList.remove('active');

                // Stop QR scanner if closing borrow section
                if (modal.id === 'borrowToolsSection' && isScannerActive) {
                    stopQRScanner();
                }
            }
        });
    });
}

/**
 * Close all modals
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

/**
 * Initialize date inputs
 */
function initializeDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');

    dateInputs.forEach(input => {
        if (!input.value) {
            input.min = today;
        }
    });
}

/**
 * Handle image loading errors
 */
function handleImageError(img) {
    img.onerror = null; // Prevent infinite loop
    img.src = '/images/placeholder.png';
}

/**
 * Format currency (IDR)
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * Debounce function for search inputs
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Disalin ke clipboard', 'success');
    } catch (error) {
        console.error('Failed to copy:', error);
        showToast('Gagal menyalin', 'error');
    }
}

/**
 * Download file
 */
function downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Print content
 */
function printContent(contentId) {
    const content = document.getElementById(contentId);
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            ${content.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

/**
 * Check if device is mobile
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Get device type
 */
function getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

/**
 * Validate file size
 */
function validateFileSize(file, maxSizeMB = 5) {
    const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    if (file.size > maxSize) {
        showToast(`Ukuran file maksimal ${maxSizeMB}MB`, 'error');
        return false;
    }
    return true;
}

/**
 * Validate file type
 */
function validateFileType(file, allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']) {
    if (!allowedTypes.includes(file.type)) {
        showToast('Tipe file tidak didukung', 'error');
        return false;
    }
    return true;
}

/**
 * Preview image before upload
 */
function previewImage(input, previewElementId) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        if (!validateFileType(file) || !validateFileSize(file)) {
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewElementId);
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Scroll to top
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * Scroll to element
 */
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

/**
 * Check internet connection
 */
function checkConnection() {
    if (!navigator.onLine) {
        showToast('Tidak ada koneksi internet', 'error');
        return false;
    }
    return true;
}

/**
 * Handle online/offline events
 */
window.addEventListener('online', () => {
    showToast('Koneksi internet tersambung', 'success');
});

window.addEventListener('offline', () => {
    showToast('Koneksi internet terputus', 'error');
});

/**
 * Service worker registration (for PWA - optional)
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/service-worker.js')
        //     .then(registration => {
        //         console.log('ServiceWorker registered:', registration);
        //     })
        //     .catch(error => {
        //         console.log('ServiceWorker registration failed:', error);
        //     });
    });
}

/**
 * Export data to CSV
 */
function exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    let csv = headers.join(',') + '\n';

    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            // Escape commas and quotes
            return typeof value === 'string' && value.includes(',')
                ? `"${value.replace(/"/g, '""')}"`
                : value;
        });
        csv += values.join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Data berhasil diekspor', 'success');
}

/**
 * Generate random ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Truncate text
 */
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format phone number
 */
function formatPhoneNumber(phone) {
    if (!phone) return '';
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    // Format: 0812-3456-7890
    const match = cleaned.match(/^(\d{4})(\d{4})(\d{0,4})$/);
    if (match) {
        return match[1] + '-' + match[2] + (match[3] ? '-' + match[3] : '');
    }
    return phone;
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get query parameters
 */
function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');

    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
    });

    return params;
}

/**
 * Update URL parameters without reload
 */
function updateURLParameter(param, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(param, value);
    } else {
        url.searchParams.delete(param);
    }
    window.history.pushState({}, '', url);
}

/**
 * Handle browser back button
 */
window.addEventListener('popstate', (event) => {
    // Handle back button navigation
    console.log('Navigation:', event);
});

/**
 * Log application errors
 */
window.addEventListener('error', (event) => {
    console.error('Application error:', event.error);
    // Could send to error tracking service here
});

/**
 * Log unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Could send to error tracking service here
});

/**
 * Performance monitoring
 */
if (window.performance && window.performance.timing) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = window.performance.timing;
            const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
            console.log(`Page load time: ${pageLoadTime}ms`);
        }, 0);
    });
}

// ==================== INITIALIZE APP ====================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export functions for use in other modules
window.app = {
    showLoading,
    hideLoading,
    showToast,
    formatDate,
    formatDateSimple,
    getRelativeTime,
    showPage,
    getStatusBadge,
    getConditionBadge,
    copyToClipboard,
    downloadFile,
    exportToCSV,
    checkConnection,
    isMobileDevice,
    getDeviceType
};

console.log('App.js loaded successfully');
