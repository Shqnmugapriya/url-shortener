-- Schema for URL Shortener + Analytics

-- Enable UUID extension if needed (not strictly required here since we use SERIAL and custom short codes)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS analytics CASCADE;
DROP TABLE IF EXISTS urls CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    country VARCHAR(100) DEFAULT 'India',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. URLs Table
CREATE TABLE urls (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    short_code VARCHAR(50) UNIQUE NOT NULL,
    custom_alias VARCHAR(50) UNIQUE,
    password VARCHAR(255), -- bcrypt hash if password protected
    expires_at TIMESTAMP,
    health_status VARCHAR(20) DEFAULT 'active' CHECK (health_status IN ('active', 'broken', 'redirect_error', 'timeout')),
    last_health_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Analytics Table
CREATE TABLE analytics (
    id SERIAL PRIMARY KEY,
    url_id INTEGER REFERENCES urls(id) ON DELETE CASCADE,
    visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    device VARCHAR(50) DEFAULT 'Desktop',
    browser VARCHAR(50) DEFAULT 'Chrome',
    country VARCHAR(100) DEFAULT 'Unknown',
    region VARCHAR(100) DEFAULT 'Unknown',
    city VARCHAR(100) DEFAULT 'Unknown',
    referrer VARCHAR(255) DEFAULT 'Direct'
);

-- 4. Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'expiration', 'milestone', 'health_check', 'suspicious_activity'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_urls_short_code ON urls(short_code);
CREATE INDEX idx_urls_user_id ON urls(user_id);
CREATE INDEX idx_analytics_url_id ON analytics(url_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Seed default administrator (email: admin@gmail.com, password: admin123)
INSERT INTO users (name, email, password, role)
VALUES ('Administrator', 'admin@gmail.com', '$2a$10$tZ2EupYVd7B9gS9oHqXp1u1Y.XGv1wFz3m7X8J3G1uMhRk060OEqC', 'admin')
ON CONFLICT (email) DO NOTHING;
