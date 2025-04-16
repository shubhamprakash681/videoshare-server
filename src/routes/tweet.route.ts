import express from "express";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";
import {
  createTweet,
  deleteTweet,
  getUserTweets,
  updateTweet,
} from "../controllers/tweet.controller";

const tweetRouter = express.Router();

tweetRouter.use(isAuthenticatedUser);

tweetRouter.route("/").post(createTweet);
tweetRouter.route("/:tweetId").put(updateTweet).delete(deleteTweet);
tweetRouter.route("/user/:userId").get(getUserTweets);

export default tweetRouter;
