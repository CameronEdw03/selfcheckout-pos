USE selfcheckout_pos;

CREATE TABLE IF NOT EXISTS sizes (
    size_id INT AUTO_INCREMENT PRIMARY KEY,
    size_name VARCHAR(10) UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_sizes (
    product_id INT NOT NULL,
    size_id INT NOT NULL,
    PRIMARY KEY (product_id, size_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (size_id) REFERENCES sizes(size_id) ON DELETE CASCADE
);

INSERT IGNORE INTO sizes (size_name, sort_order) VALUES
('S', 1),
('M', 2),
('L', 3),
('XL', 4),
('XXL', 5);

-- Give every clothing product all sizes.
INSERT IGNORE INTO product_sizes (product_id, size_id)
SELECT p.product_id, s.size_id
FROM products p
CROSS JOIN sizes s
WHERE p.category IN ('Apparel', 'Shirts');
