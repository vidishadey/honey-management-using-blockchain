/**
 * Honey Chain — Shared Frontend API & UI Utilities
 */

// Centralized API client
async function fetchApi(endpoint, options = {}) {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    };

    const response = await fetch(endpoint, config);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.details
        ? Array.isArray(data.details)
          ? data.details.join(' ')
          : data.details
        : data.error || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error(`API Call failed [${endpoint}]:`, error);
    throw error;
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: '✔',
    error: '✖',
    info: 'ℹ',
  };

  toast.innerHTML = `<span>${iconMap[type] || 'ℹ'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Format date into human-readable format
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format timestamp into date & time
function formatDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Render quality status badge
function renderStatusBadge(status) {
  const normalized = (status || 'Pending').toLowerCase();
  let badgeClass = 'badge-pending';
  let icon = '⏳';

  if (normalized === 'passed') {
    badgeClass = 'badge-passed';
    icon = '✔';
  } else if (normalized === 'failed') {
    badgeClass = 'badge-failed';
    icon = '✖';
  }

  return `<span class="badge ${badgeClass}">${icon} ${status}</span>`;
}

// Render blockchain verification status badge
function renderBlockchainBadge(isValid) {
  if (isValid) {
    return `<span class="badge badge-verified">⛓ Valid Hash Link</span>`;
  }
  return `<span class="badge badge-alert">⚠ Compromised</span>`;
}

// Copy text to clipboard with user feedback
async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, 'success');
  } catch (err) {
    showToast('Failed to copy text', 'error');
  }
}
