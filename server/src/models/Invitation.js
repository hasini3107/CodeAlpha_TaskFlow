const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invitee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "cancelled"], default: "pending", index: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

invitationSchema.index({ project: 1, email: 1, status: 1 });

module.exports = mongoose.model("Invitation", invitationSchema);
