document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chainIntegrityCard = document.getElementById('chain-integrity-card');
  const integrityIcon = document.getElementById('integrity-icon');
  const integrityStatusText = document.getElementById('integrity-status-text');
  const integrityDetailText = document.getElementById('integrity-detail-text');
  const integrityBadgeContainer = document.getElementById('integrity-badge-container');
  const chainTotalBlocks = document.getElementById('chain-total-blocks');
  const chainLastVerified = document.getElementById('chain-last-verified');

  const blockListContainer = document.getElementById('block-list-container');
  const btnReverifyChain = document.getElementById('btn-reverify-chain');

  // Tamper Studio Elements
  const tamperBlockSelect = document.getElementById('tamper-block-select');
  const tamperFieldSelect = document.getElementById('tamper-field-select');
  const tamperValueInput = document.getElementById('tamper-value-input');
  const btnApplyTamper = document.getElementById('btn-apply-tamper');
  const btnRestoreTamper = document.getElementById('btn-restore-tamper');

  let currentBlocks = [];
  let currentValidation = null;

  // Load Blockchain Data
  async function loadBlockchainData(notify = false) {
    try {
      const data = await fetchApi('/api/blockchain');
      currentBlocks = data.blocks || [];
      currentValidation = data.validation || {};

      // 1. Update Integrity Dashboard
      updateIntegrityDisplay(currentValidation, currentBlocks.length);

      // 2. Populate Tamper Dropdown
      populateTamperSelect(currentBlocks);

      // 3. Render Block Explorer
      renderBlocks(currentBlocks, currentValidation);

      if (notify) {
        if (currentValidation.isValid) {
          showToast('Verification complete: Entire chain is 100% cryptographically valid!', 'success');
        } else {
          showToast(`Tampering detected at Block #${currentValidation.brokenAtBlockIndex}!`, 'error');
        }
      }
    } catch (error) {
      console.error('Failed to load blockchain:', error);
      showToast('Error loading blockchain: ' + error.message, 'error');
    }
  }

  // Update top integrity card
  function updateIntegrityDisplay(validation, totalBlocks) {
    chainTotalBlocks.textContent = totalBlocks;
    chainLastVerified.textContent = formatDateTime(validation.verifiedAt || Date.now());

    if (validation.isValid) {
      chainIntegrityCard.style.borderColor = '#10b981';
      chainIntegrityCard.style.backgroundColor = '#ecfdf5';
      integrityIcon.textContent = '🟢';
      integrityStatusText.textContent = 'Cryptographic Ledger: 100% Intact & Valid';
      integrityStatusText.style.color = '#065f46';
      integrityDetailText.textContent = `All ${totalBlocks} blocks pass SHA-256 integrity checks and maintain unbroken parent linkages.`;
      integrityBadgeContainer.innerHTML = `<span class="badge badge-verified" style="font-size:0.95rem; padding:0.4rem 0.8rem;">✔ VERIFIED SECURE</span>`;
    } else {
      chainIntegrityCard.style.borderColor = '#ef4444';
      chainIntegrityCard.style.backgroundColor = '#fef2f2';
      integrityIcon.textContent = '🔴';
      integrityStatusText.textContent = `SECURITY ALERT: Tampering Detected at Block #${validation.brokenAtBlockIndex}!`;
      integrityStatusText.style.color = '#991b1b';
      integrityDetailText.textContent = validation.reason || 'Cryptographic signature mismatch identified.';
      integrityBadgeContainer.innerHTML = `<span class="badge badge-alert" style="font-size:0.95rem; padding:0.4rem 0.8rem;">⚠ INTEGRITY COMPROMISED</span>`;
    }
  }

  // Populate Tamper Select Options
  function populateTamperSelect(blocks) {
    const nonGenesisBlocks = blocks.filter((b) => b.index > 0);
    if (nonGenesisBlocks.length === 0) {
      tamperBlockSelect.innerHTML = `<option value="">No batch blocks yet (register a batch first)</option>`;
      btnApplyTamper.disabled = true;
      btnRestoreTamper.disabled = true;
      return;
    }

    btnApplyTamper.disabled = false;
    btnRestoreTamper.disabled = false;

    tamperBlockSelect.innerHTML = nonGenesisBlocks
      .map((b) => {
        const tamperedTag = b.isTamperedForDemo ? ' [CURRENTLY TAMPERED]' : '';
        return `<option value="${b.index}">Block #${b.index} — Batch ${b.batchId} (${b.event})${tamperedTag}</option>`;
      })
      .join('');
  }

  // Render Visual Blocks
  function renderBlocks(blocks, validation) {
    if (!blocks || blocks.length === 0) {
      blockListContainer.innerHTML = `<div class="card" style="text-align:center;">No blocks available.</div>`;
      return;
    }

    const brokenIndex = validation.isValid ? null : validation.brokenAtBlockIndex;

    let html = '';
    blocks.forEach((block, idx) => {
      const isGenesis = block.index === 0;
      const isBroken = brokenIndex !== null && block.index >= brokenIndex;
      const isSpecificTampered = block.index === brokenIndex || block.isTamperedForDemo;

      html += `
        <div class="block-card ${isSpecificTampered ? 'tampered' : ''}">
          <div class="block-card-header">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span class="block-index-badge">${isGenesis ? 'ROOT #0' : `BLOCK #${block.index}`}</span>
              <strong style="font-size:1.05rem;">${block.event}</strong>
              <span style="font-size:0.85rem; color:var(--text-muted);">Batch ID: <code>${block.batchId}</code></span>
            </div>
            <div>
              ${
                isSpecificTampered
                  ? '<span class="badge badge-alert">⚠ HASH MISMATCH / TAMPERED</span>'
                  : '<span class="badge badge-verified">✔ INTACT</span>'
              }
            </div>
          </div>

          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">
            Timestamp: ${formatDateTime(block.timestamp)} (${block.timestamp})
          </div>

          <!-- Hashes Section -->
          <div style="display:grid; grid-template-columns:1fr; gap:0.5rem; margin-bottom:0.75rem;">
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">PREVIOUS BLOCK HASH (PARENT LINK):</div>
              <div class="hash-snippet" style="background:#2b2118; color:${isGenesis ? '#9ca3af' : '#60a5fa'};">
                ${block.previousHash}
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">BLOCK SHA-256 HASH (STORED):</div>
              <div class="hash-snippet" style="background:#1f1610; color:${isSpecificTampered ? '#f87171' : '#34d399'};">
                ${block.hash}
              </div>
            </div>
          </div>

          <!-- Payload Snapshot -->
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-bottom:0.25rem;">
              BLOCK PAYLOAD SNAPSHOT:
            </div>
            <pre style="background:#f9f6f0; border:1px solid var(--border-light); border-radius:4px; padding:0.6rem; font-size:0.8rem; overflow-x:auto; font-family:var(--font-mono); color:#2b2118;">${escapeHtml(JSON.stringify(block.data, null, 2))}</pre>
          </div>
        </div>
      `;

      // Connector Arrow between blocks
      if (idx < blocks.length - 1) {
        html += `
          <div class="block-connector" style="color:${isBroken ? '#ef4444' : 'var(--primary-gold)'};">
            ↓ 🔗 SHA-256 Linked
          </div>
        `;
      }
    });

    blockListContainer.innerHTML = html;
  }

  // Event: Re-verify Chain
  btnReverifyChain.addEventListener('click', async () => {
    btnReverifyChain.disabled = true;
    btnReverifyChain.innerHTML = '<span>⏳</span> Verifying...';
    await loadBlockchainData(true);
    btnReverifyChain.disabled = false;
    btnReverifyChain.innerHTML = '<span>🔄</span> Re-Verify Full Chain';
  });

  // Event: Apply Tampering
  btnApplyTamper.addEventListener('click', async () => {
    const blockIndex = tamperBlockSelect.value;
    const field = tamperFieldSelect.value;
    let newValue = tamperValueInput.value.trim();

    if (!blockIndex) {
      showToast('Please select a target block to tamper', 'error');
      return;
    }

    if (field === 'quantityKg') {
      newValue = parseFloat(newValue) || 999.9;
    }

    try {
      btnApplyTamper.disabled = true;
      btnApplyTamper.innerHTML = '<span>⏳</span> Tampering DB...';

      const res = await fetchApi('/api/blockchain/tamper', {
        method: 'POST',
        body: JSON.stringify({
          blockIndex: Number(blockIndex),
          field,
          newValue,
        }),
      });

      showToast(res.result.message, 'error');
      await loadBlockchainData(false);
    } catch (error) {
      showToast('Tamper failed: ' + error.message, 'error');
    } finally {
      btnApplyTamper.disabled = false;
      btnApplyTamper.innerHTML = '<span>⚠</span> Simulate Malicious Tamper';
    }
  });

  // Event: Restore Tampering
  btnRestoreTamper.addEventListener('click', async () => {
    const blockIndex = tamperBlockSelect.value;
    if (!blockIndex) {
      showToast('Please select a block to restore', 'error');
      return;
    }

    try {
      btnRestoreTamper.disabled = true;
      btnRestoreTamper.innerHTML = '<span>⏳</span> Restoring...';

      const res = await fetchApi('/api/blockchain/restore', {
        method: 'POST',
        body: JSON.stringify({
          blockIndex: Number(blockIndex),
        }),
      });

      showToast(res.result.message, 'success');
      await loadBlockchainData(false);
    } catch (error) {
      showToast('Restore failed: ' + error.message, 'error');
    } finally {
      btnRestoreTamper.disabled = false;
      btnRestoreTamper.innerHTML = '<span>🔄</span> Restore Original Block';
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

  loadBlockchainData();
});
