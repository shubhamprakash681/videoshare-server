import express from "express";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistOptions,
  getPlaylists,
} from "../controllers/playlist.controller";
const playlistRouter = express.Router();

playlistRouter.use(isAuthenticatedUser);

playlistRouter.route("/").post(createPlaylist).get(getPlaylists);
playlistRouter.route("/options/:videoId").get(getPlaylistOptions);
playlistRouter.route("/:playlistId").delete(deletePlaylist);

export default playlistRouter;
