import Index from "views/Index.js";
import Report from "views/examples/Report.js";
import Profile from "views/examples/Profile.js";
import Resources from "views/examples/Resources.js";
import Login from "views/examples/Login.js";
import AdminLogin from "views/examples/AdminLogin.js";
import SAT from "views/examples/SAT.js";
import Sessions from "views/examples/Sessions.js";
import Classes from "views/examples/Classes.js";
import SubjectPage from "views/subject/SubjectPage.js";

var routes = [
  {
    path: "/index",
    name: "Dashboard",
    icon: "ni ni-tv-2 text-primary",
    component: <Index />,
    layout: "/admin",
    // No roles = visible to ALL (admin, teacher, student)
  },
  {
    path: "/sessions",
    name: "Sessions",
    icon: "ni ni-chat-round text-info",
    component: <Sessions />,
    layout: "/admin",
    roles: ["TEACHER", "ADMIN"],
  },
  {
    path: "/classes",
    name: "Classes",
    icon: "ni ni-books text-blue",
    component: <Classes />,
    layout: "/admin",
    roles: ["STUDENT"],
  },
  {
    path: "/resources",
    name: "Resources",
    icon: "ni ni-folder-17 text-blue",
    component: <Resources />,
    layout: "/admin",
  },
  {
    path: "/report",
    name: "Report",
    icon: "ni ni-chart-bar-32 text-yellow",
    component: <Report />,
    layout: "/admin",
  },
  {
    path: "/profile",
    name: "Profile",
    icon: "ni ni-single-02 text-info",
    component: <Profile />,
    layout: "/admin",
  },
  {
    path: "/sat",
    name: "SAT",
    icon: "ni ni-bullet-list-67 text-red",
    component: <SAT />,
    layout: "/admin",
  },
  {
    path: "/logout",
    name: "Logout",
    icon: "ni ni-user-run text-danger",
    component: <Index />,
    layout: "/admin",
  },
  // ── Subject detail — not in sidebar, navigated to from course links ──
  {
    path: "/subject/:subjectId",
    name: "Subject",
    icon: "ni ni-collection text-info",
    component: <SubjectPage />,
    layout: "/admin",
    hidden: true,   // Sidebar ignores this (it doesn't appear in nav)
  },
  // ── Auth routes ──
  {
    path: "/login",
    name: "Login",
    icon: "ni ni-key-25 text-info",
    component: <Login />,
    layout: "/auth",
  },
  {
    path: "/admin-login",
    name: "Admin Login",
    icon: "ni ni-circle-08 text-danger",
    component: <AdminLogin />,
    layout: "/auth",
  },
];
export default routes;
