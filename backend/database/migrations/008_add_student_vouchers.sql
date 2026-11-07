USE selfcheckout_pos;

CREATE TABLE IF NOT EXISTS student_vouchers (
    student_id VARCHAR(20) PRIMARY KEY,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    CHECK (balance >= 0)
);

-- Give every existing student a starting voucher balance.
-- INSERT IGNORE keeps balances that already exist.
INSERT IGNORE INTO student_vouchers (student_id, balance)
SELECT student_id, 250.00
FROM users
WHERE role = 'student'
  AND student_id IS NOT NULL;
