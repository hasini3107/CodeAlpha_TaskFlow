const mongoose = require("mongoose");
const Task = require("../models/Task");
const { findAccessibleProject } = require("../utils/projectAccess");
const { uploadedFileData, deleteStoredFile } = require("../utils/storedFile");
const { emitToProject } = require("../realtime/socket");
const recordActivity = require("../services/activityService");

const requireFile = (req, res) => {
  if (req.file) return true;
  res.status(400).json({ success: false, message: "Choose an image to upload" });
  return false;
};

const uploadProjectCover = async (req, res, next) => {
  try {
    if (!requireFile(req, res)) return;
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project) { await deleteStoredFile(`/uploads/${req.file.filename}`); return res.status(404).json({ success: false, message: "Project not found" }); }
    await deleteStoredFile(project.coverImage);
    project.coverImage = `/uploads/${req.file.filename}`;
    await project.save();
    return res.json({ success: true, coverImage: project.coverImage });
  } catch (error) { return next(error); }
};

const addProjectAttachment = async (req, res, next) => {
  try {
    if (!requireFile(req, res)) return;
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project) { await deleteStoredFile(`/uploads/${req.file.filename}`); return res.status(404).json({ success: false, message: "Project not found" }); }
    project.attachments.push(uploadedFileData(req.file));
    await project.save();
    const attachment = project.attachments[project.attachments.length - 1];
    await recordActivity({ project: project._id, actor: req.user._id, type: "project-updated", message: `added project image “${attachment.name}”`, entityId: project._id });
    return res.status(201).json({ success: true, attachment });
  } catch (error) { return next(error); }
};

const removeProjectAttachment = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project || !mongoose.isValidObjectId(req.params.attachmentId)) return res.status(404).json({ success: false, message: "Image not found" });
    const attachment = project.attachments.id(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ success: false, message: "Image not found" });
    await deleteStoredFile(attachment.url);
    attachment.deleteOne();
    await project.save();
    return res.json({ success: true, message: "Image removed" });
  } catch (error) { return next(error); }
};

const findAccessibleTask = async (taskId, userId) => {
  if (!mongoose.isValidObjectId(taskId)) return null;
  const task = await Task.findById(taskId);
  if (!task || !(await findAccessibleProject(task.project, userId))) return null;
  return task;
};

const addTaskAttachment = async (req, res, next) => {
  try {
    if (!requireFile(req, res)) return;
    const task = await findAccessibleTask(req.params.id, req.user._id);
    if (!task) { await deleteStoredFile(`/uploads/${req.file.filename}`); return res.status(404).json({ success: false, message: "Task not found" }); }
    task.attachments.push(uploadedFileData(req.file));
    await task.save();
    await task.populate("assignee", "name email");
    const attachment = task.attachments[task.attachments.length - 1];
    emitToProject(task.project, "task:updated", { task });
    await recordActivity({ project: task.project, actor: req.user._id, type: "task-updated", message: `attached an image to “${task.title}”`, entityId: task._id });
    return res.status(201).json({ success: true, task, attachment });
  } catch (error) { return next(error); }
};

const removeTaskAttachment = async (req, res, next) => {
  try {
    const task = await findAccessibleTask(req.params.id, req.user._id);
    if (!task || !mongoose.isValidObjectId(req.params.attachmentId)) return res.status(404).json({ success: false, message: "Image not found" });
    const attachment = task.attachments.id(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ success: false, message: "Image not found" });
    await deleteStoredFile(attachment.url);
    attachment.deleteOne();
    await task.save();
    await task.populate("assignee", "name email");
    emitToProject(task.project, "task:updated", { task });
    return res.json({ success: true, task });
  } catch (error) { return next(error); }
};

module.exports = { uploadProjectCover, addProjectAttachment, removeProjectAttachment, addTaskAttachment, removeTaskAttachment };
