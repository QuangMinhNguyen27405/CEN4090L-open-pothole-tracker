import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { UserModel, type User } from "../models/user.model.ts";

export const UpdateUserSchema = z
  .object({
    username: z.string().min(2).max(100).optional(),
    avatarUrl: z.url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const UpdateMeSchema = z
  .object({
    username: z.string().min(2).max(100).optional(),
    email: z.email().optional(),
    avatarUrl: z.url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(100),
});

export const toUserResponse = (user: User) => ({
  id: String(user.id),
  email: user.email,
  username: user.username,
  role: user.role,
  avatarUrl: user.avatarUrl ?? "",
});

const canManage = (req: Request, userId: number) =>
  req.user?.id === userId || req.user?.role === "admin";

export const UserController = {
  async getMe(req: Request, res: Response) {
    const user = await UserModel.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ message: "Profile retrieved successfully", data: toUserResponse(user) });
  },

  async updateMe(req: Request, res: Response) {
    const payload = req.body as z.infer<typeof UpdateMeSchema>;

    if (payload.email) {
      const existing = await UserModel.findByEmail(payload.email);
      if (existing && existing.id !== req.user!.id) {
        res.status(400).json({ message: "Email already in use" });
        return;
      }
    }

    const updated = await UserModel.update(req.user!.id, payload);
    if (!updated) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ message: "Profile updated successfully", data: toUserResponse(updated) });
  },

  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body as z.infer<typeof ChangePasswordSchema>;

    const user = await UserModel.findByIdWithPassword(req.user!.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    if (!user.passwordHash) {
      res.status(400).json({ message: "Cannot change password for Google accounts" });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    await UserModel.setPassword(user.id, await bcrypt.hash(newPassword, 10));
    res.json({ message: "Password changed successfully", data: {} });
  },

  async getMyStats(req: Request, res: Response) {
    const stats = await UserModel.getStats(req.user!.id);
    res.json({
      message: "Statistics retrieved successfully",
      // detectionSessions stays 0 until detection sessions are stored
      data: { ...stats, detectionSessions: 0 },
    });
  },

  async getUser(req: Request, res: Response) {
    const user = await UserModel.findById(Number(req.params.id));
    if (!user?.isActive) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const { email: _email, ...publicProfile } = toUserResponse(user);
    res.json({ message: "User retrieved successfully", data: publicProfile });
  },

  async updateUser(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!canManage(req, id)) {
      res.status(403).json({ message: "Not allowed to update this user" });
      return;
    }

    const updated = await UserModel.update(id, req.body as z.infer<typeof UpdateUserSchema>);
    if (!updated) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ message: "User updated successfully", data: toUserResponse(updated) });
  },

  async deleteUser(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!canManage(req, id)) {
      res.status(403).json({ message: "Not allowed to delete this user" });
      return;
    }

    if (!(await UserModel.deactivate(id))) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ message: "User deleted successfully", data: {} });
  },
};
