import { CookieOptions, NextFunction, Request, Response } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import ErrorHandler from "../utils/ErrorHandler";
import { StatusCodes } from "http-status-codes";
import {
  loginUserValidator,
  registerUserValidator,
  updatePasswordValidator,
  updateProfileValidator,
} from "../schema/user";
import User, { IUser } from "../models/User.model";
import { deleteCloudinaryFile, uploadOnCloudinary } from "../utils/cloudinary";
import APIResponse from "../utils/APIResponse";
import mongoose, { Document } from "mongoose";
import jwt from "jsonwebtoken";

interface IRegisterUserBody {
  username: string;
  email: string;
  fullname: string;
  password: string;
}

interface ILoginUserBody {
  identifier: string;
  password: string;
}

const getAccessTokenCookieOptions: () => CookieOptions = () => {
  return {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: Number(process.env.ACCESS_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000 || 0,
  };
};
const getRefreshTokenCookieOptions: () => CookieOptions = () => {
  return {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge:
      Number(process.env.REFRESH_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000 || 0,
  };
};

const generateAccessAndRefreshTokenToken = async (
  user: Document<unknown, {}, IUser> &
    IUser &
    Required<{
      _id: unknown;
    }> & {
      __v?: number;
    }
): Promise<{ accessToken: string; refreshToken: string }> => {
  try {
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err: any) {
    throw new ErrorHandler(
      "Failed to generate Login Session! Please try after sometime.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const registerUser = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // get user details from frontend
    const { username, email, fullname, password } =
      req.body as IRegisterUserBody;

    // validations
    if (
      [username, email, fullname, password].some(
        (field) => typeof field !== "string" || field.trim() === ""
      )
    ) {
      return next(
        new ErrorHandler("All fields are required!", StatusCodes.BAD_REQUEST)
      );
    }
    const validationRes = registerUserValidator.safeParse({
      username,
      email,
      fullname,
      password,
    });
    // console.log("validationRes: ", validationRes);
    if (!validationRes.success) {
      const validationErrors = validationRes.error.errors.map(
        (err) => err.message
      );

      return next(
        new ErrorHandler(
          validationErrors.length
            ? validationErrors.join(", ")
            : "Invalid query parameter",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // check if user already exists
    const userAlreadyExists = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (userAlreadyExists) {
      return next(
        new ErrorHandler(
          "User with same username or email already exists",
          StatusCodes.CONFLICT
        )
      );
    }

    // check for images, check for avatar
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const avatar = files["avatar"]?.at(0);
    const coverImage = files["coverImage"]?.at(0);
    let coverImageRes = null;

    if (!avatar) {
      return next(
        new ErrorHandler("Avatar is required!", StatusCodes.BAD_REQUEST)
      );
    }

    // upload images- avatar, coverImage to cloudinary
    const avatarCloudRes = await uploadOnCloudinary(
      avatar.path,
      `user/${username}/avatar`
    );
    if (coverImage) {
      const coverImageCloudRes = await uploadOnCloudinary(
        coverImage.path,
        `user/${username}/coverImage`
      );

      if (coverImageCloudRes) {
        coverImageRes = coverImageCloudRes;
      }
    }

    // check for avatar uploaded successfully
    if (!avatarCloudRes) {
      return next(
        new ErrorHandler(
          "User Registration Failed! Please try after some time.",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    // create user object - create entry in db
    const user = await User.create({
      username,
      email,
      fullname,
      password,
      avatar: { public_id: avatarCloudRes.public_id, url: avatarCloudRes.url },
      coverImage: coverImageRes
        ? { public_id: coverImageRes.public_id, url: coverImageRes.url }
        : { public_id: "", url: "" },
    });

    // full proof method -- ensuring by making an extra DB call
    // remove password and refresh token field
    const userData = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    // check for user creation - return res
    if (!userData) {
      return next(
        new ErrorHandler(
          "User Registration Failed! Please try after some time.",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    return res.status(StatusCodes.CREATED).json(
      new APIResponse(StatusCodes.CREATED, "User Registered Successfully!", {
        user: userData,
      })
    );
  }
);

export const loginUser = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { identifier, password } = req.body as ILoginUserBody;

    // schema validation
    const validationResponse = loginUserValidator.safeParse({
      identifier,
      password,
    });

    if (!validationResponse.success) {
      const validationErrors = validationResponse.error.errors.map(
        (err) => err.message
      );

      return next(
        new ErrorHandler(
          validationErrors.length
            ? validationErrors.join(", ")
            : "Invalid query parameters",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+password");

    if (!user) {
      return next(
        new ErrorHandler("Account not exists!", StatusCodes.NOT_FOUND)
      );
    }

    const isPasswordMatched = await user.comparePassword(password);
    if (!isPasswordMatched) {
      return next(
        new ErrorHandler(
          "Login Identifier or Password is incorrect",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    const { accessToken, refreshToken } =
      await generateAccessAndRefreshTokenToken(user);

    // removing password & refreshToken fields
    user.password = "";
    user.refreshToken = "";

    res
      .status(StatusCodes.OK)
      .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
      .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions())
      .json(
        new APIResponse(StatusCodes.OK, `Welcome back ${user.fullname}!`, {
          user,
          accessToken,
          refreshToken,
        })
      );
  }
);

export const getUserProfile = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "Profile data sent successfully", {
        user: req.user,
      })
    );
  }
);

export const updateProfile = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { fullname, email } = req.body as { fullname: string; email: string };

    if (!email || !fullname) {
      return next(
        new ErrorHandler("All fields are required!", StatusCodes.BAD_REQUEST)
      );
    }

    const validationRes = updateProfileValidator.safeParse({
      email,
      fullname,
    });

    if (!validationRes.success) {
      const validationErrors = validationRes.error.errors.map(
        (err) => err.message
      );
      return next(
        new ErrorHandler(
          validationErrors.length
            ? validationErrors.join(", ")
            : "Invalid parameters",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { email, fullname } },
      { new: true }
    ).select("-password -refreshToken");

    res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "Profile updated successfully!", {
        user: updatedUser,
      })
    );
  }
);

export const updateUserAvatar = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
      return next(
        new ErrorHandler("New Avatar file is required", StatusCodes.BAD_REQUEST)
      );
    }

    const avatarCloudResponse = await uploadOnCloudinary(
      avatarLocalPath,
      `user/${req.user?.username}/avatar`
    );
    if (!avatarCloudResponse) {
      return next(
        new ErrorHandler(
          "User Avatar update failed! Please try after some time.",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    // delete old cloudinary image
    req.user?.avatar.public_id &&
      (await deleteCloudinaryFile(req.user?.avatar.public_id));

    const modifiedUser = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: {
            public_id: avatarCloudResponse.public_id,
            url: avatarCloudResponse.url,
          },
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "User Avatar updated successfully!", {
        user: modifiedUser,
      })
    );
  }
);

export const updateUserCoverImage = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const covImageLocalPath = req.file?.path;

    if (!covImageLocalPath) {
      return next(
        new ErrorHandler(
          "New Cover Image file is required",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const covImageCloudRes = await uploadOnCloudinary(
      covImageLocalPath,
      `user/${req.user?.username}/coverImage`
    );
    if (!covImageCloudRes) {
      return next(
        new ErrorHandler(
          "Cover Image update Failed! Please try again after some time",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    // delete old cloudinary image
    req.user?.coverImage.public_id &&
      (await deleteCloudinaryFile(req.user?.coverImage.public_id));

    const modifiedUser = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          coverImage: {
            public_id: covImageCloudRes.public_id,
            url: covImageCloudRes.url,
          },
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "Cover Image updated successfully!", {
        user: modifiedUser,
      })
    );
  }
);

export const deleteCoverImage = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    req.user?.coverImage.public_id &&
      (await deleteCloudinaryFile(req.user?.coverImage.public_id));

    const modifiedUser = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          coverImage: {
            public_id: "",
            url: "",
          },
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "Cover Image deleted successfully!", {
        user: modifiedUser,
      })
    );
  }
);

export const updatePassword = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword } = req.body;

    // validations
    const validationRes = updatePasswordValidator.safeParse({
      oldPassword,
      newPassword,
    });

    if (!validationRes.success) {
      const validationErrors = validationRes.error.errors.map(
        (err) => err.message
      );

      return next(
        new ErrorHandler(
          validationErrors.length
            ? validationErrors.join(", ")
            : "Invalid update password parameters",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // getting user data from db
    const user = await User.findById(req.user?._id).select("+password");

    if (user) {
      const isPasswordMatched = await user?.comparePassword(oldPassword);
      if (!isPasswordMatched) {
        return next(
          new ErrorHandler("Old password is incorrect", StatusCodes.BAD_REQUEST)
        );
      }

      user.password = newPassword;

      await user.save({ validateBeforeSave: false });

      return res
        .status(StatusCodes.OK)
        .json(new APIResponse(StatusCodes.OK, "Password updated successfully"));
    }

    return next(
      new ErrorHandler(
        "Something went wrong while updating Password",
        StatusCodes.INTERNAL_SERVER_ERROR
      )
    );
  }
);

export const refreshSession = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      return next(
        new ErrorHandler("Unauthorized request", StatusCodes.UNAUTHORIZED)
      );
    }

    const decodedUser = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as unknown as { _id: string };

    const user = await User.findById(decodedUser._id);

    if (!user) {
      return next(
        new ErrorHandler(
          "Refresh token is expired or used",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    // verifying refresh token again from DB for extra security
    if (incomingRefreshToken !== user.refreshToken) {
      return next(
        new ErrorHandler(
          "Refresh token is expired or used",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    const { accessToken, refreshToken } =
      await generateAccessAndRefreshTokenToken(user);

    // removing password & refreshToken fields
    user.password = "";
    user.refreshToken = "";

    res
      .status(StatusCodes.OK)
      .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
      .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions())
      .json(
        new APIResponse(StatusCodes.OK, `Welcome back ${user.fullname}!`, {
          user,
          accessToken,
          refreshToken,
        })
      );
  }
);

export const logoutUser = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          refreshToken: "",
        },
      },
      {
        new: true,
      }
    );

    res
      .status(StatusCodes.OK)
      .clearCookie("accessToken", getAccessTokenCookieOptions())
      .clearCookie("refreshToken", getRefreshTokenCookieOptions())
      .json(new APIResponse(StatusCodes.OK, "Logged out successfully"));
  }
);

// Imp: Controllers with aggregation pipelines
export const getUserChannelProfile = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.params;

    if (!username.trim()) {
      return next(
        new ErrorHandler("Username is required!", StatusCodes.BAD_REQUEST)
      );
    }

    const channel = await User.aggregate([
      // 1st stage - to get all(here, only 1) users where username is req.params.username
      {
        $match: { username: username.toLocaleLowerCase() },
      },

      // lookup - looking for all subscriptions where channel = User[username: req.params.username]._id
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },

      // lookup - looking for all subscriptions where subscriber = User[username: req.params.username]._id
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo",
        },
      },

      // adding fields to the documents
      {
        $addFields: {
          // storing count of users that are subscribed to current user's (User[username: req.params.username]) channel
          subscriberCount: {
            $size: "$subscribers",
          },

          // storing count of channels that current user (User[username: req.params.username]) has subscribed
          subscribedToCount: {
            $size: "$subscribedTo",
          },

          // variable to store logged in user is subscribed to this channel (where username = req.params.username)
          isSubscribed: {
            $cond: {
              if: {
                $in: [
                  new mongoose.Types.ObjectId(req.user?._id?.toString()),
                  "$subscribers.subscriber",
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },

      // project - to specify which fields to keep in the merged document
      {
        $project: {
          fullname: 1,
          username: 1,
          avatar: 1,
          coverImage: 1,
          email: 1,
          subscriberCount: 1,
          subscribedToCount: 1,
          isSubscribed: 1,
        },
      },
    ]);

    if (!channel.length) {
      return next(
        new ErrorHandler("Channel does not exists", StatusCodes.NOT_FOUND)
      );
    }

    return res.status(StatusCodes.OK).json(
      new APIResponse(StatusCodes.OK, "Channel data fetched successfully", {
        ...channel[0],
      })
    );
  }
);

export const getWatchHistory = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Note: This conversion is required because we need to convert string IDs to mongodb id
    // as aggregation pipeline does not automatically performs this conversion
    // unlike in case of mongoose (which automatically performs this kind of conversion)
    const userId = new mongoose.Types.ObjectId(req.user?._id as string);

    const user = await User.aggregate([
      // 1st stage - to find user
      {
        $match: {
          _id: userId,
        },
      },

      // lookup
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
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
                      avatar: 1,
                    },
                  },
                ],
              },
            },

            // pipeline to change wathcHistory's owner from array to object (since we have a single object in array)
            {
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
        },
      },
    ]);

    res.status(StatusCodes.OK).json(
      new APIResponse(
        StatusCodes.OK,
        "Successfully fetched your Watch History",
        {
          watchHistory: user[0].watchHistory,
        }
      )
    );
  }
);
