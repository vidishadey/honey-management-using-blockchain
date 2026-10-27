const express = require('express');
const Batch = require('../models/Batch');
const { validateChain, getBatchHistory } = require('../services/blockchain');

const router = express.Router();

/**
 * GET /api/public/verify/:batchId
 * Public consumer endpoint for scanning the QR code on a honey jar.
 * Returns public-safe batch metadata, complete cryptographic audit log,
 * and live blockchain integrity status with vital educational distinction.
 */
router.get('/verify/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ batchId }).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: `Honey Batch "${batchId}" was not found in the official registry.`,
      });
    }

    // 1. Fetch chronological audit log recorded on the blockchain
    const history = await getBatchHistory(batchId);

    // 2. Perform live cryptographic verification of the complete chain
    const chainValidation = await validateChain();

    // 3. Prepare public-safe data payload (no internal credentials)
    const publicData = {
      batchId: batch.batchId,
      beekeeperName: batch.beekeeperName,
      originLocation: batch.originLocation,
      hiveId: batch.hiveId,
      harvestDate: batch.harvestDate.toISOString().split('T')[0],
      extractionDate: batch.extractionDate.toISOString().split('T')[0],
      quantityKg: batch.quantityKg,
      qualityStatus: batch.qualityStatus,
      registeredAt: batch.createdAt,
      notes: batch.notes || 'None provided.',
    };

    // 4. Return clear structured response highlighting the 3 viva dimensions
    return res.json({
      success: true,
      batch: publicData,
      history,
      blockchainVerification: {
        chainIsValid: chainValidation.isValid,
        totalBlocksInChain: chainValidation.blockCount,
        verifiedAt: new Date().toISOString(),
        details: chainValidation.isValid
          ? 'Every block and parent hash link in the audit ledger matches its SHA-256 cryptographic signature.'
          : chainValidation.reason,
      },
      educationalDisclaimer: {
        recordedDataNote:
          'The origin, harvest, and test data above reflect the parameters officially recorded by the registered beekeeper.',
        cryptographicIntegrityNote: chainValidation.isValid
          ? 'INTEGRITY VERIFIED: Cryptographic hash checks confirm that this historical record has remained completely untampered since registration.'
          : 'INTEGRITY ALERT: A hash discrepancy was detected in the ledger. The historical record may have been altered.',
        purityLimitationNote:
          'IMPORTANT ACADEMIC DISTINCTION: Cryptographic blockchain verification guarantees that historical ledger records have not been altered or tampered with. However, a digital ledger cannot independently prove physical honey purity or lack of adulteration in the physical world without accredited physical laboratory testing and tamper-evident container seals (the "Oracle Problem").',
      },
    });
  } catch (error) {
    console.error(`[Error: GET /api/public/verify/${req.params.batchId}]`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process public verification: ' + error.message,
    });
  }
});

module.exports = router;
