CREATE DATABASE IF NOT EXISTS selfcheckout_pos;

USE selfcheckout_pos;

CREATE TABLE IF NOT EXISTS products (

    product_id INT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(255),

    price DECIMAL(10,2) NOT NULL,

    quantity INT NOT NULL DEFAULT 0,

    category VARCHAR(50)

);

CREATE TABLE IF NOT EXISTS users (

    user_id INT PRIMARY KEY,

    username VARCHAR(50) UNIQUE NOT NULL,

    password VARCHAR(255) NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'student',

    student_id VARCHAR(20)

);