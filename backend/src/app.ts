import express from "express";
import { router } from "./routes/index.ts";
import { errorHandler } from "./middleware/error.middleware.ts";

export const app = express();

app.use(express.json());
app.use("/api", router);
app.use(errorHandler);
