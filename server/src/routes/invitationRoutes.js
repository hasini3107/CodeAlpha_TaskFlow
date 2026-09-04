const express = require("express");
const requireAuth = require("../middleware/auth");
const { listInvitations, respondToInvitation } = require("../controllers/invitationController");

const router = express.Router();
router.use(requireAuth);
router.get("/", listInvitations);
router.patch("/:id", respondToInvitation);

module.exports = router;
