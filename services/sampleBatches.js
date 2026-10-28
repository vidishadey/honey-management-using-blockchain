const Batch = require('../models/Batch');
const { addBlock } = require('./blockchain');

/**
 * 12 Realistic Demonstration Honey Batches
 * Spans harvest years 2012 through 2026 to populate both Old Stock (>10 yrs) and New Stock (<=10 yrs).
 * Explicitly flagged as sample/demo data for academic evaluation.
 */
const SAMPLE_BATCHES = [
  // --- OLD STOCK (Harvested > 10 years ago relative to 2026) ---
  {
    batchId: 'HC-2012-A101',
    batchName: 'Vintage Bramblewood Multiflora',
    honeyVariety: 'Multiflora',
    beekeeperName: 'Arthur Pendelton (BKP-009)',
    originLocation: 'Bramblewood Highlands, Plot 3',
    hiveId: 'HIVE-BW-01',
    harvestDate: new Date('2012-06-14T08:00:00Z'),
    extractionDate: new Date('2012-06-16T14:00:00Z'),
    quantityKg: 42.0,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Aged mountain multiflora blend; deep golden amber with natural crystalline sugars.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2013-E202',
    batchName: 'Blue Ridge Aged Eucalyptus Reserve',
    honeyVariety: 'Eucalyptus',
    beekeeperName: 'Elena Rostova (BKP-014)',
    originLocation: 'Blue Ridge Eucalyptus Grove, Sector B',
    hiveId: 'HIVE-EU-08',
    harvestDate: new Date('2013-09-20T09:30:00Z'),
    extractionDate: new Date('2013-09-22T11:00:00Z'),
    quantityKg: 38.5,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Bold herbal profile with signature menthol bouquet; lab certified 15.8% moisture.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2014-F303',
    batchName: 'Blackwood Deep Forest Honeydew',
    honeyVariety: 'Forest Honey',
    beekeeperName: 'Marcus Sterling (BKP-022)',
    originLocation: 'Blackwood Forest Apiary, Ridge 12',
    hiveId: 'HIVE-FOR-03',
    harvestDate: new Date('2014-08-05T07:15:00Z'),
    extractionDate: new Date('2014-08-07T16:00:00Z'),
    quantityKg: 55.0,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Rich dark forest honeydew; elevated mineral density and complex woody aroma.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2015-A404',
    batchName: 'Sun Valley Old Reserve Acacia',
    honeyVariety: 'Acacia',
    beekeeperName: 'Sophia Lindqvist (BKP-031)',
    originLocation: 'Sun Valley Acacia Orchards, Lot 5',
    hiveId: 'HIVE-AC-19',
    harvestDate: new Date('2015-05-18T10:00:00Z'),
    extractionDate: new Date('2015-05-20T12:00:00Z'),
    quantityKg: 48.2,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Translucent pale straw color; high natural fructose prevents crystallization.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2016-W505',
    batchName: 'High-Alpine Spring Wildflower',
    honeyVariety: 'Wildflower',
    beekeeperName: 'David K. Thorne (BKP-018)',
    originLocation: 'Alpine Meadow Research Station 2',
    hiveId: 'HIVE-ALP-07',
    harvestDate: new Date('2016-04-12T08:30:00Z'),
    extractionDate: new Date('2016-04-14T15:00:00Z'),
    quantityKg: 33.0,
    qualityStatus: 'Pending',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Subalpine meadow nectar blend; pending secondary botanical pollen verification.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2016-C606',
    batchName: 'Green Pastures Valley White Clover',
    honeyVariety: 'Clover',
    beekeeperName: 'Miriam Chen (BKP-027)',
    originLocation: 'Green Pastures Clover Ranch',
    hiveId: 'HIVE-CLV-14',
    harvestDate: new Date('2016-08-28T09:00:00Z'),
    extractionDate: new Date('2016-08-30T13:30:00Z'),
    quantityKg: 50.5,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Traditional white clover harvest; velvety creamed consistency and mild floral sweetness.',
    isSampleData: true,
  },

  // --- NEW STOCK (Harvested <= 10 years ago relative to 2026) ---
  {
    batchId: 'HC-2018-L707',
    batchName: 'Plateau Lavender Blossom Reserve',
    honeyVariety: 'Lavender',
    beekeeperName: 'Antoine Dubois (BKP-045)',
    originLocation: 'Plateau de Sault Lavender Fields',
    hiveId: 'HIVE-LAV-02',
    harvestDate: new Date('2018-07-10T11:00:00Z'),
    extractionDate: new Date('2018-07-12T14:00:00Z'),
    quantityKg: 29.0,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Highly aromatic lavender mono-floral honey; faint floral tartness with bright finish.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2021-O808',
    batchName: 'Valencia Sun Citrus Orange Blossom',
    honeyVariety: 'Orange Blossom',
    beekeeperName: 'Carmen Morales (BKP-053)',
    originLocation: 'Valencia Sun Citrus Groves, Sector 4',
    hiveId: 'HIVE-CIT-11',
    harvestDate: new Date('2021-04-22T08:00:00Z'),
    extractionDate: new Date('2021-04-24T10:00:00Z'),
    quantityKg: 62.0,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Fresh citrus blossoms yield bright golden liquid with distinct orange zest notes.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2023-F909',
    batchName: 'Misty Glen Mountain Forest Honey',
    honeyVariety: 'Forest Honey',
    beekeeperName: "Liam O'Connor (BKP-061)",
    originLocation: 'Misty Glen Forest Range, Plot 8',
    hiveId: 'HIVE-MG-05',
    harvestDate: new Date('2023-09-02T09:00:00Z'),
    extractionDate: new Date('2023-09-04T12:00:00Z'),
    quantityKg: 44.8,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Late summer mountain harvest; notes of pine sap, heather blossom, and dark toffee.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2024-M010',
    batchName: 'East Cape Coastal Manuka Active',
    honeyVariety: 'Manuka',
    beekeeperName: 'Kahu Te Punga (BKP-077)',
    originLocation: 'East Cape Coastal Native Terraces',
    hiveId: 'HIVE-MNK-33',
    harvestDate: new Date('2024-02-15T10:30:00Z'),
    extractionDate: new Date('2024-02-18T16:00:00Z'),
    quantityKg: 25.5,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Certified active Manuka with MGO 263+ rating; dense, viscous, and mineral-rich.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2025-E011',
    batchName: 'Pine Valley Golden Eucalyptus',
    honeyVariety: 'Eucalyptus',
    beekeeperName: 'Dr. Ronald Vance (BKP-042)',
    originLocation: 'Pine Valley Apiary, Plot 2',
    hiveId: 'HIVE-PV-16',
    harvestDate: new Date('2025-10-10T08:00:00Z'),
    extractionDate: new Date('2025-10-12T11:00:00Z'),
    quantityKg: 58.0,
    qualityStatus: 'Passed',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Clean golden eucalyptus; crisp refreshing character and 16.4% optimal moisture content.',
    isSampleData: true,
  },
  {
    batchId: 'HC-2026-W012',
    batchName: 'Wildflower Valley Spring Multiflora',
    honeyVariety: 'Multiflora',
    beekeeperName: 'Sarah Jenkins (BKP-088)',
    originLocation: 'Wildflower Valley Apiaries, Field 7',
    hiveId: 'HIVE-WF-04',
    harvestDate: new Date('2026-05-04T07:30:00Z'),
    extractionDate: new Date('2026-05-06T13:00:00Z'),
    quantityKg: 47.2,
    qualityStatus: 'Pending',
    notes: '[SAMPLE/DEMO DATA - Fictional Educational Record] Fresh spring harvest; delicate clover, dandelion, and apple blossom blend.',
    isSampleData: true,
  },
];

/**
 * Seed the demonstration batches into MongoDB if not already present,
 * and anchor each batch on the blockchain ledger so cryptographic verification stays 100% intact.
 */
async function seedSampleBatches() {
  let seededCount = 0;

  for (const sample of SAMPLE_BATCHES) {
    const existing = await Batch.findOne({ batchId: sample.batchId });
    if (!existing) {
      const newBatch = new Batch(sample);
      await newBatch.save();

      // Anchor onto blockchain ledger
      await addBlock(sample.batchId, 'BATCH_REGISTERED', {
        action: 'Initial sample batch registration for academic demonstration',
        batchName: sample.batchName,
        honeyVariety: sample.honeyVariety,
        beekeeperName: sample.beekeeperName,
        originLocation: sample.originLocation,
        hiveId: sample.hiveId,
        harvestDate: sample.harvestDate.toISOString().split('T')[0],
        extractionDate: sample.extractionDate.toISOString().split('T')[0],
        quantityKg: sample.quantityKg,
        qualityStatus: sample.qualityStatus,
        isSampleData: true,
        notes: sample.notes,
      });

      seededCount++;
    }
  }

  if (seededCount > 0) {
    console.log(`[Database Seeder] Successfully seeded ${seededCount} demonstration honey batches anchored to the blockchain!`);
  }

  return seededCount;
}

module.exports = {
  SAMPLE_BATCHES,
  seedSampleBatches,
};
