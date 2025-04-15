import { Document, Model, Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";
import { model } from "mongoose";

type WatchHistory = { videoId: string; watchedAt: Date };
export interface IUser extends Document {
  username: string;
  email: string;
  fullname: string;
  avatar: {
    public_id: string;
    url: string;
  };
  coverImage: {
    public_id: string;
    url: string;
  };
  watchHistory: WatchHistory[];
  password: string;
  refreshToken: string;
  resetPswdToken?: string;
  resetPswdExpire?: Date;
  channelDescription?: string;
  uploadTCAccepted: boolean;

  comparePassword: (enteredPassword: string) => Promise<boolean>;
  generateAccessToken: () => string;
  generateRefreshToken: () => string;
  generatePasswordResetToken: () => string;
}

// Extend Mongoose Model for custom static methods
interface IUserModel extends Model<IUser> {
  // Add aggregate pagination support
  aggregatePaginate: Function;
}

const userSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    fullname: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    avatar: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },

    coverImage: {
      public_id: {
        type: String,
        // required: true,
      },
      url: {
        type: String,
        // required: true,
      },
    },
    channelDescription: {
      type: String,
      trim: true,
    },

    watchHistory: [
      {
        videoId: { type: Schema.Types.ObjectId, ref: "Video" },
        watchedAt: { type: Date, default: Date.now },
      },
    ],

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    refreshToken: {
      type: String,
    },
    resetPswdToken: {
      type: String,
    },
    resetPswdExpire: {
      type: Date,
    },
    uploadTCAccepted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// hashing password
userSchema.pre<IUser>("save", async function (next) {
  // while updating other user's details, password should not be hashed again
  // if this condition is not written then it will re-hash the pswd each time user's info is updated
  if (!this.isModified("password")) {
    // ie, if pswd is not modified
    return next();
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// comparePassword
userSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// access token generator
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullname: this.fullname,
    },
    process.env.ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

// refresh token generator
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET as string,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generatePasswordResetToken = function () {
  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash the token and set it to the resetPswdToken field
  this.resetPswdToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPswdExpire = new Date(Date.now() + 15 * 60 * 1000); //15 min

  return resetToken;
};

// Add Aggregate Pagination Plugin
userSchema.plugin(aggregatePaginate);

const User: IUserModel = model<IUser, IUserModel>("User", userSchema);

export default User;
