const crypto = require('crypto');
const Block = require('../models/Block');

/**
 * Deterministically serialize data payload by sorting object keys.
 * This guarantees consistent SHA-256 calculation regardless of key insertion order.
 */
function canonicalDataString(data) {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }
  if (Array.isArray(data)) {
    return JSON.stringify(data.map((item) => canonicalDataString(item)));
  }
  const sortedKeys = Object.keys(data).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = data[key];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Calculate SHA-256 hash from the block's exact contents.
 */
function calculateHash(index, timestamp, batchId, event, data, previousHash) {
  const content = `${index}|${timestamp}|${batchId}|${event}|${canonicalDataString(data)}|${previousHash}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Initialize Genesis block if the blockchain collection is empty.
 * Ensures the ledger starts from a verifiable root.
 */
async function initializeGenesisBlock() {
  const count = await Block.countDocuments();
  if (count > 0) {
    return await Block.findOne({ index: 0 });
  }

  const genesisTimestamp = 1704067200000; // Jan 1, 2024 (fixed epoch for deterministic genesis)
  const genesisBatchId = 'GENESIS';
  const genesisEvent = 'GENESIS';
  const genesisData = {
    system: 'Honey Chain Traceability Ledger',
    version: '1.0.0',
    description: 'Cryptographic genesis block marking the genesis of the honey traceability audit chain',
    rules: 'Tamper-evident, hash-linked immutable event ledger',
  };
  const genesisPreviousHash = '0'.repeat(64);
  const genesisHash = calculateHash(
    0,
    genesisTimestamp,
    genesisBatchId,
    genesisEvent,
    genesisData,
    genesisPreviousHash
  );

  const genesisBlock = new Block({
    index: 0,
    timestamp: genesisTimestamp,
    batchId: genesisBatchId,
    event: genesisEvent,
    data: genesisData,
    previousHash: genesisPreviousHash,
    hash: genesisHash,
  });

  await genesisBlock.save();
  console.log('[Blockchain] Genesis Block successfully initialized with hash:', genesisHash);
  return genesisBlock;
}

/**
 * Retrieve the latest block in the chain.
 */
async function getLatestBlock() {
  let latest = await Block.findOne().sort({ index: -1 });
  if (!latest) {
    latest = await initializeGenesisBlock();
  }
  return latest;
}

/**
 * Add a new block for a honey batch event.
 * Server-side calculation only — frontend cannot supply arbitrary hashes.
 */
async function addBlock(batchId, event, data) {
  const latestBlock = await getLatestBlock();
  const nextIndex = latestBlock.index + 1;
  const timestamp = Date.now();
  const previousHash = latestBlock.hash;

  const hash = calculateHash(
    nextIndex,
    timestamp,
    batchId,
    event,
    data,
    previousHash
  );

  const newBlock = new Block({
    index: nextIndex,
    timestamp,
    batchId,
    event,
    data,
    previousHash,
    hash,
  });

  await newBlock.save();
  console.log(`[Blockchain] Block #${nextIndex} created for Batch ${batchId} [${event}] -> ${hash.substring(0, 16)}...`);
  return newBlock;
}

/**
 * Validate the complete blockchain ledger.
 * Returns clear diagnostic information for viva demonstration.
 */
async function validateChain() {
  const chain = await Block.find().sort({ index: 1 }).lean();

  if (!chain || chain.length === 0) {
    return {
      isValid: false,
      blockCount: 0,
      reason: 'Ledger is completely empty. Genesis block missing.',
      brokenAtBlockIndex: null,
      details: null,
    };
  }

  // 1. Validate Genesis Block
  const genesis = chain[0];
  const expectedGenesisPreviousHash = '0'.repeat(64);
  const recalculatedGenesisHash = calculateHash(
    genesis.index,
    genesis.timestamp,
    genesis.batchId,
    genesis.event,
    genesis.data,
    genesis.previousHash
  );

  if (genesis.index !== 0 || genesis.previousHash !== expectedGenesisPreviousHash) {
    return {
      isValid: false,
      blockCount: chain.length,
      brokenAtBlockIndex: 0,
      batchId: genesis.batchId,
      reason: 'Genesis block structure is invalid or previous hash root has been corrupted',
      details: {
        expectedPreviousHash: expectedGenesisPreviousHash,
        actualPreviousHash: genesis.previousHash,
      },
    };
  }

  if (genesis.hash !== recalculatedGenesisHash) {
    return {
      isValid: false,
      blockCount: chain.length,
      brokenAtBlockIndex: 0,
      batchId: genesis.batchId,
      reason: 'Genesis block content has been modified. SHA-256 hash does not match.',
      details: {
        storedHash: genesis.hash,
        calculatedHash: recalculatedGenesisHash,
      },
    };
  }

  // 2. Validate all consecutive blocks
  for (let i = 1; i < chain.length; i++) {
    const currentBlock = chain[i];
    const prevBlock = chain[i - 1];

    // Check A: Hash linkage to prior block
    if (currentBlock.previousHash !== prevBlock.hash) {
      return {
        isValid: false,
        blockCount: chain.length,
        brokenAtBlockIndex: currentBlock.index,
        batchId: currentBlock.batchId,
        reason: `Cryptographic link broken at Block #${currentBlock.index}: its previousHash does not match Block #${prevBlock.index}'s hash.`,
        details: {
          blockIndex: currentBlock.index,
          expectedPreviousHash: prevBlock.hash,
          actualPreviousHash: currentBlock.previousHash,
        },
      };
    }

    // Check B: Block content hash integrity
    const recalculatedHash = calculateHash(
      currentBlock.index,
      currentBlock.timestamp,
      currentBlock.batchId,
      currentBlock.event,
      currentBlock.data,
      currentBlock.previousHash
    );

    if (currentBlock.hash !== recalculatedHash) {
      return {
        isValid: false,
        blockCount: chain.length,
        brokenAtBlockIndex: currentBlock.index,
        batchId: currentBlock.batchId,
        reason: `Tampering detected at Block #${currentBlock.index}! Block data has been modified without re-computing the SHA-256 hash.`,
        details: {
          blockIndex: currentBlock.index,
          batchId: currentBlock.batchId,
          storedHash: currentBlock.hash,
          calculatedHash: recalculatedHash,
          tamperedFieldHint: currentBlock.isTamperedForDemo
            ? 'This block was altered via the Controlled Tamper Demonstration.'
            : 'Unknown unauthorized alteration.',
        },
      };
    }
  }

  return {
    isValid: true,
    blockCount: chain.length,
    latestIndex: chain[chain.length - 1].index,
    latestHash: chain[chain.length - 1].hash,
    verifiedAt: new Date().toISOString(),
    message: 'All blocks in the chain are cryptographically valid and unbroken.',
  };
}

/**
 * Retrieve the complete chronological history of blocks for a specific batch.
 */
async function getBatchHistory(batchId) {
  const blocks = await Block.find({ batchId }).sort({ index: 1 }).lean();
  return blocks;
}

/**
 * Retrieve all blocks in the blockchain.
 */
async function getAllBlocks() {
  return await Block.find().sort({ index: 1 }).lean();
}

/**
 * CONTROLLED TAMPER DEMONSTRATION:
 * Deliberately modify a block's data without updating its hash.
 * This simulates a malicious actor directly editing the database.
 */
async function tamperBlock(index, field, newValue) {
  const block = await Block.findOne({ index });
  if (!block) {
    throw new Error(`Block #${index} not found`);
  }
  if (block.index === 0) {
    throw new Error('Genesis block cannot be tampered in demo');
  }

  // Backup original data if not already backed up
  const originalBackup = block.originalDataBackup || JSON.parse(JSON.stringify(block.data));

  // Clone data and apply tampering
  const modifiedData = JSON.parse(JSON.stringify(block.data));
  const oldValue = modifiedData[field];
  modifiedData[field] = newValue;

  // Persist directly using updateOne so no Mongoose pre-save hooks alter the hash
  await Block.updateOne(
    { index },
    {
      $set: {
        data: modifiedData,
        isTamperedForDemo: true,
        originalDataBackup: originalBackup,
      },
    }
  );

  return {
    success: true,
    blockIndex: index,
    batchId: block.batchId,
    field,
    oldValue,
    newValue,
    message: `Block #${index} data was altered directly in MongoDB. Its hash was NOT updated. Run verification to witness detection!`,
  };
}

/**
 * RESTORE A TAMPERED BLOCK:
 * Returns the block's data to its pristine, original value.
 */
async function restoreBlock(index) {
  const block = await Block.findOne({ index });
  if (!block) {
    throw new Error(`Block #${index} not found`);
  }

  if (!block.originalDataBackup) {
    return {
      success: false,
      message: `Block #${index} was not marked as tampered or has no backup data.`,
    };
  }

  await Block.updateOne(
    { index },
    {
      $set: {
        data: block.originalDataBackup,
        isTamperedForDemo: false,
        originalDataBackup: null,
      },
    }
  );

  return {
    success: true,
    blockIndex: index,
    batchId: block.batchId,
    message: `Block #${index} restored to authentic state. Chain verification should now pass.`,
  };
}

module.exports = {
  calculateHash,
  initializeGenesisBlock,
  getLatestBlock,
  addBlock,
  validateChain,
  getBatchHistory,
  getAllBlocks,
  tamperBlock,
  restoreBlock,
};
