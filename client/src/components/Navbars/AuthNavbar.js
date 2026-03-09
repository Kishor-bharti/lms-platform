import { Link } from "react-router-dom";
import {
  UncontrolledCollapse,
  NavbarBrand,
  Navbar,
  NavItem,
  NavLink,
  Nav,
  Container,
  Row,
  Col,
} from "reactstrap";

const AuthNavbar = () => {
  return (
    <>
      <Navbar className="navbar-top navbar-horizontal navbar-dark auth-navbar-modern" expand="md">
        <Container className="px-4">
          <NavbarBrand to="/" tag={Link} className="auth-navbar-brand">
            <img
              alt="10xAccel"
              src={require("../../assets/img/brand/argon-react-white.png")}
              style={{ height: '60px', width: 'auto' }}
            />
          </NavbarBrand>
          <button className="navbar-toggler" id="navbar-collapse-main">
            <span className="navbar-toggler-icon" />
          </button>
          <UncontrolledCollapse navbar toggler="#navbar-collapse-main">
            <div className="navbar-collapse-header d-md-none">
              <Row>
                <Col className="collapse-brand" xs="6">
                  <Link to="/">
                    <img
                      alt="10xAccel"
                      src={require("../../assets/img/brand/argon-react.png")}
                    />
                  </Link>
                </Col>
                <Col className="collapse-close" xs="6">
                  <button className="navbar-toggler" id="navbar-collapse-main">
                    <span />
                    <span />
                  </button>
                </Col>
              </Row>
            </div>
            <Nav className="ml-auto" navbar>
              <NavItem>
                <NavLink
                  className="auth-nav-link"
                  to="/auth/admin-login"
                  tag={Link}
                >
                  <i className="ni ni-circle-08" style={{ marginRight: 6 }} />
                  <span>Admin</span>
                </NavLink>
              </NavItem>
            </Nav>
          </UncontrolledCollapse>
        </Container>
      </Navbar>
      <style>{`
        .auth-navbar-modern {
          background: transparent !important;
          box-shadow: none !important;
          padding-top: 16px !important;
          padding-bottom: 16px !important;
        }
        .auth-navbar-brand {
          transition: transform 0.3s ease !important;
        }
        .auth-navbar-brand:hover {
          transform: scale(1.05) !important;
        }
        .auth-nav-link {
          color: rgba(255,255,255,0.8) !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          padding: 8px 18px !important;
          border-radius: 10px !important;
          transition: all 0.3s ease !important;
          display: flex !important;
          align-items: center !important;
        }
        .auth-nav-link:hover {
          color: #fff !important;
          background: rgba(255,255,255,0.1) !important;
        }
      `}</style>
    </>
  );
};

export default AuthNavbar;
