import express from "express";
import { uploadFileInServer } from "../middlewares/Multer.middleware";
import {
  deleteCoverImage,
  forgotPassword,
  getUserChannelProfile,
  getUserProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  resetPassword,
  toggleUploadTCAccepted,
  updatePassword,
  updateProfile,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controllers";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";

const userRouter = express.Router();

userRouter.route("/register").post(
  uploadFileInServer.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);
userRouter.route("/login").post(loginUser);
userRouter.route("/refresh-session").post(refreshSession);

// secured user routes
userRouter
  .route("/profile")
  .get(isAuthenticatedUser, getUserProfile)
  .put(isAuthenticatedUser, updateProfile);
userRouter.route("/terms").put(isAuthenticatedUser, toggleUploadTCAccepted);
userRouter
  .route("/avatar")
  .put(
    isAuthenticatedUser,
    uploadFileInServer.single("avatar"),
    updateUserAvatar
  );
userRouter
  .route("/cover-image")
  .put(
    isAuthenticatedUser,
    uploadFileInServer.single("coverImage"),
    updateUserCoverImage
  )
  .delete(isAuthenticatedUser, deleteCoverImage);
userRouter
  .route("/channel/:username")
  .get(isAuthenticatedUser, getUserChannelProfile);
userRouter.route("/watch-history").get(isAuthenticatedUser, getWatchHistory);
userRouter.route("/password/forgot").get(forgotPassword);
userRouter.route("/password/reset/:token").put(resetPassword);
userRouter.route("/password/update").put(isAuthenticatedUser, updatePassword);
userRouter.route("/logout").get(isAuthenticatedUser, logoutUser);

export default userRouter;
