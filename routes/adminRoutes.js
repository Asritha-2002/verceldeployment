const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');
const { auth, adminAuth } = require('../middleware/auth');

const { 
  upload,
  uploadImageToCloudinary,
  uploadVideoToCloudinary
} = require('../middleware/upload');
const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');
const Appointment=require('../models/Appointment')
const Voucher = require('../models/Voucher');
const AdditionalCharges = require('../models/AdditionalCharges');
const { validate } = require('../middleware/validate');
const { bookSchemas } = require('../validation/schemas');
const mongoose = require('mongoose');



router.get("/dashboard-stats", auth, async (req, res) => {
  try {
    // only admin allowed
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // ---------- ORDERS ----------
    const totalOrders = await Order.countDocuments();

    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: todayStart },
    });

    const deliveredOrders = await Order.countDocuments({
      status: "delivered",
    });

    const pendingOrders = await Order.countDocuments({
      status: "pending",
    });

    // ---------- REVENUE ----------
    const revenueAgg = await Order.aggregate([
      { $match: { status: "delivered" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    const todayRevenueAgg = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: todayStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const todayRevenue = todayRevenueAgg[0]?.total || 0;

    // ---------- USERS ----------
    const totalUsers = await User.countDocuments();

    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: todayStart },
    });

    // ---------- BOOKS (UPDATED SECTION) ----------
    const totalBooks = await Book.countDocuments();

    const lowStock = await Book.countDocuments({
      stock: { $lte: 5 },
    });

    const outOfStock = await Book.countDocuments({
      stock: 0,
    });

    // ---------- RESPONSE ----------
    res.json({
      totalOrders,
      totalRevenue,
      totalUsers,
      totalBooks,

      today: {
        orders: todayOrders,
        revenue: todayRevenue,
        newUsers: newUsersToday,
      },

      growth: {
        orders: 18,
        revenue: 8,
        users: 5,
      },

      inventory: {
        lowStock,
        outOfStock,
      },

      delivery: {
        pendingOrders,
        deliveredOrders,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// Add new book
router.post(
  "/books",
  auth,
  adminAuth,
  upload.fields([
    { name: "bookImages", maxCount: 5 },
    // { name: "bookVideos", maxCount: 2 }
  ]),
  validate(bookSchemas.create),

  async (req, res) => {
    try {
      const bookData = { ...req.body };

      // ✅ Parent product fix
      if (!bookData.parentProduct || bookData.parentProduct === "") {
        bookData.parentProduct = null;
      } else {
        bookData.parentProduct = new mongoose.Types.ObjectId(
          bookData.parentProduct
        );
      }

      // ✅ Parse product details
      if (typeof bookData.productDetails === "string") {
        try {
          bookData.productDetails = JSON.parse(bookData.productDetails);
        } catch (e) {
          return res.status(400).json({
            error: "Validation error",
            details: [
              { field: "productDetails", message: "Invalid JSON format" },
            ],
          });
        }
      }

      // ✅ Initialize arrays
      bookData.images = [];
      bookData.videos = [];

      // ================= IMAGES =================
      if (req.files?.bookImages) {
        const uploadPromises = req.files.bookImages.map((file) =>
          uploadImageToCloudinary(file.buffer) // ✅ FIX HERE
        );

        const results = await Promise.all(uploadPromises);

        bookData.images = results.map((result) => ({
          url: result.url,
          public_id: result.public_id,
        }));
      }

      // ================= VIDEOS =================
      if (req.files?.bookVideos) {
        const videoTitles = JSON.parse(req.body.videoTitles || "[]");

        const videoPromises = req.files.bookVideos.map(
          async (file, index) => {
            const result = await uploadVideoToCloudinary(file.buffer); // ✅ FIX

            return {
              path: result.url,
              title: videoTitles[index] || file.originalname,
              duration: result.duration || 0,
              public_id: result.public_id,
            };
          }
        );

        bookData.videos = await Promise.all(videoPromises);
      }

      // ✅ Save book
      const book = new Book(bookData);
      await book.save();

      res.status(201).json(book);
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: error.message });
    }
  }
);
// get all books
router.get("/books", auth, adminAuth, async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: books.length,
      data: books,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
      error: error.message,
    });
  }
});
// Update book
router.patch('/books/:id',
  auth,
  adminAuth,
  upload.fields([
    { name: 'bookImages', maxCount: 5 },
    { name: 'bookVideos', maxCount: 2 }
  ]),
  async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }

      // Update basic fields
      const updates = ['title', 'description', 'price', 'originalPrice', 'stock', 'category', 'slug' ,'skuId'];
      updates.forEach(field => {
        if (req.body[field]) book[field] = req.body[field];
      });

      // Handle product details
      if (req.body.productDetails) {
        try {
          book.productDetails = JSON.parse(req.body.productDetails);
        } catch (e) {
          return res.status(400).json({
            error: 'Validation error',
            details: [{ field: 'productDetails', message: 'Invalid JSON format' }]
          });
        }
      }

      // Handle new images
      if (req.files.bookImages) {
        const uploadPromises = req.files.bookImages.map(file => 
          cloudinary.uploader.upload(file.path)
        );
        const results = await Promise.all(uploadPromises);
        book.images = [
          ...book.images,
          ...results.map(result => ({
            url: result.secure_url,
            public_id: result.public_id
          }))
        ];
      }

      // Handle new videos
      if (req.files.bookVideos) {
        const videoTitles = JSON.parse(req.body.videoTitles || '[]');
        const videoPromises = req.files.bookVideos.map(async (file, index) => {
          const cloudinaryResult = await uploadVideoToCloudinary(file.path);
          return {
            path: cloudinaryResult.url,
            title: videoTitles[index] || file.originalname,
            duration: cloudinaryResult.duration || 0,
            public_id: cloudinaryResult.public_id
          };
        });
        const newVideos = await Promise.all(videoPromises);
        book.videos = [...book.videos, ...newVideos];
      }

      await book.save();
      res.json(book);
    } catch (error) {
      console.error('Error updating book:', error);
      res.status(400).json({ message: error.message });
    }
  }
);

//delete book
router.delete('/books/:id', auth, adminAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Delete all images from cloudinary
    for (const image of book.images) {
      if (image.public_id) {
        try {
          await cloudinary.uploader.destroy(image.public_id);
        } catch (err) {
          console.error('Error deleting image from cloudinary:', err);
        }
      }
    }

    // Delete all videos and their thumbnails
    for (const video of book.videos) {
      if (video.path) {
        const localPath = path.join(__dirname, '../public', video.path);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ message: 'Failed to delete book' });
  }
});



//update payment status
router.patch('/orders/:id/payment-status', auth, adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const { status, notes } = req.body;
    order.payment.status = status;
    order.payment.notes = notes;
    order.payment.updatedBy = req.user.id;
    order.payment.updatedAt = new Date();


    await order.save();
    res.json(order);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update order status
// router.patch('/orders/:id/status', auth, adminAuth, async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id)
//       .populate('items.book');
    
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found' });
//     }

//     const oldStatus = order.status;
//     order.status = req.body.status;

//     // Handle status-specific details
//     if (req.body.status === 'shipped' && req.body.tracking) {
//       order.tracking = {
//         trackingNumber: req.body.tracking.trackingNumber,
//         carrier: req.body.tracking.carrier,
//         estimatedDelivery: req.body.tracking.estimatedDelivery,
//         shippedAt: new Date()
//       };
//     }

//     if (req.body.status === 'cancelled' && req.body.cancellationDetails) {
//       order.cancellationDetails = {
//         ...req.body.cancellationDetails,
//         cancelledBy: req.user.id
//       };
//     }

//     if (req.body.status === 'refund-completed' && req.body.refundDetails) {
//       order.refundDetails = {
//         ...req.body.refundDetails,
//         processedBy: req.user.id
//       };
//     }

//     // If order is being marked as delivered, update book statistics
//     if (req.body.status === 'delivered' && oldStatus !== 'delivered') {
//       const updatePromises = order.items.map(async (item) => {
//         try {
//           const book = item.book;
//           book.statistics = book.statistics || {};
//           book.statistics.purchases = (book.statistics.purchases || 0) + item.quantity;
//           book.statistics.revenue = (book.statistics.revenue || 0) + (item.price * item.quantity);
          
//           // Add to purchase history
//           book.statistics.purchaseHistory = book.statistics.purchaseHistory || [];
//           book.statistics.purchaseHistory.push({
//             date: new Date(),
//             quantity: item.quantity,
//             orderId: order._id
//           });

//           await book.save();
//           console.log(`Updated statistics for book ${book._id}`);
//         } catch (err) {
//           console.error(`Failed to update statistics for book ${item.book._id}:`, err);
//         }
//       });

//       await Promise.all(updatePromises);
//     }

//     await order.save();
//     console.log('Order status updated:', order);
//     const savedOrder = await Order.findById(req.params.id);
//     console.log('Updated order details:', savedOrder);
//     res.json(order);
//   } catch (error) {
//     console.error('Error updating order status:', error);
//     res.status(400).json({ message: error.message });
//   }
// });



// Add voucher
router.post('/vouchers', auth, adminAuth, async (req, res) => {
  try {
    const voucher = new Voucher(req.body);
    await voucher.save();
    res.status(201).json(voucher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all vouchers
router.get('/vouchers', auth, adminAuth, async (req, res) => {
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single voucher
router.get('/vouchers/:id', auth, adminAuth, async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id)
      .populate('productId', 'title')
      .populate('complimentaryItems.bookId', 'title')
      .populate('complimentaryItems.conditions.requiredBookId', 'title');
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    res.json(voucher);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create voucher
router.post('/vouchers', auth, adminAuth, async (req, res) => {
  try {
    const voucher = new Voucher(req.body);
    await voucher.save();
    res.status(201).json(voucher);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Voucher code already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Update voucher
router.patch('/vouchers/:id', auth, adminAuth, async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    const updates = Object.keys(req.body);
    updates.forEach(update => voucher[update] = req.body[update]);
    
    await voucher.save();
    res.json(voucher);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Voucher code already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Delete voucher
router.delete('/vouchers/:id', auth, adminAuth, async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    res.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle voucher status
router.patch('/vouchers/:id/toggle-status', auth, adminAuth, async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    
    voucher.isActive = !voucher.isActive;
    await voucher.save();
    
    res.json({ 
      message: `Voucher ${voucher.isActive ? 'activated' : 'deactivated'} successfully`,
      voucher 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manage additional charges
router.post("/charges", auth, adminAuth, async (req, res) => {
  try {
    const { chargeType, type, value, subCharges } = req.body;

    // ================= VALIDATION =================
    if (!chargeType || !type) {
      return res.status(400).json({ message: "chargeType and type are required" });
    }

    // DELIVERY validation
    if (chargeType === "delivery" && (value === undefined || value === null)) {
      return res.status(400).json({ message: "Delivery value is required" });
    }

    // GST validation
    if (chargeType === "gst") {
      if (!subCharges || subCharges.length === 0) {
        return res.status(400).json({ message: "GST requires SGST and CGST" });
      }
    }

    // ================= CREATE =================
    const charge = new AdditionalCharges({
      chargeType,
      type,
      value,
      subCharges,
    });

    await charge.save();

    res.status(201).json({
      message: "Charge created successfully",
      charge,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/charges", auth, adminAuth, async (req, res) => {
  try {
    const charges = await AdditionalCharges.find()
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json(charges);
  } catch (error) {
    console.error("Get Charges Error:", error);

    res.status(500).json({
      message: "Failed to fetch charges",
      error: error.message,
    });
  }
});

//update charges
router.patch("/charges/:id", auth, adminAuth, async (req, res) => {
  try {
    const updated = await AdditionalCharges.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({ message: "Charge not found" });
    }

    res.json({
      message: "Charge updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update Charge Error:", err);

    res.status(500).json({ message: err.message });
  }
});

//delete charge
router.delete("/charges/:id", auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCharge = await AdditionalCharges.findByIdAndDelete(id);

    if (!deletedCharge) {
      return res.status(404).json({
        message: "Charge not found",
      });
    }

    res.status(200).json({
      message: "Charge deleted successfully",
      data: deletedCharge,
    });
  } catch (error) {
    console.error("Delete Charge Error:", error);

    res.status(500).json({
      message: "Failed to delete charge",
      error: error.message,
    });
  }
});
// Upload multiple images for a book
router.post('/books/:id/images', auth, adminAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const uploadPromises = req.files.map(file => 
      cloudinary.uploader.upload(file.path)
    );
    const results = await Promise.all(uploadPromises);
    
    // Append new images to existing ones
    book.images = [
      ...book.images,
      ...results.map(result => ({
        url: result.secure_url,
        public_id: result.public_id
      }))
    ];

    await book.save();
    res.json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete image from book
router.delete('/books/:id/images/:imageId', auth, adminAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const image = book.images.find(img => img.public_id === req.params.imageId);
    if (image) {
      await cloudinary.uploader.destroy(req.params.imageId);
      book.images = book.images.filter(img => img.public_id !== req.params.imageId);
      await book.save();
    }

    res.json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Upload video for a book
router.post('/books/:id/videos', auth, adminAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "book-videos",
      eager: [
        { width: 300, height: 300, crop: "pad", audio_codec: "none" },
        { width: 160, height: 100, crop: "crop", gravity: "south", audio_codec: "none" }
      ],
      eager_async: true,
      eager_notification_url: "https://your-site.com/notify-upload"
    });

    // Generate thumbnail
    const thumbnail = await cloudinary.uploader.upload(req.file.path + '.jpg', {
      folder: "book-video-thumbnails"
    });

    book.videos.push({
      url: result.secure_url,
      public_id: result.public_id,
      thumbnail: {
        url: thumbnail.secure_url,
        public_id: thumbnail.public_id
      },
      title: req.body.title,
      duration: result.duration
    });

    await book.save();
    res.json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete video from book
router.delete('/books/:id/videos/:videoId', auth, adminAuth, async (req, res) => {
  try {
    console.log('Deleting video with params:', {
      bookId: req.params.id,
      videoId: req.params.videoId
    });

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Log existing videos for debugging
    console.log('Current videos:', book.videos);

    // Find video without adding /uploads/videos prefix
    const video = book.videos.find(v => {
      const filename = v.path.split('/').pop();
      return filename === req.params.videoId;
    });

    if (!video) {
      console.log('Video not found in book');
      return res.status(404).json({ message: 'Video not found' });
    }

    console.log('Found video:', video);

    // Delete file from uploads folder
    const filePath = path.join(__dirname, '..', 'public', video.path);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Video file deleted:', filePath);
      }
    } catch (err) {
      console.error('Error deleting video file:', err);
    }
    
    // Remove video from book using exact path match
    book.videos = book.videos.filter(v => v.path !== video.path);
    await book.save();
    
    res.json({ message: 'Video deleted successfully', book });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update video details
router.patch('/books/:id/videos/:videoId', auth, adminAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const videoIndex = book.videos.findIndex(v => v.public_id === req.params.videoId);
    if (videoIndex > -1) {
      book.videos[videoIndex] = {
        ...book.videos[videoIndex],
        title: req.body.title || book.videos[videoIndex].title
      };
      await book.save();
    }

    res.json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/stats", auth, adminAuth, async (req, res) => {
  try {
    const now = new Date();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ---------------- USERS ----------------
    const totalUsers = await User.countDocuments();
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: todayStart },
    });

    // ---------------- BOOKS ----------------
    const totalBooks = await Book.countDocuments();

    const lowStockBooks = await Book.countDocuments({
      stock: { $lte: 5, $gt: 0 },
    });

    const outOfStockBooks = await Book.countDocuments({
      stock: 0,
    });

    // ---------------- ORDERS ----------------
    const totalOrders = await Order.countDocuments();

    const pendingOrders = await Order.countDocuments({
  status: {
    $nin: ["delivered", "cancelled", "refund-completed"],
  },
});

    const deliveredOrders = await Order.countDocuments({
      status: "delivered",
    });

    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: todayStart },
    });

    const weekOrders = await Order.countDocuments({
      createdAt: { $gte: weekStart },
    });

    // ---------------- REVENUE ----------------
    const revenueAgg = await Order.aggregate([
      {
        $match: {
          status: { $nin: ["cancelled", "refund-completed"] },
          "payment.status": "completed",
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = revenueAgg[0]?.revenue || 0;

    const weekRevenueAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart },
          status: { $nin: ["cancelled", "refund-completed"] },
          "payment.status": "completed",
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    const thisWeekRevenue = weekRevenueAgg[0]?.revenue || 0;

    // ---------------- RESPONSE ----------------
    res.json({
      totalUsers,
      totalBooks,
      totalOrders,
      totalRevenue,

      pendingOrders,
      deliveredOrders,

      today: {
        orders: todayOrders,
        newUsers: newUsersToday,
      },

      thisWeek: {
        orders: weekOrders,
        revenue: thisWeekRevenue,
      },

      inventory: {
        lowStock: lowStockBooks,
        outOfStock: outOfStockBooks,
      },
    });
  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Get timeframe specific analytics data
router.get('/stats/timeframe/:timeframe', auth, adminAuth, async (req, res) => {
  try {
    const { timeframe } = req.params;
    const now = new Date();
    let aggregationPipeline = [];
    
    switch(timeframe) {
      case 'today':
        // Get hourly breakdown for today
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        aggregationPipeline = [
          { 
            $match: { 
              createdAt: { $gte: todayStart },
              'payment.status': 'completed',
              'status': { $nin: ['cancelled', 'refund-completed'] }
            } 
          },
          {
            $group: {
              _id: { $hour: '$createdAt' },
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ];
        break;
        
      case 'week':
        // Get daily breakdown for this week
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay())); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        aggregationPipeline = [
          { 
            $match: { 
              createdAt: { $gte: weekStart },
              'payment.status': 'completed',
              'status': { $nin: ['cancelled', 'refund-completed'] }
            } 
          },
          {
            $group: {
              _id: { 
                dayOfWeek: { $dayOfWeek: '$createdAt' },
                date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
              },
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 }
            }
          },
          { $sort: { '_id.dayOfWeek': 1 } }
        ];
        break;
        
      case 'month':
        // Get daily breakdown for this month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        aggregationPipeline = [
          { 
            $match: { 
              createdAt: { $gte: monthStart },
              'payment.status': 'completed',
              'status': { $nin: ['cancelled', 'refund-completed'] }
            } 
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ];
        break;
        
      case 'year':
        // Get monthly breakdown for this year
        const yearStart = new Date(now.getFullYear(), 0, 1);
        aggregationPipeline = [
          { 
            $match: { 
              createdAt: { $gte: yearStart },
              'payment.status': 'completed',
              'status': { $nin: ['cancelled', 'refund-completed'] }
            } 
          },
          {
            $group: {
              _id: { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 }
            }
          },
          { $sort: { '_id.month': 1 } }
        ];
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid timeframe' });
    }

    const analyticsData = await Order.aggregate(aggregationPipeline);
    
    // Format the response based on timeframe
    let formattedData = [];
    
    switch(timeframe) {
      case 'today':
        // Fill in missing hours with 0 data
        for (let hour = 0; hour < 24; hour++) {
          const hourData = analyticsData.find(d => d._id === hour);
          formattedData.push({
            label: `${hour.toString().padStart(2, '0')}:00`,
            revenue: hourData?.revenue || 0,
            orders: hourData?.orders || 0
          });
        }
        break;
        
      case 'week':
        // Fill in missing days with 0 data
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
          const dayData = analyticsData.find(d => d._id.dayOfWeek === dayOfWeek);
          formattedData.push({
            label: daysOfWeek[dayOfWeek - 1],
            revenue: dayData?.revenue || 0,
            orders: dayData?.orders || 0
          });
        }
        break;
        
      case 'month':
        // Fill in missing days with 0 data
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dayData = analyticsData.find(d => d._id === day);
          formattedData.push({
            label: day.toString(),
            revenue: dayData?.revenue || 0,
            orders: dayData?.orders || 0
          });
        }
        break;
        
      case 'year':
        // Fill in missing months with 0 data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let month = 1; month <= 12; month++) {
          const monthData = analyticsData.find(d => d._id.month === month);
          formattedData.push({
            label: monthNames[month - 1],
            revenue: monthData?.revenue || 0,
            orders: monthData?.orders || 0
          });
        }
        break;
    }

    res.json({
      timeframe,
      data: formattedData,
      summary: {
        totalRevenue: formattedData.reduce((sum, item) => sum + item.revenue, 0),
        totalOrders: formattedData.reduce((sum, item) => sum + item.orders, 0),
        dataPoints: formattedData.length
      }
    });

  } catch (error) {
    console.error('Error fetching timeframe analytics:', error);
    res.status(500).json({ message: error.message });
  }
});


// Get sales statistics
router.get('/stats/sales', auth, adminAuth, async (req, res) => {
  try {
    const { period } = req.query;
    let dateFilter = {};
    
    switch(period) {
      case 'daily':
        dateFilter = { 
          createdAt: { 
            $gte: new Date(new Date().setHours(0,0,0,0)) 
          }
        };
        break;
      case 'weekly':
        dateFilter = {
          createdAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 7))
          }
        };
        break;
      case 'monthly':
        dateFilter = {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        };
        break;
    }

    const salesStats = await Order.aggregate([
      { $match: { ...dateFilter, 'payment.status': 'completed' } },
      {
        $group: {
          _id: {
            $dateToString: { 
              format: "%Y-%m-%d", 
              date: "$createdAt" 
            }
          },
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(salesStats);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//top products
router.get('/stats/top-products', auth, adminAuth, async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      // break order items into separate documents
      { $unwind: "$items" },

      // group by book id and count quantity
      {
        $group: {
          _id: "$items.book",
          purchases: { $sum: "$items.quantity" }
        }
      },

      // sort highest selling first
      { $sort: { purchases: -1 } },

      // limit top 5 or 10 products
      { $limit: 5 },

      // join with books collection
      {
        $lookup: {
          from: "books",
          localField: "_id",
          foreignField: "_id",
          as: "book"
        }
      },

      { $unwind: "$book" },

      // format exactly like your React component expects
      {
        $project: {
          _id: "$book._id",
          title: "$book.title",
          price: "$book.price",
          statistics: {
            purchases: "$purchases"
          }
        }
      }
    ]);

    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Delete book


// Get all users with order count
router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        const users = await User.aggregate([
            // ORDERS
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'orders'
                }
            },

            // APPOINTMENTS (NEW - SAFE ADDITION)
            {
    $lookup: {
        from: 'appointments',
        let: { userId: '$_id' },
        pipeline: [
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: ['$userId', '$$userId'] },
                            { $eq: ['$status', 'booked'] }   // 👈 ONLY ACTIVE
                        ]
                    }
                }
            }
        ],
        as: 'appointments'
    }
},

            // COUNTS ONLY (NO IMPACT ON EXISTING STRUCTURE)
            {
                $addFields: {
                    orderCount: { $size: '$orders' },
                    appointmentCount: { $size: '$appointments' }
                }
            },

            // REMOVE HEAVY DATA (same as before + appointments added)
            {
                $project: {
                    password: 0,
                    orders: 0,
                    appointments: 0
                }
            }
        ]);

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/users/:id", auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
//get all appointments with count
router.get("/appointments", auth, adminAuth, async (req, res) => {
  try {
    const appointments = await Appointment.aggregate([
      
      // ================= USER LOOKUP =================
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $addFields: {
          user: { $arrayElemAt: ["$user", 0] },
        },
      },

      // ================= REVIEW LOOKUP (FIXED) =================
      {
        $lookup: {
          from: "reviews",
          let: { appointmentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$appointmentId", "$$appointmentId"],
                },
              },
            },
          ],
          as: "review",
        },
      },

      {
        $addFields: {
          review: { $arrayElemAt: ["$review", 0] },
        },
      },

      // ================= CLEAN DATA =================
      {
        $project: {
          "user.password": 0,
          "user.verificationToken": 0,
          "user.__v": 0,
          __v: 0,
        },
      },

      // ================= SORT =================
      {
        $sort: { createdAt: -1 },
      },
    ]);

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//return user orders by userid
router.get('/users/:id/orders', auth, adminAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const orders = await Order.find({ user: userId })
            .select('status user totalAmount items charges createdAt')
            .populate('user', 'name email')
            .populate('items.book', 'title');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders with pagination and filters
// router.get('/orders', auth, adminAuth, async (req, res) => {
//   try {
//     const { page = 1, limit = 10, status } = req.query;
//     const query = status ? { status } : {};

//     // Only select fields that are not appliedVoucher, items, orderDetails, shipping
//     const selectFields = '-appliedVoucher -items -orderDetails -shipping';

//     const orders = await Order.find(query)
//       .select('status user charges createdAt')
//       .populate('user', 'name email')
//       .sort('-createdAt')
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit))
//       .lean();

//     const total = await Order.countDocuments(query);

//     res.json({
//       orders,
//       totalPages: Math.ceil(total / limit),
//       currentPage: parseInt(page),
//       total
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

module.exports = router;
