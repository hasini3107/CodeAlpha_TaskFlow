const fs = require("node:fs/promises");
const path = require("node:path");
const { uploadDirectory } = require("../middleware/upload");

const uploadedFileData = (file) => ({
  name: file.originalname.slice(0, 180),
  url: `/uploads/${file.filename}`,
  mimeType: file.mimetype,
  size: file.size,
});

const deleteStoredFile = async (url) => {
  if (!url || !url.startsWith("/uploads/")) return;
  const target = path.join(uploadDirectory, path.basename(url));
  try { await fs.unlink(target); } catch (error) { if (error.code !== "ENOENT") throw error; }
};

module.exports = { uploadedFileData, deleteStoredFile };
