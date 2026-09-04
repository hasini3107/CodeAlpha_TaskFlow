const Activity = require("../models/Activity");
const { emitToProject } = require("../realtime/socket");

const recordActivity = async ({ project, actor, type, message, entityId = null }) => {
  const activity = await Activity.create({ project, actor, type, message, entityId });
  await activity.populate("actor", "name email");
  emitToProject(project, "activity:created", { activity });
  return activity;
};

module.exports = recordActivity;
