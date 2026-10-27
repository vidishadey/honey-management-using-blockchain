document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('batchId');

  // DOM Elements
  const batchLookupSection = document.getElementById('batch-lookup-section');
  const manualBatchInput = document.getElementById('manual-batch-input');
  const btnManualLookup = document.getElementById('btn-manual-lookup');

  const verificationLoading = document.getElementById('verification-loading');
  const verificationError = document.getElementById('verification-error');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');

  const certificateDisplay = document.getElementById('certificate-display');
  const certBatchId = document.getElementById('cert-batch-id');
  const certIntegrityBadgeBox = document.getElementById('cert-integrity-badge-box');
  const certIntegrityText = document.getElementById('cert-integrity-text');

  const certBeekeeper = document.getElementById('cert-beekeeper');
  const certOrigin = document.getElementById('cert-origin');
  const certHive = document.getElementById('cert-hive');
  const certQualityStatus = document.getElementById('cert-quality-status');
  const certHarvestDate = document.getElementById('cert-harvest-date');
  const certExtractionDate = document.getElementById('cert-extraction-date');
  const certQuantity = document.getElementById('cert-quantity');
  const certRegisteredDate = document.getElementById('cert-registered-date');
  const certNotes = document.getElementById('cert-notes');
  const certTimeline = document.getElementById('cert-timeline');

  const disclaimerRecordText = document.getElementById('disclaimer-record-text');
  const disclaimerIntegrityText = document.getElementById('disclaimer-integrity-text');
  const disclaimerPurityText = document.getElementById('disclaimer-purity-text');

  // Manual lookup button handler
  if (btnManualLookup) {
    btnManualLookup.addEventListener('click', () => {
      const inputVal = manualBatchInput.value.trim().toUpperCase();
      if (!inputVal) {
        showToast('Please enter a Batch ID', 'error');
        return;
      }
      window.location.href = `verify.html?batchId=${encodeURIComponent(inputVal)}`;
    });

    manualBatchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        btnManualLookup.click();
      }
    });
  }

  // Load public batch data
  async function loadPublicVerification(id) {
    try {
      verificationLoading.style.display = 'block';
      certificateDisplay.style.display = 'none';
      verificationError.style.display = 'none';
      batchLookupSection.style.display = 'none';

      const data = await fetchApi(`/api/public/verify/${encodeURIComponent(id)}`);
      renderCertificate(data);
    } catch (error) {
      console.error('Public verification error:', error);
      verificationLoading.style.display = 'none';
      verificationError.style.display = 'block';
      errorTitle.textContent = 'Verification Failed';
      errorMessage.textContent = error.message;
    }
  }

  // Render Certificate Data
  function renderCertificate(data) {
    const { batch, history, blockchainVerification, educationalDisclaimer } = data;

    certBatchId.textContent = batch.batchId;
    certBeekeeper.textContent = batch.beekeeperName;
    certOrigin.textContent = batch.originLocation;
    certHive.textContent = batch.hiveId;
    certQualityStatus.innerHTML = renderStatusBadge(batch.qualityStatus);
    certHarvestDate.textContent = formatDate(batch.harvestDate);
    certExtractionDate.textContent = formatDate(batch.extractionDate);
    certQuantity.textContent = `${Number(batch.quantityKg).toFixed(1)} kg Yield`;
    certRegisteredDate.textContent = formatDate(batch.registeredAt);
    certNotes.textContent = batch.notes || 'No additional notes provided.';

    // Cryptographic Integrity Badge
    if (blockchainVerification.chainIsValid) {
      certIntegrityBadgeBox.className = 'alert alert-success';
      certIntegrityText.innerHTML = `
        <span style="font-size:1.1rem; margin-right:0.35rem;">✔</span>
        CRYPTOGRAPHIC INTEGRITY VERIFIED: All ${blockchainVerification.totalBlocksInChain} ledger blocks pass SHA-256 verification.
      `;
    } else {
      certIntegrityBadgeBox.className = 'alert alert-danger';
      certIntegrityText.innerHTML = `
        <span style="font-size:1.1rem; margin-right:0.35rem;">⚠</span>
        INTEGRITY ALERT: A hash discrepancy was detected on the blockchain ledger! ${escapeHtml(blockchainVerification.details)}
      `;
    }

    // Three viva disclaimer pillars
    disclaimerRecordText.textContent = educationalDisclaimer.recordedDataNote;
    disclaimerIntegrityText.textContent = educationalDisclaimer.cryptographicIntegrityNote;
    disclaimerPurityText.innerHTML = escapeHtml(educationalDisclaimer.purityLimitationNote).replace(
      'IMPORTANT ACADEMIC DISTINCTION:',
      '<strong>IMPORTANT ACADEMIC DISTINCTION:</strong>'
    );

    // Audit Timeline
    renderTimeline(history || []);

    verificationLoading.style.display = 'none';
    certificateDisplay.style.display = 'block';
  }

  function renderTimeline(history) {
    if (!history || history.length === 0) {
      certTimeline.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem;">No blockchain events recorded.</div>`;
      return;
    }

    certTimeline.innerHTML = history
      .map((block) => {
        const isRegistration = block.event === 'BATCH_REGISTERED';
        const title = isRegistration ? 'Honey Harvest & Registration' : 'Quality Testing Update';
        const icon = isRegistration ? '🍯' : '🔬';

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
                    ? `Harvest yield of <strong>${block.data.quantityKg} kg</strong> officially registered from Hive <strong>${escapeHtml(block.data.hiveId)}</strong> at <strong>${escapeHtml(block.data.originLocation)}</strong>.`
                    : `Quality status updated from <strong>${escapeHtml(block.data.previousStatus)}</strong> to <strong>${escapeHtml(block.data.newStatus)}</strong>.`
                }
              </div>

              <div style="margin-top:0.5rem;">
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">DIGITAL SHA-256 SIGNATURE:</div>
                <div class="hash-snippet">${block.hash}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
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

  // Initial Routing
  if (batchId) {
    loadPublicVerification(batchId);
  } else {
    verificationLoading.style.display = 'none';
    batchLookupSection.style.display = 'block';
  }
});
