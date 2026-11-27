USE selfcheckout_pos;

SET @has_unique_index = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'student_id'
      AND NON_UNIQUE = 0
);

SET @sql = IF(
    @has_unique_index = 0,
    'ALTER TABLE users ADD UNIQUE INDEX uq_users_student_id (student_id)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS campus_cards (
    student_id VARCHAR(20) PRIMARY KEY,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES users(student_id),
    CHECK (balance >= 0)
);