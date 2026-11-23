USE selfcheckout_pos;

CREATE TABLE IF NOT EXISTS supply_bundles (
    bundle_id INT AUTO_INCREMENT PRIMARY KEY,
    bundle_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supply_bundle_products (
    bundle_id INT NOT NULL,
    product_id INT NOT NULL,
    PRIMARY KEY (bundle_id, product_id),
    FOREIGN KEY (bundle_id) REFERENCES supply_bundles(bundle_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
