import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [collapseOpen,   setCollapseOpen]   = useState(false);
  const [mini,           setMini]           = useState(false);
  const [courses,        setCourses]        = useState([]);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [logoutOpen,     setLogoutOpen]     = useState(false);
  const [toggleHovered,  setToggleHovered]  = useState(false);
  const [showHint,       setShowHint]       = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-mini");
    if (saved === "true") setMini(true);
  }, []);

  /* ── one-time onboarding hint ── */
  useEffect(() => {
    if (!localStorage.getItem("sidebar-shortcut-seen")) {
      const t = setTimeout(() => setShowHint(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => {
      setShowHint(false);
      localStorage.setItem("sidebar-shortcut-seen", "1");
    }, 5000);
    return () => clearTimeout(t);
  }, [showHint]);

  /* ── Ctrl+X global keyboard shortcut ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "x" && !e.shiftKey && !e.altKey) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setMini((v) => {
          const n = !v;
          localStorage.setItem("sidebar-mini", String(n));
          return n;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
                setLogoutOpen(true);
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
    <>
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
            width: 28px; height: 28px; border-radius: 50%;
            background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%);
            border: 2px solid #fff;
            box-shadow: 0 4px 12px rgba(94,114,228,0.3);
            display: flex; align-items: center; justify-content: center;
            color: #fff; transition: all 0.3s ease; padding: 0 !important;
          }
          #sidenav-main .sidebar-edge-toggle:hover {
            transform: scale(1.15);
            box-shadow: 0 6px 20px rgba(94,114,228,0.4);
          }
          #sidenav-main .sidebar-edge-toggle i { font-size: 10px; }

          /* ── hover tooltip ── */
          .st-tooltip {
            position: absolute;
            left: calc(100% + 12px);
            top: 50%; transform: translateY(-50%);
            background: #1a1d2e;
            border-radius: 10px;
            padding: 8px 12px;
            white-space: nowrap;
            box-shadow: 0 8px 24px rgba(0,0,0,0.22);
            pointer-events: none;
            animation: stFadeIn 0.15s ease;
            z-index: 2000;
          }
          .st-tooltip::before {
            content: "";
            position: absolute;
            right: 100%; top: 50%; transform: translateY(-50%);
            border: 6px solid transparent;
            border-right-color: #1a1d2e;
          }
          @keyframes stFadeIn {
            from { opacity: 0; transform: translateY(-50%) translateX(-4px); }
            to   { opacity: 1; transform: translateY(-50%) translateX(0); }
          }
          .st-tooltip-title {
            font-size: 12px; font-weight: 600; color: #fff;
            margin-bottom: 5px;
          }
          .st-tooltip-shortcut {
            display: flex; align-items: center; gap: 4px;
          }
          .st-tooltip-shortcut span { color: rgba(255,255,255,0.4); font-size: 11px; }
          .st-tooltip kbd {
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 5px;
            padding: 2px 7px;
            font-size: 11px;
            color: #fff;
            font-family: inherit;
            font-weight: 700;
            letter-spacing: 0.3px;
          }

          /* ── onboarding hint ── */
          .st-hint {
            position: absolute;
            left: calc(100% + 16px);
            top: 50%; transform: translateY(-50%);
            background: #fff;
            border-radius: 14px;
            padding: 14px 16px 14px 14px;
            width: 240px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(94,114,228,0.15);
            display: flex; align-items: flex-start; gap: 10px;
            z-index: 2000;
            animation: stHintIn 0.3s cubic-bezier(0.22,1,0.36,1);
          }
          .st-hint::before {
            content: "";
            position: absolute;
            right: 100%; top: 50%; transform: translateY(-50%);
            border: 7px solid transparent;
            border-right-color: #fff;
          }
          @keyframes stHintIn {
            from { opacity: 0; transform: translateY(-50%) translateX(-8px) scale(0.95); }
            to   { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
          }
          .st-hint-icon { font-size: 20px; flex-shrink: 0; line-height: 1.3; }
          .st-hint-body {
            flex: 1; display: flex; flex-direction: column; gap: 4px;
          }
          .st-hint-body strong {
            font-size: 13px; font-weight: 800; color: #1a1d2e;
          }
          .st-hint-body span {
            font-size: 12px; color: #718096; line-height: 1.45;
          }
          .st-hint-body kbd {
            display: inline-block;
            background: #edf2f7;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 0px 5px;
            font-size: 11px;
            color: #5e72e4;
            font-weight: 700;
            font-family: inherit;
          }
          .st-hint-close {
            background: none; border: none;
            color: #a0aec0; font-size: 16px; line-height: 1;
            cursor: pointer; padding: 0; flex-shrink: 0;
            transition: color 0.15s;
          }
          .st-hint-close:hover { color: #4a5568; }
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
      <div style={{ position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)", zIndex: 1040 }}>
        <button
          type="button"
          className="sidebar-edge-toggle btn"
          aria-label="Toggle sidebar"
          onClick={() => setMini((v) => { const n = !v; localStorage.setItem("sidebar-mini", String(n)); return n; })}
          onMouseEnter={() => setToggleHovered(true)}
          onMouseLeave={() => setToggleHovered(false)}
        >
          <i className={mini ? "ni ni-bold-right" : "ni ni-bold-left"} />
        </button>

        {/* hover tooltip */}
        {toggleHovered && !showHint && (
          <div className="st-tooltip">
            <div className="st-tooltip-title">{mini ? "Expand sidebar" : "Collapse sidebar"}</div>
            <div className="st-tooltip-shortcut">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>X</kbd>
            </div>
          </div>
        )}

        {/* one-time onboarding hint */}
        {showHint && (
          <div className="st-hint">
            <div className="st-hint-icon">✨</div>
            <div className="st-hint-body">
              <strong>Keyboard shortcut</strong>
              <span>Press <kbd>Ctrl</kbd> + <kbd>X</kbd> to collapse or expand the sidebar anytime!</span>
            </div>
            <button className="st-hint-close" onClick={() => { setShowHint(false); localStorage.setItem("sidebar-shortcut-seen", "1"); }}>×</button>
          </div>
        )}
      </div>

    </Navbar>

      {/* ── Logout confirmation dialog — rendered via portal to escape Navbar stacking context ── */}
      {logoutOpen && createPortal(
        <div className="logout-overlay" onClick={() => setLogoutOpen(false)}>
          <div className="logout-dialog" onClick={e => e.stopPropagation()}>
            <div className="logout-icon-wrap">
              <i className="ni ni-user-run" />
            </div>
            <h5 className="logout-title">Sign out?</h5>
            <p className="logout-desc">You'll need to sign back in to access your account.</p>
            <div className="logout-actions">
              <button className="logout-btn-cancel" onClick={() => setLogoutOpen(false)}>
                Stay signed in
              </button>
              <button className="logout-btn-confirm" onClick={() => {
                window.localStorage.removeItem("accessToken");
                window.localStorage.removeItem("refreshToken");
                window.localStorage.removeItem("role");
                window.localStorage.removeItem("user");
                setLogoutOpen(false);
                navigate("/auth/login");
              }}>
                Sign out
              </button>
            </div>
          </div>
          <style>{`
            .logout-overlay {
              position: fixed; inset: 0; z-index: 9999;
              background: rgba(15,20,40,0.55);
              backdrop-filter: blur(4px);
              display: flex; align-items: center; justify-content: center;
              animation: loFadeIn 0.2s ease;
            }
            @keyframes loFadeIn { from { opacity: 0; } to { opacity: 1; } }
            .logout-dialog {
              background: #fff;
              border-radius: 20px;
              padding: 36px 32px 28px;
              width: 100%; max-width: 360px;
              text-align: center;
              box-shadow: 0 24px 64px rgba(0,0,0,0.18);
              animation: loSlideUp 0.25s cubic-bezier(0.22,1,0.36,1);
            }
            @keyframes loSlideUp {
              from { opacity: 0; transform: translateY(20px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .logout-icon-wrap {
              width: 64px; height: 64px; border-radius: 50%;
              background: linear-gradient(135deg, #fff1f3, #ffe4e8);
              border: 1.5px solid #ffd0d7;
              display: flex; align-items: center; justify-content: center;
              margin: 0 auto 18px;
            }
            .logout-icon-wrap i { font-size: 26px; color: #f5365c; }
            .logout-title {
              font-size: 18px; font-weight: 800; color: #1a1d2e;
              margin-bottom: 8px; letter-spacing: -0.2px;
            }
            .logout-desc {
              font-size: 13.5px; color: #8898aa; margin-bottom: 28px; line-height: 1.5;
            }
            .logout-actions { display: flex; gap: 10px; }
            .logout-btn-cancel {
              flex: 1; padding: 11px 16px; border-radius: 12px;
              border: 1.5px solid #e3e8f0; background: #f7f8fc;
              color: #525f7f; font-weight: 700; font-size: 14px;
              cursor: pointer; transition: all 0.2s ease;
            }
            .logout-btn-cancel:hover { background: #eef1f8; border-color: #d0d7e6; }
            .logout-btn-confirm {
              flex: 1; padding: 11px 16px; border-radius: 12px;
              border: none;
              background: linear-gradient(135deg, #f5365c, #f53680);
              color: #fff; font-weight: 700; font-size: 14px;
              cursor: pointer; transition: all 0.2s ease;
              box-shadow: 0 4px 14px rgba(245,54,92,0.35);
            }
            .logout-btn-confirm:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 20px rgba(245,54,92,0.45);
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
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
