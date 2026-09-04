const mongoose = require("mongoose");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Invitation = require("../models/Invitation");
const { accessQuery, findAccessibleProject, isProjectOwner } = require("../utils/projectAccess");
const recordActivity = require("../services/activityService");
const { deleteStoredFile } = require("../utils/storedFile");

const allowedStatuses = new Set(["active", "on-hold", "completed"]);

const projectInput = (body, partial = false) => {
  const input = {};
  if (!partial || body.name !== undefined) input.name = typeof body.name === "string" ? body.name.trim() : "";
  if (!partial || body.description !== undefined) input.description = typeof body.description === "string" ? body.description.trim() : "";
  if (!partial || body.status !== undefined) input.status = body.status || "active";
  if (!partial || body.dueDate !== undefined) input.dueDate = body.dueDate || null;
  return input;
};

const validateProject = (input) => {
  if (input.name !== undefined && (input.name.length < 2 || input.name.length > 100)) return "Project name must be between 2 and 100 characters";
  if (input.description !== undefined && input.description.length > 500) return "Description cannot exceed 500 characters";
  if (input.status !== undefined && !allowedStatuses.has(input.status)) return "Choose a valid project status";
  if (input.dueDate && Number.isNaN(new Date(input.dueDate).getTime())) return "Choose a valid due date";
  return null;
};

const listProjects = async (req, res, next) => {
  try {
    const projects = await Project.find(accessQuery(req.user._id)).populate("owner", "name email").populate("members.user", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, projects });
  } catch (error) { return next(error); }
};

const createProject = async (req, res, next) => {
  try {
    const input = projectInput(req.body);
    const validationError = validateProject(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const project = await Project.create({ ...input, owner: req.user._id });
    return res.status(201).json({ success: true, project });
  } catch (error) { return next(error); }
};

const getProject = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    return res.json({ success: true, project });
  } catch (error) { return next(error); }
};

const updateProject = async (req, res, next) => {
  try {
    const input = projectInput(req.body, true);
    const validationError = validateProject(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    Object.assign(project, input);
    await project.save();
    await recordActivity({ project: project._id, actor: req.user._id, type: "project-updated", message: `updated project “${project.name}”`, entityId: project._id });
    return res.json({ success: true, project });
  } catch (error) { return next(error); }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    if (!isProjectOwner(project, req.user._id)) return res.status(403).json({ success: false, message: "Only the project owner can delete this project" });
    const projectTasks = await Task.find({ project: project._id });
    await Promise.all([
      deleteStoredFile(project.coverImage),
      ...project.attachments.map((attachment) => deleteStoredFile(attachment.url)),
      ...projectTasks.flatMap((task) => task.attachments.map((attachment) => deleteStoredFile(attachment.url))),
    ]);
    await Task.deleteMany({ project: project._id });
    await Activity.deleteMany({ project: project._id });
    await Invitation.deleteMany({ project: project._id });
    await project.deleteOne();
    return res.json({ success: true, message: "Project deleted" });
  } catch (error) { return next(error); }
};

module.exports = { listProjects, createProject, getProject, updateProject, deleteProject };
