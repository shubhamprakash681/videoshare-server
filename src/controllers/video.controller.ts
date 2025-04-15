import { NextFunction, query, Request, Response } from "express";
import Video, { IVideo } from "../models/Video.model";
import AsyncHandler from "../utils/AsyncHandler";
import mongoose, { isValidObjectId, PipelineStage } from "mongoose";
import { StatusCodes } from "http-status-codes";
import APIResponse from "../utils/APIResponse";
import ErrorHandler from "../utils/ErrorHandler";
import { deleteCloudinaryFile, uploadOnCloudinary } from "../utils/cloudinary";
import User from "../models/User.model";
import Playlist from "../models/Playlist.model";
import { updateSearchDb } from "./search.controller";

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

    if (query && query.trim().length) {
      pipeline.push({
        $search: {
          index: "auto-text-search-index",
          text: {
            query,
            path: ["title", "description"],
            matchCriteria: "any",
            fuzzy: {
              maxEdits: 2,
              prefixLength: 0,
              maxExpansions: 50,
            },
          },
        },
      });

      await updateSearchDb(query, next);
    }

    // pipeline for fetching public & Safe videos only
    pipeline.push({
      $match: { $and: [{ isPublic: true }, { isNSFW: false }] },
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

    // pagination & limit
    pipeline.push(
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) }
    );
    // console.log(pipeline);

    const videoAggregate = Video.aggregate(pipeline);

    const countPipeline = videoAggregate
      .pipeline()
      .slice(
        0,
        videoAggregate
          .pipeline()
          .findIndex((p) => Object.keys(p)[0] === "$match") + 1
      );
    countPipeline.push({ $count: "totalCount" });

    const countResult = await Video.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;

    const videos = await videoAggregate
      .skip((+page - 1) * +limit)
      .limit(+limit);

    const result = {
      docs: videos,
      totalDocs: totalCount,
      limit: limit,
      page: page,
      totalPages: Math.ceil(totalCount / limit),
      pagingCounter: (page - 1) * limit + 1,
      hasPrevPage: page > 1,
      hasNextPage: page * limit < totalCount,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page * limit < totalCount ? page + 1 : null,
    };

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(StatusCodes.OK, "Video fetched successfully", result)
      );
  }
);

export const getSuggestions = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };
    const { page = 1, limit = 10 } = req.query as unknown as {
      page: number;
      limit: number;
    };

    if (!isValidObjectId(videoId)) {
      return next(new ErrorHandler("Invalid Video!", StatusCodes.BAD_REQUEST));
    }

    const targetVideo = await Video.findById(videoId);
    if (!targetVideo) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Video not found" });
    }

    const suggestionAggregate = Video.aggregate([
      {
        $search: {
          index: "auto-text-search-index",
          compound: {
            should: [
              {
                text: {
                  query: targetVideo.title,
                  path: "title",
                  matchCriteria: "any",
                  // Allows minor typos
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 0,
                    maxExpansions: 50,
                  },
                },
              },
              {
                text: {
                  query: targetVideo.description,
                  path: "description",
                  matchCriteria: "any",
                  // Allows minor typos
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 0,
                    maxExpansions: 50,
                  },
                },
              },
            ],
            minimumShouldMatch: 1, // At least one condition should match
          },
        },
      },
      {
        $match: {
          _id: { $ne: targetVideo._id }, // Exclude original video
          $or: [{ owner: targetVideo.owner }], // Include videos from the same owner
          $and: [{ isPublic: true }, { isNSFW: false }], // include public & safe videos only
        },
      },

      // Sort by popularity & recency
      { $sort: { views: -1, createdAt: -1 } },

      // Stage for populating owner's data
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
      },

      { $skip: (Number(page) - 1) * Number(limit) }, // Pagination: Skip before limit
      { $limit: Number(limit) }, // Pagination: Limit the results
    ]);

    const countPipeline = suggestionAggregate
      .pipeline()
      .slice(
        0,
        suggestionAggregate
          .pipeline()
          .findIndex((p) => Object.keys(p)[0] === "$match") + 1
      );
    countPipeline.push({ $count: "totalCount" });

    const countResult = await Video.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;

    const videos = await suggestionAggregate
      .skip((+page - 1) * +limit)
      .limit(+limit);

    const result = {
      docs: videos,
      totalDocs: totalCount,
      limit: limit,
      page: page,
      totalPages: Math.ceil(totalCount / limit),
      pagingCounter: (page - 1) * limit + 1,
      hasPrevPage: page > 1,
      hasNextPage: page * limit < totalCount,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page * limit < totalCount ? page + 1 : null,
    };

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Suggestions fetched successfully",
          result
        )
      );
  }
);

export const getSearchSuggestion = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { query } = req.query as { query: string };

    if (!query || query.trim().length < 2) {
      return res
        .status(StatusCodes.OK)
        .json(
          new APIResponse(
            StatusCodes.OK,
            "Search Suggestions fetched successfully",
            []
          )
        );
    }

    const searchSuggestionAggregate = Video.aggregate([
      {
        $search: {
          index: "auto-text-search-index",
          compound: {
            should: [
              {
                autocomplete: {
                  query,
                  path: "title",
                  // tokenOrder: "sequential",
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 0,
                    maxExpansions: 50,
                  },
                },
              },
              {
                autocomplete: {
                  query,
                  path: "description",
                  // tokenOrder: "sequential",
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 0,
                    maxExpansions: 50,
                  },
                },
              },
            ],

            minimumShouldMatch: 1,
          },

          highlight: {
            path: ["title", "description"],
          },
        },
      },
      {
        $match: { $and: [{ isPublic: true }, { isNSFW: false }] },
      },
      {
        $limit: 20,
      },
      {
        $project: {
          _id: 0,
          title: 1,
          description: 1,
          score: { $meta: "searchScore" },
          highlights: { $meta: "searchHighlights" },
        },
      },
      {
        $sort: {
          score: -1,
        },
      },
    ]);

    const searchSuggestions = await searchSuggestionAggregate;

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Search Suggestions fetched successfully",
          searchSuggestions
        )
      );
  }
);

export const getVideo = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    if (!isValidObjectId(videoId)) {
      return next(new ErrorHandler("Invalid Video!", StatusCodes.BAD_REQUEST));
    }

    const videoAggregate = Video.aggregate([
      {
        $match: {
          $and: [
            { _id: new mongoose.Types.ObjectId(videoId) },
            { isNSFW: false },
          ],
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
      },
    ]);

    const videos = await Video.aggregatePaginate(videoAggregate);

    if (videos.docs.length === 0) {
      return next(new ErrorHandler("Video not found!", StatusCodes.NOT_FOUND));
    }

    if (videos.docs[0].isPublic === false) {
      if (videos.docs[0].owner._id.toString() !== req.user?._id?.toString()) {
        return next(
          new ErrorHandler(
            "You are not allowed to view this video",
            StatusCodes.UNAUTHORIZED
          )
        );
      }
    }

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Video fetched successfully",
          videos.docs[0]
        )
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

    if (!req.user?.uploadTCAccepted) {
      return next(
        new ErrorHandler(
          "Please accept the Video upload terms and conditions",
          StatusCodes.BAD_REQUEST
        )
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

    if (!req.user?.uploadTCAccepted) {
      return next(
        new ErrorHandler(
          "Please accept the Video upload terms and conditions",
          StatusCodes.BAD_REQUEST
        )
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

export const getVideoLikeData = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    if (!isValidObjectId(videoId)) {
      return next(
        new ErrorHandler("VideoId is Invalid!", StatusCodes.BAD_REQUEST)
      );
    }

    const videoLikeAggregate = Video.aggregate([
      {
        $match: {
          $and: [
            { _id: new mongoose.Types.ObjectId(videoId) },
            { isPublic: true },
            { isNSFW: false },
          ],
        },
      },

      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "allLikes",
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
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "allDislikes",
          pipeline: [
            {
              $match: {
                likeType: "dislike",
              },
            },
          ],
        },
      },

      {
        $addFields: {
          isLiked: {
            $cond: {
              if: {
                $in: [
                  new mongoose.Types.ObjectId(req.user?._id?.toString()),
                  "$allLikes.likedBy",
                ],
              },
              then: true,
              else: false,
            },
          },

          isDisliked: {
            $cond: {
              if: {
                $in: [
                  new mongoose.Types.ObjectId(req.user?._id?.toString()),
                  "$allDislikes.likedBy",
                ],
              },
              then: true,
              else: false,
            },
          },

          likeCount: {
            $size: "$allLikes",
          },
        },
      },

      {
        $project: {
          _id: 0,
          allLikes: 0,
          allDislikes: 0,
          owner: 0,
          title: 0,
          isPublic: 0,
          description: 0,
          duration: 0,
          updatedAt: 0,
          createdAt: 0,
          views: 0,
          videoFile: 0,
          thumbnail: 0,
        },
      },
    ]);

    const videoLikeData = await Video.aggregatePaginate(videoLikeAggregate);

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Likes data fetched successfully",
          videoLikeData.docs[0]
        )
      );
  }
);

export const incremenetVideoView = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    if (!isValidObjectId(videoId)) {
      return next(
        new ErrorHandler("VideoId is Invalid!", StatusCodes.BAD_REQUEST)
      );
    }

    const video = await Video.findById(videoId);
    const user = await User.findById(req.user?._id);

    if (!video) {
      return next(new ErrorHandler("Video not found!", StatusCodes.NOT_FOUND));
    }
    if (!user) {
      return next(new ErrorHandler("User not found!", StatusCodes.BAD_REQUEST));
    }

    await Video.findByIdAndUpdate(videoId, {
      $inc: { views: 1 },
    });

    // update user's watch history
    const existingEntry = user?.watchHistory.find(
      (entry) => entry.videoId.toString() === videoId
    );

    if (existingEntry) {
      existingEntry.watchedAt = new Date();
    } else {
      user.watchHistory.push({
        videoId,
        watchedAt: new Date(),
      });
    }

    await user.save();

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(StatusCodes.OK, "Video view incremented successfully")
      );
  }
);

export const updateVideoPlaylists = AsyncHandler(
  (req: Request, res: Response, next: NextFunction) => {
    const { videoId } = req.params as { videoId: string };

    const { addToPlaylistIds, removeFromPlaylistIds } = req.body as {
      addToPlaylistIds: string[];
      removeFromPlaylistIds: string[];
    };

    if (!isValidObjectId(videoId)) {
      return next(new ErrorHandler("Invalid Video!", StatusCodes.BAD_REQUEST));
    }

    if (
      !addToPlaylistIds.every((id) => isValidObjectId(id)) ||
      !removeFromPlaylistIds.every((id) => isValidObjectId(id))
    ) {
      return next(
        new ErrorHandler("Invalid Playlist!", StatusCodes.BAD_REQUEST)
      );
    }

    [...addToPlaylistIds, ...removeFromPlaylistIds].forEach(
      async (playlistId) => {
        const playlist = await Playlist.findById(playlistId);
        if (playlist?.owner.toString() !== req.user?._id?.toString()) {
          return next(
            new ErrorHandler(
              "You are not allowed to update this playlist",
              StatusCodes.UNAUTHORIZED
            )
          );
        }
      }
    );

    addToPlaylistIds.forEach(async (playlistId) => {
      await Playlist.findByIdAndUpdate(playlistId, {
        $addToSet: { videos: videoId },
      });
    });

    removeFromPlaylistIds.forEach(async (playlistId) => {
      await Playlist.findByIdAndUpdate(playlistId, {
        $pull: { videos: videoId },
      });
    });

    res
      .status(StatusCodes.OK)
      .json(new APIResponse(StatusCodes.OK, "Playlists Updated"));
  }
);
