USE selfcheckout_pos;

INSERT INTO products

(product_id, name, description, price, quantity, category)

VALUES

(1001, 'To Kill a Mockingbird', 'Fiction / Harper Lee', 12.99, 8, 'Books'),

(1002, 'The Great Gatsby', 'Fiction / F. Scott Fitzgerald', 10.99, 6, 'Books'),

(1003, '1984', 'Dystopian Fiction / George Orwell', 11.99, 7, 'Books'),

(1004, 'The Hobbit', 'Fantasy / J.R.R. Tolkien', 14.99, 5, 'Books'),

(1005, 'The Hunger Games', 'Dystopian Fiction / Suzanne Collins', 13.99, 9, 'Books'),

(1006, 'Harry Potter and the Sorcerer''s Stone', 'Fantasy / J.K. Rowling', 14.99, 10, 'Books'),

(1007, 'The Outsiders', 'Young Adult Fiction / S.E. Hinton', 9.99, 6, 'Books'),

(1008, 'The Giver', 'Dystopian Fiction / Lois Lowry', 10.99, 7, 'Books'),

(1009, 'Of Mice and Men', 'Fiction / John Steinbeck', 9.99, 5, 'Books'),

(1010, 'Fahrenheit 451', 'Dystopian Fiction / Ray Bradbury', 11.99, 8, 'Books'),

(1011, 'Doritos Nacho Cheese', 'Corn chips / Nacho Cheese', 1.75, 20, 'Snacks'),

(1012, 'Lay''s Classic Potato Chips', 'Potato chips / Original', 1.50, 18, 'Snacks'),

(1013, 'Cheez-It Crackers', 'Cheese crackers / Original', 1.75, 15, 'Snacks'),

(1014, 'Goldfish Crackers', 'Cheese crackers / Cheddar', 1.50, 16, 'Snacks'),

(1015, 'Oreo Cookies', 'Cookies / Chocolate Sandwich', 1.50, 14, 'Snacks'),

(1016, 'Nature Valley Granola Bar', 'Granola bar / Oats & Honey', 1.25, 20, 'Snacks'),

(1017, 'Pop-Tarts', 'Pastry / Strawberry', 1.75, 12, 'Snacks'),

(1018, 'M&M''s', 'Candy / Milk Chocolate', 1.50, 15, 'Snacks'),

(1019, 'Rice Krispies Treat', 'Cereal bar / Marshmallow', 1.25, 17, 'Snacks'),

(1020, 'Skittles', 'Candy / Fruity', 1.50, 13, 'Snacks'),

(1021, 'Scantron Form', 'Standard Exam Answer Sheet', 0.50, 50, 'Exam Supplies'),

(1022, 'Acrylic Paint Set', '12-Color Acrylic Paint Set', 8.99, 10, 'Art Supplies'),

(1023, 'College T-Shirt', 'Dallas College Cotton T-Shirt', 19.99, 12, 'Apparel'),

(1024, 'Scientific Calculator', 'Basic Scientific Calculator', 14.99, 8, 'Course Supplies'),

(1025, 'Introduction to Programming', 'Programming Fundamentals Textbook', 59.99, 5, 'Books');



INSERT INTO users

(user_id, username, password, role, student_id)

VALUES

(1, '123Boss', 'testpassword', 'manager', NULL),

(2, 'james.wilson', 'testpassword', 'student', 'S10001'),

(3, 'maya.johnson', 'testpassword', 'student', 'S10002'),

(4, 'ethan.davis', 'testpassword', 'student', 'S10003'),

(5, 'olivia.brown', 'testpassword', 'student', 'S10004'),

(6, 'noah.miller', 'testpassword', 'student', 'S10005'),

(7, 'ava.williams', 'testpassword', 'student', 'S10006'),

(8, 'liam.anderson', 'testpassword', 'student', 'S10007'),

(9, 'sophia.thomas', 'testpassword', 'student', 'S10008'),

(10, 'mason.jackson', 'testpassword', 'student', 'S10009'),

(11, 'mia.harris', 'testpassword', 'student', 'S10010');

-- -- Zulika as a manager I can insert categories

-- INSERT INTO categories (category_name, description)
-- VALUES
--     ('Snacks', 'Chips, candy, cookies, and other snack foods'),
--     ('Drinks', 'Water, juice, soda, coffee, and other beverages'),
--     ('Stationery', 'Pens, pencils, notebooks, folders, and writing supplies'),
--     ('Exam Supplies', 'Items needed for exams such as calculators, pencils, and erasers'),
--     ('Art Supplies', 'Drawing, painting, crafting, and other art materials'),
--     ('Apparel', 'Clothing and accessories such as shirts, hoodies, hats, and bags'),
--     ('Course Supplies', 'Supplies and materials required for specific courses'),
--     ('Books', 'Textbooks, reference books, and other educational books');