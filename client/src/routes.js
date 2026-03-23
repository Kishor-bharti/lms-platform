import Index from 'views/Index.js';
import Report from 'views/examples/Report.js';
import Profile from 'views/examples/Profile.js';
import Resources from 'views/examples/Resources.js';
import Login from 'views/examples/Login.js';
import AdminLogin from 'views/examples/AdminLogin.js';
import Sessions from 'views/examples/Sessions.js';
import Classes from 'views/examples/Classes.js';
import SubjectPage from 'views/subject/SubjectPage.js';
import AdminDashboard from 'views/admin/AdminDashboard.js';
import AdminUsers from 'views/admin/AdminUsers.js';
import AdminCourses from 'views/admin/AdminCourses.js';
import AdminSubjects from 'views/admin/AdminSubjects.js';
import AdminSessions from 'views/admin/AdminSessions.js';
import AdminAllocations from 'views/admin/AdminAllocations.js';
import QuizBuilder from 'views/quiz/QuizBuilder.js';
import QuizTaker from 'views/quiz/QuizTaker.js';
import CourseQuiz from 'views/quiz/CourseQuiz.js';

var routes = [
  // ---- Visible to ALL roles ----
  {
    path: '/index',
    name: 'Dashboard',
    icon: 'ni ni-tv-2 text-primary',
    component: <Index />,
    layout: '/admin',
  },

  // ---- Teacher / Admin only ----
  {
    path: '/sessions',
    name: 'Sessions',
    icon: 'ni ni-chat-round text-info',
    component: <Sessions />,
    layout: '/admin',
    roles: ['TEACHER', 'ADMIN'],
  },

  // ---- Student only ----
  {
    path: '/classes',
    name: 'Classes',
    icon: 'ni ni-books text-blue',
    component: <Classes />,
    layout: '/admin',
    roles: ['STUDENT'],
  },

  // ---- Shared ----
  {
    path: '/resources',
    name: 'Resources',
    icon: 'ni ni-folder-17 text-blue',
    component: <Resources />,
    layout: '/admin',
    hidden: true,
  },
  {
    path: '/report',
    name: 'Report',
    icon: 'ni ni-chart-bar-32 text-yellow',
    component: <Report />,
    layout: '/admin',
  },
  {
    path: '/profile',
    name: 'Profile',
    icon: 'ni ni-single-02 text-info',
    component: <Profile />,
    layout: '/admin',
  },
  {
    path: '/logout',
    name: 'Logout',
    icon: 'ni ni-user-run text-danger',
    component: <Index />,
    layout: '/admin',
  },

  // ---- Admin panel pages (hidden from sidebar — shown via admin nav section) ----
  {
    path: '/admin-overview',
    name: 'Admin Overview',
    icon: 'ni ni-settings-gear-65 text-danger',
    component: <AdminDashboard />,
    layout: '/admin',
    roles: ['ADMIN'],
    hidden: true,
  },
  {
    path: '/admin-users',
    name: 'Users',
    icon: 'ni ni-single-02 text-danger',
    component: <AdminUsers />,
    layout: '/admin',
    roles: ['ADMIN'],
    hidden: true,
  },
  {
    path: '/admin-courses',
    name: 'Courses',
    icon: 'ni ni-book-bookmark text-danger',
    component: <AdminCourses />,
    layout: '/admin',
    roles: ['ADMIN'],
    hidden: true,
  },
  {
    path: '/admin-subjects',
    name: 'Subjects',
    icon: 'ni ni-collection text-danger',
    component: <AdminSubjects />,
    layout: '/admin',
    roles: ['ADMIN'],
    hidden: true,
  },
  {
    path: '/admin-sessions',
    name: 'All Sessions',
    icon: 'ni ni-calendar-grid-58 text-danger',
    component: <AdminSessions />,
    layout: '/admin',
    roles: ['ADMIN'],
    hidden: true,
  },
  {
    path: '/admin-allocations',
    name: 'Teacher Allocations',
    icon: 'ni ni-bullet-list-67 text-danger',
    component: <AdminAllocations />,
    layout: '/admin',
    roles: ['ADMIN'],
    hidden: true,
  },

  // ---- Subject detail (hidden — navigated via course sidebar links) ----
  {
    path: '/subject/:subjectId',
    name: 'Subject',
    icon: 'ni ni-collection text-info',
    component: <SubjectPage />,
    layout: '/admin',
    hidden: true,
  },

  // ---- Quiz routes (hidden) ----
  {
    path: '/quiz-builder',
    name: 'Quiz Builder',
    icon: 'ni ni-collection text-primary',
    component: <QuizBuilder />,
    layout: '/admin',
    roles: ['TEACHER', 'ADMIN'],
    hidden: true,
  },
  {
    path: '/quiz/:quizId',
    name: 'Take Quiz',
    icon: 'ni ni-collection text-primary',
    component: <QuizTaker />,
    layout: '/admin',
    hidden: true,
  },
  {
    path: '/course-quiz/:courseId',
    name: 'Course Quiz',
    icon: 'ni ni-paper-diploma text-primary',
    component: <CourseQuiz />,
    layout: '/admin',
    hidden: true,
  },

  // ---- Auth ----
  {
    path: '/login',
    name: 'Login',
    icon: 'ni ni-key-25 text-info',
    component: <Login />,
    layout: '/auth',
  },
  {
    path: '/admin-login',
    name: 'Admin Login',
    icon: 'ni ni-circle-08 text-danger',
    component: <AdminLogin />,
    layout: '/auth',
  },
];

export default routes;
