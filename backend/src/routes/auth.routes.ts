import { Router } from "express";
import {
  AuthController,
  GoogleLoginSchema,
  LoginSchema,
  SignupSchema,
} from "../controllers/auth.controller.ts";
import { validate } from "../middleware/validate.middleware.ts";

export const authRouter = Router();

authRouter.post("/signup", validate({ body: SignupSchema }), AuthController.signup);
authRouter.post("/login", validate({ body: LoginSchema }), AuthController.login);
authRouter.post("/google", validate({ body: GoogleLoginSchema }), AuthController.googleLogin);
authRouter.post("/logout", AuthController.logout);
authRouter.get("/me", AuthController.me);
