require("dotenv").config();

const http = require("node:http");
const app = require("./app");
const connectDB = require("./config/db");
const { initializeSocket } = require("./realtime/socket");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const httpServer = http.createServer(app);
    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`TaskFlow server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
