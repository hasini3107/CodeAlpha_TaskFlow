const Activity = require("../models/Activity");
const { findAccessibleProject } = require("../utils/projectAccess");

const listActivity = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const activity = await Activity.find({ project: project._id })
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ success: true, activity });
  } catch (error) { return next(error); }
};

module.exports = { listActivity };
