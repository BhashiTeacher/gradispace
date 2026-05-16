const router     = require('express').Router();
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const { requireAuth } = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    }).end(buffer);
  });
}

// POST /api/v1/upload/image
router.post('/image', requireAuth, requirePlan('pro', 'school'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No file uploaded.' });
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'validation_error', message: 'Only JPEG, PNG, GIF, WEBP allowed.' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'validation_error', message: 'Image must be under 5 MB.' });
    }
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `gradispace/${req.teacherId}`,
      resource_type: 'image',
    });
    res.status(201).json({ url: result.secure_url });
  } catch (err) { next(err); }
});

// POST /api/v1/upload/audio
router.post('/audio', requireAuth, requirePlan('pro', 'school'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No file uploaded.' });
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/mp4'];
    if (!allowed.includes(req.file.mimetype) && !req.file.originalname.match(/\.(mp3|wav|m4a)$/i)) {
      return res.status(400).json({ error: 'validation_error', message: 'Only MP3, WAV, M4A allowed.' });
    }
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `gradispace/${req.teacherId}`,
      resource_type: 'video', // Cloudinary uses 'video' type for audio
    });
    res.status(201).json({ url: result.secure_url });
  } catch (err) { next(err); }
});

module.exports = router;
