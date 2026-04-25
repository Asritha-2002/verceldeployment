const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Blog = require('../models/Blogs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateBlog } = require('../middleware/validate');
const { uploadBlogImageToCloudinary } = require('../middleware/upload');

// Configure multer for temporary file storage before uploading to Cloudinary
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads/temp');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      // fs.mkdirSync(uploadPath, { recursive: true });
      console.log("");
      
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'blog-temp-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ==================== ADMIN ROUTES (Protected) ====================

// Get all blogs (admin only)
router.get('/admin/blogs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search;

    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { heading: { $regex: search, $options: 'i' } },
        { context: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (page - 1) * limit;
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Blog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        blogs,
        pagination: {
          currentPage: page,
          totalPages,
          totalBlogs: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blogs'
    });
  }
});

// Get single blog by ID (admin only)
router.get('/admin/blogs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    res.json({
      success: true,
      data: blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog'
    });
  }
});

// Create new blog (admin only)
router.post('/admin/blogs', 
  authenticateToken, 
  requireAdmin, 
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'subImage', maxCount: 1 }
  ]), 
  validateBlog,
  async (req, res) => {
    let uploadedMainImage = null;
    let uploadedSubImage = null;
    let tempMainPath = null;
    let tempSubPath = null;

    try {
      const { heading, context, tags, status, metaDescription, featured } = req.body;

      // Check if required images are uploaded
      if (!req.files?.mainImage || !req.files?.subImage) {
        return res.status(400).json({
          success: false,
          message: 'Both main and sub images are required'
        });
      }

      // Upload main image to Cloudinary
      tempMainPath = req.files.mainImage[0].path;
      uploadedMainImage = await uploadBlogImageToCloudinary(tempMainPath, 'main');

      // Upload sub image to Cloudinary
      tempSubPath = req.files.subImage[0].path;
      uploadedSubImage = await uploadBlogImageToCloudinary(tempSubPath, 'sub');

      // Process tags
      const processedTags = tags ? 
        (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [];

      const blogData = {
        heading,
        context,
        tags: processedTags,
        images: {
          main: uploadedMainImage,
          sub: uploadedSubImage
        },
        status: status || 'draft',
        metaDescription,
        featured: featured === 'true' || featured === true
      };

      const blog = new Blog(blogData);
      
      // Ensure slug is generated
      if (!blog.slug) {
        await blog.generateSlug();
      }
      
      await blog.save();

      // Clean up temporary files
      if (tempMainPath && fs.existsSync(tempMainPath)) {
        fs.unlinkSync(tempMainPath);
      }
      if (tempSubPath && fs.existsSync(tempSubPath)) {
        fs.unlinkSync(tempSubPath);
      }

      res.status(201).json({
        success: true,
        message: 'Blog created successfully',
        data: blog
      });
    } catch (error) {
      console.error('Error creating blog:', error);
      
      // Clean up temporary files
      if (tempMainPath && fs.existsSync(tempMainPath)) {
        fs.unlinkSync(tempMainPath);
      }
      if (tempSubPath && fs.existsSync(tempSubPath)) {
        fs.unlinkSync(tempSubPath);
      }

      res.status(500).json({
        success: false,
        message: error.code === 11000 ? 'Blog with similar title already exists' : 'Failed to create blog'
      });
    }
  }
);

// Update blog (admin only)
router.put('/admin/blogs/:id', 
  authenticateToken, 
  requireAdmin, 
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'subImage', maxCount: 1 }
  ]), 
  async (req, res) => {
    let uploadedMainImage = null;
    let uploadedSubImage = null;
    let tempMainPath = null;
    let tempSubPath = null;

    try {
      const { heading, context, tags, status, metaDescription, featured } = req.body;
      
      const blog = await Blog.findById(req.params.id);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }

      // Process tags
      const processedTags = tags ? 
        (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : blog.tags;

      // Update fields
      const oldHeading = blog.heading;
      blog.heading = heading || blog.heading;
      blog.context = context || blog.context;
      blog.tags = processedTags;
      blog.status = status || blog.status;
      blog.metaDescription = metaDescription || blog.metaDescription;
      blog.featured = featured !== undefined ? (featured === 'true' || featured === true) : blog.featured;

      // Regenerate slug if heading changed
      if (heading && heading !== oldHeading) {
        await blog.generateSlug();
      }

      // Update main image if new one is uploaded
      if (req.files?.mainImage) {
        tempMainPath = req.files.mainImage[0].path;
        uploadedMainImage = await uploadBlogImageToCloudinary(tempMainPath, 'main');
        blog.images.main = uploadedMainImage;

        // Clean up temporary file
        if (fs.existsSync(tempMainPath)) {
          fs.unlinkSync(tempMainPath);
        }
      }

      // Update sub image if new one is uploaded
      if (req.files?.subImage) {
        tempSubPath = req.files.subImage[0].path;
        uploadedSubImage = await uploadBlogImageToCloudinary(tempSubPath, 'sub');
        blog.images.sub = uploadedSubImage;

        // Clean up temporary file
        if (fs.existsSync(tempSubPath)) {
          fs.unlinkSync(tempSubPath);
        }
      }

      await blog.save();

      res.json({
        success: true,
        message: 'Blog updated successfully',
        data: blog
      });
    } catch (error) {
      console.error('Error updating blog:', error);
      
      // Clean up temporary files on error
      if (tempMainPath && fs.existsSync(tempMainPath)) {
        fs.unlinkSync(tempMainPath);
      }
      if (tempSubPath && fs.existsSync(tempSubPath)) {
        fs.unlinkSync(tempSubPath);
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update blog'
      });
    }
  }
);

// Delete blog (admin only)
router.delete('/admin/blogs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Images are stored on Cloudinary, no local cleanup needed
    await Blog.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog'
    });
  }
});

// ==================== PUBLIC ROUTES ====================

// Get published blogs (public)
router.get('/blogs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const tag = req.query.tag;
    const featured = req.query.featured;

    let blogs;
    let total;

    if (featured === 'true') {
      blogs = await Blog.getFeaturedBlogs(limit);
      total = await Blog.countDocuments({ status: 'published', featured: true });
    } else if (tag) {
      blogs = await Blog.getBlogsByTag(tag, page, limit);
      total = await Blog.countDocuments({ 
        status: 'published', 
        tags: { $in: [tag.toLowerCase()] } 
      });
    } else {
      blogs = await Blog.getPublishedBlogs(page, limit);
      total = await Blog.countDocuments({ status: 'published' });
    }

    // Limit context size to 100 characters
    const blogsWithLimitedContext = blogs.map(blog => {
      const blogObj = blog.toObject ? blog.toObject() : blog;
      return {
        ...blogObj,
        context: blogObj.context?.substring(0, 100) || ''
      };
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        blogs: blogsWithLimitedContext,
        pagination: {
          currentPage: page,
          totalPages,
          totalBlogs: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blogs'
    });
  }
});

// Get single published blog by slug (public)
router.get('/blogs/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ 
      slug: req.params.slug, 
      status: 'published' 
    });
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Increment views
    await blog.incrementViews();

    res.json({
      success: true,
      data: blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog'
    });
  }
});

// Get all available tags (public)
router.get('/blogs/tags/list', async (req, res) => {
  try {
    const tags = await Blog.distinct('tags', { status: 'published' });
    
    res.json({
      success: true,
      data: tags.sort()
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags'
    });
  }
});

module.exports = router;
