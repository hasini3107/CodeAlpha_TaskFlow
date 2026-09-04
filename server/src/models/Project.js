const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["active", "on-hold", "completed"], default: "active" },
    dueDate: { type: Date, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coverImage: { type: String, default: "" },
    attachments: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
    members: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["member"], default: "member" },
      addedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ "members.user": 1, createdAt: -1 });

module.exports = mongoose.model("Project", projectSchema);
