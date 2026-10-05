import { Router } from "express";
import {
  ChangePasswordSchema,
  UpdateMeSchema,
  UpdateUserSchema,
  UserController,
} from "../controllers/user.controller.ts";
import { authenticate } from "../middleware/auth.middleware.ts";
import { idParams, validate } from "../middleware/validate.middleware.ts";

export const userRouter = Router();

// /me routes must come before /:id
userRouter.get("/me", authenticate, UserController.getMe);
userRouter.put("/me", authenticate, validate({ body: UpdateMeSchema }), UserController.updateMe);
userRouter.put(
  "/me/password",
  authenticate,
  validate({ body: ChangePasswordSchema }),
  UserController.changePassword,
);
userRouter.get("/me/stats", authenticate, UserController.getMyStats);

userRouter.get("/:id", validate({ params: idParams }), UserController.getUser);
userRouter.put(
  "/:id",
  authenticate,
  validate({ params: idParams, body: UpdateUserSchema }),
  UserController.updateUser,
);
userRouter.delete(
  "/:id",
  authenticate,
  validate({ params: idParams }),
  UserController.deleteUser,
);
