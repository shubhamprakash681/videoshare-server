import { NextFunction, Request, Response } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import mongoose, { isValidObjectId } from "mongoose";
import ErrorHandler from "../utils/ErrorHandler";
import { StatusCodes } from "http-status-codes";
import Subscription from "../models/Subscription.model";
import APIResponse from "../utils/APIResponse";

export const toggleChannelSubscription = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { channelId } = req.params as { channelId: string };

    if (!isValidObjectId(channelId)) {
      return next(
        new ErrorHandler("Channel is Invalid!", StatusCodes.BAD_REQUEST)
      );
    }

    const isAlreadySubscribed = await Subscription.findOne({
      subscriber: req.user?._id,
      channel: channelId,
    });

    if (isAlreadySubscribed) {
      await Subscription.findByIdAndDelete(isAlreadySubscribed._id);

      return res
        .status(StatusCodes.OK)
        .json(new APIResponse(StatusCodes.OK, "Unsubscribed successfully"));
    }

    await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });

    res
      .status(StatusCodes.OK)
      .json(new APIResponse(StatusCodes.OK, "Subscribed Successfully"));
  }
);

export const getSubscribedChannels = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params as { userId: string };

    const { page = 1, limit = 10 } = req.query as unknown as {
      page: number;
      limit: number;
    };

    if (!isValidObjectId(userId)) {
      return next(new ErrorHandler("Invalid User!", StatusCodes.BAD_REQUEST));
    }

    const subscribedChannelsAggregate = Subscription.aggregate([
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(userId),
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "channel",
          pipeline: [
            {
              $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "owner",
                as: "recentVideos",
                pipeline: [
                  {
                    $match: {
                      $and: [{ isPublic: true }, { isNSFW: false }],
                    },
                  },
                  {
                    $sort: {
                      createdAt: -1,
                    },
                  },
                  {
                    $limit: 5,
                  },
                ],
              },
            },
          ],
        },
      },
      {
        $unwind: "$channel",
      },
      {
        $project: {
          "channel.refreshToken": 0,
          "channel.password": 0,
          "channel.email": 0,
          "channel.watchHistory": 0,
          "channel.avatar.public_id": 0,
          "channel.coverImage": 0,
        },
      },
    ]);

    const subscribedChannels = await Subscription.aggregatePaginate(
      subscribedChannelsAggregate,
      { page, limit }
    );

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Subscribed channels fetched successfully",
          subscribedChannels
        )
      );
  }
);
