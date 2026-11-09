import { pool } from "../db.ts";

export type ConfirmationStatus = "still_there" | "not_there";

export type Confirmation = {
  potholeId: number;
  userId: number;
  username?: string;
  status: ConfirmationStatus;
  confirmedAt: Date;
};

export type ConfirmationSummary = {
  still_there: number;
  not_there: number;
  total: number;
};

export type ViewerConfirmationSummary = {
  still_there: number;
  not_there: number;
  my_response: boolean | null;
};

export const CONFIRMATION_COLUMNS = `
  pothole_id AS "potholeId",
  user_id AS "userId",
  CASE WHEN still_there THEN 'still_there' ELSE 'not_there' END AS status,
  created_at AS "confirmedAt"`;

export const ConfirmationModel = {
  findByPothole: async (potholeId: number): Promise<Confirmation[]> => {
    const { rows } = await pool.query<Confirmation>(
      `SELECT ${CONFIRMATION_COLUMNS},
         (SELECT username FROM users WHERE users.id = confirmations.user_id) AS username
       FROM confirmations
       WHERE pothole_id = $1
       ORDER BY created_at DESC`,
      [potholeId]
    );
    return rows;
  },

  // Returns null when the report is unknown or has been rejected.
  findViewerSummary: async (
    potholeId: number,
    userId: number | null
  ): Promise<ViewerConfirmationSummary | null> => {
    const { rows } = await pool.query<ViewerConfirmationSummary>(
      `SELECT
         count(c.user_id) FILTER (WHERE c.still_there)::int AS still_there,
         count(c.user_id) FILTER (WHERE NOT c.still_there)::int AS not_there,
         bool_or(c.still_there) FILTER (WHERE c.user_id = $2::int) AS my_response
       FROM potholes p
       LEFT JOIN confirmations c ON c.pothole_id = p.id
       WHERE p.id = $1 AND p.review_status <> 'rejected'
       GROUP BY p.id`,
      [potholeId, userId]
    );
    return rows[0] ?? null;
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
