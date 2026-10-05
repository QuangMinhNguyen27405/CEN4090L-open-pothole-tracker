import { pool } from "../db.ts";

export type ConfirmationStatus = "still_there" | "not_there";

export type Confirmation = {
  potholeId: number;
  userId: number;
  status: ConfirmationStatus;
  confirmedAt: Date;
};

export type ConfirmationSummary = {
  still_there: number;
  not_there: number;
  total: number;
};

export const CONFIRMATION_COLUMNS = `
  pothole_id AS "potholeId",
  user_id AS "userId",
  CASE WHEN still_there THEN 'still_there' ELSE 'not_there' END AS status,
  created_at AS "confirmedAt"`;

export const ConfirmationModel = {
  // Returns null if this user already confirmed this pothole.
  create: async (data: {
    potholeId: number;
    userId: number;
    status: ConfirmationStatus;
  }): Promise<Confirmation | null> => {
    const { rows } = await pool.query<Confirmation>(
      `INSERT INTO confirmations (pothole_id, user_id, still_there)
       VALUES ($1, $2, $3)
       ON CONFLICT (pothole_id, user_id) DO NOTHING
       RETURNING ${CONFIRMATION_COLUMNS}`,
      [data.potholeId, data.userId, data.status === "still_there"]
    );
    return rows[0] ?? null;
  },

  findByPothole: async (potholeId: number): Promise<Confirmation[]> => {
    const { rows } = await pool.query<Confirmation>(
      `SELECT ${CONFIRMATION_COLUMNS} FROM confirmations
       WHERE pothole_id = $1
       ORDER BY created_at DESC`,
      [potholeId]
    );
    return rows;
  },

  summarize: (confirmations: Confirmation[]): ConfirmationSummary => {
    const stillThere = confirmations.filter((c) => c.status === "still_there").length;
    return {
      still_there: stillThere,
      not_there: confirmations.length - stillThere,
      total: confirmations.length,
    };
  },
};
