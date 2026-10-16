USE selfcheckout_pos;

ALTER TABLE products
ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
