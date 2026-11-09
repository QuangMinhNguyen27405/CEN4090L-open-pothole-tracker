DROP INDEX potholes_review_queue_idx;

ALTER TABLE potholes
  DROP COLUMN reviewed_at,
  DROP COLUMN reviewed_by,
  DROP COLUMN review_status;
