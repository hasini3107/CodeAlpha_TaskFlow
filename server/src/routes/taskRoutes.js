const express = require("express");
const requireAuth = require("../middleware/auth");
const { listTasks, createTask, updateTask, deleteTask } = require("../controllers/taskController");
const { imageUpload } = require("../middleware/upload");
const { addTaskAttachment, removeTaskAttachment } = require("../controllers/mediaController");

const router = express.Router();
router.use(requireAuth);
router.route("/projects/:projectId/tasks").get(listTasks).post(createTask);
router.route("/tasks/:id").patch(updateTask).delete(deleteTask);
router.post("/tasks/:id/attachments", imageUpload.single("image"), addTaskAttachment);
router.delete("/tasks/:id/attachments/:attachmentId", removeTaskAttachment);

module.exports = router;
