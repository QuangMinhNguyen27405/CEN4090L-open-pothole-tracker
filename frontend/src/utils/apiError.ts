import { isAxiosError } from "axios";

type ApiErrorBody = {
  message?: unknown;
  error?: unknown;
};

const issueMessage = (issues: unknown[]): string | undefined => {
  const message = (issues[0] as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
};

// The API answers with { message }, { error: string }, or { error: issues[] }
// depending on which layer rejected the request.
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const body = error.response?.data as ApiErrorBody | string | undefined;
  if (!body || typeof body !== "object") return fallback;
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;
  if (Array.isArray(body.error)) return issueMessage(body.error) ?? fallback;
  return fallback;
};
