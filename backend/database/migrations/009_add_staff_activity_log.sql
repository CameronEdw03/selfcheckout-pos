USE selfcheckout_pos;

-- Records staff actions that are not already captured by
-- product_price_history or cart_item_price_history, such as
-- removing items from or canceling a student transaction.
CREATE TABLE IF NOT EXISTS staff_activity_log (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_username VARCHAR(50) NOT NULL,
    action VARCHAR(40) NOT NULL,
    student_id VARCHAR(20) NULL,
    product_id INT NULL,
    product_name VARCHAR(100) NULL,
    quantity INT NULL,
    amount DECIMAL(10,2) NULL,
    details VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_staff_activity_created_at (created_at),
    INDEX idx_staff_activity_staff (staff_username)
);
