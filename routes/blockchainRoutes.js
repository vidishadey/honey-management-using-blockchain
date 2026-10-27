const express = require('express');
const {
  getAllBlocks,
  validateChain,
  getBatchHistory,
  tamperBlock,
  restoreBlock,
} = require('../services/blockchain');

const router = express.Router();

/**
 * GET /api/blockchain
 * Return all blocks in the ledger alongside instant validation summary.
 */
router.get('/', async (req, res) => {
  try {
    const blocks = await getAllBlocks();
    const validation = await validateChain();

    return res.json({
      success: true,
      blockCount: blocks.length,
      isValid: validation.isValid,
      validation,
      blocks,
    });
  } catch (error) {
    console.error('[Error: GET /api/blockchain]', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve blockchain: ' + error.message,
    });
  }
});

/**
 * GET /api/blockchain/validate
 * Run full cryptographic integrity validation of the entire blockchain.
 * Recomputes SHA-256 for each block and validates cryptographic parent linkages.
 */
router.get('/validate', async (req, res) => {
  try {
    const validation = await validateChain();
    return res.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('[Error: GET /api/blockchain/validate]', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate blockchain: ' + error.message,
    });
  }
});

/**
 * GET /api/blockchain/history/:batchId
 * Fetch chronological immutable audit log for a given batch.
 */
router.get('/history/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const history = await getBatchHistory(batchId);
    return res.json({
      success: true,
      batchId,
      eventCount: history.length,
      history,
    });
  } catch (error) {
    console.error(`[Error: GET /api/blockchain/history/${req.params.batchId}]`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve batch history: ' + error.message,
    });
  }
});

/**
 * POST /api/blockchain/tamper
 * CONTROLLED VIVA DEMONSTRATION ENDPOINT:
 * Deliberately alters data inside a MongoDB block document WITHOUT recalculating its SHA-256 hash.
 * This proves to examiners that direct database tampering immediately breaks the cryptographic chain!
 */
router.post('/tamper', async (req, res) => {
  try {
    const { blockIndex, field, newValue } = req.body;

    if (blockIndex === undefined || !field) {
      return res.status(400).json({
        success: false,
        error: 'blockIndex and field are required for the tamper demonstration',
      });
    }

    const result = await tamperBlock(Number(blockIndex), field, newValue);
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Error: POST /api/blockchain/tamper]', error);
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/blockchain/restore
 * Restore a tampered block back to its authentic pristine state.
 */
router.post('/restore', async (req, res) => {
  try {
    const { blockIndex } = req.body;

    if (blockIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'blockIndex is required to restore a block',
      });
    }

    const result = await restoreBlock(Number(blockIndex));
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Error: POST /api/blockchain/restore]', error);
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
