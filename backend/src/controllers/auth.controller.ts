import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { getFirebaseAuth } from "../config/firebase.ts";
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
  getUserFromRequest,
  signAccessToken,
} from "../middleware/auth.middleware.ts";
import { UserModel, type User } from "../models/user.model.ts";
import { toUserResponse } from "./user.controller.ts";

export const SignupSchema = z.object({
  email: z.email(),
  username: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const GoogleLoginSchema = z.object({
  token: z.string(),
});

const UNIQUE_VIOLATION = "23505";

const sendLoggedIn = (res: Response, user: User, message: string) => {
  res
    .cookie(ACCESS_TOKEN_COOKIE, signAccessToken(user.id), accessTokenCookieOptions)
    .json({ message, data: toUserResponse(user) });
};

export const AuthController = {
  async signup(req: Request, res: Response) {
    const { email, username, password } = req.body as z.infer<typeof SignupSchema>;

    if (await UserModel.findByEmail(email)) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    try {
      const user = await UserModel.create({
        email,
        username,
        passwordHash: await bcrypt.hash(password, 10),
      });
      res.status(201).json({ message: "User created successfully", data: toUserResponse(user) });
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        res.status(409).json({ message: "Email already exists" });
        return;
      }
      throw err;
    }
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;

    const user = await UserModel.findByEmail(email);
    if (!user || !user.isActive) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    if (!user.passwordHash) {
      res.status(401).json({ message: "Please login with Google" });
      return;
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    sendLoggedIn(res, user, "Login successful");
  },

  async googleLogin(req: Request, res: Response) {
    const { token } = req.body as z.infer<typeof GoogleLoginSchema>;
    if (!process.env.FIREBASE_APPLICATION_CREDENTIALS) {
      res.status(503).json({ message: "Google login is not configured" });
      return;
    }
    const firebaseAuth = getFirebaseAuth();

    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(token);
    } catch {
      res.status(401).json({ message: "Invalid Firebase ID token" });
      return;
    }

    const { uid, email, picture, name } = decoded;
    if (!email) {
      res.status(401).json({ message: "Email not found in Firebase token" });
      return;
    }

    let user: User | null = await UserModel.findByEmail(email);
    if (!user) {
      user = await UserModel.create({
        email,
        username: name ?? email.split("@")[0]!,
        firebaseUid: uid,
        avatarUrl: picture ?? null,
      });
    } else if (!user.firebaseUid) {
      res.status(401).json({ message: "Please login with email and password" });
      return;
    } else if (!user.isActive) {
      res.status(401).json({ message: "Account is deactivated" });
      return;
    }

    sendLoggedIn(res, user, "Google login successful");
  },

  async logout(_req: Request, res: Response) {
    res
      .clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions)
      .json({ message: "Logout successful", data: {} });
  },

  async me(req: Request, res: Response) {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    res.json({ message: "User retrieved successfully", user: toUserResponse(user) });
  },
};
