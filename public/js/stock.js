document.addEventListener('DOMContentLoaded', () => {
  let allOldStock = [];
  let allNewStock = [];

  // DOM Elements
  const statOldCount = document.getElementById('stat-old-count');
  const statOldKg = document.getElementById('stat-old-kg');
  const statNewCount = document.getElementById('stat-new-count');
  const statNewKg = document.getElementById('stat-new-kg');
  const statTotalBatches = document.getElementById('stat-total-batches');
  const statTotalKg = document.getElementById('stat-total-kg');

  const badgeOldCount = document.getElementById('badge-old-count');
  const badgeNewCount = document.getElementById('badge-new-count');
  const oldStockList = document.getElementById('old-stock-list');
  const newStockList = document.getElementById('new-stock-list');

  const searchInput = document.getElementById('stock-search-input');
  const varietySelect = document.getElementById('variety-filter-select');
  const filterStatusText = document.getElementById('filter-status-text');
  const btnSeedSamples = document.getElementById('btn-seed-samples');

  // Load Honey Stock Data
  async function loadStockData() {
    try {
      const data = await fetchApi('/api/batches/stock');
      allOldStock = data.oldStock || [];
      allNewStock = data.newStock || [];
      const stats = data.stats || {};

      // Update stat cards
      statOldCount.textContent = stats.oldStockCount || 0;
      statOldKg.textContent = (stats.oldStockKg || 0).toFixed(1);
      statNewCount.textContent = stats.newStockCount || 0;
      statNewKg.textContent = (stats.newStockKg || 0).toFixed(1);
      statTotalBatches.textContent = stats.totalBatches || 0;
      statTotalKg.textContent = ((stats.oldStockKg || 0) + (stats.newStockKg || 0)).toFixed(1);

      badgeOldCount.textContent = `${allOldStock.length} Batch${allOldStock.length === 1 ? '' : 'es'}`;
      badgeNewCount.textContent = `${allNewStock.length} Batch${allNewStock.length === 1 ? '' : 'es'}`;

      applyFilterAndRender();
    } catch (error) {
      console.error('Failed to load stock categories:', error);
      showToast('Error loading stock categories: ' + error.message, 'error');
      oldStockList.innerHTML = `<div class="empty-stock-box"><p style="color:#dc2626;">Failed to load Old Stock.</p></div>`;
      newStockList.innerHTML = `<div class="empty-stock-box"><p style="color:#dc2626;">Failed to load New Stock.</p></div>`;
    }
  }

  // Filter and Render
  function applyFilterAndRender() {
    const query = (searchInput?.value || '').toLowerCase().trim();
    const selectedVariety = varietySelect?.value || '';

    const filterFn = (batch) => {
      const matchesSearch =
        !query ||
        (batch.displayName && batch.displayName.toLowerCase().includes(query)) ||
        (batch.batchId && batch.batchId.toLowerCase().includes(query)) ||
        (batch.beekeeperName && batch.beekeeperName.toLowerCase().includes(query)) ||
        (batch.originLocation && batch.originLocation.toLowerCase().includes(query)) ||
        (batch.hiveId && batch.hiveId.toLowerCase().includes(query));

      const matchesVariety = !selectedVariety || batch.honeyVariety === selectedVariety;
      return matchesSearch && matchesVariety;
    };

    const filteredOld = allOldStock.filter(filterFn);
    const filteredNew = allNewStock.filter(filterFn);

    renderColumn(oldStockList, filteredOld, 'old', query || selectedVariety);
    renderColumn(newStockList, filteredNew, 'new', query || selectedVariety);

    badgeOldCount.textContent = `${filteredOld.length} Batch${filteredOld.length === 1 ? '' : 'es'}`;
    badgeNewCount.textContent = `${filteredNew.length} Batch${filteredNew.length === 1 ? '' : 'es'}`;

    if (filterStatusText) {
      if (query || selectedVariety) {
        filterStatusText.textContent = `Filtered: ${filteredOld.length + filteredNew.length} of ${allOldStock.length + allNewStock.length} batches`;
      } else {
        filterStatusText.textContent = `Showing all ${allOldStock.length + allNewStock.length} batches`;
      }
    }
  }

  // Render a specific column
  function renderColumn(container, batches, type, isFiltered) {
    if (!batches || batches.length === 0) {
      const isOld = type === 'old';
      container.innerHTML = `
        <div class="empty-stock-box">
          <div class="empty-icon">${isOld ? '🏺' : '🐝'}</div>
          <p style="font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">
            ${isFiltered ? 'No matching batches found' : isOld ? 'No Old Stock recorded' : 'No New Stock recorded'}
          </p>
          <p style="font-size:0.83rem;">
            ${
              isFiltered
                ? 'Try broadening your search query or selecting "All Honey Varieties".'
                : isOld
                ? 'Honey batches harvested more than 10 years ago will automatically appear here.'
                : 'Recent honey harvests (≤ 10 years old) will automatically appear here.'
            }
          </p>
        </div>`;
      return;
    }

    container.innerHTML = batches
      .map((batch) => {
        const stockInfo = batch.stockClassification || {};
        const isOld = stockInfo.isOldStock;
        const ageLabel = stockInfo.ageFormatted || 'Age unknown';
        const ageBadgeClass = isOld ? 'badge-old-stock' : 'badge-new-stock';

        return `
          <div class="stock-batch-card">
            <div class="stock-card-top">
              <div>
                <div class="stock-batch-name">${escapeHtml(batch.displayName || batch.batchName || 'Honey Batch')}</div>
                <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.3rem; flex-wrap:wrap;">
                  <span class="mono-cell" style="font-size:0.85rem;">${batch.batchId}</span>
                  <span class="badge-variety">${escapeHtml(batch.honeyVariety || 'Wildflower')}</span>
                  ${batch.isSampleData ? '<span class="badge-demo">Demo Data</span>' : ''}
                </div>
              </div>
              <div>
                <span class="badge ${ageBadgeClass}" title="Calculated from harvest date relative to current date">
                  ${isOld ? '🏺' : '🌱'} ${escapeHtml(ageLabel)}
                </span>
              </div>
            </div>

            <div class="stock-meta-grid">
              <div class="stock-meta-item">
                <div class="meta-label">Beekeeper</div>
                <div class="meta-value">${escapeHtml(batch.beekeeperName)}</div>
              </div>
              <div class="stock-meta-item">
                <div class="meta-label">Origin Apiary</div>
                <div class="meta-value">${escapeHtml(batch.originLocation)}</div>
              </div>
              <div class="stock-meta-item">
                <div class="meta-label">Harvest Date</div>
                <div class="meta-value">${formatDate(batch.harvestDate)}</div>
              </div>
              <div class="stock-meta-item">
                <div class="meta-label">Yield Quantity</div>
                <div class="meta-value" style="color:var(--primary-dark-gold);">${Number(batch.quantityKg).toFixed(1)} kg</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
              <div>
                ${renderStatusBadge(batch.qualityStatus)}
              </div>
              <div style="display:flex; gap:0.4rem;">
                <a href="batch-details.html?batchId=${encodeURIComponent(batch.batchId)}" class="btn btn-secondary btn-sm" title="View Batch & QR Code">
                  <span>🔍</span> Details &amp; QR
                </a>
                <a href="verify.html?batchId=${encodeURIComponent(batch.batchId)}" target="_blank" class="btn btn-secondary btn-sm" title="Open Public Consumer Verification">
                  <span>📱</span> Verify
                </a>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Event Listeners for Filters
  if (searchInput) {
    searchInput.addEventListener('input', applyFilterAndRender);
  }
  if (varietySelect) {
    varietySelect.addEventListener('change', applyFilterAndRender);
  }

  // Seed Demonstration Batches Button
  if (btnSeedSamples) {
    btnSeedSamples.addEventListener('click', async () => {
      try {
        btnSeedSamples.disabled = true;
        btnSeedSamples.innerHTML = '<span>⏳</span> Seeding 12 Batches...';

        const res = await fetchApi('/api/batches/seed-samples', { method: 'POST' });
        showToast(res.message, 'success');
        await loadStockData();
      } catch (error) {
        console.error('Seeding error:', error);
        showToast('Failed to seed batches: ' + error.message, 'error');
      } finally {
        btnSeedSamples.disabled = false;
        btnSeedSamples.innerHTML = '<span>🌱</span> Seed Demo Batches';
      }
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

  loadStockData();
});
