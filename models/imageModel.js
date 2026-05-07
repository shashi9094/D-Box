// Example Mongoose schema for storing image metadata (does NOT store binary)
// Usage: const Image = require('./models/imageModel'); await Image.create({ ... })

const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  originalName: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  s3Key: { type: String },
  uploadedBy: { type: Number }, // or String depending on your user id type
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Image || mongoose.model('Image', ImageSchema);
