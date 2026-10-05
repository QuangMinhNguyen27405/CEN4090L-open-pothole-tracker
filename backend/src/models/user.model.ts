import { pool } from "../db.ts";

export type Role = "user" | "admin";

export type User = {
  id: number;
  email: string;
  username: string;
  role: Role;
  avatarUrl: string | null;
  firebaseUid: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithPassword = User & { passwordHash: string | null };

export const USER_COLUMNS = `
  id,
  email,
  username,
  role,
  avatar_url AS "avatarUrl",
  firebase_uid AS "firebaseUid",
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

export const UserModel = {
  findById: async (id: number): Promise<User | null> => {
    const { rows } = await pool.query<User>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  findByIdWithPassword: async (id: number): Promise<UserWithPassword | null> => {
    const { rows } = await pool.query<UserWithPassword>(
      `SELECT ${USER_COLUMNS}, password_hash AS "passwordHash"
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  findByEmail: async (email: string): Promise<UserWithPassword | null> => {
    const { rows } = await pool.query<UserWithPassword>(
      `SELECT ${USER_COLUMNS}, password_hash AS "passwordHash"
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ?? null;
  },

  create: async (data: {
    email: string;
    username: string;
    passwordHash?: string | null;
    firebaseUid?: string | null;
    avatarUrl?: string | null;
  }): Promise<User> => {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (email, username, password_hash, firebase_uid, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_COLUMNS}`,
      [
        data.email,
        data.username,
        data.passwordHash ?? null,
        data.firebaseUid ?? null,
        data.avatarUrl ?? null,
      ]
    );
    return rows[0]!;
  },

  update: async (
    id: number,
    data: { username?: string; email?: string; avatarUrl?: string }
  ): Promise<User | null> => {
    const { rows } = await pool.query<User>(
      `UPDATE users SET
         username = COALESCE($2, username),
         email = COALESCE($3, email),
         avatar_url = COALESCE($4, avatar_url),
         updated_at = now()
       WHERE id = $1 AND is_active
       RETURNING ${USER_COLUMNS}`,
      [id, data.username ?? null, data.email ?? null, data.avatarUrl ?? null]
    );
    return rows[0] ?? null;
  },

  setPassword: async (id: number, passwordHash: string): Promise<void> => {
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [id, passwordHash]
    );
  },

  deactivate: async (id: number): Promise<boolean> => {
    const { rowCount } = await pool.query(
      `UPDATE users SET is_active = false, updated_at = now()
       WHERE id = $1 AND is_active`,
      [id]
    );
    return rowCount === 1;
  },

  getStats: async (
    id: number
  ): Promise<{ potholesDetected: number; totalDetections: number; confirmations: number }> => {
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM potholes WHERE reported_by = $1)::int AS "potholesDetected",
         (SELECT coalesce(sum(detection_count), 0) FROM potholes WHERE reported_by = $1)::int
           AS "totalDetections",
         (SELECT count(*) FROM confirmations WHERE user_id = $1)::int AS "confirmations"`,
      [id]
    );
    return rows[0];
  },
};
