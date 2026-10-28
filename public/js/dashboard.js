document.addEventListener('DOMContentLoaded', () => {
  let allBatches = [];
  let isChainValid = true;

  // DOM Elements
  const statTotalBatches = document.getElementById('stat-total-batches');
  const statTotalKg = document.getElementById('stat-total-kg');
  const statQualityPassed = document.getElementById('stat-quality-passed');
  const statQualityPending = document.getElementById('stat-quality-pending');
  const dashOldCount = document.getElementById('dash-old-count');
  const dashNewCount = document.getElementById('dash-new-count');
  const batchTableBody = document.getElementById('batch-table-body');
  const searchInput = document.getElementById('batch-search-input');
  const chainBanner = document.getElementById('chain-status-banner');
  const bannerChainText = document.getElementById('banner-chain-text');

  // Load Dashboard Data
  async function loadDashboard() {
    try {
      // 1. Fetch chain integrity status
      const chainData = await fetchApi('/api/blockchain/validate');
      isChainValid = chainData.validation.isValid;

      if (isChainValid) {
        chainBanner.className = 'alert alert-success';
        bannerChainText.innerHTML = `<strong>100% Intact</strong> — All ${chainData.validation.blockCount} ledger blocks verified with valid SHA-256 cryptographic linkage.`;
      } else {
        chainBanner.className = 'alert alert-danger';
        bannerChainText.innerHTML = `<strong>COMPROMISED AT BLOCK #${chainData.validation.brokenAtBlockIndex}</strong> — ${chainData.validation.reason}. <a href="blockchain.html" style="text-decoration:underline; font-weight:bold; color:inherit;">Inspect Chain in Ledger Explorer</a>`;
      }

      // 2. Fetch batches
      const batchesData = await fetchApi('/api/batches');
      allBatches = batchesData.batches || [];
      const stats = batchesData.stats || {};

      // Update Stat Cards
      statTotalBatches.textContent = stats.totalBatches || 0;
      statTotalKg.innerHTML = `${(stats.totalQuantityKg || 0).toFixed(1)} <small style="font-size:0.9rem; font-weight:normal;">kg</small>`;
      statQualityPassed.textContent = stats.statusCounts?.Passed || 0;
      statQualityPending.textContent = stats.statusCounts?.Pending || 0;

      // Update Stock Overview Badges
      if (dashOldCount) {
        dashOldCount.textContent = `🏺 Old Stock: ${stats.oldStockCount || 0} batches`;
      }
      if (dashNewCount) {
        dashNewCount.textContent = `🐝 New Stock: ${stats.newStockCount || 0} batches`;
      }

      // Render Batches Table
      renderTable(allBatches);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      showToast('Error loading dashboard data: ' + error.message, 'error');
      batchTableBody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 2rem; color: #dc2626;">
            Failed to connect to backend server. Make sure the server and MongoDB are running.
          </td>
        </tr>`;
    }
  }

  // Render Table Rows
  function renderTable(batches) {
    if (!batches || batches.length === 0) {
      batchTableBody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🐝</div>
            <p style="font-weight: 600; color: var(--text-primary);">No honey batches recorded yet</p>
            <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1rem;">Register your first honey harvest to anchor it onto the blockchain ledger.</p>
            <a href="register.html" class="btn btn-primary btn-sm">Register First Batch</a>
          </td>
        </tr>`;
      return;
    }

    batchTableBody.innerHTML = batches
      .map((batch) => {
        const stockInfo = batch.stockClassification || {};
        const isOld = stockInfo.isOldStock;
        const stockClassBadge = isOld ? 'badge-old-stock' : 'badge-new-stock';
        const stockLabel = isOld ? '🏺 Old Stock' : '🌱 New Stock';
        const ageLabel = stockInfo.ageFormatted || '';

        return `
          <tr>
            <td class="mono-cell">
              <a href="batch-details.html?batchId=${encodeURIComponent(batch.batchId)}" title="View batch details">
                ${batch.batchId}
              </a>
              ${batch.isSampleData ? '<br><span class="badge-demo" style="font-size:0.65rem;">Sample</span>' : ''}
            </td>
            <td>
              <span class="badge-variety">${escapeHtml(batch.honeyVariety || 'Wildflower')}</span>
            </td>
            <td><strong>${escapeHtml(batch.beekeeperName)}</strong></td>
            <td>${escapeHtml(batch.originLocation)}</td>
            <td><code style="background:var(--bg-gold-light); padding:2px 6px; border-radius:4px; font-size:0.85rem;">${escapeHtml(batch.hiveId)}</code></td>
            <td>${formatDate(batch.harvestDate)}</td>
            <td>
              <span class="badge ${stockClassBadge}" style="font-size:0.75rem;">
                ${stockLabel}
              </span>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                ${escapeHtml(ageLabel)}
              </div>
            </td>
            <td><strong>${Number(batch.quantityKg).toFixed(1)}</strong> kg</td>
            <td>${renderStatusBadge(batch.qualityStatus)}</td>
            <td>${renderBlockchainBadge(isChainValid)}</td>
            <td>
              <div style="display:flex; gap:0.4rem;">
                <a href="batch-details.html?batchId=${encodeURIComponent(batch.batchId)}" class="btn btn-secondary btn-sm" title="View Batch & QR Code">
                  <span>🔍</span> View
                </a>
                <a href="verify.html?batchId=${encodeURIComponent(batch.batchId)}" target="_blank" class="btn btn-secondary btn-sm" title="Preview Public Consumer Page">
                  <span>📱</span> Public
                </a>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        renderTable(allBatches);
        return;
      }
      const filtered = allBatches.filter((b) => {
        return (
          (b.batchId && b.batchId.toLowerCase().includes(query)) ||
          (b.beekeeperName && b.beekeeperName.toLowerCase().includes(query)) ||
          (b.originLocation && b.originLocation.toLowerCase().includes(query)) ||
          (b.hiveId && b.hiveId.toLowerCase().includes(query)) ||
          (b.honeyVariety && b.honeyVariety.toLowerCase().includes(query)) ||
          (b.displayName && b.displayName.toLowerCase().includes(query))
        );
      });
      renderTable(filtered);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  loadDashboard();
});
