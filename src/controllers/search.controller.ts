import { NextFunction, Request, Response } from "express";
import AsyncHandler from "../utils/AsyncHandler";
import Search from "../models/Search";
import { StatusCodes } from "http-status-codes";
import APIResponse from "../utils/APIResponse";

export const getTopSearches = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { limit } = req.query as unknown as { limit: number };

    const topSearches = await Search.find().limit(+limit);

    res
      .status(StatusCodes.OK)
      .json(
        new APIResponse(
          StatusCodes.OK,
          "Top Searhes fetched successfully",
          topSearches
        )
      );
  }
);

export const updateSearchDb = async (
  searchText: string,
  next: NextFunction
) => {
  if (!searchText.trim().length) return;

  try {
    const isExistingSearch = await Search.findOne({
      searchText: searchText.trim().toLowerCase(),
    });

    if (isExistingSearch) {
      isExistingSearch.count += 1;

      await isExistingSearch.save();
    } else {
      await Search.create({ searchText: searchText.trim().toLowerCase() });
    }

    // remove older entries if total count exceeds 10k
    const oldSearches = await Search.find()
      .sort({ count: -1, updatedAt: -1 })
      .skip(10000);

    if (oldSearches.length) {
      for (let i = 0; i < oldSearches.length; i += 1) {
        oldSearches[i].deleteOne();
      }
    }
  } catch (error) {
    next(error);
  }
};
