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
userRouter.route("/profile").get(isAuthenticatedUser, getUserProfile);
userRouter.route("/profile").patch(isAuthenticatedUser, updateProfile);
userRouter
  .route("/avatar")
  .patch(
    isAuthenticatedUser,
    uploadFileInServer.single("avatar"),
    updateUserAvatar
  );
userRouter
  .route("/cover-image")
  .patch(
    isAuthenticatedUser,
    uploadFileInServer.single("coverImage"),
    updateUserCoverImage
  );
userRouter.route("/cover-image").delete(isAuthenticatedUser, deleteCoverImage);
userRouter
  .route("/channel/:username")
  .get(isAuthenticatedUser, getUserChannelProfile);
userRouter.route("/watch-history").get(isAuthenticatedUser, getWatchHistory);
userRouter.route("/password/forgot").get(forgotPassword);
userRouter.route("/password/reset/:token").patch(resetPassword);
userRouter.route("/password/update").patch(isAuthenticatedUser, updatePassword);
userRouter.route("/logout").get(isAuthenticatedUser, logoutUser);

export default userRouter;
