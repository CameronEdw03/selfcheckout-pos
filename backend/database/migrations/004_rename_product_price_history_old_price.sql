USE selfcheckout_pos;

DELIMITER //

CREATE PROCEDURE rename_product_price_history_old_price()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'product_price_history'
          AND COLUMN_NAME = 'old_price'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'product_price_history'
          AND COLUMN_NAME = 'previous_price'
    ) THEN
        ALTER TABLE product_price_history
        CHANGE COLUMN old_price previous_price DECIMAL(10,2) NOT NULL;
    END IF;
END//

CALL rename_product_price_history_old_price()//
DROP PROCEDURE rename_product_price_history_old_price//

DELIMITER ;
