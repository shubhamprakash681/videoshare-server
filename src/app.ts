import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import ErrorHandler from "./utils/ErrorHandler";
import { StatusCodes } from "http-status-codes";
import { errorMiddleware } from "./middlewares/Error.middleware";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "../swagger-output.json";

const app = express();

// body-parser
app.use(express.json({ limit: "100mb" }));
// cookie-parsr
app.use(cookieParser());
// cors
app.use(
  cors({
    origin: process.env.ORIGIN,
    methods: ["POST", "PUT", "GET", "DELETE", "OPTIONS", "HEAD"],
    credentials: true,
  })
);
// url encoded -> for parsing incoming requests with URL-encoded payloads
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// for serving static files
app.use(express.static("public"));

// Setting up Swagger UI
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// routes imports
import {
  healthcheckRouter,
  userRouter,
  videoRouter,
  commentRouter,
  dashboardRouter,
  likeRouter,
  subscriptionRouter,
  tweetRouter,
  playlistRouter,
  searchRouter,
} from "./routes";

// routes use
app.use("/api/v1/", healthcheckRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/like", likeRouter);
app.use("/api/v1/subscription", subscriptionRouter);
app.use("/api/v1/video", videoRouter);
app.use("/api/v1/comment", commentRouter);
app.use("/api/v1/tweet", tweetRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/search", searchRouter);

// handling unknown routes
app.all("*", (req, res, next) => {
  next(
    new ErrorHandler(
      `Route ${req.originalUrl} was not found`,
      StatusCodes.NOT_FOUND
    )
  );
});

// error middleware - For handling all instances of next(new ErrorHandler())
app.use(errorMiddleware);

export default app;
