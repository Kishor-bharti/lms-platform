import Index from "views/Index.js";
import Report from "views/examples/Report.js";
import Resources from "views/examples/Resources.js";
import Login from "views/examples/Login.js";
import AdminLogin from "views/examples/AdminLogin.js";
import SAT from "views/examples/SAT.js";
import Sessions from "views/examples/Sessions.js";

var routes = [
  {
    path: "/index",
    name: "Dashboard",
    icon: "ni ni-tv-2 text-primary",
    component: <Index />,
    layout: "/admin",
  },
  {
    path: "/sessions",
    name: "Sessions",
    icon: "ni ni-chat-round text-info",
    component: <Sessions />,
    layout: "/admin",
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
    path: "/sat",
    name: "SAT",
    icon: "ni ni-bullet-list-67 text-red",
    component: <SAT />,
    layout: "/admin",
  },
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
