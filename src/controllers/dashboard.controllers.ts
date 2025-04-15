import { NextFunction, Request, Response } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import Video from "../models/Video.model";
import Subscription from "../models/Subscription.model";
import { StatusCodes } from "http-status-codes";
import APIResponse from "../utils/APIResponse";
import ErrorHandler from "../utils/ErrorHandler";
import { deleteCloudinaryFile } from "../utils/cloudinary";
import mongoose from "mongoose";

// Get the personal channel stats like total video views, total subscribers, total videos, total likes etc.
export const getChannelStats = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    const videoStats = await Video.aggregate([
      // statge 1- filter videos based on user id
      {
        $match: {
          $and: [
            { owner: new mongoose.Types.ObjectId(userId as string) },
            { isNSFW: false },
          ],
        },
      },

      // stage 2- lookup for populating likes
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },
      {
        $addFields: {
          likes: { $size: "$likes" },
        },
      },

      // stage 3 -
      {
        $group: {
          _id: null,

          totalLikes: { $sum: "$likes" },
          totalViews: { $sum: "$views" },
          totalVideos: { $sum: 1 },
        },
      },
    ]);

    const subscriptionStats = await Subscription.aggregate([
      // statge 1- filter subscriptions based on user id
      {
        $match: {
          channel: new mongoose.Types.ObjectId(userId as string),
        },
      },

      {
        $group: {
          _id: null,
          totalSubscribers: {
            $sum: 1,
          },
        },
      },
    ]);

    res.status(StatusCodes.OK).json(
      new APIResponse(
        StatusCodes.OK,
        "Your Channel Stats fetched successfully",
        {
          totalLikes: videoStats[0]?.totalLikes || 0,
          totalViews: videoStats[0]?.totalViews || 0,
          totalVideos: videoStats[0]?.totalVideos || 0,
          totalSubscribers: subscriptionStats[0]?.totalSubscribers || 0,
        }
      )
    );
  }
);

// Get all the videos uploaded by the channel
export const getChannelVideos = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { limit = 15, page = 1 } = req.query as unknown as {
      limit: number;
      page: number;
    };

    const videoAggregate = Video.aggregate([
      // stage 1 - filter all videos uploaded by current user
      {
        $match: {
          $and: [
            { owner: new mongoose.Types.ObjectId(req.user?._id as string) },
            { isNSFW: false },
          ],
        },
      },

      // stage 2 & 3 - get total likes on each video
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },
      {
        $addFields: {
          likeCount: {
            $size: "$likes",
          },
        },
      },

      // stage 4 & 5 - get total comments on each video
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "video",
          as: "comments",
        },
      },
      {
        $addFields: {
          commentCount: {
            $size: "$comments",
          },
        },
      },

      // stage 6 - exclusive projection for removing extra fields
      {
        $project: {
          likes: 0,
          comments: 0,
        },
      },

      // stage 7 - sort by createdAt in desc order
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    const videos = await Video.aggregatePaginate(videoAggregate, {
      limit,
      page,
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "All videos uploaded by your channel fetched successfully",
          { ...videos }
        )
      );
  }
);

export const toggleVideoState = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    const video = await Video.findById(videoId);

    if (!video) {
      return next(new ErrorHandler("Video not found!", StatusCodes.NOT_FOUND));
    }

    if (video.owner.toString() !== req.user?._id!.toString()) {
      return next(
        new ErrorHandler("You cannot edit this video", StatusCodes.UNAUTHORIZED)
      );
    }

    video.isPublic = !video.isPublic;
    await video.save();

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          video.isPublic ? "Video made Public" : "Video made Private"
        )
      );
  }
);

export const deleteVideo = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    const video = await Video.findById(videoId);

    if (!video) {
      return next(new ErrorHandler("Video not found!", StatusCodes.NOT_FOUND));
    }

    if (video.owner.toString() !== req.user?._id!.toString()) {
      return next(
        new ErrorHandler(
          "You cannot delete this video",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    const videoFileDeleteSuccess = await deleteCloudinaryFile(
      video.videoFile.public_id,
      "video"
    );

    if (videoFileDeleteSuccess) {
      await deleteCloudinaryFile(video.thumbnail.public_id);

      await Video.findByIdAndDelete(video._id);

      return res
        .status(StatusCodes.OK)
        .json(new APIResponse(StatusCodes.OK, "Video deleted successfully"));
    }

    return next(
      new ErrorHandler(
        "Video delete failed! Please try again",
        StatusCodes.INTERNAL_SERVER_ERROR
      )
    );
  }
);
