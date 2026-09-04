const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const path = require("node:path");
const fs = require("node:fs");
const { uploadDirectory } = require("./middleware/upload");

const app = express();
const clientUrl = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
const clientDirectory = path.resolve(__dirname, "../../client/dist");

app.use(cors({ origin: clientUrl }));
app.use(express.json());
app.use("/uploads", express.static(uploadDirectory, { maxAge: "1d", immutable: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "TaskFlow API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api", taskRoutes);

if (fs.existsSync(clientDirectory)) {
  app.use(express.static(clientDirectory));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
      return next();
    }
    return res.sendFile(path.join(clientDirectory, "index.html"));
  });
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((error, req, res, next) => {
  if (error.name === "MulterError") {
    return res.status(400).json({ success: false, message: error.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : "Image upload failed" });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "An account with this email already exists" });
  }

  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Something went wrong on the server",
  });
});

module.exports = app;
