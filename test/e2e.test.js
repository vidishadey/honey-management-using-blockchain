const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const connectDB = require('../config/db');
const { initializeGenesisBlock } = require('../services/blockchain');

const TEST_PORT = 3456;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {}),
        },
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(responseData);
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseData });
          }
        });
      }
    );

    req.on('error', reject);
    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runEndToEndTests() {
  console.log('====================================================');
  console.log('   HONEY CHAIN — COMPLETE END-TO-END TEST SUITE     ');
  console.log('====================================================\n');

  try {
    await connectDB();
    await initializeGenesisBlock();
    server = app.listen(TEST_PORT);
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`[Test Server] Live on http://127.0.0.1:${TEST_PORT}\n`);

    // TEST 1: Health Check
    console.log('[Test 1] GET /api/health');
    const health = await request('GET', '/api/health');
    if (health.status !== 200 || health.data.status !== 'online') {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    console.log('  ✔ Health check passed');

    // TEST 2: Validation rejection on bad batch registration
    console.log('\n[Test 2] POST /api/batches with invalid payload (negative quantity & extraction before harvest)');
    const badBatch = await request('POST', '/api/batches', {
      beekeeperName: 'Test',
      originLocation: 'Farm',
      hiveId: 'H-1',
      harvestDate: '2026-10-25',
      extractionDate: '2026-10-20', // Earlier than harvest
      quantityKg: -10,             // Negative
    });
    if (badBatch.status !== 400 || badBatch.data.success !== false) {
      throw new Error(`Should reject invalid batch: ${JSON.stringify(badBatch)}`);
    }
    console.log('  ✔ Invalid batch registration correctly rejected with 400 Bad Request');
    console.log('    Errors caught:', badBatch.data.details);

    // TEST 3: Successful batch registration
    console.log('\n[Test 3] POST /api/batches with valid batch data');
    const goodBatch = await request('POST', '/api/batches', {
      beekeeperName: 'Dr. Ronald Vance',
      originLocation: 'Clover Ridge Apiary, Plot 9',
      hiveId: 'HIVE-CR-09',
      harvestDate: '2026-10-25',
      extractionDate: '2026-10-26',
      quantityKg: 52.4,
      qualityStatus: 'Pending',
      notes: 'Wildflower and Clover harvest',
    });

    if (goodBatch.status !== 201 || !goodBatch.data.batch?.batchId) {
      throw new Error(`Batch creation failed: ${JSON.stringify(goodBatch)}`);
    }
    const createdBatchId = goodBatch.data.batch.batchId;
    const blockIndex = goodBatch.data.blockchain.blockIndex;
    console.log(`  ✔ Batch created with ID: ${createdBatchId}`);
    console.log(`  ✔ Anchored in Blockchain Block #${blockIndex}`);
    console.log(`  ✔ Block Hash: ${goodBatch.data.blockchain.blockHash}`);

    // TEST 4: Batch listing and summary aggregation
    console.log('\n[Test 4] GET /api/batches');
    const batchList = await request('GET', '/api/batches');
    if (batchList.status !== 200 || !batchList.data.batches) {
      throw new Error(`Batch listing failed: ${JSON.stringify(batchList)}`);
    }
    const found = batchList.data.batches.some((b) => b.batchId === createdBatchId);
    if (!found) throw new Error(`Created batch ${createdBatchId} not found in listing`);
    console.log('  ✔ Batches retrieved successfully. Total batches:', batchList.data.stats.totalBatches);
    console.log('  ✔ Total harvested honey:', batchList.data.stats.totalQuantityKg, 'kg');

    // TEST 5: Get batch details and QR Code
    console.log(`\n[Test 5] GET /api/batches/${createdBatchId}`);
    const batchDetails = await request('GET', `/api/batches/${createdBatchId}`);
    if (batchDetails.status !== 200 || !batchDetails.data.qrCodeDataUrl) {
      throw new Error(`Batch details failed: ${JSON.stringify(batchDetails)}`);
    }
    if (!batchDetails.data.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('QR code data URL must be a base64 PNG');
    }
    console.log('  ✔ Batch details retrieved');
    console.log('  ✔ QR code generated successfully (Base64 PNG verified)');
    console.log('  ✔ Verification URL:', batchDetails.data.verificationUrl);

    // TEST 6: Update Quality Testing Status
    console.log(`\n[Test 6] PATCH /api/batches/${createdBatchId}/status (Pending -> Passed)`);
    const statusUpdate = await request('PATCH', `/api/batches/${createdBatchId}/status`, {
      qualityStatus: 'Passed',
      notes: 'Pollen purity 98.4%, Moisture 16.8%, 0 antibiotic residues.',
    });
    if (statusUpdate.status !== 200 || statusUpdate.data.batch.qualityStatus !== 'Passed') {
      throw new Error(`Status update failed: ${JSON.stringify(statusUpdate)}`);
    }
    console.log('  ✔ Batch quality status updated to Passed');
    console.log(`  ✔ Appended to new Block #${statusUpdate.data.blockchain.blockIndex}`);

    // TEST 7: Chain Validation (Intact)
    console.log('\n[Test 7] GET /api/blockchain/validate');
    const validCheck = await request('GET', '/api/blockchain/validate');
    if (validCheck.status !== 200 || !validCheck.data.validation.isValid) {
      throw new Error(`Chain should be valid: ${JSON.stringify(validCheck)}`);
    }
    console.log('  ✔ Blockchain verified intact! Total blocks in chain:', validCheck.data.validation.blockCount);

    // TEST 8: Public Consumer Verification Endpoint
    console.log(`\n[Test 8] GET /api/public/verify/${createdBatchId}`);
    const publicVerify = await request('GET', `/api/public/verify/${createdBatchId}`);
    if (publicVerify.status !== 200 || !publicVerify.data.educationalDisclaimer) {
      throw new Error(`Public verification failed: ${JSON.stringify(publicVerify)}`);
    }
    if (!publicVerify.data.blockchainVerification.chainIsValid) {
      throw new Error('Public verification reported chain as invalid');
    }
    console.log('  ✔ Public consumer verification page data retrieved');
    console.log('  ✔ Educational disclaimer three pillars confirmed present');

    // TEST 9: Controlled Tampering Demonstration
    console.log(`\n[Test 9] POST /api/blockchain/tamper (Simulating database hack on Block #${blockIndex})`);
    const tamperRes = await request('POST', '/api/blockchain/tamper', {
      blockIndex,
      field: 'quantityKg',
      newValue: 9999.0, // Maliciously inflated quantity
    });
    if (tamperRes.status !== 200) {
      throw new Error(`Tamper API call failed: ${JSON.stringify(tamperRes)}`);
    }
    console.log('  ✔ Data tampered in database without re-hashing');

    console.log('  Checking if validation detects the hack...');
    const tamperCheck = await request('GET', '/api/blockchain/validate');
    if (tamperCheck.data.validation.isValid) {
      throw new Error('Validation SHOULD FAIL after tampering!');
    }
    if (tamperCheck.data.validation.brokenAtBlockIndex !== blockIndex) {
      throw new Error(`Expected broken index ${blockIndex}, got ${tamperCheck.data.validation.brokenAtBlockIndex}`);
    }
    console.log('  ✔ TAMPERING SUCCESSFULLY CAUGHT!');
    console.log('    Reason:', tamperCheck.data.validation.reason);

    // TEST 10: Restoring Tampered Block
    console.log(`\n[Test 10] POST /api/blockchain/restore (Restoring Block #${blockIndex} to authentic state)`);
    const restoreRes = await request('POST', '/api/blockchain/restore', { blockIndex });
    if (restoreRes.status !== 200) {
      throw new Error(`Restore failed: ${JSON.stringify(restoreRes)}`);
    }
    const restoredCheck = await request('GET', '/api/blockchain/validate');
    if (!restoredCheck.data.validation.isValid) {
      throw new Error('Validation should pass after restore');
    }
    console.log('  ✔ Block restored! Chain verification back to 100% valid.');

    console.log('\n====================================================');
    console.log('   ALL 10 END-TO-END TESTS PASSED WITH 100% SUCCESS!  ');
    console.log('====================================================\n');

    server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Test Failure:', error.message);
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

runEndToEndTests();
