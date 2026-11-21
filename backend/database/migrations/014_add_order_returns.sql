USE selfcheckout_pos;

-- Returns by transaction number (the order_id printed on the receipt).
--
-- orders.payment_method records how the order was paid so a return can be
-- refunded the same way. orders.student_id records whose voucher paid for
-- a voucher order. Orders created before this migration keep NULL in both
-- columns and are refunded to "original payment".
DELIMITER //

CREATE PROCEDURE add_order_payment_fields_if_missing()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME = 'payment_method'
    ) THEN
        ALTER TABLE orders
        ADD COLUMN payment_method VARCHAR(20) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME = 'student_id'
    ) THEN
        ALTER TABLE orders
        ADD COLUMN student_id VARCHAR(20) NULL;
    END IF;
END//

CALL add_order_payment_fields_if_missing()//
DROP PROCEDURE add_order_payment_fields_if_missing//

DELIMITER ;

-- One row per return. A single order can have several partial returns.
CREATE TABLE IF NOT EXISTS order_returns (
    return_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    refund_total DECIMAL(10,2) NOT NULL,
    refund_method VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_returns_order (order_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- The receipt lines (and quantities) given back in each return.
--
-- order_items.order_item_id is INT in schema.sql but BIGINT UNSIGNED in some
-- existing databases. A foreign key must match the referenced column's type
-- exactly, so read the real type and build the table with it.
DELIMITER //

CREATE PROCEDURE create_order_return_items_if_missing()
BEGIN
    DECLARE order_item_id_type VARCHAR(64);

    SELECT COLUMN_TYPE INTO order_item_id_type
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'order_item_id';

    SET @create_sql = CONCAT(
        'CREATE TABLE IF NOT EXISTS order_return_items (',
        '    return_item_id INT AUTO_INCREMENT PRIMARY KEY,',
        '    return_id INT NOT NULL,',
        '    order_item_id ', order_item_id_type, ' NOT NULL,',
        '    product_id INT NOT NULL,',
        '    quantity INT NOT NULL,',
        '    refund_each DECIMAL(10,2) NOT NULL,',
        '    INDEX idx_order_return_items_order_item (order_item_id),',
        '    FOREIGN KEY (return_id) REFERENCES order_returns(return_id) ON DELETE CASCADE,',
        '    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),',
        '    CHECK (quantity >= 1)',
        ')'
    );

    PREPARE create_stmt FROM @create_sql;
    EXECUTE create_stmt;
    DEALLOCATE PREPARE create_stmt;
END//

CALL create_order_return_items_if_missing()//
DROP PROCEDURE create_order_return_items_if_missing//

DELIMITER ;
