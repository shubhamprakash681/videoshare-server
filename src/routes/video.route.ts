import express from "express";
import {
  getAllVideos,
  getVideoLikeData,
  incremenetVideoView,
  updateVideo,
  updateVideoPlaylists,
  uploadVideo,
} from "../controllers/video.controller";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";
import { uploadFileInServer } from "../middlewares/Multer.middleware";

const videoRouter = express.Router();

videoRouter.route("/").get(getAllVideos);
videoRouter.route("/likes/:videoId").get(isAuthenticatedUser, getVideoLikeData);
videoRouter
  .route("/view/:videoId")
  .patch(isAuthenticatedUser, incremenetVideoView);
videoRouter
  .route("/playlist/:videoId")
  .patch(isAuthenticatedUser, updateVideoPlaylists);

videoRouter.route("/upload").post(
  isAuthenticatedUser,
  uploadFileInServer.fields([
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  uploadVideo
);

videoRouter
  .route("/update/:videoId")
  .patch(
    isAuthenticatedUser,
    uploadFileInServer.single("thumbnail"),
    updateVideo
  );

export default videoRouter;
