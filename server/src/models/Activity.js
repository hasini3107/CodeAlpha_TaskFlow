const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["task-created", "task-updated", "task-deleted", "member-added", "member-removed", "project-updated"],
      required: true,
    },
    message: { type: String, required: true, maxlength: 240 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

activitySchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);
