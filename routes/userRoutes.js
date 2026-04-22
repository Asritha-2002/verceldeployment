const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
// const Cart = require('../models/Cart');
// const Book = require('../models/Book');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/email');
const { validate } = require('../middleware/validate');
const { userSchemas } = require('../validation/schemas');
const { cartSchemas } = require("../validation/schemas");
const Book = require('../models/Book');
const Cart = require('../models/Cart')
const CheckoutAddress=require('../models/CheckoutAddress').default
const Voucher = require('../models/Voucher');
const CheckoutSession=require('../models/CheckoutSession')
const AdditionalCharges = require('../models/AdditionalCharges');


// Register
router.post(
  '/register',
  validate(userSchemas.register),
  async (req, res) => {
    try {
      const { email } = req.body;

      // 1. CHECK USER EXISTS
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists. Please login instead.'
        });
      }

      // 2. CREATE USER
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const user = new User({
        ...req.body,
        verificationToken,
        isVerified: false
      });

      await user.save();

      // 3. TRY EMAIL (DO NOT BLOCK FLOW)
      let emailStatus = "sent";

      try {
        await sendVerificationEmail(user.email, verificationToken);
      } catch (emailError) {
        console.error("Email sending failed:", emailError.message);
        emailStatus = "failed";
      }

      // 4. GENERATE TOKEN
      const token = jwt.sign(
        { id: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET
      );

      // 5. RESPONSE (SUCCESS ALWAYS)
      return res.status(201).json({
        success: true,
        user,
        token,
        message:
          emailStatus === "sent"
            ? "Registration successful. Verification email sent."
            : "Registration successful, but email sending failed. Please try resending verification email."
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: 'Something went wrong',
        error: error.message
      });
    }
  }
);

// Login
router.post(
  "/login",
  validate(userSchemas.login),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // console.log("REQ:", req.body);

      const user = await User.findOne({ email });

      // ❌ FIX: check BEFORE using user
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // console.log("DB PASSWORD:", user.password);

      if (!user.isVerified) {
        return res.status(400).json({ message: "Please verify your email first" });
      }

      if (!user.isActive) {
        return res.status(400).json({
          message: "Your account is inactive, Please Contact Support"
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          id: user._id,
          isAdmin: user.isAdmin,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const safeUser = {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified,
        isActive: user.isActive
      };

      return res.json({
        message: user.isAdmin
          ? "Admin login successful"
          : "User login successful",
        token,
        user: safeUser
      });

    } catch (error) {
      return res.status(500).json({
        message: error.message || "Something went wrong"
      });
    }
  }
);

// Email verification
router.get('/verify/:token', async (req, res) => {
 // console.log( req.params.token);
  
  try {
    const user = await User.findOne({ verificationToken: req.params.token});
   // console.log(user);
    
    if (!user) {
     // console.log("not");
      return res.status(400).json({ message: 'Invalid verification token' });
      
      
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
   // console.log("hello");
    
  }
});

// Change forgot password route
router.post('/auth/forgot-password', async (req, res) => {
//console.log(req.body);
  
  try {
    const {email} = req.body;
    //console.log(email);
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 600000; // 10 minutes
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    //console.error('Forgot password error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update reset password route
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Your password reset session has expired. Please request a new one' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    //console.error('Reset password error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update email verification route
router.post('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    //console.error('Email verification error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's cart
router.get("/cart", auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id });

    // ✅ If no cart → create empty cart
    if (!cart) {
      cart = new Cart({
        user: req.user.id,
        items: [],
      });

      await cart.save();
    }

    // ✅ Remove deleted products (important cleanup)
    cart.items = cart.items.filter(item => item.book !== null);

    // ✅ Populate after cleanup
    await cart.populate("items.book");

    res.status(200).json({
      success: true,
      data: cart,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message,
    });
  }
});

// Add to cart
router.post("/cart", auth, async (req, res) => {
  try {
    // ✅ 1. Validate request
    const { error, value } = cartSchemas.add.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { bookId, quantity } = value;

    // ✅ 2. Check product exists
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ✅ 3. Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({
        user: req.user.id,
        items: [],
      });
    }

    // ✅ 4. Check existing item
    const existingItem = cart.items.find(
      (item) => item.book.toString() === bookId
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;

      // ✅ Stock check
      if (book.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${book.stock} items available in stock`,
        });
      }

      // ✅ Update quantity
      existingItem.quantity = newQuantity;

      // ✅ OPTIONAL (Recommended): update latest price snapshot
      existingItem.price = book.price;
      existingItem.originalPrice = book.originalPrice;

    } else {
      // ✅ Stock check for new item
      if (book.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${book.stock} items available in stock`,
        });
      }

      // ✅ Add new item (IMPORTANT: include originalPrice)
      cart.items.push({
        book: book._id,
        title: book.title,
        price: book.price,
        originalPrice: book.originalPrice, // ✅ FIXED
        image: book.images?.[0]?.url || book.images?.[0],
        quantity,
      });
    }

    // ✅ 5. Save cart (middleware handles totals)
    await cart.save();

    // ✅ 6. Populate for frontend
    await cart.populate("items.book");

    // ✅ 7. Success response
    res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: cart,
    });

  } catch (err) {
    console.error("Add to cart error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
      error: err.message, // ✅ helpful for debugging
    });
  }
});

// Update cart item quantity
router.patch("/cart/:itemId", auth, async (req, res) => {
  try {
    const { action } = req.body; // "inc" or "dec"

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1)
      return res.status(404).json({ message: "Item not found" });

    if (action === "inc") {
      cart.items[itemIndex].quantity += 1;
    }

    if (action === "dec") {
      cart.items[itemIndex].quantity -= 1;

      if (cart.items[itemIndex].quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      }
    }

    await cart.save();
    await cart.populate("items.book");

    res.json(cart);
  } catch (error) {
    res.status(400).json({ message: "Failed to update cart item" });
  }
});

// Remove item from cart
router.delete('/cart/:itemId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => 
      item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate('items.book');
    res.json(cart);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
);


// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update user profile
router.patch('/profile',
  auth,
  validate(userSchemas.updateProfile),
  async (req, res) => {
    //console.log(req.body);
    
    try {
      const user = await User.findById(req.user.id);
      if (req.body.name) user.name = req.body.name;
      if (req.body.email) user.email = req.body.email;
      if (req.body.gender) user.gender = req.body.gender;
      if (req.body.dateOfBirth) user.dateOfBirth = req.body.dateOfBirth;
      if (req.body.phone) user.phone = req.body.phone;

      await user.save();
      
      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;
      
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Update password
router.patch('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update shipping address
router.patch('/address', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.address = req.body;
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Clear cart
router.delete('/cart', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get favorite books
router.get('/favorites', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    res.json(user.favorites || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add/Remove favorite book
router.post('/favorites/:bookId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const bookId = req.params.bookId;
    
    const index = user.favorites ? user.favorites.indexOf(bookId) : -1;
    if (index > -1) {
      user.favorites.splice(index, 1);
    } else {
      if (!user.favorites) user.favorites = [];
      user.favorites.push(bookId);
    }
    
    await user.save();
    await user.populate('favorites');
    res.json(user.favorites);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add new address
router.post('/addresses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const requiredFields = ['mobilenum','addl1','addl2','pincode', 'city', 'state'];
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === "") {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // ➕ Add new address
    user.addresses.push({
      ...req.body,
      isDefault: false
    });

    // ✅ Set only 0th index as default
    user.addresses.forEach((addr, index) => {
      addr.isDefault = index === 0;
    });

    await user.save();

    res.json(user.addresses);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// post checkout address
router.post("/checkout-addresses", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      fullName,
      mobileNumber,
      addressLine1,
      addressLine2,
      landmark,
      pincode,
      city,
      state,
      type,
    } = req.body;

    // ✅ Validation (simple backend check)
    const requiredFields = [
      "fullName",
      "mobileNumber",
      "addressLine1",
      "pincode",
      "city",
      "state",
    ];

    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === "") {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // ✅ Check if first address → make default
    const existing = await CheckoutAddress.find({ userId });

    const newAddress = new CheckoutAddress({
      userId,
      fullName,
      mobileNumber,
      addressLine1,
      addressLine2,
      landmark,
      pincode,
      city,
      state,
      type,
      isDefault: existing.length === 0, // first one = default
    });

    await newAddress.save();

    // ✅ return updated list
    const addresses = await CheckoutAddress.find({ userId }).sort({
      isDefault: -1,
    });

    res.status(201).json(addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Get all addresses
router.get('/addresses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user.addresses);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//get checkout addresses
router.get("/checkout-addresses", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await CheckoutAddress.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 }); // default first

    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch checkout addresses",
      error: error.message,
    });
  }
});

// Update address
router.patch('/addresses', auth, async (req, res) => {
  try {
    let { index, updatedAddress } = req.body;

    //console.log("INDEX RECEIVED:", index);

    const user = await User.findById(req.user.id);

    const indexNum = Number(index);

    // ✅ FIX: use addresses (plural)
    if (
      !Array.isArray(user.addresses) ||
      indexNum < 0 ||
      indexNum >= user.addresses.length
    ) {
      return res.status(404).json({ message: "Address not found" });
    }

    // ✅ update correct array
    user.addresses[indexNum] = {
      ...user.addresses[indexNum].toObject(),
      ...updatedAddress
    };

    await user.save();

    res.json(user.addresses);
  } catch (error) {
    //console.error(error);
    res.status(400).json({ message: error.message });
  }
});

//update checkout address
router.put("/checkout-addresses/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const {
      fullName,
      mobileNumber,
      addressLine1,
      addressLine2,
      landmark,
      pincode,
      city,
      state,
      type,
    } = req.body;

    // ✅ Validation
    const requiredFields = [
      "fullName",
      "mobileNumber",
      "addressLine1",
      "pincode",
      "city",
      "state",
    ];

    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === "") {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // ✅ Find & Update (only user's address)
    const updatedAddress = await CheckoutAddress.findOneAndUpdate(
      { _id: addressId, userId },
      {
        fullName,
        mobileNumber,
        addressLine1,
        addressLine2,
        landmark,
        pincode,
        city,
        state,
        type,
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({ message: "Address not found" });
    }

    // ✅ Return updated list
    const addresses = await CheckoutAddress.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json(addresses);

  } catch (error) {
    res.status(500).json({
      message: "Failed to update address",
      error: error.message,
    });
  }
});


// Delete address
router.delete('/addresses/:addressId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses.pull(req.params.addressId);
    await user.save();
    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//update checkout address delete
router.delete("/checkout-addresses/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const deleted = await CheckoutAddress.findOneAndDelete({
      _id: addressId,
      userId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Address not found" });
    }

    // ✅ If deleted was default → assign new default
    if (deleted.isDefault) {
      const firstAddress = await CheckoutAddress.findOne({ userId }).sort({
        createdAt: -1,
      });

      if (firstAddress) {
        firstAddress.isDefault = true;
        await firstAddress.save();
      }
    }

    // ✅ Return updated list
    const addresses = await CheckoutAddress.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json(addresses);

  } catch (error) {
    res.status(500).json({
      message: "Failed to delete address",
      error: error.message,
    });
  }
});


// Set default address
router.post('/addresses/:addressId/default', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    await user.setDefaultAddress(req.params.addressId);
    res.json(user.addresses);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//set default checkout address
// SET DEFAULT ADDRESS
router.put("/checkout-addresses/default/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    // 1️⃣ Make all addresses false
    await CheckoutAddress.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );

    // 2️⃣ Set selected address as true
    await CheckoutAddress.findByIdAndUpdate(addressId, {
      isDefault: true,
    });

    // 3️⃣ Return updated list
    const addresses = await CheckoutAddress.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({
      message: "Failed to set default address",
      error: error.message,
    });
  }
});

// router.post()

// Update user preferences
router.patch('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.preferences = {
      ...user.preferences,
      ...req.body
    };
    await user.save();
    res.json(user.preferences);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get user preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user.preferences);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


//get all books
router.get("/books", auth, async (req, res) => {
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

// get specific book
router.get("/books/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const book = await Book.findById(id);

    // If book not found
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      data: book,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch book",
      error: error.message,
    });
  }
});

//related books

router.get("/books/related/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const currentProduct = await Book.findById(id);

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const relatedProducts = await Book.find({
      category: currentProduct.category,
      _id: { $ne: id }, // exclude current product
    })
      .limit(4) // 👈 important
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: relatedProducts,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch related products",
      error: error.message,
    });
  }
});


//get all vouchers

router.get("/vouchers", auth, async (req, res) => {
  try {
    const cartTotal = Number(req.query.cartTotal || 0);
    const now = new Date();

    const vouchers = await Voucher.find({
      isActive: true,
      expiryDate: { $gte: now },        // ❌ remove expired
      minPurchase: { $lte: cartTotal }, // ❌ remove not eligible
    }).sort({ createdAt: -1 });

    const filtered = vouchers.filter(v => {
      // extra safety check for usage limit
      if (v.maxUses && v.usedCount >= v.maxUses) return false;
      return true;
    });

    res.json({
      success: true,
      data: filtered,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.post("/checkout/start", auth, async (req, res) => {
  try {
    // 1. Get cart of user
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // 2. Create checkout session
    const session = await CheckoutSession.create({
      userId: req.user.id,
      cartId: cart._id,
      voucherId: null, // initially no voucher
      status: "draft",
    });

    res.status(201).json({
      message: "Checkout session created successfully",
      data: session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});


router.patch("/checkout/voucher", auth, async (req, res) => {
  try {
    const { voucherId } = req.body;

    // 🔍 find active checkout session for user
    const session = await CheckoutSession.findOne({
      userId: req.user.id,
      status: "draft",
    });

    if (!session) {
      return res.status(404).json({
        message: "Checkout session not found",
      });
    }

    // 🟢 store or remove voucher
    session.voucherId = voucherId || null;

    await session.save();

    res.json({
      message: voucherId
        ? "Voucher applied to checkout session"
        : "Voucher removed from checkout session",
      data: session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update checkout voucher",
    });
  }
});

router.get("/checkout/summary", auth, async (req, res) => {
  try {
    // 1. Get checkout session
    const session = await CheckoutSession.findOne({
      userId: req.user.id,
      status: "draft",
    });

    if (!session) {
      return res.status(404).json({ message: "Checkout session not found" });
    }

    // 2. Get cart
    const cart = await Cart.findById(session.cartId);

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // 3. Get voucher (if applied)
    let voucher = null;
    let voucherDiscount = 0;

    if (session.voucherId) {
      voucher = await Voucher.findById(session.voucherId);

      if (voucher) {
        const totalAmount = cart.totalAmount;

        if (voucher.type === "percentage") {
          voucherDiscount = (totalAmount * voucher.value) / 100;
        }

        if (voucher.type === "fixed") {
          voucherDiscount = voucher.value;
        }

        if (voucher.type === "complimentary") {
          voucherDiscount = 0;
        }
      }
    }

    // 4. Cart values
    const deliveryFee = 100;
    const productDiscount = cart.totalOriginalAmount - cart.totalAmount;

    const finalTotal =
      cart.totalAmount + deliveryFee - voucherDiscount;

    res.json({
      cart,
      voucher,
      productDiscount,
      voucherDiscount,
      deliveryFee,
      finalTotal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load summary" });
  }
});

router.get("/charges/recent", auth, async (req, res) => {
  try {
    const charges = await AdditionalCharges.find({ isActive: true })
      .sort({ createdAt: -1 });

    // get latest delivery charge
    const latestDelivery = charges.find(
      (c) => c.chargeType === "delivery"
    );

    // get latest gst charge
    const latestGST = charges.find(
      (c) => c.chargeType === "gst"
    );

    res.status(200).json({
      delivery: latestDelivery || null,
      gst: latestGST || null,
    });
  } catch (error) {
    console.error("Get Recent Charges Error:", error);

    res.status(500).json({
      message: "Failed to fetch recent charges",
      error: error.message,
    });
  }
});

module.exports = router;
