const express = require("express");
const requireAuth = require("../middleware/auth");
const { listProjects, createProject, getProject, updateProject, deleteProject } = require("../controllers/projectController");
const { listMembers, addMember, removeMember } = require("../controllers/memberController");
const { listActivity } = require("../controllers/activityController");
const { imageUpload } = require("../middleware/upload");
const { uploadProjectCover, addProjectAttachment, removeProjectAttachment } = require("../controllers/mediaController");

const router = express.Router();
router.use(requireAuth);
router.route("/").get(listProjects).post(createProject);
router.route("/:id").get(getProject).patch(updateProject).delete(deleteProject);
router.route("/:id/members").get(listMembers).post(addMember);
router.delete("/:id/members/:userId", removeMember);
router.get("/:id/activity", listActivity);
router.post("/:id/cover", imageUpload.single("image"), uploadProjectCover);
router.post("/:id/attachments", imageUpload.single("image"), addProjectAttachment);
router.delete("/:id/attachments/:attachmentId", removeProjectAttachment);

module.exports = router;
