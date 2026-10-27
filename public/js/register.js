document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('batch-registration-form');
  const harvestDateInput = document.getElementById('harvestDate');
  const extractionDateInput = document.getElementById('extractionDate');
  const errorAlert = document.getElementById('form-error-alert');
  const errorText = document.getElementById('form-error-text');
  const submitBtn = document.getElementById('submit-btn');

  const successModal = document.getElementById('success-modal');
  const modalBatchId = document.getElementById('modal-batch-id');
  const modalBlockIndex = document.getElementById('modal-block-index');
  const modalBlockHash = document.getElementById('modal-block-hash');
  const modalBtnView = document.getElementById('modal-btn-view');
  const modalBtnAnother = document.getElementById('modal-btn-another');

  // Set default dates to today
  const today = new Date().toISOString().split('T')[0];
  harvestDateInput.value = today;
  harvestDateInput.max = today;
  extractionDateInput.value = today;
  extractionDateInput.min = harvestDateInput.value;

  // Keep extraction min date synchronized with harvest date
  harvestDateInput.addEventListener('change', () => {
    extractionDateInput.min = harvestDateInput.value;
    if (extractionDateInput.value && extractionDateInput.value < harvestDateInput.value) {
      extractionDateInput.value = harvestDateInput.value;
    }
  });

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const beekeeperName = document.getElementById('beekeeperName').value.trim();
    const originLocation = document.getElementById('originLocation').value.trim();
    const hiveId = document.getElementById('hiveId').value.trim();
    const harvestDate = harvestDateInput.value;
    const extractionDate = extractionDateInput.value;
    const quantityKg = parseFloat(document.getElementById('quantityKg').value);
    const qualityStatus = document.getElementById('qualityStatus').value;
    const notes = document.getElementById('notes').value.trim();

    // Client-side validations
    const errors = [];
    if (!beekeeperName) errors.push('Beekeeper name is required.');
    if (!originLocation) errors.push('Origin location is required.');
    if (!hiveId) errors.push('Hive identifier is required.');
    if (!harvestDate) errors.push('Harvest date is required.');
    if (!extractionDate) errors.push('Extraction date is required.');
    if (harvestDate && harvestDate > today) errors.push('Harvest date cannot be in the future.');
    if (harvestDate && extractionDate && extractionDate < harvestDate) {
      errors.push('Extraction date cannot be earlier than harvest date.');
    }
    if (isNaN(quantityKg) || quantityKg <= 0) {
      errors.push('Quantity must be a positive number greater than 0 kg.');
    }

    if (errors.length > 0) {
      showError(errors.join('<br>'));
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳</span> Hashing & Anchoring on Blockchain...';

      const payload = {
        beekeeperName,
        originLocation,
        hiveId,
        harvestDate,
        extractionDate,
        quantityKg,
        qualityStatus,
        notes,
      };

      const result = await fetchApi('/api/batches', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showToast('Batch registered & anchored to blockchain!', 'success');

      // Populate and display success modal
      modalBatchId.textContent = result.batch.batchId;
      modalBlockIndex.textContent = `Block #${result.blockchain.blockIndex}`;
      modalBlockHash.textContent = result.blockchain.blockHash;
      modalBtnView.href = `batch-details.html?batchId=${encodeURIComponent(result.batch.batchId)}`;

      successModal.classList.add('open');
    } catch (error) {
      console.error('Registration failed:', error);
      showError(error.message);
      showToast('Failed to register batch', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🔒</span> Save & Anchor on Blockchain';
    }
  });

  // Modal actions
  modalBtnAnother.addEventListener('click', () => {
    successModal.classList.remove('open');
    form.reset();
    harvestDateInput.value = today;
    extractionDateInput.value = today;
  });

  function showError(msg) {
    errorText.innerHTML = msg;
    errorAlert.style.display = 'flex';
  }

  function hideError() {
    errorAlert.style.display = 'none';
    errorText.innerHTML = '';
  }
});
