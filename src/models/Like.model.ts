import { Document, Model, model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

interface ILike extends Document {
  video?: Schema.Types.ObjectId;
  comment?: Schema.Types.ObjectId;
  tweet?: Schema.Types.ObjectId;
  likeType: "like" | "dislike";
  likedBy: Schema.Types.ObjectId;
}

interface ILikeModel extends Model<ILike> {
  aggregatePaginate: Function;
}

const LikeSchema: Schema<ILike> = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },
    likeType: {
      type: String,
      enum: ["like", "dislike"],
      default: "like",
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "LikedBy is required to create a Like"],
    },
  },
  {
    timestamps: true,
  }
);

LikeSchema.plugin(mongooseAggregatePaginate);

const Like: ILikeModel = model<ILike, ILikeModel>("Like", LikeSchema);

export default Like;
