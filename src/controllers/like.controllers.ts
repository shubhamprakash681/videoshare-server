import { NextFunction, Request, Response } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import mongoose, { isValidObjectId } from "mongoose";
import ErrorHandler from "../utils/ErrorHandler";
import { StatusCodes } from "http-status-codes";
import Like from "../models/Like.model";
import APIResponse from "../utils/APIResponse";
import Video from "../models/Video.model";
import Comment from "../models/Comment.model";
import Tweet from "../models/Tweet.model";

export const toggleVideoLike = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };
    const { likeType } = req.query as {
      likeType: "like" | "dislike" | "delete";
    };

    if (!["like", "dislike", "delete"].includes(likeType)) {
      return next(
        new ErrorHandler(
          "Invalid likeType! It should be either 'like', 'dislike' or 'delete'",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (!isValidObjectId(videoId)) {
      return next(
        new ErrorHandler("VideoId is Invalid!", StatusCodes.BAD_REQUEST)
      );
    }

    const isLikedAlready = await Like.findOne({
      video: videoId,
      likedBy: req.user?._id,
    });
    if (isLikedAlready) {
      if (likeType === "delete") {
        await Like.findByIdAndDelete(isLikedAlready._id);

        return res
          .status(StatusCodes.OK)
          .json(
            new APIResponse(
              StatusCodes.OK,
              `Video removed from your ${
                isLikedAlready.likeType === "like" ? "Like" : "Dislike"
              } List`
            )
          );
      } else {
        await Like.findByIdAndUpdate(isLikedAlready._id, {
          likeType,
        });

        return res
          .status(StatusCodes.OK)
          .json(
            new APIResponse(
              StatusCodes.OK,
              `Video ${likeType === "like" ? "Liked" : "Disliked"} Successfully`
            )
          );
      }
    }

    const doesVideoExists = await Video.findById(videoId);
    if (!doesVideoExists) {
      return next(
        new ErrorHandler(
          "Video does not exists anymore!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (likeType === "delete") {
      return next(
        new ErrorHandler(
          "You can't delete a like that you haven't made!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    await Like.create({
      video: videoId,
      likedBy: req.user?._id,
      likeType: likeType === "dislike" ? "dislike" : "like",
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          `Video ${likeType === "dislike" ? "Disliked" : "Liked"} Successfully`
        )
      );
  }
);

export const toggleCommentLike = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { commentId } = req.params as { commentId: string };
    const { likeType } = req.query as {
      likeType: "like" | "dislike" | "delete";
    };

    if (!["like", "dislike", "delete"].includes(likeType)) {
      return next(
        new ErrorHandler(
          "Invalid likeType! It should be either 'like', 'dislike' or 'delete'",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (!isValidObjectId(commentId)) {
      return next(
        new ErrorHandler("Comment is Invalid!", StatusCodes.BAD_REQUEST)
      );
    }

    const isLikedAlready = await Like.findOne({
      comment: commentId,
      likedBy: req.user?._id,
    });
    if (isLikedAlready) {
      if (likeType === "delete") {
        await Like.findByIdAndDelete(isLikedAlready._id);

        return res
          .status(StatusCodes.OK)
          .json(
            new APIResponse(
              StatusCodes.OK,
              `Comment removed from your ${
                isLikedAlready.likeType === "like" ? "Like" : "Dislike"
              } List`
            )
          );
      } else {
        await Like.findByIdAndUpdate(isLikedAlready._id, {
          likeType,
        });

        return res
          .status(StatusCodes.OK)
          .json(
            new APIResponse(
              StatusCodes.OK,
              `Comment ${
                likeType === "like" ? "Liked" : "Disliked"
              } Successfully`
            )
          );
      }
    }

    const doesCommentExists = await Comment.findById(commentId);
    if (!doesCommentExists) {
      return next(
        new ErrorHandler(
          "Comment does not exists anymore!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (likeType === "delete") {
      return next(
        new ErrorHandler(
          "You can't delete a like that you haven't made!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    await Like.create({
      comment: commentId,
      likedBy: req.user?._id,
      likeType: likeType === "dislike" ? "dislike" : "like",
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          `Comment ${
            likeType === "dislike" ? "Disliked" : "Liked"
          } Successfully`
        )
      );
  }
);

export const toggleTweetLike = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { tweetId } = req.params as { tweetId: string };
    const { likeType } = req.query as {
      likeType: "like" | "dislike" | "delete";
    };

    if (!["like", "dislike", "delete"].includes(likeType)) {
      return next(
        new ErrorHandler(
          "Invalid likeType! It should be either 'like', 'dislike' or 'delete'",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (!isValidObjectId(tweetId)) {
      return next(
        new ErrorHandler("Tweet is Invalid!", StatusCodes.BAD_REQUEST)
      );
    }

    const isLikedAlready = await Like.findOne({
      tweet: tweetId,
      likedBy: req.user?._id,
    });
    if (isLikedAlready) {
      if (likeType === "delete") {
        await Like.findByIdAndDelete(isLikedAlready._id);

        return res
          .status(StatusCodes.OK)
          .json(
            new APIResponse(
              StatusCodes.OK,
              `Tweet removed from your ${
                isLikedAlready.likeType === "like" ? "Like" : "Dislike"
              } List`
            )
          );
      } else {
        await Like.findByIdAndUpdate(isLikedAlready._id, {
          likeType,
        });

        return res
          .status(StatusCodes.OK)
          .json(
            new APIResponse(
              StatusCodes.OK,
              `Tweet ${likeType === "like" ? "Liked" : "Disliked"} Successfully`
            )
          );
      }
    }

    const doesTweetExists = await Tweet.findById(tweetId);
    if (!doesTweetExists) {
      return next(
        new ErrorHandler(
          "Tweet does not exists anymore!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (likeType === "delete") {
      return next(
        new ErrorHandler(
          "You can't delete a like that you haven't made!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    await Like.create({
      tweet: tweetId,
      likedBy: req.user?._id,
      likeType: likeType === "dislike" ? "dislike" : "like",
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          `Tweet ${likeType === "dislike" ? "Disliked" : "Liked"} Successfully`
        )
      );
  }
);

export const getLikedVideos = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    const { page = 1, limit = 10 } = req.query as unknown as {
      page: number;
      limit: number;
    };

    const likedVideosAggregate = Like.aggregate([
      {
        $match: {
          likedBy: new mongoose.Types.ObjectId(userId as string),
          likeType: "like",
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "video",
          // pipeline for populating owner's data of videos
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullname: 1,
                      username: 1,
                      avatar: "$avatar.url",
                    },
                  },
                ],
              },
            },
            {
              $unwind: "$owner",
            },
          ],
        },
      },
      {
        $unwind: "$video",
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          "video.owner": {
            refreshToken: 0,
            email: 0,
            coverImage: 0,
            watchHistory: 0,
            password: 0,
            "avatar.public_id": 0,
          },
        },
      },
    ]);
    const likedVideos = await Like.aggregatePaginate(likedVideosAggregate, {
      page,
      limit,
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Liked videos fetched successfully",
          likedVideos
        )
      );
  }
);
