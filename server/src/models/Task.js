const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    dueDate: { type: Date, default: null },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    attachments: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

taskSchema.index({ project: 1, owner: 1, createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);
