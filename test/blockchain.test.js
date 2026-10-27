const mongoose = require('mongoose');
const Block = require('../models/Block');
const {
  initializeGenesisBlock,
  addBlock,
  validateChain,
  tamperBlock,
  restoreBlock,
} = require('../services/blockchain');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/honeychain_test';

async function runBlockchainTests() {
  console.log('====================================================');
  console.log('   HONEY CHAIN — BLOCKCHAIN SERVICE AUTOMATED TESTS  ');
  console.log('====================================================\n');

  try {
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test Setup] Connected to test database:', TEST_DB_URI);

    // Clean up test database collection
    await Block.deleteMany({});
    console.log('[Test Setup] Purged old test blocks from collection.\n');

    // TEST 1: Genesis Block Creation
    console.log('[Test 1] Initializing Genesis block...');
    const genesis = await initializeGenesisBlock();
    if (genesis.index !== 0) throw new Error('Genesis index must be 0');
    if (genesis.previousHash !== '0'.repeat(64)) throw new Error('Genesis previousHash must be 64 zeros');
    console.log('  ✔ Genesis block created with hash:', genesis.hash.substring(0, 20) + '...');

    // TEST 2: Validate initial chain
    console.log('\n[Test 2] Validating single-block Genesis chain...');
    const validation1 = await validateChain();
    if (!validation1.isValid) throw new Error(`Chain should be valid: ${validation1.reason}`);
    console.log('  ✔ Validation passed. Block count:', validation1.blockCount);

    // TEST 3: Add sequential event blocks
    console.log('\n[Test 3] Adding sequential event blocks...');
    const block1 = await addBlock('HC-2026-T001', 'BATCH_REGISTERED', {
      beekeeperName: 'Sarah Jenkins',
      originLocation: 'Pine Valley Apiary',
      quantityKg: 45.5,
      qualityStatus: 'Pending',
    });
    if (block1.previousHash !== genesis.hash) {
      throw new Error('Block #1 previousHash must equal Genesis hash');
    }
    console.log('  ✔ Block #1 added. Hash:', block1.hash.substring(0, 20) + '...');

    const block2 = await addBlock('HC-2026-T001', 'QUALITY_STATUS_UPDATED', {
      beekeeperName: 'Sarah Jenkins',
      qualityStatus: 'Passed',
      notes: 'Passed laboratory moisture and pollen analysis',
    });
    if (block2.previousHash !== block1.hash) {
      throw new Error('Block #2 previousHash must equal Block #1 hash');
    }
    console.log('  ✔ Block #2 added. Hash:', block2.hash.substring(0, 20) + '...');

    // TEST 4: Validate intact multi-block chain
    console.log('\n[Test 4] Validating 3-block chain...');
    const validation2 = await validateChain();
    if (!validation2.isValid) throw new Error(`Chain should be valid: ${validation2.reason}`);
    console.log('  ✔ Validation passed. Block count:', validation2.blockCount);

    // TEST 5: Tamper detection simulation
    console.log('\n[Test 5] Simulating malicious tampering on Block #1 (changing quantityKg 45.5 -> 500.0)...');
    await tamperBlock(1, 'quantityKg', 500.0);
    const validation3 = await validateChain();
    if (validation3.isValid) {
      throw new Error('Tampered chain MUST NOT pass validation!');
    }
    if (validation3.brokenAtBlockIndex !== 1) {
      throw new Error(`Tampering detected at wrong index: expected 1, got ${validation3.brokenAtBlockIndex}`);
    }
    console.log('  ✔ Tampering successfully detected!');
    console.log('    Reason reported:', validation3.reason);
    console.log('    Stored hash:    ', validation3.details.storedHash.substring(0, 24) + '...');
    console.log('    Recalculated:   ', validation3.details.calculatedHash.substring(0, 24) + '...');

    // TEST 6: Restore block to authentic state
    console.log('\n[Test 6] Restoring Block #1 to authentic state...');
    await restoreBlock(1);
    const validation4 = await validateChain();
    if (!validation4.isValid) {
      throw new Error(`Chain should be valid after restore: ${validation4.reason}`);
    }
    console.log('  ✔ Block restored! Chain verification passed once again.');

    console.log('\n====================================================');
    console.log('   ALL 6 BLOCKCHAIN TESTS PASSED SUCCESSFULLY!       ');
    console.log('====================================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test Failure:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

runBlockchainTests();
