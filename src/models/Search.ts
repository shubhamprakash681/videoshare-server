import { Document, model, Model, Schema } from "mongoose";

interface ISearch extends Document {
  searchText: string;
  count: number;
}

const SearchSchema: Schema<ISearch> = new Schema(
  {
    searchText: {
      type: String,
      unique: true,
      required: [true, "SearchText is required."],
    },
    count: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

const Search = model<ISearch, Model<ISearch>>("Search", SearchSchema);
export default Search;
