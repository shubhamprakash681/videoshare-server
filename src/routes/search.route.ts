import express from "express";
import { getTopSearches } from "../controllers/search.controller";

const searchRouter = express.Router();
searchRouter.route("/").get(getTopSearches);

export default searchRouter;
