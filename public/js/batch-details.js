document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('batchId');

  if (!batchId) {
    showToast('No Batch ID provided in URL', 'error');
    document.querySelector('.main-wrapper').innerHTML = `
      <div class="card" style="text-align:center; padding:3rem;">
        <h2>Batch Not Found</h2>
        <p>No Batch ID was specified in the URL query parameters.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top:1rem;">Back to Dashboard</a>
      </div>`;
    return;
  }

  // DOM Elements
  const headerBatchId = document.getElementById('header-batch-id');
  const headerBatchSub = document.getElementById('header-batch-sub');
  const batchStatusBadge = document.getElementById('batch-status-badge');
  const btnConsumerView = document.getElementById('btn-consumer-view');

  const detailBeekeeper = document.getElementById('detail-beekeeper');
  const detailOrigin = document.getElementById('detail-origin');
  const detailHive = document.getElementById('detail-hive');
  const detailQuantity = document.getElementById('detail-quantity');
  const detailHarvestDate = document.getElementById('detail-harvest-date');
  const detailExtractionDate = document.getElementById('detail-extraction-date');
  const detailNotes = document.getElementById('detail-notes');

  const qrImage = document.getElementById('qr-image');
  const qrBatchLabel = document.getElementById('qr-batch-label');
  const qrLinkInput = document.getElementById('qr-link-input');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnDownloadQr = document.getElementById('btn-download-qr');
  const btnPrintQr = document.getElementById('btn-print-qr');

  const eventCountBadge = document.getElementById('event-count-badge');
  const batchTimeline = document.getElementById('batch-timeline');

  // Modal Elements
  const btnOpenStatusModal = document.getElementById('btn-open-status-modal');
  const statusModal = document.getElementById('status-modal');
  const btnCloseStatusModal = document.getElementById('btn-close-status-modal');
  const btnCancelStatusModal = document.getElementById('btn-cancel-status-modal');
  const statusUpdateForm = document.getElementById('status-update-form');
  const modalQualitySelect = document.getElementById('modal-quality-select');
  const modalNotesInput = document.getElementById('modal-notes-input');
  const btnSubmitStatusUpdate = document.getElementById('btn-submit-status-update');

  let currentBatchData = null;

  // Load Batch Details
  async function loadBatchDetails() {
    try {
      const data = await fetchApi(`/api/batches/${encodeURIComponent(batchId)}`);
      currentBatchData = data.batch;

      headerBatchId.textContent = currentBatchData.batchId;
      headerBatchSub.textContent = `Registered by ${currentBatchData.beekeeperName} on ${formatDate(currentBatchData.createdAt)}`;
      batchStatusBadge.innerHTML = renderStatusBadge(currentBatchData.qualityStatus);

      btnConsumerView.href = `verify.html?batchId=${encodeURIComponent(currentBatchData.batchId)}`;

      const detailVariety = document.getElementById('detail-variety');
      const detailStockClass = document.getElementById('detail-stock-class');

      if (detailVariety) {
        detailVariety.innerHTML = `<span class="badge-variety">${escapeHtml(currentBatchData.honeyVariety || 'Wildflower')}</span>`;
      }

      if (detailStockClass) {
        const stock = currentBatchData.stockClassification || {};
        const isOld = stock.isOldStock;
        const badgeClass = isOld ? 'badge-old-stock' : 'badge-new-stock';
        const icon = isOld ? '🏺' : '🌱';
        detailStockClass.innerHTML = `
          <span class="badge ${badgeClass}">${icon} ${escapeHtml(stock.category || 'Stock')}</span>
          <span style="font-size:0.83rem; color:var(--text-muted); margin-left:0.35rem;">(${escapeHtml(stock.ageFormatted || '')})</span>
        `;
      }

      detailBeekeeper.textContent = currentBatchData.beekeeperName;
      detailOrigin.textContent = currentBatchData.originLocation;
      detailHive.textContent = currentBatchData.hiveId;
      detailQuantity.textContent = `${Number(currentBatchData.quantityKg).toFixed(1)} kg`;
      detailHarvestDate.textContent = formatDate(currentBatchData.harvestDate);
      detailExtractionDate.textContent = formatDate(currentBatchData.extractionDate);
      detailNotes.textContent = currentBatchData.notes || 'No additional notes provided.';

      // QR Code Setup
      qrImage.src = data.qrCodeDataUrl;
      qrBatchLabel.textContent = `Batch: ${currentBatchData.batchId}`;
      qrLinkInput.value = data.verificationUrl;
      btnDownloadQr.href = data.qrCodeDataUrl;
      btnDownloadQr.download = `HoneyChain-${currentBatchData.batchId}-QR.png`;

      // Timeline Rendering
      renderTimeline(data.history || []);
    } catch (error) {
      console.error('Failed to load batch:', error);
      showToast('Error loading batch: ' + error.message, 'error');
    }
  }

  // Render Blockchain Audit Timeline
  function renderTimeline(history) {
    eventCountBadge.textContent = `${history.length} Event Block${history.length === 1 ? '' : 's'} Anchored`;

    if (!history || history.length === 0) {
      batchTimeline.innerHTML = `
        <div style="color:var(--text-muted); font-size:0.9rem; padding:1rem 0;">
          No blockchain event blocks found for this batch.
        </div>`;
      return;
    }

    batchTimeline.innerHTML = history
      .map((block) => {
        const isRegistration = block.event === 'BATCH_REGISTERED';
        const title = isRegistration ? '🌱 Batch Originated & Anchored' : '🧪 Quality Status Transition';
        const icon = isRegistration ? '🌱' : '🔬';

        return `
          <div class="timeline-item">
            <div class="timeline-marker">${icon}</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <div>
                  <span class="block-index-badge">Block #${block.index}</span>
                  <strong style="margin-left:0.5rem; color:var(--text-primary); font-size:0.95rem;">${title}</strong>
                </div>
                <div class="timeline-time">${formatDateTime(block.timestamp)}</div>
              </div>

              <div style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:0.5rem;">
                ${
                  isRegistration
                    ? `Harvest yield of <strong>${block.data.quantityKg} kg</strong> registered from Hive <strong>${escapeHtml(block.data.hiveId)}</strong> at <strong>${escapeHtml(block.data.originLocation)}</strong>.`
                    : `Quality status updated from <strong>${escapeHtml(block.data.previousStatus)}</strong> to <strong>${escapeHtml(block.data.newStatus)}</strong>. ${block.data.updatedNotes ? `Notes: "${escapeHtml(block.data.updatedNotes)}"` : ''}`
                }
              </div>

              <div style="margin-top:0.6rem;">
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">PREVIOUS BLOCK HASH:</div>
                <div class="hash-snippet" style="background:#382d23; color:#d1c2b5;">${block.previousHash}</div>

                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-top:0.3rem;">BLOCK SHA-256 HASH:</div>
                <div class="hash-snippet">${block.hash}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Copy Verification URL
  btnCopyLink.addEventListener('click', () => {
    copyToClipboard(qrLinkInput.value, 'Public verification link copied!');
  });

  // Print Jar Label
  btnPrintQr.addEventListener('click', () => {
    window.print();
  });

  // Open Status Update Modal
  btnOpenStatusModal.addEventListener('click', () => {
    if (currentBatchData) {
      modalQualitySelect.value = currentBatchData.qualityStatus || 'Pending';
      modalNotesInput.value = '';
    }
    statusModal.classList.add('open');
  });

  // Close Modal
  function closeModal() {
    statusModal.classList.remove('open');
  }
  btnCloseStatusModal.addEventListener('click', closeModal);
  btnCancelStatusModal.addEventListener('click', closeModal);

  // Submit Status Update
  statusUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newStatus = modalQualitySelect.value;
    const notes = modalNotesInput.value.trim();

    try {
      btnSubmitStatusUpdate.disabled = true;
      btnSubmitStatusUpdate.innerHTML = '<span>⏳</span> Appending to Blockchain...';

      await fetchApi(`/api/batches/${encodeURIComponent(batchId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          qualityStatus: newStatus,
          notes,
        }),
      });

      showToast(`Status updated to ${newStatus} and anchored in new block!`, 'success');
      closeModal();
      await loadBatchDetails();
    } catch (error) {
      console.error('Update failed:', error);
      showToast('Failed to update status: ' + error.message, 'error');
    } finally {
      btnSubmitStatusUpdate.disabled = false;
      btnSubmitStatusUpdate.innerHTML = '<span>🔒</span> Append Block & Update';
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  loadBatchDetails();
});
