USE selfcheckout_pos;

DELIMITER //

CREATE PROCEDURE add_scheduled_product_sale_columns()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'products'
          AND COLUMN_NAME = 'sale_price'
    ) THEN
        ALTER TABLE products
            ADD COLUMN sale_price DECIMAL(10,2) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'products'
          AND COLUMN_NAME = 'sale_start_date'
    ) THEN
        ALTER TABLE products
            ADD COLUMN sale_start_date DATE NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'products'
          AND COLUMN_NAME = 'sale_end_date'
    ) THEN
        ALTER TABLE products
            ADD COLUMN sale_end_date DATE NULL;
    END IF;
END//

CALL add_scheduled_product_sale_columns()//
DROP PROCEDURE add_scheduled_product_sale_columns//

DELIMITER ;
