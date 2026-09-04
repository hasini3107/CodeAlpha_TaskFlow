const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { findAccessibleProject } = require("../utils/projectAccess");

let io;

const projectRoom = (projectId) => `project:${projectId}`;
const userRoom = (userId) => `user:${userId}`;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173" },
  });

  io.use(async (socket, next) => {
    try {
      if (!process.env.JWT_SECRET) return next(new Error("Server authentication is not configured"));
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication is required"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error("Account not found"));
      if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) return next(new Error("Your session is invalid or has expired"));
      socket.user = user;
      socket.data.userId = user._id.toString();
      return next();
    } catch {
      return next(new Error("Your session is invalid or has expired"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.userId));
    socket.on("join-project", async (projectId, acknowledge = () => {}) => {
      try {
        const project = await findAccessibleProject(projectId, socket.user._id);
        if (!project) return acknowledge({ success: false, message: "Project access denied" });
        await socket.join(projectRoom(project._id));
        return acknowledge({ success: true });
      } catch {
        return acknowledge({ success: false, message: "Could not join the project room" });
      }
    });

    socket.on("leave-project", (projectId) => {
      socket.leave(projectRoom(projectId));
    });
  });

  return io;
};

const emitToProject = (projectId, event, payload) => {
  if (io) io.to(projectRoom(projectId)).emit(event, payload);
};

const emitToUser = (userId, event, payload) => {
  if (io) io.to(userRoom(userId)).emit(event, payload);
};

const evictUserFromProject = async (projectId, userId) => {
  if (!io) return;
  const sockets = await io.in(projectRoom(projectId)).fetchSockets();
  await Promise.all(sockets
    .filter((socket) => socket.data.userId === userId.toString())
    .map(async (socket) => {
      socket.emit("project:access-revoked", { projectId: projectId.toString() });
      await socket.leave(projectRoom(projectId));
    }));
};

module.exports = { initializeSocket, emitToProject, emitToUser, evictUserFromProject };
