import type { CookieOptions, Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { UserModel, type Role } from "../models/user.model.ts";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: Role };
    }
  }
}

export const ACCESS_TOKEN_COOKIE = "access_token";

export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const jwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
};

export const signAccessToken = (userId: number): string =>
  jwt.sign({ id: userId }, jwtSecret(), { expiresIn: "2w" });

const getAccessToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(/;\s*/)) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    if (pair.substring(0, idx).trim() === ACCESS_TOKEN_COOKIE) {
      return decodeURIComponent(pair.substring(idx + 1));
    }
  }
  return undefined;
};

// Resolves the active user behind the request's token, or null.
export const getUserFromRequest = async (req: Request) => {
  const token = getAccessToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret()) as { id: number };
    const user = await UserModel.findById(decoded.id);
    return user?.isActive ? user : null;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return null;
    throw err;
  }
};

export const authenticate: RequestHandler = async (req, res, next) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  req.user = { id: user.id, role: user.role };
  next();
};

// Like authenticate, but lets anonymous requests through.
export const attachUserFromToken: RequestHandler = async (req, _res, next) => {
  const user = await getUserFromRequest(req);
  if (user) req.user = { id: user.id, role: user.role };
  next();
};

// Use after authenticate.
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};
