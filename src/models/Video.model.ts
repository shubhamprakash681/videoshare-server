import { Document, model, Model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface IVideo extends Document {
  videoFile: {
    public_id: string;
    url: string;
  };
  thumbnail: {
    public_id: string;
    url: string;
  };
  title: string;
  description: string;
  duration: number;
  views: number;
  isPublic: boolean;
  owner: Schema.Types.ObjectId;

  isNSFW: boolean;
  isScannedForNSFW: boolean;
}

interface IVideoModel extends Model<IVideo> {
  // Add aggregate pagination support
  aggregatePaginate: Function;
}

const videoSchema: Schema<IVideo> = new Schema(
  {
    videoFile: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },

    thumbnail: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },

    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },

    duration: {
      type: Number,
      required: true,
    },

    views: {
      type: Number,
      default: 0,
    },

    isPublic: {
      type: Boolean,
      default: true,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isNSFW: {
      type: Boolean,
      default: false,
    },
    isScannedForNSFW: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);
const Video: IVideoModel = model<IVideo, IVideoModel>("Video", videoSchema);

export default Video;
