-- ===============================
-- LMS DATABASE SCHEMA (PostgreSQL)
-- ===============================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE DATABASE lms_db;
\c lms_db;

-- -------------------------------
-- USERS
-- -------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('ADMIN','TEACHER','STUDENT')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('ACTIVE','INACTIVE')) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------
-- CLASSES
-- -------------------------------

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    subject VARCHAR(100),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------
-- ENROLLMENTS
-- -------------------------------

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, student_id)
);

-- -------------------------------
-- SESSIONS
-- -------------------------------

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title VARCHAR(150),
    zoom_link TEXT,
    recording_url TEXT,
    status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
