const mongoose = require("mongoose");
const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const Invitation = require("../models/Invitation");
const { isProjectOwner } = require("../utils/projectAccess");
const { emitToProject, emitToUser, evictUserFromProject } = require("../realtime/socket");
const recordActivity = require("../services/activityService");
const { sendProjectInvitationEmail } = require("../services/emailService");

const findOwnedProject = (projectId, owner) => {
  if (!mongoose.isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, owner });
};

const listMembers = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({
      _id: req.params.id,
      $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
    }).populate("owner", "name email").populate("members.user", "name email");
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const canManage = isProjectOwner(project, req.user._id);
    const pendingInvitations = canManage ? await Invitation.find({ project: project._id, status: "pending" }).select("email createdAt") : [];
    return res.json({ success: true, owner: project.owner, members: project.members, pendingInvitations, canManage });
  } catch (error) { return next(error); }
};

const addMember = async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found or owner access required" });
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) return res.status(400).json({ success: false, message: "Member email is required" });
    const user = await User.findOne({ email });
    if (user?._id.equals(project.owner) || email === req.user.email) return res.status(400).json({ success: false, message: "The project owner is already part of this project" });
    if (user && project.members.some((member) => member.user.equals(user._id))) return res.status(409).json({ success: false, message: "This user is already a project member" });
    const existing = await Invitation.findOne({ project: project._id, email, status: "pending" });
    if (existing) {
      const notification = { _id: existing._id, project: { _id: project._id, name: project.name, description: project.description }, invitedBy: { _id: req.user._id, name: req.user.name, email: req.user.email }, email, status: "pending", createdAt: existing.createdAt };
      if (user) emitToUser(user._id, "invitation:created", { invitation: notification });
      const emailResult = await sendProjectInvitationEmail({ to: email, inviterName: req.user.name, projectName: project.name, invitationId: existing._id }).catch((error) => {
        console.error(`Invitation email failed: ${error.message}`);
        return { sent: false };
      });
      return res.json({ success: true, invitation: { _id: existing._id, email, createdAt: existing.createdAt }, message: emailResult.sent ? "Invitation notification and email resent." : "In-app invitation resent. Email was skipped because SMTP is not configured." });
    }
    const invitation = await Invitation.create({ project: project._id, invitedBy: req.user._id, invitee: user?._id || null, email });
    const notification = { _id: invitation._id, project: { _id: project._id, name: project.name, description: project.description }, invitedBy: { _id: req.user._id, name: req.user.name, email: req.user.email }, email, status: "pending", createdAt: invitation.createdAt };
    if (user) emitToUser(user._id, "invitation:created", { invitation: notification });
    const emailResult = await sendProjectInvitationEmail({ to: email, inviterName: req.user.name, projectName: project.name, invitationId: invitation._id }).catch((error) => {
      console.error(`Invitation email failed: ${error.message}`);
      return { sent: false };
    });
    const accountMessage = user ? "They can accept it from TaskFlow notifications." : "It will appear when this email creates a TaskFlow account.";
    const deliveryMessage = emailResult.sent ? " An email was also sent." : "";
    return res.status(201).json({ success: true, invitation: { _id: invitation._id, email, createdAt: invitation.createdAt }, message: `Invitation created. ${accountMessage}${deliveryMessage}` });
  } catch (error) { return next(error); }
};

const removeMember = async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found or owner access required" });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ success: false, message: "Member not found" });
    const before = project.members.length;
    project.members = project.members.filter((member) => !member.user.equals(req.params.userId));
    if (project.members.length === before) return res.status(404).json({ success: false, message: "Member not found" });
    await project.save();
    await Task.updateMany({ project: project._id, assignee: req.params.userId }, { $set: { assignee: null } });
    emitToProject(project._id, "member:removed", { userId: req.params.userId });
    await recordActivity({ project: project._id, actor: req.user._id, type: "member-removed", message: "removed a member from the project", entityId: req.params.userId });
    await evictUserFromProject(project._id, req.params.userId);
    return res.json({ success: true, message: "Member removed" });
  } catch (error) { return next(error); }
};

module.exports = { listMembers, addMember, removeMember };
