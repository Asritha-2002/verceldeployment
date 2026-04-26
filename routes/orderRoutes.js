const express = require('express');
const router = express.Router();
const fs = require('fs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path=require('path')

const { auth, adminAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Voucher = require('../models/Voucher');
const ShopDetails = require('../models/ShopDetails');
const AdditionalCharges = require('../models/AdditionalCharges');
const Book = require('../models/Book');
const { validate } = require('../middleware/validate');
const { orderSchemas } = require('../validation/schemas');
const {validateWebhookSignature} = require('razorpay/dist/utils/razorpay-utils')
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require('../config/email');

const generateInvoice = require("../config/generateInvoice");
// console.log(generateInvoice);



console.log('Razorpay Key ID:', process.env.RAZORPAY_KEY_ID);
console.log('Razorpay Key Secret:', process.env.RAZORPAY_KEY_SECRET);
console.log('Company Name:', process.env.COMPANY_NAME);
console.log('Company Logo:', process.env.COMPANY_LOGO);

var pgInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});






router.post("/:id/invoice", auth, async (req, res) => {
  try {
    let order;

    if (req.user.isAdmin) {
      // ✅ Admin can access ANY order
      order = await Order.findById(req.params.id)
        .populate("items.book user");
    } else {
      // ✅ User → only their own order
      order = await Order.findOne({
        _id: req.params.id,
        user: req.user.id,
      }).populate("items.book user");
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.payment?.status !== "completed") {
      return res.status(400).json({ message: "Payment not completed yet" });
    }

    if (order.orderDetails?.invoice?.url) {
      return res.json({
        message: "Invoice already exists",
        invoice: order.orderDetails.invoice,
      });
    }

    const invoiceNumber = `INV-${Date.now()}-${order._id.toString().slice(-4)}`;

    order.orderDetails.invoice = {
      number: invoiceNumber,
      generatedAt: new Date(),
      url: null,
    };

    await order.save();

    const invoiceUrl = await generateInvoice(order);

    order.orderDetails.invoice.url = invoiceUrl;
    await order.save();

    return res.json({
      message: "Invoice generated successfully",
      invoice: order.orderDetails.invoice,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});



// Middleware to validate Razorpay webhook signature



router.post('/paymentStatus', async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-razorpay-signature'];
    console.log('Received payload:', payload);
    console.log('Received signature:', signature);

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    console.log('Webhook Secret:', webhookSecret);
    console.log('Validating signature...', JSON.stringify(payload), signature, webhookSecret);

    const isValid = validateWebhookSignature(JSON.stringify(payload), signature, webhookSecret);
    console.log(isValid);
    if (isValid) {
      fs.writeFileSync('payload.json', JSON.stringify(payload, null, 2));
      try {
        const entity = payload.payload.order.entity;
        console.log(entity);
        const order = await Order.findOne({
          'payment.razorpayOrderId': entity.id
        }).populate('items.book user');

        if (!order) {
          return res.status(404).json({ message: 'Order not found' });
        }
          order.payment.status = 'completed';
          order.payment.paidAt = new Date();
          order.status = 'processing';
       console.log(`from backend ${order}`)
        await order.save();
        
        
        // Send order confirmation email after successful payment
        try {
          await sendOrderConfirmationEmail(order.user.email, order);
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't fail the webhook if email fails
        }
        
        res.status(200).json({ status: 'webhook_processed' });
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ message: 'Error processing webhook' });
      }
    } else {
      res.status(400).json({ message: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch("/cancel/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, notes, cancelledAt } = req.body;

    // ✅ populate user (VERY IMPORTANT)
    const order = await Order.findById(orderId)
      .populate("user", "email name");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // ✅ check ownership
    if (order.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    // ✅ prevent duplicate cancel
    if (order.status === "cancelled") {
      return res.status(400).json({
        message: "Order already cancelled",
      });
    }

    // ✅ allow only certain statuses
    if (!["processing", "shipped"].includes(order.status)) {
      return res.status(400).json({
        message: "Order cannot be cancelled at this stage",
      });
    }

    // ✅ update status
    order.status = "cancelled";

    order.cancellationDetails = {
      reason,
      notes,
      cancelledAt: cancelledAt || new Date(),
      cancelledBy: req.user.id,
    };

    // ✅ update payment status
    // if (order.payment) {
    //   order.payment.status = "refund-initiated";
    // }

    // ✅ SAVE FIRST
    await order.save();

    // ✅ SEND EMAIL (AFTER SAVE)
    try {
      await sendOrderStatusEmail(
        order.user.email,
        order,
        "cancelled"
      );
    } catch (emailError) {
      console.error("Cancel email failed:", emailError.message);
    }

    res.json({
      message: "Order cancelled successfully",
      order,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: err.message,
    });
  }
});


router.post('/create-cod-order', auth, async (req, res) => {
  try {

    const { shippingAddress, charges, paymentMethod, appliedVoucher } = req.body;

    if(process.env.COD_ENABLED !== 'true') {
      return res.status(400).json({ message: 'Cash on Delivery is not available' });
    }
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.book');
   

     const validation = await validateOrder({
      cart,
      charges,
      paymentMethod,
      shippingMethod: req.body.shippingMethod,
      appliedVoucher,
      userId: req.user.id,
      shippingAddress
    });

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message, field: validation.field });
    }


    

    // Calculate voucher discount if applied
    let voucherDiscount = 0;
    let complimentaryItems = [];

    if (appliedVoucher) {
      voucherDiscount = appliedVoucher.discount;
      complimentaryItems = appliedVoucher.complimentaryItems || [];
    }


    // Calculate the exact total to avoid PayPal amount mismatch
    const itemTotal = charges.subtotal;
    const taxTotal = charges.gst;
    const handlingTotal = charges.paymentCharge;
    const shippingTotal = charges.deliveryCharge;
    const finalTotal = Math.round((itemTotal + taxTotal + handlingTotal + shippingTotal - voucherDiscount) * 100) / 100;

    // Create order using charges from frontend
    const newOrder = new Order({
      user: req.user.id,
      items: cart.items.map(item => ({
        book: item.book._id,
        quantity: item.quantity,
        price: item.book.price,
        originalPrice: item.book.originalPrice,
        name: item.book.title,
        skuId: item.book.skuId,
        imageUrl: item.book.images?.[0]?.url
      })),
      shipping: {
        address: shippingAddress,
        method: req.body.shippingMethod || 'standard',
        cost: charges.deliveryCharge
      },
      charges: {
        subtotal: itemTotal,
        gst: taxTotal,
        paymentCharge: handlingTotal,
        deliveryCharge: shippingTotal,
        totalAmount: finalTotal
      },
      totalAmount: finalTotal,
      ...(appliedVoucher && {
        appliedVoucher: {
          voucher: appliedVoucher.id,
          code: appliedVoucher.code,
          discountType: appliedVoucher.discountType,
          discount: appliedVoucher.discount,
          complimentaryItems: appliedVoucher.complimentaryItems || []
        }
      }),
      status: 'processing',
      payment: {
        method: 'cod',
        status: 'pending'
      }
    });

    // Clear cart and update stock
    await Promise.all([
      Cart.findByIdAndUpdate(cart._id, { items: [] }),
      ...cart.items.map(item => 
        Book.findByIdAndUpdate(item.book._id, { 
          $inc: { stock: -item.quantity }
        })
      )
    ]);

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



router.post('/create-pay-order', auth, async (req, res) => {
  try {
    const { shippingAddress, charges, paymentMethod, appliedVoucher } = req.body;

    console.log("Incoming request:", req.body);

    const cart = await Cart.findOne({ user: req.user.id }).populate('items.book');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // ✅ BASIC VALIDATION ONLY (RELAXED)
    if (!charges || !charges.subtotal || !charges.totalAmount) {
      return res.status(400).json({
        message: "Invalid charges data",
        field: "charges"
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method required",
        field: "paymentMethod"
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        message: "Shipping address required",
        field: "shippingAddress"
      });
    }

    // ✅ CREATE ORDER
    const newOrder = new Order({
      user: req.user.id,

      items: cart.items.map(item => ({
        book: item.book._id,
        quantity: item.quantity,
        price: item.book.price,
        originalPrice: item.book.originalPrice,
        name: item.book.title,
        skuId: item.book.skuId,
        imageUrl: item.book.images?.[0]?.url
      })),

      // ✅ FIXED ADDRESS STRUCTURE
      shipping: {
        address: {
          street: shippingAddress.addressLine1,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zipCode: shippingAddress.pincode,
          country: "India",
          contactNumber: shippingAddress.mobileNumber
        },
        method: req.body.shippingMethod || 'standard',
        cost: charges.deliveryCharge || 0
      },

      // ✅ ACCEPT FRONTEND CALCULATED VALUES
      charges: {
        subtotal: charges.subtotal,
        gst: charges.gst || 0,
        paymentCharge: charges.paymentCharge || 0,
        deliveryCharge: charges.deliveryCharge || 0,
        totalAmount: charges.totalAmount
      },

      totalAmount: charges.totalAmount,

      payment: {
        method: paymentMethod.toLowerCase(),
        status: 'pending'
      },

      // ✅ OPTIONAL VOUCHER
      ...(appliedVoucher && {
        appliedVoucher: {
          voucher: appliedVoucher.id,
          code: appliedVoucher.code,
          discountType: appliedVoucher.discountType,
          discount: appliedVoucher.discount,
          complimentaryItems: appliedVoucher.complimentaryItems || []
        }
      })
    });

    await newOrder.save();

    // ✅ CREATE RAZORPAY ORDER
    const razorpayOrder = await pgInstance.orders.create({
      amount: Math.round(charges.totalAmount * 100), // paise
      currency: 'INR',
      receipt: newOrder._id.toString(),
      notes: {
        orderId: newOrder._id.toString(),
      }
    });

    // ✅ SAVE RAZORPAY ORDER ID
    newOrder.payment.razorpayOrderId = razorpayOrder.id;
    await newOrder.save();

    // ✅ CLEAR CART + UPDATE STOCK
    // await Promise.all([
    //   Cart.findByIdAndUpdate(cart._id, { items: [] }),

    //   ...cart.items.map(item =>
    //     Book.findByIdAndUpdate(item.book._id, {
    //       $inc: { stock: -item.quantity }
    //     })
    //   )
    // ]);

    // ✅ ATTACH FRONTEND DATA
    razorpayOrder.key = process.env.RAZORPAY_KEY_ID;
    razorpayOrder.companyName = process.env.COMPANY_NAME;
    razorpayOrder.companyLogo = process.env.COMPANY_LOGO;

    // ✅ RESPONSE
    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      companyName: process.env.COMPANY_NAME,
      companyLogo: process.env.COMPANY_LOGO,
      order: newOrder,
      razorpayOrder
    });

  } catch (error) {
    console.error('Order creation error:', error);

    res.status(500).json({
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// Get user's orders
router.get("/my-orders", auth, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email phone")
      .populate("items.book", "title price images")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/my-order", auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }) // ✅ FIXED HERE
      .populate("user", "name email phone")
      .populate("items.book", "title price images")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get orders by page with filters
router.get('/ad', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = status ? { status } : {};

    const orders = await Order.find(filter)
      .select('status payment user items charges totalAmount createdAt')
      .populate('user', 'title name email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(filter);

    // Get count for each status
    const statusCountsAgg = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const statusCounts = {};
    statusCountsAgg.forEach(s => {
      statusCounts[s._id] = s.count;
    });

    res.json({
      orders,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      currentPage: parseInt(page),
      statusCounts
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//get order by id for admin
router.get('/ad/:id', auth,adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate([
      { path: 'items.book' },
      { path: 'user', select: '-password' },
      { path: 'appliedVoucher.voucher' },
      { path: 'appliedVoucher.complimentaryItems.book' },
      { path: 'payment.method' },
      { path: 'payment.updatedBy', select: '-password' },
      { path: 'cancellationDetails.cancelledBy', select: '-password' },
      { path: 'refundDetails.processedBy', select: '-password' }
      ]);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update order status
router.patch('/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'email name')
      .populate('items.book', 'title price images');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { status, shippingDetails, cancellationDetails, refundDetails } = req.body;
    const previousStatus = order.status;

    const validStatuses = [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refund-completed'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // ✅ ENSURE shipping object exists
    if (!order.shipping) {
      order.shipping = {};
    }

    // ================= SHIPPED =================
    if (status === 'shipped') {
      if (!shippingDetails?.name || !shippingDetails?.trackingId) {
        return res.status(400).json({
          message: 'Shipping partner name and tracking ID are required'
        });
      }

      // ✅ Preserve existing data
      order.shipping.deliveryPartner = {
        ...order.shipping.deliveryPartner,

        name: shippingDetails.name,
        trackingId: shippingDetails.trackingId,
        estimatedDelivery: shippingDetails.estimatedDelivery || null,

        // ✅ Preserve old updates
        trackingUpdates: [
          ...(order.shipping.deliveryPartner?.trackingUpdates || []),
          {
            status: 'shipped',
            description: 'Order has been shipped',
            timestamp: new Date()
          }
        ]
      };

     
    }

    // ================= DELIVERED =================
    if (status === 'delivered' && previousStatus !== 'delivered') {
      if (!order.shipping.deliveryPartner) {
        order.shipping.deliveryPartner = {};
      }

      order.shipping.deliveryPartner.trackingUpdates = [
        ...(order.shipping.deliveryPartner.trackingUpdates || []),
        {
          status: 'delivered',
          description: 'Order has been delivered',
          timestamp: new Date()
        }
      ];

      

      await Promise.all(order.items.map(item =>
        Book.findByIdAndUpdate(item.book, {
          $inc: {
            'statistics.purchases': item.quantity,
            'statistics.totalRevenue': item.price * item.quantity
          }
        })
      ));
    }

    // ================= CANCELLED =================
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      if (cancellationDetails) {
        order.cancellationDetails = {
          ...cancellationDetails,
          cancelledBy: req.user.id,
          cancelledAt: new Date()
        };
      }

     
    }

    // ================= REFUND =================
    if (status === 'refund-completed' && previousStatus !== 'refund-completed') {
      if (refundDetails) {
        order.refundDetails = {
          ...refundDetails,
          processedBy: req.user.id,
          completedAt: new Date()
        };
      }

      
    }

    // ✅ FINAL SAVE
    order.status = status;
    await order.save();
    if (
  ['shipped', 'delivered', 'cancelled', 'refund-completed'].includes(status) &&
  previousStatus !== status
) {
  try {
    await sendOrderStatusEmail(order.user.email, order, status);
  } catch (error) {
    console.error("Email failed:", error);
  }
}


    res.json(order);

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('items.book appliedVoucher.voucher appliedVoucher.complimentaryItems.book');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Calculate order totals with voucher
router.post('/calculate', auth, async (req, res) => {
  try {
    const { items, voucherId, shippingAddress } = req.body;
    let subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Get final charges (like GST)
    const finalCharges = await AdditionalCharges.find({ category: 'FINALCHARGES', isActive: true });
    const gst = finalCharges.reduce((sum, charge) => 
      sum + (subtotal * (parseFloat(charge.value) / 100)), 0);

    const discount = 0; // Will be calculated if voucher is provided
    const deliveryCharge = await calculateDeliveryCharge(shippingAddress);

    res.json({
      subtotal,
      charges: {
        gst,
        paymentCharge: 0, // Will be added in frontend
        deliveryCharge: deliveryCharge,
        totalAmount: subtotal + gst + deliveryCharge
      },
      discount,
      totalAmount: subtotal + gst + deliveryCharge - discount
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Cancel order
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({ message: 'Order cannot be cancelled' });
    }

    order.status = 'cancelled';
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Book.findByIdAndUpdate(item.book, {
        $inc: { stock: item.quantity }
      });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get order invoice
router.get('/:id/invoice', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('items.book user');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const invoiceData = {
      orderNumber: order._id,
      date: order.createdAt,
      customerDetails: {
        name: order.user.name,
        email: order.user.email,
        address: order.shipping.address
      },
      items: order.items.map(item => ({
        title: item.book.title,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
      })),
      charges: order.charges,
      discount: order.appliedVoucher?.discount || 0,
      totalAmount: order.totalAmount
    };

    res.json(invoiceData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update delivery status with enhanced tracking
router.patch('/:id/delivery', auth, adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { 
      name, 
      trackingId, 
      estimatedDelivery, 
      currentLocation, 
      status, 
      description,
      attemptDetails 
    } = req.body;

    if (!order.shipping.deliveryPartner) {
      order.shipping.deliveryPartner = {};
    }

    // Update delivery partner info
    if (name) order.shipping.deliveryPartner.name = name;
    if (trackingId) order.shipping.deliveryPartner.trackingId = trackingId;
    if (estimatedDelivery) order.shipping.deliveryPartner.estimatedDelivery = estimatedDelivery;
    if (currentLocation) order.shipping.deliveryPartner.currentLocation = currentLocation;

    // Add new status update
    if (status) {
      order.shipping.deliveryPartner.statusUpdates.push({
        status,
        location: currentLocation,
        description,
        timestamp: new Date()
      });
    }

    // Add delivery attempt if provided
    if (attemptDetails) {
      order.shipping.deliveryPartner.deliveryAttempts.push({
        attemptDate: new Date(),
        status: attemptDetails.status,
        notes: attemptDetails.notes
      });
    }

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get delivery tracking
router.get('/:id/tracking', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    }).select('shipping.deliveryPartner status createdAt');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      orderId: order._id,
      status: order.status,
      orderDate: order.createdAt,
      deliveryInfo: order.shipping.deliveryPartner
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});




// Verify payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    const sign = razorpayOrderId + "|" + razorpayPaymentId;

    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpaySignature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    // ✅ Find order
    const order = await Order.findOne({
      "payment.razorpayOrderId": razorpayOrderId
    }).populate("items.book user");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // ✅ Prevent duplicate verification
    if (order.payment.status === "completed") {
      return res.json({
        success: true,
        message: "Payment already verified",
        order
      });
    }

    // ✅ Update payment details
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.status = "completed";
    order.payment.paidAt = new Date();
    order.status = "processing";

    // 🔥 SAFE voucher update (ONLY ONCE)
    if (order.appliedVoucher?.voucher && !order.voucherUsed) {
      console.log("Updating voucher:", order.appliedVoucher.voucher);

      await Voucher.findByIdAndUpdate(
        order.appliedVoucher.voucher,
        { $inc: { usedCount: 1 },
       $addToSet: { usedBy: order.user._id } },
        
      );

      order.voucherUsed = true;
    }

    // ✅ Save order once
    await order.save();

    // ✅ Clear cart
    const cart = await Cart.findOne({ user: order.user._id });
    if (cart) {
      await Cart.findByIdAndUpdate(cart._id, { items: [] });
    }

    // ✅ Reduce stock
    await Promise.all(
      order.items.map(item =>
        Book.findByIdAndUpdate(item.book._id, {
          $inc: { stock: -item.quantity }
        })
      )
    );

    // ✅ Send email
    try {
      await sendOrderConfirmationEmail(order.user.email, order);
    } catch (emailError) {
      console.error("Email send error:", emailError);
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error("Payment verification error:", error);

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});



// Generate invoice
router.post("/:id/invoice", auth, async (req, res) => {
  try {
    let order;
    console.log("hiii");
    
    
    if (req.user.isAdmin === true) {
  // ✅ Admin can access any order
  order = await Order.findById(req.params.id);
} else {
  // ✅ User can access only their order
  order = await Order.findOne({
    _id: req.params.id,
    user: req.user.id,
  });
}

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.payment?.status !== "completed") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    if (order.orderDetails?.invoice?.url) {
      return res.json({
        message: "Already generated",
        invoice: order.orderDetails.invoice,
      });
    }

    const invoiceNumber = `INV-${Date.now()}-${order._id.toString().slice(-4)}`;

    order.orderDetails.invoice = {
      number: invoiceNumber,
      generatedAt: new Date(),
      url: null,
    };

    await order.save();

    const result = await generateInvoice(order);

    // store cloudinary url (optional)
    order.orderDetails.invoice.url = result.cloudUrl;
    await order.save();

    return res.json({
      message: "Invoice generated",
      invoice: order.orderDetails.invoice,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//generate invoice for admin
// router.post("/:id/invoices", auth,adminAuth, async (req, res) => {
//   try {
//     const order = await Order.findOne({
//       _id: req.params.id,
//     });

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     if (order.payment?.status !== "completed") {
//       return res.status(400).json({ message: "Payment not completed" });
//     }

//     if (order.orderDetails?.invoice?.url) {
//       return res.json({
//         message: "Already generated",
//         invoice: order.orderDetails.invoice,
//       });
//     }

//     const invoiceNumber = `INV-${Date.now()}-${order._id.toString().slice(-4)}`;

//     order.orderDetails.invoice = {
//       number: invoiceNumber,
//       generatedAt: new Date(),
//       url: null,
//     };

//     await order.save();

//     const result = await generateInvoice(order);

//     // store cloudinary url (optional)
//     order.orderDetails.invoice.url = result.cloudUrl;
//     await order.save();

//     return res.json({
//       message: "Invoice generated",
//       invoice: order.orderDetails.invoice,
//     });

//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });



const checkPaymentTypeCharges = (paymentMethod, charges, shopdetails) => {
  const paymentCharge = shopdetails.find(charge =>
    charge.name?.toLowerCase() === paymentMethod?.toLowerCase()
  );

  if (Number(paymentCharge?.value) !== Number(charges.paymentCharge)) {
    return { valid: false, message: 'Invalid payment charges', field: 'paymentMethod' };
  }
  return { valid: true };
};

const checkShippingCharges = (shippingMethod, charges, shopdetails) => {
  const shippingCharge = shopdetails.find(charge =>
    charge.name?.toLowerCase() === shippingMethod?.toLowerCase()
  );

  if (Number(shippingCharge?.value) !== Number(charges.deliveryCharge)) {
    return { valid: false, message: 'Invalid shipping charges', field: 'shippingMethod' };
  }
  return { valid: true };
};


const checkTaxAmount = (subtotal, charges, shopdetails) => {
  console.log('Checking tax amount...', subtotal, charges, shopdetails);
  const taxCharges = shopdetails.filter(detail => detail.category === 'FINALCHARGES');
  const totalTaxPerCent = taxCharges.reduce((sum, charge) => sum + Number(charge.value), 0);
  const totalTaxAmount = (subtotal * totalTaxPerCent) / 100;
  if (Math.abs(totalTaxAmount - Number(charges.taxAmount)) > 0.01) {
    return { valid: false, message: 'Invalid tax amount', field: 'taxAmount' };
  }
  return { valid: true };
};

const checkCartAndSubtotals = (cart, subtotal) => {

  if (!cart || cart.items.length === 0) {
      return { valid: false, message: 'Cart is empty', field: 'cart' };
    }
  const subtotalA = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (Math.abs(subtotalA - subtotal) > 0.01) {
    return { valid: false, message: 'Cart and subtotal mismatch', field: 'subtotal' };
  }
  return { valid: true };
};

const checkShippingDetails = (shippingAddress) => {
  const requiredFields = ['street', 'city', 'state', 'zipCode', 'country', 'contactNumber'];
  const missingFields = requiredFields.filter(field => !shippingAddress[field] || shippingAddress[field].trim() === '');

  if (missingFields.length > 0) {
    return { valid: false, message: 'Missing required shipping fields', field: 'shippingAddress', missingFields };
  }

  // Validate zipCode format (basic validation)
  if (!shippingAddress.zipCode || shippingAddress.zipCode.length < 3) {
    return { valid: false, message: 'Invalid postal code. Postal code must be at least 3 characters long.', field: 'zipCode' };
  }

  return { valid: true };
};


 

const isVoucherValid = async (voucher, subtotal, items, userId) => {
  console.log('Validating voucher:', voucher);
  if (!voucher || !voucher.isActive) return { valid: false, message: 'Invalid or inactive voucher', field: 'appliedVoucher' };

  const alreadyUsed = await Order.find({
    user: userId,
    'appliedVoucher.code': voucher.code,
    status: { $nin: ['cancelled', 'refund-completed', 'pending'] }
  }).select('_id');

  const now = new Date();
  if (voucher.expiryDate && now > voucher.expiryDate)
    return { valid: false, message: 'Voucher has expired', field: 'appliedVoucher' };

  if (voucher.minPurchase && subtotal < voucher.minPurchase)
    return { valid: false, message: 'Voucher does not meet minimum purchase requirement', field: 'appliedVoucher' };

  if (voucher.maxUses && alreadyUsed.length >= voucher.maxUses)
    return { valid: false, message: 'Voucher has reached maximum usage limit', field: 'appliedVoucher' };

  return { valid: true };
};

const calculateVoucherDiscount = (voucher, subtotal, items, resdiscount) => {
  let discount = 0;
  let complimentaryItems = [];

  if (!voucher) return { valid: true, discount, complimentaryItems };

  if (voucher.type === 'percentage') {
    discount = (subtotal * voucher.value) / 100;
    if (voucher.maxDiscount) {
      discount = Math.min(discount, voucher.maxDiscount);
    }
  } else if (voucher.type === 'fixed') {
    discount = Math.min(voucher.value, subtotal);
  } else if (voucher.type === 'complimentary') {
    if (voucher.complimentaryItems?.length > 0) {
      complimentaryItems = voucher.complimentaryItems.map(item => ({
        book: item.bookId,
        quantity: item.quantity
      }));
    }
  }

  if (resdiscount !== undefined && Math.abs(resdiscount - discount) > 0.01) {
    return { valid: false, message: 'Invalid voucher discount', field: 'appliedVoucher' };
  }

  return { valid: true, discount, complimentaryItems };
};

const validateOrder = async ({ cart, charges, paymentMethod, shippingMethod, appliedVoucher, userId, shippingAddress }) => {
  const shopdetails = await ShopDetails.find();

  let validationResult;



  validationResult = checkCartAndSubtotals(cart, charges.subtotal);
  if (!validationResult.valid) return validationResult;

  validationResult = checkPaymentTypeCharges(paymentMethod, charges, shopdetails);
  if (!validationResult.valid) return validationResult;

  validationResult = checkShippingCharges(shippingMethod, charges, shopdetails);
  if (!validationResult.valid) return validationResult;

  validationResult = checkTaxAmount(charges.subtotal, charges, shopdetails);
  if (!validationResult.valid) return validationResult;

  validationResult = checkShippingDetails(shippingAddress);
  if (!validationResult.valid) return validationResult;

  if (appliedVoucher) {
      const voucher = await Voucher.findById(appliedVoucher.id);

    const isVoucherOk = await isVoucherValid(voucher, charges.subtotal, cart.items, userId);
    if (!isVoucherOk.valid) return isVoucherOk;

    const voucherDiscount = calculateVoucherDiscount(voucher, charges.subtotal, cart.items, appliedVoucher.discount);
    if (!voucherDiscount.valid) return voucherDiscount;
  }

  return { valid: true };
};

module.exports = router;
