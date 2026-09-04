const mongoose = require("mongoose");
const Project = require("../models/Project");
const Task = require("../models/Task");
const { findAccessibleProject, projectUserIds } = require("../utils/projectAccess");
const { emitToProject } = require("../realtime/socket");
const recordActivity = require("../services/activityService");
const { deleteStoredFile } = require("../utils/storedFile");

const statuses = new Set(["todo", "in-progress", "done"]);
const priorities = new Set(["low", "medium", "high"]);

const taskInput = (body, partial = false) => {
  const input = {};
  if (!partial || body.title !== undefined) input.title = typeof body.title === "string" ? body.title.trim() : "";
  if (!partial || body.description !== undefined) input.description = typeof body.description === "string" ? body.description.trim() : "";
  if (!partial || body.status !== undefined) input.status = body.status || "todo";
  if (!partial || body.priority !== undefined) input.priority = body.priority || "medium";
  if (!partial || body.dueDate !== undefined) input.dueDate = body.dueDate || null;
  if (!partial || body.assignee !== undefined) input.assignee = body.assignee || null;
  return input;
};

const validateTask = (input) => {
  if (input.title !== undefined && (input.title.length < 2 || input.title.length > 120)) return "Task title must be between 2 and 120 characters";
  if (input.description !== undefined && input.description.length > 500) return "Description cannot exceed 500 characters";
  if (input.status !== undefined && !statuses.has(input.status)) return "Choose a valid task status";
  if (input.priority !== undefined && !priorities.has(input.priority)) return "Choose a valid priority";
  if (input.dueDate && Number.isNaN(new Date(input.dueDate).getTime())) return "Choose a valid due date";
  if (input.assignee && !mongoose.isValidObjectId(input.assignee)) return "Choose a valid assignee";
  return null;
};

const assigneeBelongsToProject = (project, assignee) => !assignee || projectUserIds(project).includes(assignee.toString());

const listTasks = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const tasks = await Task.find({ project: project._id }).populate("assignee", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, tasks });
  } catch (error) { return next(error); }
};

const createTask = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const input = taskInput(req.body);
    const validationError = validateTask(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (!assigneeBelongsToProject(project, input.assignee)) return res.status(400).json({ success: false, message: "Assignee must belong to this project" });
    const task = await Task.create({ ...input, project: req.params.projectId, owner: req.user._id });
    await task.populate("assignee", "name email");
    emitToProject(project._id, "task:created", { task });
    await recordActivity({ project: project._id, actor: req.user._id, type: "task-created", message: `created “${task.title}”`, entityId: task._id });
    return res.status(201).json({ success: true, task });
  } catch (error) { return next(error); }
};

const updateTask = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Task not found" });
    const input = taskInput(req.body, true);
    const validationError = validateTask(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    const project = await findAccessibleProject(task.project, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Task not found" });
    if (!assigneeBelongsToProject(project, input.assignee)) return res.status(400).json({ success: false, message: "Assignee must belong to this project" });
    Object.assign(task, input);
    await task.save();
    await task.populate("assignee", "name email");
    emitToProject(project._id, "task:updated", { task });
    await recordActivity({ project: project._id, actor: req.user._id, type: "task-updated", message: `updated “${task.title}”`, entityId: task._id });
    return res.json({ success: true, task });
  } catch (error) { return next(error); }
};

const deleteTask = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Task not found" });
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    const project = await findAccessibleProject(task.project, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Task not found" });
    await Promise.all(task.attachments.map((attachment) => deleteStoredFile(attachment.url)));
    await task.deleteOne();
    emitToProject(project._id, "task:deleted", { taskId: task._id.toString() });
    await recordActivity({ project: project._id, actor: req.user._id, type: "task-deleted", message: `deleted “${task.title}”`, entityId: task._id });
    return res.json({ success: true, message: "Task deleted" });
  } catch (error) { return next(error); }
};

module.exports = { listTasks, createTask, updateTask, deleteTask };
