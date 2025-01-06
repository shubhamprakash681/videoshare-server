import { Document, Model, model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

interface IPlaylist extends Document {
  title: string;
  description?: string;
  visibility: "public" | "private";
  videos: Schema.Types.ObjectId[];
  owner: Schema.Types.ObjectId;
}

interface IPlaylistModel extends Model<IPlaylist> {
  aggregatePaginate: Function;
}

const PlaylistSchema: Schema<IPlaylist> = new Schema(
  {
    title: {
      type: String,
      required: [true, "Playlist Title is required"],
    },
    description: {
      type: String,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    videos: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
        default: [],
      },
    ],
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Playlist Owner is required"],
    },
  },
  { timestamps: true }
);

PlaylistSchema.plugin(mongooseAggregatePaginate);

const Playlist: IPlaylistModel = model<IPlaylist, IPlaylistModel>(
  "Playlist",
  PlaylistSchema
);
export default Playlist;
