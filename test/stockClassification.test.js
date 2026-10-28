const assert = require('assert');
const {
  classifyBatchStock,
  partitionBatchesByStock,
  TEN_YEARS_IN_MS,
  MILLISECONDS_PER_YEAR,
} = require('../services/stockService');

console.log('====================================================');
console.log('   HONEY CHAIN — STOCK CLASSIFICATION UNIT TESTS    ');
console.log('====================================================\n');

try {
  // Use a fixed reference "now" date for testing deterministic boundaries
  const testNow = new Date('2026-10-28T12:00:00Z');

  // TEST 1: Boundary Test - Exactly 10.5 years old (> 10 years -> Old Stock)
  console.log('[Test 1] 10.5 years old batch classification...');
  const dateOld = new Date(testNow.getTime() - (10.5 * MILLISECONDS_PER_YEAR));
  const resOld = classifyBatchStock({ harvestDate: dateOld }, testNow);
  assert.strictEqual(resOld.category, 'Old Stock', 'Should be Old Stock');
  assert.strictEqual(resOld.isOldStock, true, 'isOldStock should be true');
  assert.strictEqual(resOld.isValidDate, true);
  console.log(`  ✔ Correctly classified as Old Stock (${resOld.ageFormatted})`);

  // TEST 2: Boundary Test - 9.5 years old (<= 10 years -> New Stock)
  console.log('\n[Test 2] 9.5 years old batch classification...');
  const dateNew = new Date(testNow.getTime() - (9.5 * MILLISECONDS_PER_YEAR));
  const resNew = classifyBatchStock({ harvestDate: dateNew }, testNow);
  assert.strictEqual(resNew.category, 'New Stock', 'Should be New Stock');
  assert.strictEqual(resNew.isOldStock, false, 'isOldStock should be false');
  assert.strictEqual(resNew.isValidDate, true);
  console.log(`  ✔ Correctly classified as New Stock (${resNew.ageFormatted})`);

  // TEST 3: Edge Boundary - 10 years + 1 day (> 10 years -> Old Stock)
  console.log('\n[Test 3] Edge boundary: 10 years + 1 day...');
  const dateTenYearsPlusDay = new Date(testNow.getTime() - (TEN_YEARS_IN_MS + (24 * 60 * 60 * 1000)));
  const resEdgeOld = classifyBatchStock({ harvestDate: dateTenYearsPlusDay }, testNow);
  assert.strictEqual(resEdgeOld.category, 'Old Stock', '10 yrs + 1 day must be Old Stock');
  assert.strictEqual(resEdgeOld.isOldStock, true);
  console.log(`  ✔ Correctly classified as Old Stock (${resEdgeOld.ageYearsDecimal} years)`);

  // TEST 4: Edge Boundary - 10 years - 1 day (<= 10 years -> New Stock)
  console.log('\n[Test 4] Edge boundary: 10 years - 1 day...');
  const dateTenYearsMinusDay = new Date(testNow.getTime() - (TEN_YEARS_IN_MS - (24 * 60 * 60 * 1000)));
  const resEdgeNew = classifyBatchStock({ harvestDate: dateTenYearsMinusDay }, testNow);
  assert.strictEqual(resEdgeNew.category, 'New Stock', '10 yrs - 1 day must be New Stock');
  assert.strictEqual(resEdgeNew.isOldStock, false);
  console.log(`  ✔ Correctly classified as New Stock (${resEdgeNew.ageYearsDecimal} years)`);

  // TEST 5: Fallback to extractionDate when harvestDate is absent
  console.log('\n[Test 5] Fallback to extractionDate...');
  const resFallback = classifyBatchStock({
    harvestDate: null,
    extractionDate: new Date('2014-05-10T00:00:00Z'),
  }, testNow);
  assert.strictEqual(resFallback.category, 'Old Stock');
  assert.strictEqual(resFallback.isValidDate, true);
  console.log(`  ✔ Successfully fell back to extractionDate (${resFallback.ageFormatted})`);

  // TEST 6: Graceful handling of invalid or missing dates
  console.log('\n[Test 6] Handling missing or corrupt dates gracefully...');
  const resMissing = classifyBatchStock({ harvestDate: null, extractionDate: null }, testNow);
  assert.strictEqual(resMissing.category, 'Unclassified');
  assert.strictEqual(resMissing.isValidDate, false);
  assert.strictEqual(resMissing.isOldStock, false);

  const resInvalid = classifyBatchStock({ harvestDate: 'not-a-real-date' }, testNow);
  assert.strictEqual(resInvalid.category, 'Unclassified');
  assert.strictEqual(resInvalid.isValidDate, false);
  console.log('  ✔ Handled missing and corrupt dates without throwing errors or misclassifying');

  // TEST 7: Partitioning batch list into columns
  console.log('\n[Test 7] Partitioning array into two columns (Old Stock vs New Stock)...');
  const mockBatches = [
    { batchId: 'HC-001', harvestDate: new Date('2012-01-01'), quantityKg: 50 }, // Old
    { batchId: 'HC-002', harvestDate: new Date('2015-06-01'), quantityKg: 40 }, // Old
    { batchId: 'HC-003', harvestDate: new Date('2020-01-01'), quantityKg: 30 }, // New
    { batchId: 'HC-004', harvestDate: new Date('2026-01-01'), quantityKg: 20 }, // New
    { batchId: 'HC-005', harvestDate: 'invalid-date', quantityKg: 10 },          // Unclassified
  ];

  const partitioned = partitionBatchesByStock(mockBatches, testNow);
  assert.strictEqual(partitioned.oldStock.length, 2, 'Should have 2 Old Stock batches');
  assert.strictEqual(partitioned.newStock.length, 2, 'Should have 2 New Stock batches');
  assert.strictEqual(partitioned.unclassified.length, 1, 'Should have 1 Unclassified batch');
  assert.strictEqual(partitioned.stats.oldStockKg, 90.0, 'Old stock kg sum');
  assert.strictEqual(partitioned.stats.newStockKg, 50.0, 'New stock kg sum');
  console.log('  ✔ Partitioning successful: 2 Old Stock (90 kg), 2 New Stock (50 kg), 1 Unclassified');

  console.log('\n====================================================');
  console.log('   ALL 7 STOCK CLASSIFICATION TESTS PASSED!         ');
  console.log('====================================================\n');
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
