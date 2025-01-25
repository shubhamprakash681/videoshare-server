import express from "express";
import { isAuthenticatedUser } from "../middlewares/Auth.middleware";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistData,
  getPlaylistOptions,
  getPlaylists,
  updatePlaylist,
} from "../controllers/playlist.controller";
const playlistRouter = express.Router();

playlistRouter
  .route("/")
  .post(isAuthenticatedUser, createPlaylist)
  .get(isAuthenticatedUser, getPlaylists);
playlistRouter
  .route("/options/:videoId")
  .get(isAuthenticatedUser, getPlaylistOptions);
playlistRouter
  .route("/:playlistId")
  .put(isAuthenticatedUser, updatePlaylist)
  .delete(isAuthenticatedUser, deletePlaylist);

playlistRouter.route("/:playlistId").get(getPlaylistData);

export default playlistRouter;
