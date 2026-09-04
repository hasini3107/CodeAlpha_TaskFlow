const mongoose = require("mongoose");
const Invitation = require("../models/Invitation");
const Project = require("../models/Project");
const { emitToProject, emitToUser } = require("../realtime/socket");
const recordActivity = require("../services/activityService");

const invitationQueryFor = (user) => ({ status: "pending", $or: [{ invitee: user._id }, { email: user.email.toLowerCase() }] });

const listInvitations = async (req, res, next) => {
  try {
    const invitations = await Invitation.find(invitationQueryFor(req.user))
      .populate("project", "name description coverImage status")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });
    return res.json({ success: true, invitations: invitations.filter((item) => item.project) });
  } catch (error) { return next(error); }
};

const respondToInvitation = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Invitation not found" });
    const response = req.body.response;
    if (!["accepted", "declined"].includes(response)) return res.status(400).json({ success: false, message: "Choose accept or decline" });
    const invitation = await Invitation.findOne({ _id: req.params.id, ...invitationQueryFor(req.user) }).populate("project").populate("invitedBy", "name email");
    if (!invitation || !invitation.project) return res.status(404).json({ success: false, message: "Invitation not found or no longer available" });

    if (response === "accepted") {
      const project = invitation.project;
      if (!project.members.some((member) => member.user.equals(req.user._id)) && !project.owner.equals(req.user._id)) {
        project.members.push({ user: req.user._id, role: "member" });
        await project.save();
        const addedMember = project.members[project.members.length - 1];
        const member = { _id: addedMember._id, user: { id: req.user._id, name: req.user.name, email: req.user.email }, role: "member", addedAt: addedMember.addedAt };
        emitToProject(project._id, "member:added", { member });
        await recordActivity({ project: project._id, actor: req.user._id, type: "member-added", message: `${req.user.name} accepted the project invitation`, entityId: req.user._id });
      }
    }

    invitation.status = response;
    invitation.invitee = req.user._id;
    invitation.respondedAt = new Date();
    await invitation.save();
    emitToUser(req.user._id, "invitation:updated", { invitationId: invitation._id, status: response });
    emitToUser(invitation.invitedBy._id, "invitation:responded", { invitationId: invitation._id, status: response, user: { name: req.user.name, email: req.user.email } });
    return res.json({ success: true, status: response, projectId: response === "accepted" ? invitation.project._id : null });
  } catch (error) { return next(error); }
};

module.exports = { listInvitations, respondToInvitation };
