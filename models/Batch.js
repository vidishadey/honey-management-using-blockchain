const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    batchName: {
      type: String,
      trim: true,
      default: '',
    },
    honeyVariety: {
      type: String,
      trim: true,
      default: 'Wildflower',
      enum: [
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
      ],
    },
    beekeeperName: {
      type: String,
      required: [true, 'Beekeeper name or ID is required'],
      trim: true,
    },
    originLocation: {
      type: String,
      required: [true, 'Apiary or origin location is required'],
      trim: true,
    },
    hiveId: {
      type: String,
      required: [true, 'Hive ID is required'],
      trim: true,
    },
    harvestDate: {
      type: Date,
      required: [true, 'Harvest date is required'],
    },
    extractionDate: {
      type: Date,
      required: [true, 'Extraction date is required'],
      validate: {
        validator: function (value) {
          // Extraction date must not precede harvest date
          return !this.harvestDate || value >= this.harvestDate;
        },
        message: 'Extraction date cannot be earlier than the harvest date',
      },
    },
    quantityKg: {
      type: Number,
      required: [true, 'Honey quantity in kg is required'],
      min: [0.1, 'Honey quantity must be at least 0.1 kg'],
    },
    qualityStatus: {
      type: String,
      enum: {
        values: ['Pending', 'Passed', 'Failed'],
        message: 'Quality status must be Pending, Passed, or Failed',
      },
      default: 'Pending',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isSampleData: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to ensure batch has a friendly display name
BatchSchema.virtual('displayName').get(function () {
  if (this.batchName && this.batchName.trim()) {
    return this.batchName;
  }
  return `${this.honeyVariety || 'Natural'} Honey Reserve`;
});

// Ensure virtuals are serialized in JSON
BatchSchema.set('toJSON', { virtuals: true });
BatchSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Batch', BatchSchema);
