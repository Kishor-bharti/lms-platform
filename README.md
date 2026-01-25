# lms-platform

lms-platform is an enterprise-grade Learning Management System (LMS) designed and developed for an EdTech startup in 2026. The platform delivers a secure, scalable, and role-based digital learning ecosystem for administrators, educators, and students.

## Project Structure

```
lms-platform/
│
├── client/                         # Frontend (React / Next.js)
│   ├── public/
│   │   └── index.html
│   │
│   ├── src/
│   │   ├── assets/                 # Images, icons
│   │   ├── components/             # Reusable UI components
│   │   │   ├── common/
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   └── Loader.jsx
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.jsx
│   │   │   │   ├── TeacherLayout.jsx
│   │   │   │   └── StudentLayout.jsx
│   │   │
│   │   ├── pages/                  # Route-level pages
│   │   │   ├── auth/
│   │   │   │   └── Login.jsx
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Users.jsx
│   │   │   │   └── Classes.jsx
│   │   │   ├── teacher/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── MyClasses.jsx
│   │   │   │   ├── Assignments.jsx
│   │   │   │   └── Quizzes.jsx
│   │   │   ├── student/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── MyClasses.jsx
│   │   │   │   ├── Assignments.jsx
│   │   │   │   └── Reports.jsx
│   │   │
│   │   ├── routes/                 # Frontend routing
│   │   │   ├── AdminRoutes.jsx
│   │   │   ├── TeacherRoutes.jsx
│   │   │   ├── StudentRoutes.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   │
│   │   ├── services/               # API calls
│   │   │   ├── api.js
│   │   │   ├── auth.service.js
│   │   │   ├── class.service.js
│   │   │   └── assignment.service.js
│   │   │
│   │   ├── context/                # Global state
│   │   │   └── AuthContext.jsx
│   │   │
│   │   ├── hooks/                  # Custom hooks
│   │   │   └── useAuth.js
│   │   │
│   │   ├── utils/
│   │   │   └── roleGuard.js
│   │   │
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   └── package.json
│
├── server/                         # Backend (Node + Express / Nest)
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   ├── jwt.js
│   │   │   └── env.js
│   │   │
│   │   ├── modules/                # Feature-based structure
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── auth.service.js
│   │   │   │   ├── auth.routes.js
│   │   │   │   └── auth.validation.js
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── user.controller.js
│   │   │   │   ├── user.service.js
│   │   │   │   ├── user.routes.js
│   │   │   │   └── user.model.js
│   │   │   │
│   │   │   ├── classes/
│   │   │   │   ├── class.controller.js
│   │   │   │   ├── class.service.js
│   │   │   │   ├── class.routes.js
│   │   │   │   └── class.model.js
│   │   │   │
│   │   │   ├── sessions/
│   │   │   │   ├── session.controller.js
│   │   │   │   ├── session.service.js
│   │   │   │   ├── session.routes.js
│   │   │   │   └── session.model.js
│   │   │   │
│   │   │   ├── assignments/
│   │   │   │   ├── assignment.controller.js
│   │   │   │   ├── assignment.service.js
│   │   │   │   ├── assignment.routes.js
│   │   │   │   └── assignment.model.js
│   │   │   │
│   │   │   ├── quizzes/
│   │   │   │   ├── quiz.controller.js
│   │   │   │   ├── quiz.service.js
│   │   │   │   ├── quiz.routes.js
│   │   │   │   ├── question.model.js
│   │   │   │   └── submission.model.js
│   │   │   │
│   │   │   ├── attendance/
│   │   │   │   ├── attendance.controller.js
│   │   │   │   ├── attendance.service.js
│   │   │   │   └── attendance.model.js
│   │   │   │
│   │   │   └── reports/
│   │   │       ├── report.controller.js
│   │   │       └── report.service.js
│   │   │
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   ├── role.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   └── upload.middleware.js
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── response.js
│   │   │   └── pagination.js
│   │   │
│   │   ├── routes.js               # Central route loader
│   │   ├── app.js                  # Express app
│   │   └── server.js               # Server entry
│   │
│   ├── tests/
│   │   └── auth.test.js
│   │
│   ├── package.json
│   └── .env
│
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── schema.sql
│
├── docs/
│   ├── HLD.md
│   ├── LLD.md
│   ├── API.md
│   └── ERD.png
│
├── .gitignore
├── README.md
└── docker-compose.yml
```

This is a **proprietary software product**.  
All rights are reserved © 2026.