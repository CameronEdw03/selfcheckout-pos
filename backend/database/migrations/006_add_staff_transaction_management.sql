USE selfcheckout_pos;

UPDATE users
SET role = 'employee'
WHERE username = '123Staff'
  AND role = 'taff';

CREATE TABLE IF NOT EXISTS cart_item_price_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    previous_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DELIMITER //

CREATE PROCEDURE add_cart_item_discount_fields_if_missing()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart_items'
          AND COLUMN_NAME = 'discounted_price'
    ) THEN
        ALTER TABLE cart_items
        ADD COLUMN discounted_price DECIMAL(10,2) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart_items'
          AND COLUMN_NAME = 'discount_reason'
    ) THEN
        ALTER TABLE cart_items
        ADD COLUMN discount_reason VARCHAR(500) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart_items'
          AND COLUMN_NAME = 'discounted_by'
    ) THEN
        ALTER TABLE cart_items
        ADD COLUMN discounted_by VARCHAR(50) NULL;
    END IF;
END//

CALL add_cart_item_discount_fields_if_missing()//
DROP PROCEDURE add_cart_item_discount_fields_if_missing//

DELIMITER ;
