const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      enum: [
        'GENESIS',
        'BATCH_REGISTERED',
        'QUALITY_STATUS_UPDATED',
        'PROCESSING_RECORDED',
        'DISTRIBUTION_DISPATCHED',
      ],
      default: 'BATCH_REGISTERED',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    previousHash: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
    // Supporting fields for the controlled viva tamper demonstration
    isTamperedForDemo: {
      type: Boolean,
      default: false,
    },
    originalDataBackup: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Block', BlockSchema);
