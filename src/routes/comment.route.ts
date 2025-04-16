import express from "express";
import {
  addVideoComment,
  deleteComment,
  getAllVideoComments,
  updateComment,
} from "../controllers/comment.controllers";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";

const commentRouter = express.Router();

commentRouter
  .route("/:videoId")
  .post(isAuthenticatedUser, addVideoComment)
  .get(isAuthenticatedUser, getAllVideoComments);
commentRouter
  .route("/:commentId")
  .put(isAuthenticatedUser, updateComment)
  .delete(isAuthenticatedUser, deleteComment);

export default commentRouter;
