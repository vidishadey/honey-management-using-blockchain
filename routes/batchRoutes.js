const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');
const Batch = require('../models/Batch');
const { addBlock, getBatchHistory } = require('../services/blockchain');
const { classifyBatchStock, partitionBatchesByStock } = require('../services/stockService');
const { seedSampleBatches } = require('../services/sampleBatches');

const router = express.Router();

/**
 * Helper to generate a standardized, human-readable batch ID.
 * Example: HC-2026-7B9F
 */
function generateBatchId() {
  const currentYear = new Date().getFullYear();
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `HC-${currentYear}-${randomSuffix}`;
}

/**
 * GET /api/batches/stock
 * Returns all batches partitioned into "Old Stock" (>10 years) and "New Stock" (<=10 years)
 * with dynamic age calculation, aggregate weight, and category counts.
 */
router.get('/stock', async (req, res) => {
  try {
    const batches = await Batch.find().sort({ harvestDate: -1 }).lean();
    const stockData = partitionBatchesByStock(batches);

    return res.json({
      success: true,
      ...stockData,
    });
  } catch (error) {
    console.error('[Error: GET /api/batches/stock]', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve honey stock categories: ' + error.message,
    });
  }
});

/**
 * POST /api/batches/seed-samples
 * Seeds 12 realistic demonstration batches (spanning 2012-2026) if not already present.
 */
router.post('/seed-samples', async (req, res) => {
  try {
    const seededCount = await seedSampleBatches();
    const totalBatches = await Batch.countDocuments();
    return res.json({
      success: true,
      message: `Sample seeding complete. ${seededCount} new demonstration batches anchored.`,
      seededCount,
      totalBatches,
    });
  } catch (error) {
    console.error('[Error: POST /api/batches/seed-samples]', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to seed sample batches: ' + error.message,
    });
  }
});

/**
 * GET /api/batches
 * Beekeeper dashboard endpoint: list all batches with overall aggregate statistics
 * and dynamic stock classifications.
 */
router.get('/', async (req, res) => {
  try {
    const rawBatches = await Batch.find().sort({ createdAt: -1 }).lean();

    // Augment batches with dynamic stock age classification
    const batches = rawBatches.map((b) => {
      const stockInfo = classifyBatchStock(b);
      return {
        ...b,
        displayName: b.batchName || `${b.honeyVariety || 'Natural'} Honey Reserve`,
        stockClassification: stockInfo,
      };
    });

    const oldStockCount = batches.filter((b) => b.stockClassification?.isOldStock).length;
    const newStockCount = batches.filter((b) => b.stockClassification?.isValidDate && !b.stockClassification?.isOldStock).length;

    // Compute summary metrics for the dashboard cards
    const stats = {
      totalBatches: batches.length,
      totalQuantityKg: Number(
        batches.reduce((sum, b) => sum + (b.quantityKg || 0), 0).toFixed(2)
      ),
      oldStockCount,
      newStockCount,
      statusCounts: {
        Pending: batches.filter((b) => b.qualityStatus === 'Pending').length,
        Passed: batches.filter((b) => b.qualityStatus === 'Passed').length,
        Failed: batches.filter((b) => b.qualityStatus === 'Failed').length,
      },
    };

    return res.json({
      success: true,
      stats,
      batches,
    });
  } catch (error) {
    console.error('[Error: GET /api/batches]', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve batches: ' + error.message,
    });
  }
});

/**
 * POST /api/batches
 * Register a new honey batch, validate fields, persist to MongoDB,
 * and create an immutable BATCH_REGISTERED block on the blockchain ledger.
 */
router.post('/', async (req, res) => {
  try {
    const {
      batchName = '',
      honeyVariety = 'Wildflower',
      beekeeperName,
      originLocation,
      hiveId,
      harvestDate,
      extractionDate,
      quantityKg,
      qualityStatus = 'Pending',
      notes = '',
      isSampleData = false,
    } = req.body;

    // Strict Server-side Validation
    const validationErrors = [];

    if (!beekeeperName || !beekeeperName.trim()) {
      validationErrors.push('Beekeeper name or ID is required.');
    }
    if (!originLocation || !originLocation.trim()) {
      validationErrors.push('Apiary or origin location is required.');
    }
    if (!hiveId || !hiveId.trim()) {
      validationErrors.push('Hive ID is required.');
    }
    if (!harvestDate) {
      validationErrors.push('Harvest date is required.');
    }
    if (!extractionDate) {
      validationErrors.push('Extraction date is required.');
    }

    const parsedHarvestDate = new Date(harvestDate);
    const parsedExtractionDate = new Date(extractionDate);
    const now = new Date();

    if (isNaN(parsedHarvestDate.getTime())) {
      validationErrors.push('Harvest date is not a valid date.');
    } else if (parsedHarvestDate > now) {
      validationErrors.push('Harvest date cannot be in the future.');
    }

    if (isNaN(parsedExtractionDate.getTime())) {
      validationErrors.push('Extraction date is not a valid date.');
    } else if (parsedExtractionDate < parsedHarvestDate) {
      validationErrors.push('Extraction date cannot precede the harvest date.');
    }

    const parsedQuantity = parseFloat(quantityKg);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      validationErrors.push('Honey quantity must be a positive number greater than 0 kg.');
    }

    const validStatuses = ['Pending', 'Passed', 'Failed'];
    if (!validStatuses.includes(qualityStatus)) {
      validationErrors.push('Quality status must be Pending, Passed, or Failed.');
    }

    const validVarieties = [
      'Wildflower',
      'Multiflora',
      'Eucalyptus',
      'Acacia',
      'Forest Honey',
      'Clover',
      'Lavender',
      'Orange Blossom',
      'Manuka',
      'Sidr',
      'Other',
    ];
    if (honeyVariety && !validVarieties.includes(honeyVariety)) {
      validationErrors.push(`Honey variety must be one of: ${validVarieties.join(', ')}`);
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    // Generate unique batch ID
    let batchId = generateBatchId();
    while (await Batch.findOne({ batchId })) {
      batchId = generateBatchId();
    }

    const finalBatchName = batchName && batchName.trim()
      ? batchName.trim()
      : `${honeyVariety} Honey Batch`;

    // 1. Persist batch in MongoDB
    const newBatch = new Batch({
      batchId,
      batchName: finalBatchName,
      honeyVariety: honeyVariety || 'Wildflower',
      beekeeperName: beekeeperName.trim(),
      originLocation: originLocation.trim(),
      hiveId: hiveId.trim(),
      harvestDate: parsedHarvestDate,
      extractionDate: parsedExtractionDate,
      quantityKg: parsedQuantity,
      qualityStatus,
      notes: notes.trim(),
      isSampleData: Boolean(isSampleData),
    });

    await newBatch.save();

    // 2. Cryptographically link event to Blockchain Ledger
    const blockData = {
      action: 'Initial honey harvest and batch registration',
      batchName: newBatch.batchName,
      honeyVariety: newBatch.honeyVariety,
      beekeeperName: newBatch.beekeeperName,
      originLocation: newBatch.originLocation,
      hiveId: newBatch.hiveId,
      harvestDate: newBatch.harvestDate.toISOString().split('T')[0],
      extractionDate: newBatch.extractionDate.toISOString().split('T')[0],
      quantityKg: newBatch.quantityKg,
      qualityStatus: newBatch.qualityStatus,
      notes: newBatch.notes,
    };

    const block = await addBlock(batchId, 'BATCH_REGISTERED', blockData);

    const stockInfo = classifyBatchStock(newBatch);

    return res.status(201).json({
      success: true,
      message: `Honey batch ${batchId} (${newBatch.batchName}) registered and anchored on blockchain ledger.`,
      batch: {
        ...newBatch.toObject({ virtuals: true }),
        stockClassification: stockInfo,
      },
      blockchain: {
        blockIndex: block.index,
        blockHash: block.hash,
        previousHash: block.previousHash,
      },
    });
  } catch (error) {
    console.error('[Error: POST /api/batches]', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create honey batch: ' + error.message,
    });
  }
});

/**
 * GET /api/batches/:batchId
 * Retrieve individual batch details, its QR code data URL, stock classification,
 * and its blockchain event history.
 */
router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const rawBatch = await Batch.findOne({ batchId }).lean();

    if (!rawBatch) {
      return res.status(404).json({
        success: false,
        error: `Batch ${batchId} not found`,
      });
    }

    const stockClassification = classifyBatchStock(rawBatch);
    const batch = {
      ...rawBatch,
      displayName: rawBatch.batchName || `${rawBatch.honeyVariety || 'Natural'} Honey Reserve`,
      stockClassification,
    };

    // Generate QR code for the public consumer verification page
    const baseUrl = process.env.APP_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
    const verificationUrl = `${baseUrl}/verify.html?batchId=${batchId}`;

    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#261c14', // Honey theme dark charcoal
        light: '#ffffff',
      },
    });

    // Fetch chronological blockchain audit history for this batch
    const history = await getBatchHistory(batchId);

    return res.json({
      success: true,
      batch,
      verificationUrl,
      qrCodeDataUrl,
      history,
    });
  } catch (error) {
    console.error(`[Error: GET /api/batches/${req.params.batchId}]`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve batch: ' + error.message,
    });
  }
});

/**
 * PATCH /api/batches/:batchId/status
 * Update testing status (e.g. from 'Pending' to 'Passed' or 'Failed').
 * Appends a new immutable QUALITY_STATUS_UPDATED block to the blockchain ledger.
 */
router.patch('/:batchId/status', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { qualityStatus, notes } = req.body;

    const validStatuses = ['Pending', 'Passed', 'Failed'];
    if (!qualityStatus || !validStatuses.includes(qualityStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quality status. Must be Pending, Passed, or Failed.',
      });
    }

    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: `Batch ${batchId} not found`,
      });
    }

    const oldStatus = batch.qualityStatus;
    batch.qualityStatus = qualityStatus;
    if (notes !== undefined) {
      batch.notes = notes.trim();
    }
    await batch.save();

    // Record the status transition onto the blockchain
    const blockData = {
      action: 'Quality Testing Status Updated',
      previousStatus: oldStatus,
      newStatus: qualityStatus,
      updatedNotes: batch.notes,
      updatedAt: new Date().toISOString(),
    };

    const block = await addBlock(batchId, 'QUALITY_STATUS_UPDATED', blockData);

    const stockClassification = classifyBatchStock(batch);

    return res.json({
      success: true,
      message: `Batch ${batchId} status updated to ${qualityStatus} and recorded on blockchain.`,
      batch: {
        ...batch.toObject({ virtuals: true }),
        stockClassification,
      },
      blockchain: {
        blockIndex: block.index,
        blockHash: block.hash,
        previousHash: block.previousHash,
      },
    });
  } catch (error) {
    console.error(`[Error: PATCH /api/batches/${req.params.batchId}/status]`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update quality status: ' + error.message,
    });
  }
});

/**
 * POST /api/batches/:batchId/event
 * Record a lifecycle event (e.g. packaging, sealing, or distribution).
 */
router.post('/:batchId/event', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { eventType, details } = req.body;

    const validEventTypes = ['PROCESSING_RECORDED', 'DISTRIBUTION_DISPATCHED'];
    if (!eventType || !validEventTypes.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event type. Must be PROCESSING_RECORDED or DISTRIBUTION_DISPATCHED.',
      });
    }

    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: `Batch ${batchId} not found`,
      });
    }

    const block = await addBlock(batchId, eventType, {
      eventType,
      details: details || {},
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: `Event ${eventType} recorded on blockchain ledger for batch ${batchId}.`,
      block,
    });
  } catch (error) {
    console.error(`[Error: POST /api/batches/${req.params.batchId}/event]`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record event: ' + error.message,
    });
  }
});

module.exports = router;
