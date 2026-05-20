-- Teacher-defined enrollment cap. NULL means unlimited.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS max_students integer;
