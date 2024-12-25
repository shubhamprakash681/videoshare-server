import { Document, Model, model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

interface IComment extends Document {
  content: string;
  video: Schema.Types.ObjectId;
  parentComment?: Schema.Types.ObjectId;
  owner: Schema.Types.ObjectId;
}

interface ICommentModel extends Model<IComment> {
  aggregatePaginate: Function;
}

const CommentSchema: Schema<IComment> = new Schema(
  {
    content: {
      type: String,
      required: [true, "Content is required to add Comment"],
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: [true, "Video is required to add Comment"],
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required to create a Comment"],
    },
  },
  {
    timestamps: true,
  }
);

CommentSchema.plugin(mongooseAggregatePaginate);

const Comment: ICommentModel = model<IComment, ICommentModel>(
  "Comment",
  CommentSchema
);
export default Comment;
