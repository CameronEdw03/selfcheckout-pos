USE selfcheckout_pos;

-- Multi-item pricing set up by managers and applied automatically at the
-- register. Two kinds of deal:
--   bundle_price  : "3 for $5"            -> quantity = 3, bundle_price = 5.00
--   buy_get_free  : "Buy 2, get 1 free"   -> quantity = 2, free_quantity = 1
CREATE TABLE IF NOT EXISTS multi_item_deals (
    deal_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    deal_type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    free_quantity INT NULL,
    bundle_price DECIMAL(10,2) NULL,
    starts_on DATE NULL,
    ends_on DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_multi_item_deals_product (product_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    CHECK (deal_type IN ('bundle_price', 'buy_get_free')),
    CHECK (quantity >= 1)
);
