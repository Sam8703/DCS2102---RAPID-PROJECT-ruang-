-- ========================================================================
-- RUANG HOMESTAY MANAGEMENT SYSTEM - DATABASE SCHEMA (ruang_db.sql)
-- Purpose: Complete database initialization script for fresh setups.
-- ========================================================================

-- 1. DATABASE CREATION & SELECTION
-- Creates a fresh database instance named 'ruang_db' with utf8mb4 encoding
-- to support special characters and emojis.
CREATE DATABASE IF NOT EXISTS ruang_db
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ruang_db;

-- 2. RESET TABLES (CLEAN SLATE)
-- Drop existing tables in reverse dependency order (child tables first)
-- to avoid foreign key constraint errors.
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS homestays;
DROP TABLE IF EXISTS users;

-- ========================================================================
-- TABLE 1: users
-- Purpose: Stores login credentials, roles, and contact info for all 
-- platform accounts (Admins, Room Owners/Managers, and Customers).
-- ========================================================================
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,                         -- Unique user ID (e.g., 'admin-1', 'owner-1')[cite: 25]
    name VARCHAR(100) NOT NULL,                         -- User's full name[cite: 25]
    email VARCHAR(100) NOT NULL UNIQUE,                 -- Login identifier (must be unique across the system)[cite: 25]
    contact VARCHAR(30) NOT NULL,                       -- Contact phone number used for booking coordination[cite: 25]
    role ENUM('Admin', 'Owner', 'Customer') 
         NOT NULL DEFAULT 'Customer',                   -- Access permission role[cite: 25]
    status ENUM('Enabled', 'Disabled') 
         DEFAULT 'Enabled',                             -- Account toggle (Admins can disable suspicious accounts)[cite: 25]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP      -- Audit timestamp when account was registered[cite: 25]
);

-- ========================================================================
-- TABLE 2: homestays
-- Purpose: Stores homestay property records, pricing, capacity, 
-- facilities, and gallery photo paths linked to property owners.
-- ========================================================================
CREATE TABLE homestays (
    id VARCHAR(50) PRIMARY KEY,                         -- Unique property ID (e.g., 'stay-1')[cite: 25]
    owner_id VARCHAR(50) NOT NULL,                      -- Foreign Key linking to users.id (Owner role)[cite: 25]
    name VARCHAR(150) NOT NULL,                         -- Public property display name[cite: 25]
    location VARCHAR(100) NOT NULL,                     -- City/State in Malaysia (used by search filter & admin analytics)[cite: 25]
    price_per_night DECIMAL(10,2) NOT NULL,             -- Nightly rental rate in RM[cite: 25]
    capacity INT NOT NULL,                              -- Maximum allowed guests[cite: 25]
    description TEXT NOT NULL,                          -- Full property overview displayed on the details page[cite: 25]
    facilities TEXT NOT NULL,                           -- Comma-separated amenities (Wi-Fi, Air conditioning, etc.)[cite: 25]
    images TEXT NOT NULL,                               -- Newline-separated (\n) relative paths to local images[cite: 25]
    type VARCHAR(50) DEFAULT 'Homestay',                -- Property category label (e.g., 'Pool villa', 'City apartment')[cite: 25]
    status ENUM('Active', 'Inactive') 
         DEFAULT 'Active',                              -- Visibility flag (Active = visible to guests; Inactive = hidden)[cite: 25]
    rating DECIMAL(3,2) DEFAULT 4.90,                   -- Average review rating score[cite: 25]
    reviews INT DEFAULT 20,                             -- Total number of guest reviews[cite: 25]
    FOREIGN KEY (owner_id) REFERENCES users(id) 
        ON DELETE CASCADE                               -- If an owner is deleted, remove their homestay listings[cite: 25]
);

-- ========================================================================
-- TABLE 3: bookings
-- Purpose: Stores guest reservations, selected dates, calculated totals,
-- guest contact information, and payment/approval workflow statuses.
-- ========================================================================
CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,                         -- Unique booking reference code (e.g., 'HB-1001')[cite: 25]
    user_id VARCHAR(50) NOT NULL,                       -- Foreign Key linking to users.id (Customer account)[cite: 25]
    homestay_id VARCHAR(50) NOT NULL,                   -- Foreign Key linking to homestays.id (Booked property)[cite: 25]
    customer_name VARCHAR(100) NOT NULL,                -- Guest full name captured at reservation time[cite: 25]
    customer_email VARCHAR(100) NOT NULL,               -- Guest email for confirmation and lookup[cite: 25]
    customer_contact VARCHAR(30) NOT NULL,              -- Guest phone number for owner communication[cite: 25]
    check_in_date DATE NOT NULL,                        -- Arrival date (YYYY-MM-DD)[cite: 25]
    check_out_date DATE NOT NULL,                       -- Departure date (YYYY-MM-DD)[cite: 25]
    number_of_guests INT NOT NULL,                      -- Guest count specified during booking[cite: 25]
    nightly_rate DECIMAL(10,2) NOT NULL,                -- Property rate locked in at reservation time[cite: 25]
    total_amount DECIMAL(10,2) NOT NULL,                -- Calculated total: (nights * nightly_rate)[cite: 25]
    status ENUM('Pending', 'Confirmed', 'Cancelled', 'Completed') 
         DEFAULT 'Pending',                             -- Workflow status managed by Owners and Admins[cite: 25]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- Booking submission timestamp[cite: 25]
    FOREIGN KEY (homestay_id) REFERENCES homestays(id) 
        ON DELETE CASCADE                               -- If a property is deleted, cascade remove its booking logs[cite: 25]
);

-- ========================================================================
-- INITIAL SEED DATA: USERS
-- Purpose: Default test accounts for Admin, Room Owners, and Customers.
-- ========================================================================
INSERT INTO users (id, name, email, contact, role, status) VALUES
('admin-1',    'Amira Hassan', 'admin@demo.test',  '0123456780', 'Admin',    'Enabled'),
('owner-1',    'Daniel Tan',   'daniel@demo.test', '0123456781', 'Owner',    'Enabled'),
('owner-2',    'Nur Aisyah',   'aisyah@demo.test', '0123456782', 'Owner',    'Enabled'),
('customer-1', 'Sarah Lim',    'sarah@demo.test',  '0123456783', 'Customer', 'Enabled'),
('customer-2', 'Adam Lee',     'adam@demo.test',   '0123456784', 'Customer', 'Enabled');

-- ========================================================================
-- INITIAL SEED DATA: HOMESTAYS
-- Purpose: Four core properties across Malaysian destinations with Air 
-- conditioning included and multiple image gallery paths linked locally.
-- ========================================================================
INSERT INTO homestays (id, owner_id, name, location, price_per_night, capacity, description, facilities, images, type, status, rating, reviews) VALUES
('stay-1', 'owner-1', 'Palm House', 'Melaka', 450.00, 6, 'A spacious getaway with a welcoming porch, private pool, and sunlit spaces near heritage streets.', 'Air conditioning, Wi-Fi, Private pool, Kitchen, Free parking', 'images/PalmHouse.jpg\nimages/PalmHouseK.jpg\nimages/PalmHouseL.jpg\nimages/PalmHouseP.jpg\nimages/PalmHouseR.jpg', 'Bungalow', 'Active', 4.98, 24),
('stay-2', 'owner-2', 'City Loft', 'Kuala Lumpur', 300.00, 4, 'A furnished city retreat with floor-to-ceiling skyline views of the Petronas Twin Towers.', 'Air conditioning, Wi-Fi, Kitchen, City view', 'images/CityLoft.jpg\nimages/CityLoftK.jpg\nimages/CityLoftL.jpg\nimages/CityLoftR.jpg', 'City apartment', 'Active', 4.92, 31),
('stay-3', 'owner-1', 'Serene Home', 'Penang', 330.00, 5, 'A contemporary modern townhouse tucked into a peaceful island neighbourhood.', 'Air conditioning, Wi-Fi, Kitchen, Free parking', 'images/SereneHome.jpg\nimages/SereneHomeB.jpg\nimages/SereneHomeK.jpg\nimages/SereneHomeL.jpg\nimages/SereneHomeR.jpg', 'Terrace house', 'Active', 4.95, 38),
('stay-4', 'owner-2', 'Hillside Cabin', 'Ipoh', 220.00, 2, 'A warm multi-level timber retreat with ambient rooftop lighting and hillside breezes.', 'Air conditioning, Wi-Fi, Mountain view, Free parking', 'images/HillsideCabin.jpg\nimages/HillsideCabinK.jpg\nimages/HillsideCabinR.jpg\nimages/HillsideCabinV.jpg', 'Vacation house', 'Active', 4.89, 52);

-- ========================================================================
-- INITIAL SEED DATA: SAMPLE BOOKING
-- Purpose: Pre-populates a verified reservation so that Admin analytics,
-- Room Owner workspaces, and customer booking logs display active records.
-- ========================================================================
INSERT INTO bookings (id, user_id, homestay_id, customer_name, customer_email, customer_contact, check_in_date, check_out_date, number_of_guests, nightly_rate, total_amount, status) VALUES
(
    'HB-1001', 
    'customer-1', 
    'stay-1', 
    'Sarah Lim', 
    'sarah@demo.test', 
    '0123456783', 
    DATE_ADD(CURDATE(), INTERVAL 5 DAY), 
    DATE_ADD(CURDATE(), INTERVAL 8 DAY), 
    2, 
    320.00, 
    960.00, 
    'Confirmed'
);