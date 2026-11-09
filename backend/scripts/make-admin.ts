import { pool } from "../src/db.ts";
import { UserModel } from "../src/models/user.model.ts";

export type GrantAdminResult = "granted" | "already_admin" | "not_found" | "inactive";

export const grantAdmin = async (email: string): Promise<GrantAdminResult> => {
  const user = await UserModel.findByEmail(email);
  if (!user) return "not_found";
  if (!user.isActive) return "inactive";
  if (user.role === "admin") return "already_admin";

  await UserModel.setRole(user.id, "admin");
  return "granted";
};

const outcomes: Record<GrantAdminResult, { message: string; failed: boolean }> = {
  granted: { message: "is now an admin", failed: false },
  already_admin: { message: "is already an admin", failed: false },
  not_found: { message: "does not match any account", failed: true },
  inactive: { message: "belongs to a deactivated account", failed: true },
};

if (import.meta.main) {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run make-admin -- <email>");
    process.exitCode = 1;
  } else {
    try {
      const { message, failed } = outcomes[await grantAdmin(email)];
      (failed ? console.error : console.log)(`${email} ${message}`);
      if (failed) process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}
