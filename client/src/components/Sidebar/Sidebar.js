import { useEffect, useState } from "react";
import { NavLink as NavLinkRRD, Link, useNavigate } from "react-router-dom";
import { PropTypes } from "prop-types";
import {
  Collapse, Form, Input, InputGroupAddon, InputGroupText, InputGroup,
  NavbarBrand, Navbar, NavItem, NavLink, Nav, Container, Row, Col,
} from "reactstrap";
import http from "utils/http";

const COURSE_ICONS = {
  ACT: { icon: "ni ni-book-bookmark", color: "#11cdef" },
  AP:  { icon: "ni ni-trophy",       color: "#fb6340" },
};
const DEFAULT_COURSE = { icon: "ni ni-collection",  color: "#2dce89" };

const Sidebar = (props) => {
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [courses, setCourses] = useState([]);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-mini");
    if (saved === "true") setMini(true);
  }, []);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      const res = await http.get("/api/courses/my-courses");
      setCourses(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("[Sidebar] Failed to fetch courses:", err);
      setCourses([]);
    }
  };

  const toggleCollapse = () => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    setCollapseOpen((prev) => {
      const next = !prev;
      if (isMobile && next) { setMini(false); localStorage.setItem("sidebar-mini", "false"); }
      return next;
    });
  };

  const closeCollapse = () => setCollapseOpen(false);

  const createLinks = (routes) => {
    const userRole = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    const userRoleUpper = (userRole ?? "").toUpperCase();
    return routes
      .filter((prop) => {
        if (prop.layout !== "/admin") return false;
        if (prop.hidden) return false;
        if (!prop.roles) return true;
        return prop.roles.map((r) => r.toUpperCase()).includes(userRoleUpper);
      })
      .map((prop, key) => (
        <NavItem key={key} className="sidebar-nav-item">
          <NavLink
            to={prop.layout + prop.path}
            tag={NavLinkRRD}
            onClick={(e) => {
              if (prop.name === "Logout") {
                e.preventDefault();
                const confirmed = window.confirm('Are you sure you want to logout?');
                if (!confirmed) return;
                window.localStorage.removeItem("accessToken");
                window.localStorage.removeItem("refreshToken");
                window.localStorage.removeItem("role");
                window.localStorage.removeItem("user");
                navigate("/auth/login");
              } else { closeCollapse(); }
            }}
            title={prop.name}
            className="sidebar-link"
          >
            <i className={prop.icon} />
            <span className="nav-link-text" style={mini ? { display: "none" } : undefined}>
              {prop.name}
            </span>
          </NavLink>
        </NavItem>
      ));
  };

  const createCourseLinks = () => {
    if (!courses.length) return null;
    return courses.map((course) => {
      const { icon, color } = COURSE_ICONS[course.code] ?? DEFAULT_COURSE;
      const isOpen = expandedCourse === course.id;
      return (
        <div key={course.id} className="course-section">
          <NavItem className="sidebar-nav-item">
            <NavLink
              href="#"
              onClick={(e) => { e.preventDefault(); setExpandedCourse(isOpen ? null : course.id); }}
              title={course.name}
              className="sidebar-link course-header"
              style={{ cursor: "pointer" }}
            >
              <i className={icon} style={{ color }} />
              <span className="nav-link-text" style={{ ...(mini ? { display: "none" } : {}), fontWeight: 600, color: "#32325d" }}>
                {course.name}
              </span>
              {!mini && (
                <i className={`ni ${isOpen ? "ni-bold-up" : "ni-bold-down"} ml-auto`}
                   style={{ fontSize: "10px", color: "#8898aa", transition: "transform 0.3s ease" }} />
              )}
            </NavLink>
          </NavItem>
          {isOpen && !mini && (
            <div className="subject-list" style={{ paddingLeft: "20px", borderLeft: "2px solid rgba(94,114,228,0.15)", marginLeft: "22px", marginBottom: "4px" }}>
              {course.subjects.map((subject) => (
                <NavItem key={subject.id} className="sidebar-nav-item subject-item">
                  <NavLink to={`/admin/subject/${subject.id}`} tag={NavLinkRRD} onClick={closeCollapse}
                    title={subject.name} className="sidebar-link" style={{ padding: "6px 12px", fontSize: "13px" }}>
                    <i className="ni ni-circle-08" style={{ fontSize: "8px", color: "#8898aa", marginRight: "8px" }} />
                    <span style={{ color: "#525f7f" }}>{subject.name}</span>
                  </NavLink>
                </NavItem>
              ))}
              <NavItem key={`quiz-${course.id}`} className="sidebar-nav-item">
                <NavLink to={`/admin/course-quiz/${course.id}`} tag={NavLinkRRD} onClick={closeCollapse}
                  title={`${course.name} — Test Sets`} className="sidebar-link quiz-link" style={{ padding: "6px 12px", fontSize: "13px" }}>
                  <i className="ni ni-paper-diploma nav-link-icon" style={{ fontSize: "9px", marginRight: "8px" }} />
                  <span className="nav-link-text" style={{ fontWeight: 700 }}>Quiz</span>
                </NavLink>
              </NavItem>
            </div>
          )}
        </div>
      );
    });
  };

  const { routes, logo } = props;
  let navbarBrandProps;
  if (logo?.innerLink) navbarBrandProps = { to: logo.innerLink, tag: Link };
  else if (logo?.outterLink) navbarBrandProps = { href: logo.outterLink, target: "_blank" };

  return (
    <Navbar
      className={`navbar-vertical fixed-left navbar-light ${mini ? "sidebar-mini" : ""} ${collapseOpen ? "sidebar-open" : ""}`}
      expand="md" id="sidenav-main"
    >
      <Container fluid>
        <button className="navbar-toggler" type="button" onClick={toggleCollapse}>
          <span className="navbar-toggler-icon" />
        </button>
        {logo && (
          <NavbarBrand className="pt-0" {...navbarBrandProps}>
            <img alt={logo.imgAlt} className="navbar-brand-img" src={logo.imgSrc} style={{ maxHeight: '64px', width: 'auto' }} />
          </NavbarBrand>
        )}
        <Collapse navbar isOpen={collapseOpen}>
          <div className="navbar-collapse-header d-md-none">
            <Row>
              {logo && (
                <Col className="collapse-brand" xs="6">
                  {logo.innerLink
                    ? <Link to={logo.innerLink}><img alt={logo.imgAlt} src={logo.imgSrc} /></Link>
                    : <a href={logo.outterLink}><img alt={logo.imgAlt} src={logo.imgSrc} /></a>}
                </Col>
              )}
              <Col className="collapse-close" xs="6">
                <button className="navbar-toggler" type="button" onClick={toggleCollapse}><span /><span /></button>
              </Col>
            </Row>
          </div>
          <Form className="mt-4 mb-3 d-md-none">
            <InputGroup className="input-group-rounded input-group-merge">
              <Input aria-label="Search" className="form-control-rounded form-control-prepended" placeholder="Search" type="search" />
              <InputGroupAddon addonType="prepend"><InputGroupText><span className="fa fa-search" /></InputGroupText></InputGroupAddon>
            </InputGroup>
          </Form>

          <Nav navbar>{createLinks(routes)}</Nav>

          {courses.length > 0 && (
            <>
              <hr className="my-3" />
              <h6 className="navbar-heading text-muted sidebar-section-title" style={mini ? { display: "none" } : undefined}>
                <span className="section-dot" style={{ background: "#5e72e4" }} />My Courses
              </h6>
              <Nav navbar>{createCourseLinks()}</Nav>
            </>
          )}

          {(typeof window !== "undefined" && (window.localStorage.getItem("role") || "").toLowerCase() === "admin") && (
            <>
              <hr className="my-3" />
              <h6 className="navbar-heading text-muted sidebar-section-title" style={mini ? { display: "none" } : undefined}>
                <span className="section-dot" style={{ background: "#f5365c" }} />Admin Panel
              </h6>
              <Nav navbar>
                {[
                  { path: "/admin-overview", label: "Overview",     icon: "ni ni-settings-gear-65" },
                  { path: "/admin-users",    label: "Users",        icon: "ni ni-single-02" },
                  { path: "/admin-courses",  label: "Courses",      icon: "ni ni-book-bookmark" },
                  { path: "/admin-subjects", label: "Subjects",     icon: "ni ni-collection" },
                  { path: "/admin-sessions", label: "All Sessions", icon: "ni ni-calendar-grid-58" },
                ].map((item) => (
                  <NavItem key={item.path} className="sidebar-nav-item admin-item">
                    <NavLink to={"/admin" + item.path} tag={NavLinkRRD} onClick={closeCollapse}
                      title={item.label} className="sidebar-link">
                      <i className={item.icon} style={{ color: "#f5365c" }} />
                      <span className="nav-link-text" style={mini ? { display: "none" } : { color: "#f5365c", fontWeight: 600 }}>
                        {item.label}
                      </span>
                    </NavLink>
                  </NavItem>
                ))}
              </Nav>
            </>
          )}

        </Collapse>

        <style>{`
          #sidenav-main {
            width: 260px;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%) !important;
            border-right: 1px solid rgba(94, 114, 228, 0.08);
            box-shadow: 4px 0 24px rgba(94, 114, 228, 0.06);
          }
          #sidenav-main.sidebar-mini { width: 90px; }
          .main-content { margin-left: 260px; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          #sidenav-main.sidebar-mini ~ .main-content { margin-left: 90px; }
          .sidebar-section-title {
            display: flex; align-items: center; gap: 8px;
            font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase;
          }
          .section-dot {
            width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0;
            animation: dotPulse 2s ease-in-out infinite;
          }
          @keyframes dotPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.4); }
          }
          .sidebar-nav-item { margin: 1px 8px; }
          .sidebar-link {
            border-radius: 10px !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            position: relative;
          }
          .sidebar-link:hover {
            background: linear-gradient(135deg, rgba(94,114,228,0.08) 0%, rgba(130,94,228,0.06) 100%) !important;
            transform: translateX(4px);
          }
          .sidebar-link.active {
            background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%) !important;
            color: #fff !important;
            box-shadow: 0 4px 16px rgba(94,114,228,0.3);
          }
          .sidebar-link.active i,
          .sidebar-link.active span,
          .sidebar-link.active .nav-link-text { color: #fff !important; }
          .quiz-link:not(.active) .nav-link-icon,
          .quiz-link:not(.active) .nav-link-text { color: #5e72e4; }
          .subject-list { animation: slideDown 0.3s ease; }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          #sidenav-main .sidebar-edge-toggle {
            position: absolute; right: -14px; top: 50%; transform: translateY(-50%);
            width: 28px; height: 28px; border-radius: 50%;
            background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%);
            border: 2px solid #fff;
            box-shadow: 0 4px 12px rgba(94,114,228,0.3);
            display: flex; align-items: center; justify-content: center; z-index: 1040;
            color: #fff; transition: all 0.3s ease;
          }
          #sidenav-main .sidebar-edge-toggle:hover {
            transform: translateY(-50%) scale(1.15);
            box-shadow: 0 6px 20px rgba(94,114,228,0.4);
          }
          #sidenav-main .sidebar-edge-toggle i { font-size: 10px; }
          .admin-item .sidebar-link:hover {
            background: linear-gradient(135deg, rgba(245,54,92,0.08) 0%, rgba(245,54,92,0.04) 100%) !important;
          }
          #sidenav-main .navbar-collapse {
            scrollbar-width: thin;
            scrollbar-color: rgba(94,114,228,0.15) transparent;
          }
          #sidenav-main .navbar-collapse::-webkit-scrollbar { width: 4px; }
          #sidenav-main .navbar-collapse::-webkit-scrollbar-track { background: transparent; }
          #sidenav-main .navbar-collapse::-webkit-scrollbar-thumb { background: rgba(94,114,228,0.15); border-radius: 4px; }
          @media (max-width: 767.98px) {
            #sidenav-main { width: 70px; }
            #sidenav-main.sidebar-mini { width: 70px; }
            #sidenav-main.sidebar-open { width: 260px; }
            .main-content { margin-left: 0; }
            #sidenav-main.sidebar-mini ~ .main-content { margin-left: 0; }
            #sidenav-main .sidebar-edge-toggle { display: none; }
          }
        `}</style>
      </Container>
      <button type="button" className="sidebar-edge-toggle btn" aria-label="Toggle sidebar"
        onClick={() => setMini((v) => { const n = !v; localStorage.setItem("sidebar-mini", String(n)); return n; })}>
        <i className={mini ? "ni ni-bold-right" : "ni ni-bold-left"} />
      </button>
    </Navbar>
  );
};

Sidebar.defaultProps = { routes: [{}] };
Sidebar.propTypes = {
  routes: PropTypes.arrayOf(PropTypes.object),
  logo: PropTypes.shape({
    innerLink: PropTypes.string,
    outterLink: PropTypes.string,
    imgSrc: PropTypes.string.isRequired,
    imgAlt: PropTypes.string.isRequired,
  }),
};

export default Sidebar;
