import { pool } from "../db.ts";
import { POTHOLE_COLUMNS, type Pothole } from "./pothole.model.ts";

export type NearbyPothole = Pothole & { distanceMeters: number };

export const NearbyPotholesModel = {
  async findNearby(options: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    limit: number;
  }): Promise<NearbyPothole[]> {
    const { rows } = await pool.query<NearbyPothole>(
      `SELECT ${POTHOLE_COLUMNS},
              ST_Distance(
                location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS "distanceMeters"
         FROM potholes
        WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )
        ORDER BY "distanceMeters", id
        LIMIT $4`,
      [options.longitude, options.latitude, options.radiusMeters, options.limit],
    );

    return rows;
  },
};
