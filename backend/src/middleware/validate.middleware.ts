import type { RequestHandler } from "express";
import { z } from "zod";

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export type IdParams = z.infer<typeof idParams>;

export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

export const validate =
  (schemas: Schemas): RequestHandler<any, any, any, any> =>
  (req, _res, next) => {
    for (const key of ["body", "query", "params"] as const) {
      const schema = schemas[key];
      if (schema) {
        Object.defineProperty(req, key, {
          value: schema.parse(req[key]),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    next();
  };
