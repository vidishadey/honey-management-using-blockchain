/**
 * Honey Chain — Stock Classification Service
 * Dynamically classifies honey batches into "Old Stock" (>10 years) and "New Stock" (<=10 years)
 * based on harvesting date (or production/extraction date if harvest date unavailable).
 */

const MILLISECONDS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const TEN_YEARS_IN_MS = 10 * MILLISECONDS_PER_YEAR;

/**
 * Calculate dynamic age and stock classification for a given batch.
 * @param {Object} batch - The honey batch document or plain object.
 * @param {Date} [now] - Current reference date (defaults to new Date()).
 * @returns {Object} Enriched classification metadata.
 */
function classifyBatchStock(batch, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  if (isNaN(nowDate.getTime())) {
    throw new Error('Invalid reference "now" date provided to stock classifier');
  }

  // Use harvest date, fallback to extraction date, then createdAt
  const rawDate = batch?.harvestDate || batch?.extractionDate || batch?.createdAt;

  if (!rawDate) {
    return {
      category: 'Unclassified',
      isOldStock: false,
      ageYearsDecimal: 0,
      ageYears: 0,
      ageMonths: 0,
      ageFormatted: 'Date unavailable',
      isValidDate: false,
      reason: 'No harvest or extraction date recorded on batch',
    };
  }

  const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (isNaN(dateObj.getTime())) {
    return {
      category: 'Unclassified',
      isOldStock: false,
      ageYearsDecimal: 0,
      ageYears: 0,
      ageMonths: 0,
      ageFormatted: 'Invalid date format',
      isValidDate: false,
      reason: 'The stored date is not a parseable calendar timestamp',
    };
  }

  const diffMs = nowDate.getTime() - dateObj.getTime();

  // If harvest date is in future (e.g. slight clock skew or edge case)
  if (diffMs < 0) {
    return {
      category: 'New Stock',
      isOldStock: false,
      ageYearsDecimal: 0,
      ageYears: 0,
      ageMonths: 0,
      ageFormatted: 'Recently harvested',
      isValidDate: true,
      referenceDate: dateObj.toISOString().split('T')[0],
    };
  }

  // Exact calendar difference calculation
  let years = nowDate.getFullYear() - dateObj.getFullYear();
  let months = nowDate.getMonth() - dateObj.getMonth();
  let days = nowDate.getDate() - dateObj.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const ageYearsDecimal = Number((diffMs / MILLISECONDS_PER_YEAR).toFixed(2));

  // Natural human-readable age string
  let ageFormatted = '';
  if (years >= 1) {
    if (months > 0) {
      ageFormatted = `${years} yr${years > 1 ? 's' : ''}, ${months} mo${months > 1 ? 's' : ''} old`;
    } else {
      ageFormatted = `${years} year${years > 1 ? 's' : ''} old`;
    }
  } else if (months >= 1) {
    ageFormatted = `${months} month${months > 1 ? 's' : ''} old`;
  } else {
    const daysOld = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    ageFormatted = `${daysOld} day${daysOld === 1 ? '' : 's'} old`;
  }

  // Rule:
  // "Old Stock: Honey batches that are more than 10 years old."
  // "New Stock: Honey batches that are 10 years old or less."
  const isOldStock = diffMs > TEN_YEARS_IN_MS;
  const category = isOldStock ? 'Old Stock' : 'New Stock';

  return {
    category,
    isOldStock,
    ageYearsDecimal,
    ageYears: years,
    ageMonths: months,
    ageFormatted,
    isValidDate: true,
    referenceDate: dateObj.toISOString().split('T')[0],
  };
}

/**
 * Partition a list of batches into Old Stock, New Stock, and Unclassified groups.
 * @param {Array} batches - List of batch objects.
 * @param {Date} [now] - Current reference date.
 */
function partitionBatchesByStock(batches = [], now = new Date()) {
  const oldStock = [];
  const newStock = [];
  const unclassified = [];

  for (const b of batches) {
    const plainBatch = typeof b.toObject === 'function' ? b.toObject({ virtuals: true }) : { ...b };
    const stockInfo = classifyBatchStock(plainBatch, now);

    const enrichedBatch = {
      ...plainBatch,
      displayName: plainBatch.displayName || plainBatch.batchName || `${plainBatch.honeyVariety || 'Natural'} Honey Batch`,
      stockClassification: stockInfo,
    };

    if (!stockInfo.isValidDate) {
      unclassified.push(enrichedBatch);
    } else if (stockInfo.isOldStock) {
      oldStock.push(enrichedBatch);
    } else {
      newStock.push(enrichedBatch);
    }
  }

  // Sort batches: Oldest first for Old Stock, Newest first for New Stock
  oldStock.sort((a, b) => new Date(a.harvestDate || a.createdAt) - new Date(b.harvestDate || b.createdAt));
  newStock.sort((a, b) => new Date(b.harvestDate || b.createdAt) - new Date(a.harvestDate || a.createdAt));

  const stats = {
    totalBatches: batches.length,
    oldStockCount: oldStock.length,
    newStockCount: newStock.length,
    unclassifiedCount: unclassified.length,
    oldStockKg: Number(oldStock.reduce((sum, b) => sum + (b.quantityKg || 0), 0).toFixed(1)),
    newStockKg: Number(newStock.reduce((sum, b) => sum + (b.quantityKg || 0), 0).toFixed(1)),
  };

  return {
    oldStock,
    newStock,
    unclassified,
    stats,
  };
}

module.exports = {
  classifyBatchStock,
  partitionBatchesByStock,
  MILLISECONDS_PER_YEAR,
  TEN_YEARS_IN_MS,
};
