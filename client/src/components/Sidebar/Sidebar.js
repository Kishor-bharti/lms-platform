import { useEffect, useState } from "react";
import { NavLink as NavLinkRRD, Link, useNavigate } from "react-router-dom";
import { PropTypes } from "prop-types";
import {
  Collapse, Form, Input, InputGroupAddon, InputGroupText, InputGroup,
  NavbarBrand, Navbar, NavItem, NavLink, Nav, Container, Row, Col,
} from "reactstrap";
import http from "utils/http";

// Course icon map — falls back to a default
const COURSE_ICONS = {
  SAT: { icon: "ni ni-hat-3",       color: "#5e72e4" },
  ACT: { icon: "ni ni-book-bookmark", color: "#11cdef" },
  AP:  { icon: "ni ni-trophy",       color: "#fb6340" },
};
const DEFAULT_COURSE = { icon: "ni ni-collection",  color: "#2dce89" };

const Sidebar = (props) => {
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [courses, setCourses] = useState([]);          // dynamic courses from API
  const [expandedCourse, setExpandedCourse] = useState(null); // which course is open
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-mini");
    if (saved === "true") setMini(true);
  }, []);

  // Fetch courses on mount
  useEffect(() => {
    fetchCourses();
  }, []);

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

  // Static nav links — role-filtered
  const createLinks = (routes) => {
    const userRole = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    const userRoleUpper = (userRole ?? "").toUpperCase();
    return routes
      .filter((prop) => {
        if (prop.layout !== "/admin") return false;
        if (prop.hidden) return false;          // skip hidden routes (e.g. /subject/:id)
        if (!prop.roles) return true;
        return prop.roles.map((r) => r.toUpperCase()).includes(userRoleUpper);
      })
      .map((prop, key) => (
        <NavItem key={key}>
          <NavLink
            to={prop.layout + prop.path}
            tag={NavLinkRRD}
            onClick={(e) => {
              if (prop.name === "Logout") {
                e.preventDefault();
                window.localStorage.removeItem("accessToken");
                window.localStorage.removeItem("refreshToken");
                window.localStorage.removeItem("role");
                window.localStorage.removeItem("user");
                navigate("/auth/login");
              } else {
                closeCollapse();
              }
            }}
            title={prop.name}
          >
            <i className={prop.icon} />
            <span className="nav-link-text" style={mini ? { display: "none" } : undefined}>
              {prop.name}
            </span>
          </NavLink>
        </NavItem>
      ));
  };

  // Dynamic course sections — each course expands to show subjects
  const createCourseLinks = () => {
    if (!courses.length) return null;
    return courses.map((course) => {
      const { icon, color } = COURSE_ICONS[course.code] ?? DEFAULT_COURSE;
      const isOpen = expandedCourse === course.id;

      return (
        <div key={course.id}>
          {/* Course header row — click to expand/collapse */}
          <NavItem>
            <NavLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setExpandedCourse(isOpen ? null : course.id);
              }}
              title={course.name}
              style={{ cursor: "pointer" }}
            >
              <i className={icon} style={{ color }} />
              <span
                className="nav-link-text"
                style={{
                  ...(mini ? { display: "none" } : {}),
                  fontWeight: 600,
                  color: "#32325d",
                }}
              >
                {course.name}
              </span>
              {!mini && (
                <i
                  className={`ni ${isOpen ? "ni-bold-up" : "ni-bold-down"} ml-auto`}
                  style={{ fontSize: "10px", color: "#8898aa" }}
                />
              )}
            </NavLink>
          </NavItem>

          {/* Subject list — shown when course expanded */}
          {isOpen && !mini && (
            <div style={{ paddingLeft: "20px", borderLeft: "2px solid #e9ecef", marginLeft: "22px", marginBottom: "4px" }}>
              {course.subjects.map((subject) => (
                <NavItem key={subject.id}>
                  <NavLink
                    to={`/admin/subject/${subject.id}`}
                    tag={NavLinkRRD}
                    onClick={closeCollapse}
                    title={subject.name}
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    <i
                      className="ni ni-circle-08"
                      style={{ fontSize: "8px", color: "#8898aa", marginRight: "8px" }}
                    />
                    <span style={{ color: "#525f7f" }}>{subject.name}</span>
                  </NavLink>
                </NavItem>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  const { routes, logo } = props;
  let navbarBrandProps;
  if (logo?.innerLink) {
    navbarBrandProps = { to: logo.innerLink, tag: Link };
  } else if (logo?.outterLink) {
    navbarBrandProps = { href: logo.outterLink, target: "_blank" };
  }

  return (
    <Navbar
      className={`navbar-vertical fixed-left navbar-light bg-white ${mini ? "sidebar-mini" : ""} ${collapseOpen ? "sidebar-open" : ""}`}
      expand="md"
      id="sidenav-main"
    >
      <Container fluid>
        {/* Mobile toggler */}
        <button className="navbar-toggler" type="button" onClick={toggleCollapse}>
          <span className="navbar-toggler-icon" />
        </button>

        {/* Brand logo */}
        {logo && (
          <NavbarBrand className="pt-0" {...navbarBrandProps}>
            <img alt={logo.imgAlt} className="navbar-brand-img" src={logo.imgSrc} />
          </NavbarBrand>
        )}

        <Collapse navbar isOpen={collapseOpen}>
          {/* Mobile collapse header */}
          <div className="navbar-collapse-header d-md-none">
            <Row>
              {logo && (
                <Col className="collapse-brand" xs="6">
                  {logo.innerLink ? (
                    <Link to={logo.innerLink}><img alt={logo.imgAlt} src={logo.imgSrc} /></Link>
                  ) : (
                    <a href={logo.outterLink}><img alt={logo.imgAlt} src={logo.imgSrc} /></a>
                  )}
                </Col>
              )}
              <Col className="collapse-close" xs="6">
                <button className="navbar-toggler" type="button" onClick={toggleCollapse}>
                  <span /><span />
                </button>
              </Col>
            </Row>
          </div>

          {/* Search (mobile only) */}
          <Form className="mt-4 mb-3 d-md-none">
            <InputGroup className="input-group-rounded input-group-merge">
              <Input
                aria-label="Search"
                className="form-control-rounded form-control-prepended"
                placeholder="Search"
                type="search"
              />
              <InputGroupAddon addonType="prepend">
                <InputGroupText><span className="fa fa-search" /></InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Form>

          {/* ── Static nav links (Dashboard, Sessions, Classes, etc.) ── */}
          <Nav navbar>{createLinks(routes)}</Nav>

          {/* ── Dynamic courses section ── */}
          {courses.length > 0 && (
            <>
              <hr className="my-3" />
              <h6
                className="navbar-heading text-muted"
                style={mini ? { display: "none" } : undefined}
              >
                My Courses
              </h6>
              <Nav navbar>{createCourseLinks()}</Nav>
            </>
          )}

          {/* ── Admin Panel section (admin only) ── */}
          {(typeof window !== "undefined" && (window.localStorage.getItem("role") || "").toLowerCase() === "admin") && (
            <>
              <hr className="my-3" />
              <h6 className="navbar-heading text-muted" style={mini ? { display: "none" } : undefined}>
                Admin Panel
              </h6>
              <Nav navbar>
                {[
                  { path: "/admin-overview", label: "Overview",     icon: "ni ni-settings-gear-65" },
                  { path: "/admin-users",    label: "Users",        icon: "ni ni-single-02" },
                  { path: "/admin-courses",  label: "Courses",      icon: "ni ni-book-bookmark" },
                  { path: "/admin-subjects", label: "Subjects",     icon: "ni ni-collection" },
                  { path: "/admin-sessions", label: "All Sessions", icon: "ni ni-calendar-grid-58" },
                ].map((item) => (
                  <NavItem key={item.path}>
                    <NavLink
                      to={"/admin" + item.path}
                      tag={NavLinkRRD}
                      onClick={closeCollapse}
                      title={item.label}
                    >
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

          {/* ── Resources section ── */}
          <hr className="my-3" />
          <h6
            className="navbar-heading text-muted"
            style={mini ? { display: "none" } : undefined}
          >
            Resources
          </h6>
          <Nav className="mb-md-3" navbar>
            <NavItem>
              <NavLink href="#" title="Course Guide">
                <i className="ni ni-spaceship" />
                <span className="nav-link-text" style={mini ? { display: "none" } : undefined}>Course Guide</span>
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" title="Student Support">
                <i className="ni ni-palette" />
                <span className="nav-link-text" style={mini ? { display: "none" } : undefined}>Student Support</span>
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" title="Help Center">
                <i className="ni ni-ui-04" />
                <span className="nav-link-text" style={mini ? { display: "none" } : undefined}>Help Center</span>
              </NavLink>
            </NavItem>
          </Nav>
        </Collapse>

        <style>{`
          #sidenav-main { width: 250px; transition: width 0.2s ease; }
          #sidenav-main.sidebar-mini { width: 90px; }
          .main-content { margin-left: 250px; transition: margin-left 0.2s ease; }
          #sidenav-main.sidebar-mini ~ .main-content { margin-left: 90px; }
          #sidenav-main .sidebar-edge-toggle {
            position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
            width: 36px; height: 36px; border-radius: 50%; background: #fff;
            border: 1px solid #e9ecef; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            display: flex; align-items: center; justify-content: center; z-index: 1040;
          }
          #sidenav-main .sidebar-edge-toggle:hover { background: #f8f9fa; }
          @media (max-width: 767.98px) {
            #sidenav-main { width: 70px; }
            #sidenav-main.sidebar-mini { width: 70px; }
            #sidenav-main.sidebar-open { width: 250px; }
            .main-content { margin-left: 0; }
            #sidenav-main.sidebar-mini ~ .main-content { margin-left: 0; }
            #sidenav-main .sidebar-edge-toggle { display: none; }
          }
        `}</style>
      </Container>

      {/* Edge mini-toggle button */}
      <button
        type="button"
        className="sidebar-edge-toggle btn"
        aria-label="Toggle sidebar"
        onClick={() => setMini((v) => { const n = !v; localStorage.setItem("sidebar-mini", String(n)); return n; })}
      >
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
