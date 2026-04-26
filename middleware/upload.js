const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const streamifier = require("streamifier");

// Create upload directories
const uploadsDir = path.join(__dirname, '../public/uploads');
const videosDir = path.join(uploadsDir, 'videos');
const imagesDir = path.join(uploadsDir, 'images');
const marketingDir = path.join(uploadsDir, 'marketing');

[videosDir, imagesDir, marketingDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        // fs.mkdirSync(dir, { recursive: true });
        console.log("");
        
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'bookVideos') {
            cb(null, videosDir);
        } else if (file.fieldname === 'bookImages') {
            cb(null, imagesDir);
        } else if (file.fieldname === 'image') {
            cb(null, marketingDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const prefix = file.fieldname === 'bookVideos' ? 'video-' : 'image-';
        cb(null, prefix + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'bookVideos') {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Not a video file'), false);
        }
    } else if (file.fieldname === 'bookImages' || file.fieldname === 'image') {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image file'), false);
        }
    } else {
        cb(new Error('Invalid field name'), false);
    }
};

const upload = multer({
  storage: multer.memoryStorage(), // ✅ NO local storage
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // max 100MB (adjust if needed)
  }
});

// Cloudinary upload functions
const uploadImageToCloudinary = (fileBuffer, folder = "ecommerce/images") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id
        });
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

const uploadVideoToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ecommerce/videos",
        resource_type: "video"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          duration: result.duration
        });
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

const uploadBlogImageToCloudinary = async (filePath, imageType = 'main') => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'image',
            folder: `ecommerce/blogs/${imageType}`,
            transformation: [
                { width: 1200, height: 630, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        });
        return result.secure_url;
    } catch (error) {
        throw new Error('Failed to upload blog image to Cloudinary: ' + error.message);
    }
};

module.exports = { 
    upload, 
    uploadImageToCloudinary,
    uploadVideoToCloudinary,
    uploadBlogImageToCloudinary
};
