USE selfcheckout_pos;

DELIMITER //

DROP PROCEDURE IF EXISTS enable_student_registration//

CREATE PROCEDURE enable_student_registration()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND INDEX_NAME = 'uq_users_student_id'
    ) THEN
        ALTER TABLE users
        ADD UNIQUE INDEX uq_users_student_id (student_id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart_items'
          AND CONSTRAINT_NAME = 'cart_items_ibfk_1'
          AND COLUMN_NAME = 'user_id'
          AND REFERENCED_TABLE_NAME = 'users'
          AND REFERENCED_COLUMN_NAME = 'user_id'
    ) THEN
        ALTER TABLE cart_items
        DROP FOREIGN KEY cart_items_ibfk_1;
    END IF;

    ALTER TABLE users
        MODIFY COLUMN user_id INT NOT NULL AUTO_INCREMENT;

    IF EXISTS (
        SELECT 1
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart_items'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart_items'
          AND COLUMN_NAME = 'user_id'
          AND REFERENCED_TABLE_NAME = 'users'
          AND REFERENCED_COLUMN_NAME = 'user_id'
    ) THEN
        ALTER TABLE cart_items
        ADD CONSTRAINT cart_items_ibfk_1
        FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
END//

CALL enable_student_registration()//
DROP PROCEDURE enable_student_registration//

DELIMITER ;
