const mongoose = require("mongoose");
const Project = require("../models/Project");

const accessQuery = (userId) => ({
  $or: [{ owner: userId }, { "members.user": userId }],
});

const findAccessibleProject = (projectId, userId) => {
  if (!mongoose.isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, ...accessQuery(userId) });
};

const objectIdString = (value) => (value?._id || value).toString();

const isProjectOwner = (project, userId) => objectIdString(project.owner) === objectIdString(userId);

const projectUserIds = (project) => [
  objectIdString(project.owner),
  ...project.members.map((member) => objectIdString(member.user)),
];

module.exports = { accessQuery, findAccessibleProject, isProjectOwner, projectUserIds };
