USE selfcheckout_pos;

DELIMITER //

CREATE PROCEDURE add_product_tax_exempt_if_missing()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'products'
          AND COLUMN_NAME = 'is_tax_exempt'
    ) THEN
        ALTER TABLE products
        ADD COLUMN is_tax_exempt BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END//

CALL add_product_tax_exempt_if_missing()//
DROP PROCEDURE add_product_tax_exempt_if_missing//

DELIMITER ;

CREATE TABLE IF NOT EXISTS courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    course_number VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(100) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS course_products (
    course_id INT NOT NULL,
    product_id INT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (course_id, product_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
