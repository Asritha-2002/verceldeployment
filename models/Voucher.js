const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'complimentary'],
        required: true
    },
    value: {
        type: Number,
        required: function() {
            return this.type !== 'complimentary';
        },
        min: 0
    },

    // ✅ ADD THIS FIELD
    description: {
        type: String,
        trim: true,
        default: ""
    },

    maxDiscount: {
        type: Number,
        required: function() {
            return this.type === 'percentage';
        },
        default: null
    },
    maxUses: {
        type: Number,
        default: null
    },
    usedCount: {
        type: Number,
        default: 0
    },
    usedBy: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "User"
}],
    minPurchase: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    complimentaryConfig: {
        quantity: {
            type: Number,
            required: function() {
                return this.type === 'complimentary';
            },
            min: 1
        },
        minPrice: {
            type: Number,
            required: function() {
                return this.type === 'complimentary';
            },
            min: 0
        },
        maxPrice: {
            type: Number,
            required: function() {
                return this.type === 'complimentary';
            }
        }
    }
}, { timestamps: true });

voucherSchema.index({ expiryDate: 1, isActive: 1 });

module.exports = mongoose.model('Voucher', voucherSchema);