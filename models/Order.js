// const mongoose = require('mongoose');

// // Import Book model for statistics updates
// const Book = require('./Book');

// // Define tracking status update schema
// const trackingUpdateSchema = new mongoose.Schema({
//   status: {
//     type: String,
//     enum: ['order_placed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'],
//     required: true
//   },
//   location: String,
//   description: String,
//   timestamp: { 
//     type: Date, 
//     default: Date.now 
//   }
// });

// const shippingPartnerSchema = new mongoose.Schema({
//   name: { 
//     type: String, 
//     required: false
//   },
//   trackingId: { 
//     type: String, 
//     required: false
//   },
//   estimatedDelivery: Date,
//   currentLocation: String,
//   serviceType: {
//     type: String,
//     enum: ['standard', 'express', 'priority'],
//     default: 'standard'
//   },
//   trackingUpdates: [trackingUpdateSchema]
// });



// const orderSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   items: [{
//     book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
//     quantity: { type: Number, required: true },
//     price: { type: Number, required: true },
//     name: { type: String, required: true },
//     skuId: { type: String, required: true },
//     originalPrice: { type: Number, required: true },
//     imageUrl: { type: String } 
//   }],

//   shipping: {
//     address: {
//       street: { type: String, required: true },
//       city: { type: String, required: true },
//       state: { type: String, required: true },
//       zipCode: { type: String, required: true },
//       country: { type: String, required: true },
//       contactNumber: { type: String, required: true },
//       specialInstructions: String
//     },
//     method: { type: String, required: true },
//     cost: { type: Number, required: true },
//     deliveryPartner: shippingPartnerSchema
//   },
//   appliedVoucher: {
//     voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
//     code: String,
//     discountType: { type: String, enum: ['percentage', 'fixed','complimentary'], default: 'percentage' },
//     discount: { type: Number, default: 0 },
//     complimentaryItems: [{
//       book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
//       name: String,
//       price: Number,
//       quantity: Number
//     }]
//   },
//   charges: {
//     subtotal: { type: Number, required: true },
//     gst: { type: Number, required: true },
//     paymentCharge: { type: Number, required: true }, // Changed from serviceCharge
//     deliveryCharge: { type: Number, required: true },
//     totalAmount: { type: Number, required: true }
//   },
//   totalAmount: { type: Number, required: true },
//   status: { 
//     type: String, 
//     enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
//     default: 'pending' 
//   },
//   payment: {
//     razorpayOrderId: String,
//     razorpayPaymentId: String,
//     razorpaySignature: String,
//     status: {
//       type: String,
//       enum: ['pending', 'completed', 'failed'],
//       default: 'pending'
//     },

//     notes: String,
//     method: {
//       type: String,
//       enum: ['cod', 'razorpay'],
//       default: 'razorpay'
//     },
//     updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     updatedAt: { type: Date, default: Date.now },
//     paidAmount: Number,
//     paidAt: Date
//   },
  
//   // Cancellation details
//   cancellationDetails: {
//     reason: {
//       type: String,
//       enum: ['customer-request', 'out-of-stock', 'payment-issue', 'fraud-suspected', 'shipping-issue',  'quality-issue', 'other'],
//       required: function() { return this.status === 'cancelled'; }
//     },
//     notes: String,
//     refundMethod: {
//       type: String,
//       enum: ['original-payment-method', 'bank-transfer', 'wallet', 'cash', 'store-credit', 'no-refund'],
      
//     },
//     cancelledAt: {
//       type: Date,
//       default: function() { return this.status === 'cancelled' ? Date.now() : undefined; }
//     },
//     cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
//   },
  
//   // Refund details
//   refundDetails: {
//     reason: {
//       type: String,
//       enum: ['customer-request', 'defective-product', 'wrong-item', 'not-as-described', 'damaged-in-transit', 'change-of-mind', 'other'],
//       required: function() { return this.status === 'refund-completed'; }
//     },
//     notes: String,
//     refundMethod: {
//       type: String,
//       enum: ['original-payment-method', 'bank-transfer', 'wallet', 'cash', 'store-credit'],
//       required: function() { return this.status === 'refund-completed'; }
//     },
//     refundAmount: {
//       type: Number,
//       required: function() { return this.status === 'refund-completed'; }
//     },
//     referenceId: {
//       type: String,
//       required: function() { return this.status === 'refund-completed'; }
//     },
//     processedAt: {
//       type: Date,
//       default: function() { return this.status === 'refund-completed' ? Date.now() : undefined; }
//     },
//     processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
//   },
  
//   orderDetails: {
//     source: {
//       type: String,
//       enum: ['web', 'mobile', 'in-store'],
//       default: 'web'
//     },
//     notes: String,
//     giftWrap: {
//       required: { type: Boolean, default: false },
//       message: String
//     },
//     invoice: {
//       number: String,
//       generatedAt: Date,
//       url: String
//     }
//   },
//   orderMetrics: {
//     processingTime: { type: Number },
//     deliveryTime: { type: Number },
//     totalValue: { type: Number, required: false },
//     itemCount: { type: Number, required: false }
//   },
//   analytics: {
//     deviceType: String,
//     platform: String,
//     referrer: String
//   }
// }, { timestamps: true });

// // Add indexes for better querying
// orderSchema.index({ user: 1, createdAt: -1 });
// orderSchema.index({ 'shipping.deliveryPartner.trackingId': 1 });
// orderSchema.index({ user: 1, 'appliedVoucher.code': 1, 'payment.status': 1 });
// orderSchema.index({ 'payment.razorpayOrderId': 1 }, { unique: true, sparse: true });
// orderSchema.index({ status: 1, createdAt: -1 });
// orderSchema.index({ 'payment.status': 1, createdAt: -1 });
// orderSchema.index({ status: 1, 'payment.status': 1 });
// orderSchema.index({ 'cancellationDetails.cancelledAt': 1 });
// orderSchema.index({ 'refundDetails.completedAt': 1 });
// orderSchema.index({ 'cancellationDetails.reason': 1 });
// orderSchema.index({ 'refundDetails.method': 1 });

// // Add method to update tracking info
// orderSchema.methods.addTrackingUpdate = async function(updateData) {
//   if (!this.shipping.deliveryPartner) {
//     this.shipping.deliveryPartner = updateData;
//   } else {
//     if (updateData.status) {
//       this.shipping.deliveryPartner.trackingUpdates.push({
//         status: updateData.status,
//         location: updateData.location,
//         description: updateData.description
//       });
//     }
//     // Update other tracking fields if provided
//     ['name', 'trackingId', 'estimatedDelivery', 'currentLocation', 'serviceType'].forEach(field => {
//       if (updateData[field]) {
//         this.shipping.deliveryPartner[field] = updateData[field];
//       }
//     });
//   }
//   return this.save();
// };

// // Add method to cancel order
// orderSchema.methods.cancelOrder = async function(cancellationData) {
//   this.status = 'cancelled';
//   this.cancellationDetails = {
//     reason: cancellationData.reason,
//     notes: cancellationData.notes,
//     refundMethod: cancellationData.refundMethod,
//     cancelledAt: new Date(),
//     cancelledBy: cancellationData.cancelledBy || 'admin'
//   };
//   return this.save();
// };

// // Add method to complete refund
// orderSchema.methods.completeRefund = async function(refundData) {
//   this.status = 'refund-completed';
//   this.refundDetails = {
//     reason: refundData.reason,
//     notes: refundData.notes,
//     refundMethod: refundData.refundMethod,
//     refundAmount: refundData.refundAmount,
//     referenceId: refundData.referenceId,
//     processedAt: new Date(),
//     processedBy: refundData.processedBy || 'admin'
//   };
//   return this.save();
// };

// // Get cancellation status
// orderSchema.virtual('isCancelled').get(function() {
//   return this.status === 'cancelled';
// });

// // Get refund status
// orderSchema.virtual('isRefundCompleted').get(function() {
//   return this.status === 'refund-completed';
// });

// // Check if order can be cancelled
// orderSchema.methods.canBeCancelled = function() {
//   return ['pending', 'processing'].includes(this.status) && this.payment.status !== 'completed';
// };

// // Check if order can be refunded
// orderSchema.methods.canBeRefunded = function() {
//   return ['delivered', 'cancelled'].includes(this.status) && this.payment.status === 'completed';
// };

// // Get Latest tracking status
// orderSchema.virtual('currentTrackingStatus').get(function() {
//   if (!this.shipping?.deliveryPartner?.trackingUpdates?.length) return null;
//   return this.shipping.deliveryPartner.trackingUpdates[
//     this.shipping.deliveryPartner.trackingUpdates.length - 1
//   ];
// });

// // Add order stats methods
// orderSchema.statics.getOrderStats = async function(dateRange) {
//   return this.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: dateRange.start, $lte: dateRange.end },
//         'payment.status': 'completed'
//       }
//     },
//     {
//       $group: {
//         _id: null,
//         totalOrders: { $sum: 1 },
//         totalRevenue: { $sum: '$totalAmount' },
//         averageOrderValue: { $avg: '$totalAmount' }
//       }
//     }
//   ]);
// };

// orderSchema.statics.getTopSellingItems = async function(limit = 10) {
//   return this.aggregate([
//     { $unwind: '$items' },
//     {
//       $group: {
//         _id: '$items.book',
//         totalQuantity: { $sum: '$items.quantity' },
//         totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
//       }
//     },
//     { $sort: { totalQuantity: -1 } },
//     { $limit: limit }
//   ]);
// };

// // Add a static method to get paginated orders
// orderSchema.statics.getPaginatedOrders = async function(query = {}, page = 1, limit = 10) {
//   try {
//     const skip = (page - 1) * limit;
//     const orders = await this.find(query)
//       .populate('user', 'name email')
//       .populate('items.book', 'title price')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     const total = await this.countDocuments(query);
//     const totalPages = Math.ceil(total / limit);

//     return {
//       orders,
//       totalPages,
//       currentPage: page,
//       total
//     };
//   } catch (error) {
//     console.error('Error in getPaginatedOrders:', error);
//     throw error;
//   }
// };

// // Add pre-save hook to handle payment status
// orderSchema.pre('save', function(next) {
//   // If razorpayPaymentId exists and status hasn't been set to completed
//   if (this.payment?.razorpayPaymentId && this.payment.status !== 'completed') {
//     this.payment.status = 'completed';
//     this.payment.paidAt = new Date();
//   }
//   next();
// });

// // Modify post-save hook to update statistics
// orderSchema.post('save', async function(doc) {
//   try {
//     // Update statistics only when payment is completed
//     if (doc.payment?.status === 'completed') {
//       // Update book purchase statistics
//       const updatePromises = doc.items.map(item => 
//         Book.findByIdAndUpdate(item.book, {
//           $inc: {
//             'statistics.purchases': item.quantity,
//             'statistics.totalRevenue': item.price * item.quantity
//           }
//         }, { new: true })
//       );
//       await Promise.all(updatePromises);
//     }
//   } catch (err) {
//     console.error('Error updating statistics:', err);
//   }
// });

// // Add method to update tracking info
// orderSchema.methods.addTrackingUpdate = async function(updateData) {
//   if (!this.shipping.deliveryPartner) {
//     this.shipping.deliveryPartner = updateData;
//   } else {
//     if (updateData.status) {
//       this.shipping.deliveryPartner.trackingUpdates.push({
//         status: updateData.status,
//         location: updateData.location,
//         description: updateData.description
//       });
//     }
//     // Update other tracking fields if provided
//     ['name', 'trackingId', 'estimatedDelivery', 'currentLocation', 'serviceType'].forEach(field => {
//       if (updateData[field]) {
//         this.shipping.deliveryPartner[field] = updateData[field];
//       }
//     });
//   }
//   return this.save();
// };

// // Get Latest tracking status
// orderSchema.virtual('currentTrackingStatus').get(function() {
//   if (!this.shipping?.deliveryPartner?.trackingUpdates?.length) return null;
//   return this.shipping.deliveryPartner.trackingUpdates[
//     this.shipping.deliveryPartner.trackingUpdates.length - 1
//   ];
// });

// // Add order stats methods
// orderSchema.statics.getOrderStats = async function(dateRange) {
//   return this.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: dateRange.start, $lte: dateRange.end },
//         'payment.status': 'completed'
//       }
//     },
//     {
//       $group: {
//         _id: null,
//         totalOrders: { $sum: 1 },
//         totalRevenue: { $sum: '$totalAmount' },
//         averageOrderValue: { $avg: '$totalAmount' }
//       }
//     }
//   ]);
// };

// orderSchema.statics.getTopSellingItems = async function(limit = 10) {
//   return this.aggregate([
//     { $unwind: '$items' },
//     {
//       $group: {
//         _id: '$items.book',
//         totalQuantity: { $sum: '$items.quantity' },
//         totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
//       }
//     },
//     { $sort: { totalQuantity: -1 } },
//     { $limit: limit }
//   ]);
// };

// // Add a static method to get paginated orders
// orderSchema.statics.getPaginatedOrders = async function(query = {}, page = 1, limit = 10) {
//   try {
//     const skip = (page - 1) * limit;
//     const orders = await this.find(query)
//       .populate('user', 'name email')
//       .populate('items.book', 'title price')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     const total = await this.countDocuments(query);
//     const totalPages = Math.ceil(total / limit);

//     return {
//       orders,
//       totalPages,
//       currentPage: page,
//       total
//     };
//   } catch (error) {
//     console.error('Error in getPaginatedOrders:', error);
//     throw error;
//   }
// };

// // Add pre-save hook to handle payment status
// orderSchema.pre('save', function(next) {
//   // If razorpayPaymentId exists and status hasn't been set to completed
//   if (this.payment?.razorpayPaymentId && this.payment.status !== 'completed') {
//     this.payment.status = 'completed';
//     this.payment.paidAt = new Date();
//   }
//   next();
// });

// // Modify post-save hook to update statistics
// orderSchema.post('save', async function(doc) {
//   try {
//     // Update statistics only when payment is completed
//     if (doc.payment?.status === 'completed') {
//       // Update book purchase statistics
//       const updatePromises = doc.items.map(item => 
//         Book.findByIdAndUpdate(item.book, {
//           $inc: {
//             'statistics.purchases': item.quantity,
//             'statistics.totalRevenue': item.price * item.quantity
//           }
//         }, { new: true })
//       );
//       await Promise.all(updatePromises);
//     }
//   } catch (err) {
//     console.error('Error updating statistics:', err);
//   }
// });

// // Get cancellation statistics
// orderSchema.statics.getCancellationStats = async function(dateRange) {
//   return this.aggregate([
//     {
//       $match: {
//         status: 'cancelled',
//         'cancellationDetails.cancelledAt': { 
//           $gte: dateRange.start, 
//           $lte: dateRange.end 
//         }
//       }
//     },
//     {
//       $group: {
//         _id: '$cancellationDetails.reason',
//         count: { $sum: 1 },
//         totalValue: { $sum: '$totalAmount' }
//       }
//     },
//     { $sort: { count: -1 } }
//   ]);
// };

// // Get refund statistics
// orderSchema.statics.getRefundStats = async function(dateRange) {
//   return this.aggregate([
//     {
//       $match: {
//         status: 'refund-completed',
//         'refundDetails.completedAt': { 
//           $gte: dateRange.start, 
//           $lte: dateRange.end 
//         }
//       }
//     },
//     {
//       $group: {
//         _id: '$refundDetails.method',
//         count: { $sum: 1 },
//         totalRefunded: { $sum: '$refundDetails.amount' },
//         averageRefund: { $avg: '$refundDetails.amount' }
//       }
//     },
//     { $sort: { totalRefunded: -1 } }
//   ]);
// };

// module.exports = mongoose.model('Order', orderSchema);

const mongoose = require('mongoose');

// Import Book model for statistics updates
const Book = require('./Book');

// Define tracking status update schema
const trackingUpdateSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['order_placed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'],
    required: true
  },
  location: String,
  description: String,
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const shippingPartnerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: false
  },
  trackingId: { 
    type: String, 
    required: false
  },
  estimatedDelivery: Date,
  currentLocation: String,
  serviceType: {
    type: String,
    enum: ['standard', 'express', 'priority'],
    default: 'standard'
  },
  trackingUpdates: [trackingUpdateSchema]
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    name: { type: String, required: true },
    skuId: { type: String, required: true },
    originalPrice: { type: Number, required: true },
    imageUrl: { type: String } 
  }],

  shipping: {
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
      contactNumber: { type: String, required: true },
      specialInstructions: String
    },
    method: { type: String, required: true },
    cost: { type: Number, required: true },
    deliveryPartner: shippingPartnerSchema
  },
  appliedVoucher: {
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    code: String,
    discountType: { type: String, enum: ['percentage', 'fixed','complimentary'], default: 'percentage' },
    discount: { type: Number, default: 0 },
    complimentaryItems: [{
      book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
      name: String,
      price: Number,
      quantity: Number
    }]
  },
  charges: {
    subtotal: { type: Number, required: true },
    gst: { type: Number, required: true },
    paymentCharge: { type: Number, required: true }, // Changed from serviceCharge
    deliveryCharge: { type: Number, required: true },
    totalAmount: { type: Number, required: true }
  },
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refund-completed'],
    default: 'pending' 
  },
  payment: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },

    notes: String,
    method: {
      type: String,
      enum: ['cod', 'razorpay'],
      default: 'razorpay'
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
    paidAmount: Number,
    paidAt: Date
  },
  voucherUsed: {
    type: Boolean,
    default: false
  }, 
  // Cancellation details
  cancellationDetails: {
    reason: {
      type: String,
      enum: ['customer-request', 'out-of-stock', 'payment-issue', 'fraud-suspected', 'shipping-issue',  'quality-issue', 'other'],
      required: function() { return this.status === 'cancelled'; }
    },
    notes: String,
    refundMethod: {
      type: String,
      enum: ['original-payment-method', 'bank-transfer', 'wallet', 'cash', 'store-credit', 'no-refund'],
      required: function() { return this.status === 'cancelled'; }
    },
    cancelledAt: {
      type: Date,
      default: function() { return this.status === 'cancelled' ? Date.now() : undefined; }
    },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Refund details
  refundDetails: {
    reason: {
      type: String,
      enum: ['customer-request', 'defective-product', 'wrong-item', 'not-as-described', 'damaged-in-transit', 'change-of-mind', 'other'],
      required: function() { return this.status === 'refund-completed'; }
    },
    notes: String,
    refundMethod: {
      type: String,
      enum: ['original-payment-method', 'bank-transfer', 'wallet', 'cash', 'store-credit'],
      required: function() { return this.status === 'refund-completed'; }
    },
    refundAmount: {
      type: Number,
      required: function() { return this.status === 'refund-completed'; }
    },
    referenceId: {
      type: String,
      required: function() { return this.status === 'refund-completed'; }
    },
    processedAt: {
      type: Date,
      default: function() { return this.status === 'refund-completed' ? Date.now() : undefined; }
    },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  orderDetails: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'in-store'],
      default: 'web'
    },
    notes: String,
    giftWrap: {
      required: { type: Boolean, default: false },
      message: String
    },
    invoice: {
      number: String,
      generatedAt: Date,
      url: String
    }
  },
  orderMetrics: {
    processingTime: { type: Number },
    deliveryTime: { type: Number },
    totalValue: { type: Number, required: false },
    itemCount: { type: Number, required: false }
  },
  analytics: {
    deviceType: String,
    platform: String,
    referrer: String
  }
}, { timestamps: true });

// Add indexes for better querying
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'shipping.deliveryPartner.trackingId': 1 });
orderSchema.index({ user: 1, 'appliedVoucher.code': 1, 'payment.status': 1 });
orderSchema.index({ 'payment.razorpayOrderId': 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1, createdAt: -1 });
orderSchema.index({ status: 1, 'payment.status': 1 });
orderSchema.index({ 'cancellationDetails.cancelledAt': 1 });
orderSchema.index({ 'refundDetails.completedAt': 1 });
orderSchema.index({ 'cancellationDetails.reason': 1 });
orderSchema.index({ 'refundDetails.method': 1 });

// Add method to update tracking info
orderSchema.methods.addTrackingUpdate = async function(updateData) {
  if (!this.shipping.deliveryPartner) {
    this.shipping.deliveryPartner = updateData;
  } else {
    if (updateData.status) {
      this.shipping.deliveryPartner.trackingUpdates.push({
        status: updateData.status,
        location: updateData.location,
        description: updateData.description
      });
    }
    // Update other tracking fields if provided
    ['name', 'trackingId', 'estimatedDelivery', 'currentLocation', 'serviceType'].forEach(field => {
      if (updateData[field]) {
        this.shipping.deliveryPartner[field] = updateData[field];
      }
    });
  }
  return this.save();
};

// Add method to cancel order
orderSchema.methods.cancelOrder = async function(cancellationData) {
  this.status = 'cancelled';
  this.cancellationDetails = {
    reason: cancellationData.reason,
    notes: cancellationData.notes,
    refundMethod: cancellationData.refundMethod,
    cancelledAt: new Date(),
    cancelledBy: cancellationData.cancelledBy || 'admin'
  };
  return this.save();
};

// Add method to complete refund
orderSchema.methods.completeRefund = async function(refundData) {
  this.status = 'refund-completed';
  this.refundDetails = {
    reason: refundData.reason,
    notes: refundData.notes,
    refundMethod: refundData.refundMethod,
    refundAmount: refundData.refundAmount,
    referenceId: refundData.referenceId,
    processedAt: new Date(),
    processedBy: refundData.processedBy || 'admin'
  };
  return this.save();
};

// Get cancellation status
orderSchema.virtual('isCancelled').get(function() {
  return this.status === 'cancelled';
});

// Get refund status
orderSchema.virtual('isRefundCompleted').get(function() {
  return this.status === 'refund-completed';
});

// Check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'processing'].includes(this.status) && this.payment.status !== 'completed';
};

// Check if order can be refunded
orderSchema.methods.canBeRefunded = function() {
  return ['delivered', 'cancelled'].includes(this.status) && this.payment.status === 'completed';
};

// Get Latest tracking status
orderSchema.virtual('currentTrackingStatus').get(function() {
  if (!this.shipping?.deliveryPartner?.trackingUpdates?.length) return null;
  return this.shipping.deliveryPartner.trackingUpdates[
    this.shipping.deliveryPartner.trackingUpdates.length - 1
  ];
});

// Add order stats methods
orderSchema.statics.getOrderStats = async function(dateRange) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
        'payment.status': 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    }
  ]);
};

orderSchema.statics.getTopSellingItems = async function(limit = 10) {
  return this.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.book',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit }
  ]);
};

// Add a static method to get paginated orders
orderSchema.statics.getPaginatedOrders = async function(query = {}, page = 1, limit = 10) {
  try {
    const skip = (page - 1) * limit;
    const orders = await this.find(query)
      .populate('user', 'name email')
      .populate('items.book', 'title price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      orders,
      totalPages,
      currentPage: page,
      total
    };
  } catch (error) {
    console.error('Error in getPaginatedOrders:', error);
    throw error;
  }
};

// Add pre-save hook to handle payment status
orderSchema.pre('save', function(next) {
  // If razorpayPaymentId exists and status hasn't been set to completed
  if (this.payment?.razorpayPaymentId && this.payment.status !== 'completed') {
    this.payment.status = 'completed';
    this.payment.paidAt = new Date();
  }
  next();
});

// Modify post-save hook to update statistics
orderSchema.post('save', async function(doc) {
  try {
    // Update statistics only when payment is completed
    if (doc.payment?.status === 'completed') {
      // Update book purchase statistics
      const updatePromises = doc.items.map(item => 
        Book.findByIdAndUpdate(item.book, {
          $inc: {
            'statistics.purchases': item.quantity,
            'statistics.totalRevenue': item.price * item.quantity
          }
        }, { new: true })
      );
      await Promise.all(updatePromises);
    }
  } catch (err) {
    console.error('Error updating statistics:', err);
  }
});

// Add method to update tracking info
orderSchema.methods.addTrackingUpdate = async function(updateData) {
  if (!this.shipping.deliveryPartner) {
    this.shipping.deliveryPartner = updateData;
  } else {
    if (updateData.status) {
      this.shipping.deliveryPartner.trackingUpdates.push({
        status: updateData.status,
        location: updateData.location,
        description: updateData.description
      });
    }
    // Update other tracking fields if provided
    ['name', 'trackingId', 'estimatedDelivery', 'currentLocation', 'serviceType'].forEach(field => {
      if (updateData[field]) {
        this.shipping.deliveryPartner[field] = updateData[field];
      }
    });
  }
  return this.save();
};

// Get Latest tracking status
orderSchema.virtual('currentTrackingStatus').get(function() {
  if (!this.shipping?.deliveryPartner?.trackingUpdates?.length) return null;
  return this.shipping.deliveryPartner.trackingUpdates[
    this.shipping.deliveryPartner.trackingUpdates.length - 1
  ];
});

// Add order stats methods
orderSchema.statics.getOrderStats = async function(dateRange) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
        'payment.status': 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    }
  ]);
};

orderSchema.statics.getTopSellingItems = async function(limit = 10) {
  return this.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.book',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit }
  ]);
};

// Add a static method to get paginated orders
orderSchema.statics.getPaginatedOrders = async function(query = {}, page = 1, limit = 10) {
  try {
    const skip = (page - 1) * limit;
    const orders = await this.find(query)
      .populate('user', 'name email')
      .populate('items.book', 'title price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      orders,
      totalPages,
      currentPage: page,
      total
    };
  } catch (error) {
    console.error('Error in getPaginatedOrders:', error);
    throw error;
  }
};

// Add pre-save hook to handle payment status
orderSchema.pre('save', function(next) {
  // If razorpayPaymentId exists and status hasn't been set to completed
  if (this.payment?.razorpayPaymentId && this.payment.status !== 'completed') {
    this.payment.status = 'completed';
    this.payment.paidAt = new Date();
  }
  next();
});

// Modify post-save hook to update statistics
orderSchema.post('save', async function(doc) {
  try {
    // Update statistics only when payment is completed
    if (doc.payment?.status === 'completed') {
      // Update book purchase statistics
      const updatePromises = doc.items.map(item => 
        Book.findByIdAndUpdate(item.book, {
          $inc: {
            'statistics.purchases': item.quantity,
            'statistics.totalRevenue': item.price * item.quantity
          }
        }, { new: true })
      );
      await Promise.all(updatePromises);
    }
  } catch (err) {
    console.error('Error updating statistics:', err);
  }
});

// Get cancellation statistics
orderSchema.statics.getCancellationStats = async function(dateRange) {
  return this.aggregate([
    {
      $match: {
        status: 'cancelled',
        'cancellationDetails.cancelledAt': { 
          $gte: dateRange.start, 
          $lte: dateRange.end 
        }
      }
    },
    {
      $group: {
        _id: '$cancellationDetails.reason',
        count: { $sum: 1 },
        totalValue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Get refund statistics
orderSchema.statics.getRefundStats = async function(dateRange) {
  return this.aggregate([
    {
      $match: {
        status: 'refund-completed',
        'refundDetails.completedAt': { 
          $gte: dateRange.start, 
          $lte: dateRange.end 
        }
      }
    },
    {
      $group: {
        _id: '$refundDetails.method',
        count: { $sum: 1 },
        totalRefunded: { $sum: '$refundDetails.amount' },
        averageRefund: { $avg: '$refundDetails.amount' }
      }
    },
    { $sort: { totalRefunded: -1 } }
  ]);
};

module.exports = mongoose.model('Order', orderSchema);
