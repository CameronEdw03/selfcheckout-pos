USE selfcheckout_pos;

DELIMITER //

CREATE PROCEDURE add_student_profile_fields_if_missing()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(254) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'phone'
    ) THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL;
    END IF;
END//

CALL add_student_profile_fields_if_missing()//
DROP PROCEDURE add_student_profile_fields_if_missing//

DELIMITER ;

UPDATE users
SET student_id = CONCAT('S', user_id)
WHERE role = 'student'
  AND (student_id IS NULL OR TRIM(student_id) = '');
