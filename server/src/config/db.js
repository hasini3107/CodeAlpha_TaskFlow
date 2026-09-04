const mongoose = require("mongoose");
const dns = require("node:dns");

const configureDns = () => {
  const configuredServers = process.env.DNS_SERVERS
    ? process.env.DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean)
    : [];

  if (configuredServers.length > 0) {
    dns.setServers(configuredServers);
    return;
  }

  // Some Windows/ISP resolvers refuse the SRV lookup required by MongoDB Atlas.
  if (process.platform === "win32") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from the .env file");
  }

  configureDns();

  const connection = await mongoose.connect(mongoUri);

  console.log(`MongoDB connected: ${connection.connection.host}`);
};

module.exports = connectDB;
