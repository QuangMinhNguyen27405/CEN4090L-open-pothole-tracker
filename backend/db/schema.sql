CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  password_hash text,
  firebase_uid text UNIQUE,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE potholes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location geography(Point, 4326) NOT NULL,
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  detection_count integer NOT NULL DEFAULT 1 CHECK (detection_count > 0),
  verified boolean NOT NULL DEFAULT false,
  reported_by integer REFERENCES users (id) ON DELETE SET NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX potholes_location_idx ON potholes USING gist (location);

CREATE TABLE detections (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pothole_id integer NOT NULL REFERENCES potholes (id) ON DELETE CASCADE,
  location geography(Point, 4326) NOT NULL,
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  model_version text NOT NULL,
  gps_accuracy real CHECK (gps_accuracy >= 0),
  image_path text,
  captured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX detections_pothole_id_idx ON detections (pothole_id);

CREATE TABLE confirmations (
  pothole_id integer NOT NULL REFERENCES potholes (id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  still_there boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pothole_id, user_id)
);
