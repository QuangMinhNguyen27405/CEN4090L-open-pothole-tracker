ALTER TABLE detections
  ADD COLUMN user_id integer REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX detections_user_id_idx ON detections (user_id);
