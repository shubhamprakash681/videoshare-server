import express from "express";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";
import {
  deleteVideo,
  getChannelStats,
  getChannelVideos,
  toggleVideoState,
} from "../controllers/dashboard.controllers";

const dashboardRouter = express.Router();

dashboardRouter.route("/stats").get(isAuthenticatedUser, getChannelStats);
dashboardRouter.route("/videos").get(isAuthenticatedUser, getChannelVideos);
dashboardRouter
  .route("/video/:videoId")
  .put(isAuthenticatedUser, toggleVideoState)
  .delete(isAuthenticatedUser, deleteVideo);

export default dashboardRouter;
