import express from "express";
import { router } from "./routes/index.ts";
import { errorHandler } from "./middleware/error.middleware.ts";
import { UPLOAD_DIR } from "./storage.ts";

export const app = express();

app.use(express.json());
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff"),
  }),
);
app.use("/api", router);
app.use(errorHandler);
