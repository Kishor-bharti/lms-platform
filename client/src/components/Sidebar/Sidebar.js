import { useEffect, useState } from "react";
import { NavLink as NavLinkRRD, Link, useNavigate } from "react-router-dom";
// nodejs library to set properties for components
import { PropTypes } from "prop-types";

// reactstrap components
import {
  Collapse,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  NavbarBrand,
  Navbar,
  NavItem,
  NavLink,
  Nav,
  Container,
  Row,
  Col,
} from "reactstrap";

const Sidebar = (props) => {
  const [collapseOpen, setCollapseOpen] = useState();
  const [mini, setMini] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-mini");
    if (saved === "true") setMini(true);
  }, []);
  // toggles collapse between opened and closed (true/false)
  const toggleCollapse = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    setCollapseOpen((prev) => {
      const next = !prev;
      if (isMobile && next) {
        setMini(false);
        localStorage.setItem("sidebar-mini", "false");
      }
      return next;
    });
  };
  // closes the collapse
  const closeCollapse = () => {
    setCollapseOpen(false);
  };
  // creates the links that appear in the left menu / Sidebar
  const createLinks = (routes) => {
    const userRole = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    return routes
      .filter((prop) => {
        if (prop.layout !== "/admin") return false;
        if (!prop.roles) return true;
        return prop.roles.map(r => r.toUpperCase()).includes((userRole ?? "").toUpperCase());
      })
      .map((prop, key) => {
      return (
        <NavItem key={key}>
          <NavLink
            to={prop.layout + prop.path}
            tag={NavLinkRRD}
            onClick={(e) => {
              if (prop.name === "Logout") {
                e.preventDefault();
                window.localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                localStorage.removeItem("role");
                localStorage.removeItem("user");
                navigate("/auth/login");
              } else {
                closeCollapse();
              }
            }}
            title={prop.name}
          >
            <i className={prop.icon} />
            <span className="nav-link-text" style={mini ? { display: "none" } : undefined}>{prop.name}</span>
          </NavLink>
        </NavItem>
      );
    });
  };

  const { routes, logo } = props;
  let navbarBrandProps;
  if (logo && logo.innerLink) {
    navbarBrandProps = {
      to: logo.innerLink,
      tag: Link,
    };
  } else if (logo && logo.outterLink) {
    navbarBrandProps = {
      href: logo.outterLink,
      target: "_blank",
    };
  }

  return (
    <Navbar
      className={`navbar-vertical fixed-left navbar-light bg-white ${mini ? 'sidebar-mini' : ''} ${collapseOpen ? 'sidebar-open' : ''}`}
      expand="md"
      id="sidenav-main"
    >
      <Container fluid>
        {/* Toggler */}
        <button
          className="navbar-toggler"
          type="button"
          onClick={toggleCollapse}
        >
          <span className="navbar-toggler-icon" />
        </button>
        {/* Edge toggle button */}
        {/* Brand */}
        {logo ? (
          <NavbarBrand className="pt-0" {...navbarBrandProps}>
            <img
              alt={logo.imgAlt}
              className="navbar-brand-img"
              src={logo.imgSrc}
            />
          </NavbarBrand>
        ) : null}
        {/* User (removed duplicate mobile bell/avatar toggles) */}
        {/* Collapse */}
        <Collapse navbar isOpen={collapseOpen}>
          {/* Collapse header */}
          <div className="navbar-collapse-header d-md-none">
            <Row>
              {logo ? (
                <Col className="collapse-brand" xs="6">
                  {logo.innerLink ? (
                    <Link to={logo.innerLink}>
                      <img alt={logo.imgAlt} src={logo.imgSrc} />
                    </Link>
                  ) : (
                    <a href={logo.outterLink}>
                      <img alt={logo.imgAlt} src={logo.imgSrc} />
                    </a>
                  )}
                </Col>
              ) : null}
              <Col className="collapse-close" xs="6">
                <button
                  className="navbar-toggler"
                  type="button"
                  onClick={toggleCollapse}
                >
                  <span />
                  <span />
                </button>
              </Col>
            </Row>
          </div>
          {/* Form */}
          <Form className="mt-4 mb-3 d-md-none">
            <InputGroup className="input-group-rounded input-group-merge">
              <Input
                aria-label="Search"
                className="form-control-rounded form-control-prepended"
                placeholder="Search"
                type="search"
              />
              <InputGroupAddon addonType="prepend">
                <InputGroupText>
                  <span className="fa fa-search" />
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Form>
          {/* Navigation */}
          <Nav navbar>{createLinks(routes)}</Nav>
          {/* Divider */}
          <hr className="my-3" />
          {/* Heading */}
          <h6 className="navbar-heading text-muted" style={mini ? { display: "none" } : undefined}>Resources</h6>
          {/* Navigation */}
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
          /* Smooth width transition on the whole sidebar */
          #sidenav-main { width: 250px; transition: width 0.2s ease; }
          #sidenav-main.sidebar-mini { width: 90px; }
          /* Adjust main-content when sidebar shrinks/expands */
          .main-content { margin-left: 250px; transition: margin-left 0.2s ease; }
          #sidenav-main.sidebar-mini ~ .main-content { margin-left: 90px; }
          /* Edge toggle button */
          #sidenav-main .sidebar-edge-toggle {
            position: absolute;
            right: -12px;
            top: 50%;
            transform: translateY(-50%);
            width: 36px; height: 36px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid #e9ecef;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            display: flex; align-items: center; justify-content: center;
            z-index: 1040;
          }
          #sidenav-main .sidebar-edge-toggle:hover { background: #f8f9fa; }
          /* Mobile: compact sidebar and no content offset */
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
      {/* Absolute positioned edge toggle */}
      <button
        type="button"
        className="sidebar-edge-toggle btn"
        aria-label="Toggle sidebar"
        onClick={() => {
          setMini((v) => {
            const next = !v;
            localStorage.setItem("sidebar-mini", String(next));
            return next;
          });
        }}
      >
        <i className={mini ? 'ni ni-bold-right' : 'ni ni-bold-left'} />
      </button>
    </Navbar>
  );
};

Sidebar.defaultProps = {
  routes: [{}],
};

Sidebar.propTypes = {
  // links that will be displayed inside the component
  routes: PropTypes.arrayOf(PropTypes.object),
  logo: PropTypes.shape({
    // innerLink is for links that will direct the user within the app
    // it will be rendered as <Link to="...">...</Link> tag
    innerLink: PropTypes.string,
    // outterLink is for links that will direct the user outside the app
    // it will be rendered as simple <a href="...">...</a> tag
    outterLink: PropTypes.string,
    // the image src of the logo
    imgSrc: PropTypes.string.isRequired,
    // the alt for the img
    imgAlt: PropTypes.string.isRequired,
  }),
};

export default Sidebar;
