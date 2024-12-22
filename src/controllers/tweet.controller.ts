import { NextFunction, Request, Response } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import ErrorHandler from "../utils/ErrorHandler";
import { StatusCodes } from "http-status-codes";
import Tweet from "../models/Tweet.model";
import APIResponse from "../utils/APIResponse";
import mongoose, { isValidObjectId } from "mongoose";

export const createTweet = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body as { content: string };

    if (!content || !content.trim().length) {
      return next(
        new ErrorHandler(
          "Content is required to create a Tweet",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const tweet = await Tweet.create({
      owner: req.user?._id,
      content,
    });

    if (!tweet) {
      return next(
        new ErrorHandler(
          "Failed to create Tweet! Please try after some time.",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(StatusCodes.OK, "Tweet created Successfully", tweet)
      );
  }
);

export const updateTweet = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { tweetId } = req.params as { tweetId: string };
    const { content } = req.body as { content: string };

    if (!isValidObjectId(tweetId)) {
      return next(new ErrorHandler("Invalid Tweet", StatusCodes.BAD_REQUEST));
    }

    if (!content || !content.trim().length) {
      return next(
        new ErrorHandler(
          "Content is required to create a Tweet",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const existingTweet = await Tweet.findById(tweetId);
    if (!existingTweet) {
      return next(
        new ErrorHandler("Tweet does not exists!", StatusCodes.BAD_REQUEST)
      );
    }
    if (existingTweet?.owner.toString() !== req.user?._id!.toString()) {
      return next(new ErrorHandler("Unauthorized!", StatusCodes.UNAUTHORIZED));
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        $set: {
          content,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedTweet) {
      return next(
        new ErrorHandler(
          "Failed to update Tweet! Please try after some time",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Tweet updated Successfully.",
          updatedTweet
        )
      );
  }
);

export const deleteTweet = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { tweetId } = req.params as { tweetId: string };

    if (!isValidObjectId(tweetId)) {
      return next(
        new ErrorHandler("Tweet is not valid!", StatusCodes.BAD_REQUEST)
      );
    }

    const existingTweet = await Tweet.findById(tweetId);
    if (!existingTweet) {
      return next(
        new ErrorHandler("Tweet does not exists!", StatusCodes.BAD_REQUEST)
      );
    }
    if (existingTweet?.owner.toString() !== req.user?._id!.toString()) {
      return next(new ErrorHandler("Unauthorized!", StatusCodes.UNAUTHORIZED));
    }

    await Tweet.findByIdAndDelete(tweetId);

    res
      .status(StatusCodes.OK)
      .json(new APIResponse(StatusCodes.OK, "Tweet deleted successfully"));
  }
);

export const getUserTweets = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params as { userId: string };
    const { limit = 10, page = 1 } = req.query as unknown as {
      limit: number;
      page: number;
    };

    if (!isValidObjectId(userId)) {
      return next(
        new ErrorHandler("User is not valid", StatusCodes.BAD_REQUEST)
      );
    }

    const userTweetAggregate = Tweet.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId as string),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $addFields: {
                avatar: "$avatar.url",
              },
            },
            {
              $project: {
                email: 0,
                watchHistory: 0,
                password: 0,
                refreshToken: 0,
                coverImage: 0,
              },
            },
          ],
        },
      },
      {
        $unwind: "$owner",
      },

      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "likes",
        },
      },

      {
        $addFields: {
          likeCount: {
            $size: "$likes",
          },
          isLiked: {
            $cond: {
              if: {
                $in: [
                  new mongoose.Types.ObjectId(req.user?._id as string),
                  "$likes.likedBy",
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    const userTweets = await Tweet.aggregatePaginate(userTweetAggregate, {
      page,
      limit,
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Tweets fetched successfully",
          userTweets
        )
      );
  }
);
