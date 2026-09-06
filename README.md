# FlowBoard SaaS

<p align="center">
A modern Jira-inspired SaaS project management platform built with Next.js.
</p>

---

## Overview

FlowBoard is a full-stack project management application inspired by Jira. It enables teams to manage projects, organize tasks with a Kanban board, monitor analytics, collaborate within workspaces, and track project progress through an intuitive dashboard.

---

## Features

### Authentication
- User Registration
- Secure Login
- Email OTP Verification
- User Profile

### Workspace Management
- Create Workspace
- Workspace Settings
- Team Management
- Member Roles

### Project Management
- Create Projects
- Update Projects
- Delete Projects
- Project Settings

### Kanban Board
- Multiple Columns
- Drag & Drop Tasks
- Task Priorities
- Due Dates
- Task Details
- Comments
- Labels



### Dashboard
- Project Overview
- Recent Activity
- Task Summary
- Productivity Metrics

### Analytics
- Task Distribution
- Completion Statistics
- Progress Charts

### Notifications
- In-App Notifications
- Activity Tracking

### Search
- Global Task Search
- Project Search
- User Search

---

# Tech Stack

### Frontend

- Next.js
- React
- JavaScript
- CSS

### Backend

- Next.js API Routes
- SQLite

### Tools

- Git
- GitHub
- Vercel

---

# Project Structure

```
src
│
├── app
│   ├── api
│   ├── dashboard
│   ├── login
│   ├── register
│   └── ...
│
├── components
│
├── contexts
│
├── lib
│
└── middleware.js
```

---

# Installation

```bash
git clone https://github.com/V-Jasvanth/Flowboard-Saas.git

cd Flowboard-Saas

npm install

npm run dev
```

---

# Environment Variables

Create a `.env.local` file and configure the required environment variables before running the application.

Example:

```env
JWT_SECRET=your_secret
```

(Add any other variables your project requires.)

---

# Current Status

Current Version: **v1.0.0**

Production Ready

---

# Future Improvements

- Password Reset
- Team Invitations
- Real-time Collaboration
- PostgreSQL Migration
- Docker Support
- Redis Integration
- WebSockets
- CI/CD Pipeline

---

# Author

**Vekanuru Jasvanth**

GitHub: https://github.com/V-Jasvanth
FlowBoard is a modern project management SaaS for organizing teams, tasks, and workflows.
