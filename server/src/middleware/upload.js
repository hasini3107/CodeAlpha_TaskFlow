const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");

const uploadDirectory = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, done) => done(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extensions[file.mimetype] || ""}`),
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) => {
    if (!extensions[file.mimetype]) {
      const error = new Error("Only JPG, PNG, WebP, and GIF images are allowed");
      error.statusCode = 400;
      return done(error);
    }
    return done(null, true);
  },
});

module.exports = { imageUpload, uploadDirectory };
