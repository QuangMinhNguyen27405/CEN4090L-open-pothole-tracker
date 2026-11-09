ALTER TABLE potholes
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN reviewed_by integer REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz;

UPDATE potholes SET review_status = 'verified' WHERE verified;

CREATE INDEX potholes_review_queue_idx ON potholes (review_status, last_detected_at DESC);
