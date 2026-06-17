## Overview

Smart URL Shortener & Analytics Platform is a full-stack web application designed to simplify URL management while providing advanced analytics, security, monitoring, and reporting capabilities.

Traditional URL shorteners focus only on converting long URLs into short links. Our platform extends this functionality by providing real-time analytics, QR code generation, password-protected links, URL expiration, link health monitoring, notification management, report generation, and role-based access control.

The project demonstrates full-stack engineering concepts including authentication, API development, database modeling, analytics tracking, real-time communication, and secure application development.

---

# Problem Statement

Long URLs are difficult to share, visually unattractive, and provide no information regarding user engagement.

Organizations and individuals require:

* Easy URL sharing
* Analytics tracking
* Security controls
* Link monitoring
* Administrative management

This project addresses these requirements through a centralized URL management platform.

---

# Objectives

* Generate shortened URLs from long URLs
* Track visitor activities and engagement
* Provide real-time analytics
* Generate QR codes for easy sharing
* Support password-protected links
* Support URL expiration
* Monitor link health automatically
* Generate downloadable reports
* Provide role-based access control
* Improve URL management efficiency

---

# Key Features

## Authentication & Security

* User Registration
* User Login
* JWT Authentication
* Password Hashing using Bcrypt
* Protected Routes
* Role-Based Access Control (RBAC)

## URL Management

* URL Shortening
* Unique Short Code Generation
* Custom URL Aliases
* URL Expiration Support
* Password-Protected URLs
* URL Deletion

## Analytics

* Total Click Tracking
* Recent Visit History
* Last Visited Time
* Browser Analytics
* Device Analytics
* Geographic Analytics
* Referrer Tracking
* Click Trend Analysis

## QR Code Support

* Automatic QR Code Generation
* QR Download Feature

## Monitoring

* Link Health Monitoring
* Broken Link Detection
* Expired Link Detection
* Notification System

## Reporting

* PDF Reports
* Excel Reports
* CSV Reports

## Administration

* User Management
* Global Analytics Dashboard
* Platform Monitoring
* Administrative Controls

---

# Technology Stack

## Frontend

* React.js
* Tailwind CSS
* Recharts
* Socket.IO Client
* QRCode Library

## Backend

* Node.js
* Express.js

## Database

* PostgreSQL

## Security

* JWT Authentication
* Bcrypt Password Hashing

## Real-Time Communication

* Socket.IO

---

# System Architecture

```text
                    User
                      │
                      ▼
              React Frontend
                      │
              REST API Calls
                      │
                      ▼
                Express.js
                      │
                Controllers
                      │
      ┌───────────────┼───────────────┐
      │               │               │
      ▼               ▼               ▼
 Authentication   URL Engine    Analytics Engine
      │               │               │
      └───────────────┼───────────────┘
                      │
                      ▼
                 PostgreSQL
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
      Socket.IO           Background Jobs
          │                       │
          ▼                       ▼
 Real-Time Dashboard     Health Monitoring
                         Notifications
```

---

# Project Workflow

## Step 1: User Registration

Users create an account by providing:

* Name
* Email
* Password

Passwords are hashed using Bcrypt before being stored in PostgreSQL.

---

## Step 2: User Login

Users authenticate using email and password.

After successful verification:

* JWT Token is generated
* Token is returned to the frontend
* Protected routes become accessible

---

## Step 3: URL Creation

User enters a long URL.

Example:

https://www.amazon.in/electronics/laptops/hp-victus-gaming-laptop

Backend:

1. Validates URL
2. Generates unique short code
3. Checks database uniqueness
4. Stores URL in PostgreSQL

Generated Example:

https://shortly.com/aB3xYz

---

## Step 4: QR Code Generation

The generated short URL is converted into a QR code for easy sharing and scanning.

---

## Step 5: Visitor Access

When a visitor clicks the short URL:

1. Short code is extracted
2. Database lookup is performed
3. Original URL is retrieved

---

## Step 6: Security Validation

The system checks:

* URL existence
* Expiration status
* Password protection
* URL activity status

---

## Step 7: Analytics Collection

Before redirection, the system records:

* Timestamp
* Browser
* Operating System
* Device Type
* Country
* Region
* City
* Referrer

---

## Step 8: Real-Time Analytics Update

Socket.IO pushes updates instantly to connected dashboards.

No page refresh is required.

---

## Step 9: Redirect

Visitor is redirected to the original URL.

---

## Step 10: Monitoring & Notifications

Background services continuously:

* Check URL health
* Detect broken links
* Monitor expirations
* Generate notifications

---

# URL Shortening Logic

The application uses a custom Base62 short code generator.

Character Set:

ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789

Generated Example:

aB3xYz

Possible Combinations:

62^6 = 56,800,235,584

More than 56 billion unique URLs can be generated.

Before storing, the system checks the database to prevent collisions.

---

# Database Design

## Users Table

Stores:

* User Information
* Login Credentials
* Roles

## URLs Table

Stores:

* Original URLs
* Short Codes
* Expiration Settings
* Password Protection Settings

## Analytics Table

Stores:

* Visitor Information
* Click History
* Traffic Data

## Notifications Table

Stores:

* Alerts
* System Messages

---

# API Endpoints

## Authentication

POST /api/auth/register

POST /api/auth/login

GET /api/auth/me

---

## URLs

POST /api/urls

GET /api/urls

DELETE /api/urls/:id

---

## Analytics

GET /api/analytics

GET /api/analytics/:urlId

---

## Reports

GET /api/reports/pdf

GET /api/reports/csv

GET /api/reports/excel

---

# Installation & Setup

## Clone Repository

git clone <repository-url>

## Install Frontend Dependencies

cd client

npm install

## Install Backend Dependencies

cd server

npm install

---

## Configure Environment Variables

Create a `.env` file:

PORT=5000

DATABASE_URL=your_postgresql_connection_string

JWT_SECRET=your_secret_key

---

## Start Backend

npm run dev

---

## Start Frontend

npm start

---

# Assumptions

* Users must authenticate before creating URLs.
* Generated short codes are unique.
* PostgreSQL is configured correctly.
* Analytics are recorded upon successful access.
* JWT is required for protected routes.
* Internet connectivity is required for health monitoring.

---

# AI Planning Document

## Phase 1: Requirement Analysis

Identified requirements:

* Authentication
* URL Shortening
* Analytics Tracking
* Dashboard
* Reporting
* Monitoring

## Phase 2: Architecture Design

Selected:

* React.js
* Node.js
* Express.js
* PostgreSQL
* JWT
* Socket.IO

## Phase 3: Database Design

Designed:

* Users
* URLs
* Analytics
* Notifications

## Phase 4: API Design

Developed REST APIs for:

* Authentication
* URL Management
* Analytics
* Reports

## Phase 5: Frontend Development

Implemented:

* Login System
* Dashboard
* Analytics Pages
* Admin Panel

## Phase 6: Testing

Validated:

* Authentication
* URL Creation
* Redirection
* Analytics Tracking
* Reporting

---

# Sample Outputs

## Login Page

Add screenshot here.

## Dashboard

Add screenshot here.

## Analytics Dashboard

Add screenshot here.

## QR Code Generation

Add screenshot here.

## Admin Dashboard

Add screenshot here.

---

# Sample Database Records

## Users

| ID | Name      | Email                                   |
| -- | --------- | --------------------------------------- |
| 1  | Demo User | [demo@gmail.com](mailto:demo@gmail.com) |

## URLs

| ID | Short Code | Original URL       |
| -- | ---------- | ------------------ |
| 1  | aB3xYz     | https://google.com |

## Analytics

| ID | URL ID | Clicks |
| -- | ------ | ------ |
| 1  | 1      | 25     |

---

# Challenges Faced

* Designing real-time analytics updates
* Preventing short-code collisions
* Implementing secure JWT authentication
* Optimizing PostgreSQL queries
* Building background health monitoring tasks
* Managing large analytics datasets

---

# Future Enhancements

* Redis Caching
* Docker Containerization
* Kubernetes Deployment
* Multi-Factor Authentication
* AI-Based Click Prediction
* Fraud Click Detection
* Advanced Geo Analytics
* Google OAuth Login

---

# Demo Video

YouTube Demonstration:

https://youtu.be/1Qt-Pb3kMgI

---

#Output

USER 
sign up : <img width="1913" height="915" alt="image" src="https://github.com/user-attachments/assets/18e5fdfc-61ee-4623-a510-ec4003de23dc" />
Dashboard : <img width="1901" height="918" alt="image" src="https://github.com/user-attachments/assets/4c91abab-ab6e-4672-8522-e8ee6f3bb5d3" />
Creation of URL : <img width="1912" height="911" alt="image" src="https://github.com/user-attachments/assets/4077643a-dde0-47e1-8ed3-6baeb43724b2" />
Link usage : <img width="1917" height="911" alt="image" src="https://github.com/user-attachments/assets/bf8c405f-f704-4719-8397-2cc0fb8f3214" />
QR : <img width="1912" height="911" alt="image" src="https://github.com/user-attachments/assets/41b2e659-853e-475e-a07a-c1edde93de8e" />
Settings : <img width="1902" height="912" alt="image" src="https://github.com/user-attachments/assets/ac94adca-8965-42c8-81b2-c18f6409fa1d" />
Analytics : <img width="1901" height="917" alt="image" src="https://github.com/user-attachments/assets/194eaa85-eb58-4a10-8376-0dfa41156596" />

ADMIN

Dashboard : <img width="1906" height="908" alt="image" src="https://github.com/user-attachments/assets/b943e037-1884-42c6-be23-c06809dad36d" />
Users : <img width="1891" height="917" alt="image" src="https://github.com/user-attachments/assets/f429f162-c952-4820-9182-489513b7cf5d" />
Users link : <img width="1907" height="917" alt="image" src="https://github.com/user-attachments/assets/ef7ff42e-ee00-4479-beb6-c38ca15fd56c" />
Admin URL creation : <img width="1911" height="912" alt="image" src="https://github.com/user-attachments/assets/e3298796-cbad-4704-ad03-4c67706b0724" />
Users link usage : <img width="1897" height="920" alt="image" src="https://github.com/user-attachments/assets/ff6525d1-3ba7-4179-82bf-9af16666191f" />




# Author

Shanmugapriya S

Karpagam Institute of Technology (KIT)

Full Stack Web Development Project

---

# License

This project is developed for educational and academic purposes.

---

This project is a part of a hackathon run by https://katomaran.com
