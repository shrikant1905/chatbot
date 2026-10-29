import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { config } from '../config/index.js';

// Ensure uploads directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  // Audio
  '.mp3', '.wav', '.ogg', '.m4a', '.webm',
  // Video
  '.mp4', '.mov', '.mkv',
  // Documents
  '.pdf', '.txt', '.md', '.json', '.csv'
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'application/pdf', 'text/', 'application/json'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
    const randomHex = crypto.randomBytes(12).toString('hex');
    const safeName = `${Date.now()}-${randomHex}${safeExt}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const rawExt = path.extname(file.originalname).toLowerCase();

  // Block dangerous executable extensions
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.mjs', '.vbs', '.scr'];
  if (blockedExtensions.includes(rawExt)) {
    return cb(new Error(`File type '${rawExt}' is forbidden for security.`), false);
  }

  // Validate allowed extension
  if (!ALLOWED_EXTENSIONS.has(rawExt)) {
    return cb(new Error(`Unsupported file extension: '${rawExt}'. Supported types: images, audio, video, PDF, text.`), false);
  }

  // Validate MIME type prefix
  const isValidMime = ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
  if (!isValidMime) {
    return cb(new Error(`Invalid or untrusted MIME type: '${file.mimetype}'.`), false);
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSizeMb * 1024 * 1024
  },
  fileFilter
});

