import { NextFunction, Request, Response } from "express";
import Video, { IVideo } from "../models/Video.model";
import AsyncHandler from "../utils/AsyncHandler";
import mongoose, { PipelineStage } from "mongoose";
import { StatusCodes } from "http-status-codes";
import APIResponse from "../utils/APIResponse";
import ErrorHandler from "../utils/ErrorHandler";
import { deleteCloudinaryFile, uploadOnCloudinary } from "../utils/cloudinary";

type getAllVideosQuery = {
  page: number;
  limit: number;
  query: string;
  sortBy: keyof IVideo;
  sortType: "asc" | "des";
  userId: string;
};

export const getAllVideos = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      page = 1,
      limit = 10,
      query,
      sortBy,
      sortType = "asc",
      userId,
    } = req.query as unknown as getAllVideosQuery;

    const pipeline: PipelineStage[] = [];

    if (query) {
      pipeline.push({
        $search: {
          index: "video-search-index",
          text: {
            query,
            path: ["title", "description"],
            fuzzy: {
              maxEdits: 2,
              prefixLength: 0,
              maxExpansions: 50,
            },
          },
        },
      });
    }

    // pipeline for fetching public videos only
    pipeline.push({
      $match: { isPublic: true },
    });

    // send userId with req.query if want to get videos of specific user only
    if (userId) {
      pipeline.push({
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      });
    }

    if (sortBy && sortType) {
      pipeline.push({
        $sort: {
          [sortBy]: sortType === "des" ? -1 : 1,
        },
      });
    } else {
      // default sorting by creation date
      pipeline.push({
        $sort: {
          createdAt: -1,
        },
      });
    }

    // lookup for populating owner data
    pipeline.push(
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
        $unwind: {
          path: "$owner",
        },
      }
    );

    // lookup for populating likes count
    pipeline.push(
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
          pipeline: [
            {
              $match: {
                likeType: "like",
              },
            },
          ],
        },
      },
      {
        $addFields: {
          likes: {
            $size: "$likes",
          },
        },
      }
    );

    // console.log(pipeline);

    const videoAggregate = Video.aggregate(pipeline);

    const videos = await Video.aggregatePaginate(videoAggregate, {
      page,
      limit,
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(StatusCodes.OK, "Video fetched successfully", videos)
      );
  }
);

export const uploadVideo = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description } = req.body as {
      title: string;
      description: string;
    };

    if (
      [title, description].some(
        (field) => typeof field !== "string" || field.trim() === ""
      )
    ) {
      return next(
        new ErrorHandler("All fields are required!", StatusCodes.BAD_REQUEST)
      );
    }

    const files = req.files as { [fieldName: string]: Express.Multer.File[] };
    const video = files["video"]?.at(0);
    const thumbnail = files["thumbnail"]?.at(0);

    if (!video) {
      return next(
        new ErrorHandler("Video File is required!", StatusCodes.BAD_REQUEST)
      );
    }
    if (!thumbnail) {
      return next(
        new ErrorHandler(
          "Thumbnail Image is required!",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const videoCloudRes = await uploadOnCloudinary(
      video.path,
      `video/${req.user?.username}`
    );
    const thumbnailCloudRes = await uploadOnCloudinary(
      thumbnail.path,
      `thumbnail/${req.user?.username}`
    );

    if (!videoCloudRes || !thumbnailCloudRes) {
      return next(
        new ErrorHandler(
          "Video Upload Failed! Please try after some time.",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    const videoDoc = await Video.create({
      title,
      description,
      videoFile: {
        public_id: videoCloudRes.public_id,
        url: videoCloudRes.url,
      },
      thumbnail: {
        public_id: thumbnailCloudRes.public_id,
        url: thumbnailCloudRes.url,
      },
      duration: videoCloudRes.duration,
      owner: req.user?._id,
    });

    const videoData = await Video.findById(videoDoc._id);
    if (!videoData) {
      return next(
        new ErrorHandler(
          "Video upload failed! Please try again after some time",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    res.status(StatusCodes.CREATED).json(
      new APIResponse(StatusCodes.CREATED, "Video uploaded successfully", {
        video: videoData,
      })
    );
  }
);

export const updateVideo = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    const { title, description } = req.body as {
      title: string;
      description: string;
    };

    if (
      [title, description].some(
        (field) => typeof field !== "string" || field.trim() === ""
      )
    ) {
      return next(
        new ErrorHandler("All fields are required!", StatusCodes.BAD_REQUEST)
      );
    }

    const video = await Video.findById(videoId);

    if (!video) {
      return next(new ErrorHandler("Video not found!", StatusCodes.NOT_FOUND));
    }

    if (video.owner.toString() !== req.user?._id!.toString()) {
      return next(
        new ErrorHandler(
          "You cannot update this video",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) {
      return next(
        new ErrorHandler("Thumbnail file is required", StatusCodes.BAD_REQUEST)
      );
    }

    const thumbnailCloudRes = await uploadOnCloudinary(
      thumbnailLocalPath,
      `thumbnail/${req.user?.username}`
    );
    if (!thumbnailCloudRes) {
      return next(
        new ErrorHandler("Video update failed! Please try again after sometime")
      );
    }

    const oldThumbnailDeleteSuccess = await deleteCloudinaryFile(
      video.thumbnail.public_id
    );
    if (!oldThumbnailDeleteSuccess) {
      return next(
        new ErrorHandler("Video update failed! Please try again after sometime")
      );
    }

    const modifiedVideo = await Video.findByIdAndUpdate(
      video._id,
      {
        $set: {
          thumbnail: {
            public_id: thumbnailCloudRes.public_id,
            url: thumbnailCloudRes.url,
          },
          title,
          description,
        },
      },
      { new: true }
    );

    res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "Video updated successfully", {
        video: modifiedVideo,
      })
    );
  }
);
