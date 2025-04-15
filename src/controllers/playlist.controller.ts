import { Request, Response, NextFunction } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import ErrorHandler from "../utils/ErrorHandler";
import { StatusCodes } from "http-status-codes";
import mongoose, { isValidObjectId, PipelineStage } from "mongoose";
import Playlist from "../models/Playlist.model";
import APIResponse from "../utils/APIResponse";

interface ICreatePlaylistRequest {
  title: string;
  description?: string;
  visibility?: "public" | "private";
  videos?: string[];
}

export const createPlaylist = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, visibility, videos } =
      req.body as ICreatePlaylistRequest;

    // validations
    if (!title || title.trim() === "") {
      return next(
        new ErrorHandler(
          "Playlist title cannot be empty",
          StatusCodes.BAD_REQUEST
        )
      );
    }
    if (visibility && visibility !== "public" && visibility !== "private") {
      return next(
        new ErrorHandler(
          "Playlist visibility can be either public or private",
          StatusCodes.BAD_REQUEST
        )
      );
    }
    if (videos && videos.length) {
      // check if all video ids are valid
      videos.forEach((videoId: string) => {
        if (!isValidObjectId(videoId)) {
          return next(
            new ErrorHandler("Invalid Video ID", StatusCodes.BAD_REQUEST)
          );
        }
      });
    }

    // create playlist
    const playlist = await Playlist.create({
      title,
      description,
      visibility,
      videos,
      owner: req.user?._id,
    });

    res
      .status(StatusCodes.CREATED)
      .json(new APIResponse(StatusCodes.CREATED, "Playlist created", playlist));
  }
);

type getPlaylistQuery = {
  userId: string;
  visibility?: "public" | "private" | "all";
  page: number;
  limit: number;
};
export const getPlaylists = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      userId,
      visibility,
      page = 1,
      limit = 10,
    } = req.query as unknown as getPlaylistQuery;

    if (!userId || !isValidObjectId(userId)) {
      return next(new ErrorHandler("Invalid User ID", StatusCodes.BAD_REQUEST));
    }

    if (
      visibility &&
      visibility !== "public" &&
      visibility !== "private" &&
      visibility !== "all"
    ) {
      return next(
        new ErrorHandler(
          "Playlist query visibility can be either public, private or all",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },

      {
        $lookup: {
          from: "videos",
          let: { parentVideos: "$videos" }, // Pass the videos array from the parent document
          localField: "videos",
          foreignField: "_id",
          as: "videos",
          pipeline: [
            {
              $match: {
                $and: [{ isPublic: true }, { isNSFW: false }],
              },
            },

            {
              $addFields: {
                // use videos array in local scope to assign index to each video doc
                sortIndex: {
                  $indexOfArray: ["$$parentVideos", "$_id"],
                },
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

            {
              $sort: {
                sortIndex: 1,
              },
            },

            {
              $project: {
                sortIndex: 0,
              },
            },
          ],
        },
      },

      {
        $sort: {
          updatedAt: -1,
        },
      },
    ];

    if (req.user?._id?.toString() === userId.toString()) {
      if (visibility && visibility !== "all") {
        pipeline.push({
          $match: {
            visibility: visibility,
          },
        });
      }
    } else {
      pipeline.push({
        $match: {
          visibility: "public",
        },
      });
    }

    const playlistAggregate = Playlist.aggregate(pipeline);

    const playlists = await Playlist.aggregatePaginate(playlistAggregate, {
      limit,
      page,
    });

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Playlist fetched successfully",
          playlists
        )
      );
  }
);
export const getPlaylistData = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { playlistId } = req.params as { playlistId: string };

    if (!playlistId || !isValidObjectId(playlistId)) {
      return next(
        new ErrorHandler("Invalid Playlist ID", StatusCodes.BAD_REQUEST)
      );
    }

    const playlistAggregate = Playlist.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(playlistId),
        },
      },

      {
        $lookup: {
          from: "videos",
          let: { parentVideos: "$videos" }, // Pass the videos array from the parent document
          localField: "videos",
          foreignField: "_id",
          as: "videos",
          pipeline: [
            {
              $match: {
                $and: [{ isPublic: true }, { isNSFW: false }],
              },
            },

            {
              $addFields: {
                // use videos array in local scope to assign index to each video doc
                sortIndex: {
                  $indexOfArray: ["$$parentVideos", "$_id"],
                },
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

            {
              $sort: {
                sortIndex: 1,
              },
            },

            {
              $project: {
                sortIndex: 0,
              },
            },
          ],
        },
      },

      {
        $sort: {
          updatedAt: -1,
        },
      },
    ]);

    const playlists = await Playlist.aggregatePaginate(playlistAggregate);

    if (!playlists.docs.length) {
      return next(
        new ErrorHandler("Playlist not found!", StatusCodes.NOT_FOUND)
      );
    }

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Playlist fetched successfully",
          playlists
        )
      );
  }
);

// Endpoint for fetching all playlist options for a video with conditional check if the video is already added to the playlist
export const getPlaylistOptions = AsyncHandler(
  async (req: Request, res: Response) => {
    const { videoId } = req.params as { videoId: string };

    const playlistOptionsAggreagte = Playlist.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(req.user?._id as string),
        },
      },

      {
        $addFields: {
          isPresent: {
            $cond: {
              if: {
                $in: [new mongoose.Types.ObjectId(videoId), "$videos"],
              },
              then: true,
              else: false,
            },
          },
        },
      },

      {
        $sort: {
          title: 1,
        },
      },
    ]);

    const playlists = await Playlist.aggregatePaginate(
      playlistOptionsAggreagte
    );

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Playlist options fetched successfully",
          playlists.docs
        )
      );
  }
);

export const updatePlaylist = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { playlistId } = req.params as { playlistId: string };
    const { title, description, visibility, videos } =
      req.body as ICreatePlaylistRequest;

    if (!playlistId || !isValidObjectId(playlistId)) {
      return next(
        new ErrorHandler("Invalid Playlist ID", StatusCodes.BAD_REQUEST)
      );
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(
        new ErrorHandler("Playlist not found", StatusCodes.NOT_FOUND)
      );
    }

    if (playlist.owner.toString() !== req.user?._id?.toString()) {
      return next(
        new ErrorHandler(
          "You cannot update this playlist",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    // validations
    if (!title || title.trim() === "") {
      return next(
        new ErrorHandler(
          "Playlist title cannot be empty",
          StatusCodes.BAD_REQUEST
        )
      );
    }
    if (visibility && visibility !== "public" && visibility !== "private") {
      return next(
        new ErrorHandler(
          "Playlist visibility can be either public or private",
          StatusCodes.BAD_REQUEST
        )
      );
    }
    if (videos && videos.length) {
      // check if all video ids are valid
      videos.forEach((videoId: string) => {
        if (!isValidObjectId(videoId)) {
          return next(
            new ErrorHandler("Invalid Video ID", StatusCodes.BAD_REQUEST)
          );
        }
      });
    }

    await Playlist.findByIdAndUpdate(
      playlistId,
      {
        title,
        description,
        visibility,
        videos,
      }
      // { new: true }
    );

    const playlistAggregate = Playlist.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(playlistId),
        },
      },

      {
        $lookup: {
          from: "videos",
          let: { parentVideos: "$videos" }, // Pass the videos array from the parent document
          localField: "videos",
          foreignField: "_id",
          as: "videos",
          pipeline: [
            {
              $match: {
                $and: [{ isPublic: true }, { isNSFW: false }],
              },
            },

            {
              $addFields: {
                // use videos array in local scope to assign index to each video doc
                sortIndex: {
                  $indexOfArray: ["$$parentVideos", "$_id"],
                },
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

            {
              $sort: {
                sortIndex: 1,
              },
            },

            {
              $project: {
                sortIndex: 0,
              },
            },
          ],
        },
      },

      {
        $sort: {
          updatedAt: -1,
        },
      },
    ]);

    const updatedPlaylist = await Playlist.aggregatePaginate(playlistAggregate);

    if (!updatedPlaylist.docs.length) {
      return next(
        new ErrorHandler("Playlist not found!", StatusCodes.NOT_FOUND)
      );
    }

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Playlist updated successfully",
          updatedPlaylist
        )
      );
  }
);

export const deletePlaylist = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { playlistId } = req.params as { playlistId: string };

    if (!playlistId || !isValidObjectId(playlistId)) {
      return next(
        new ErrorHandler("Invalid Playlist ID", StatusCodes.BAD_REQUEST)
      );
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(
        new ErrorHandler("Playlist not found", StatusCodes.NOT_FOUND)
      );
    }

    if (playlist.owner.toString() !== req.user?._id?.toString()) {
      return next(
        new ErrorHandler(
          "You cannot delete this playlist",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    await Playlist.findByIdAndDelete(playlistId);

    res
      .status(StatusCodes.OK)
      .json(new APIResponse(StatusCodes.OK, "Playlist deleted successfully"));
  }
);
