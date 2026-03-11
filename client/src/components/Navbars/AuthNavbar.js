import { Link } from "react-router-dom";
import {
  UncontrolledCollapse,
  NavbarBrand,
  Navbar,
  NavItem,
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
              src={require("../../assets/img/brand/argon-react.png")}
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
                <a
                  className="auth-nav-link"
                  href="https://10xaccel.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact Us
                </a>
              </NavItem>
            </Nav>
          </UncontrolledCollapse>
        </Container>
      </Navbar>
      <style>{`
        .auth-navbar-modern {
          background: #ffffff !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12) !important;
          padding-top: 14px !important;
          padding-bottom: 14px !important;
          margin-top: 14px !important;
        }
        .auth-navbar-brand {
          transition: transform 0.3s ease !important;
        }
        .auth-navbar-brand:hover {
          transform: scale(1.05) !important;
        }
        .auth-nav-link {
          color: #ffffff !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          padding: 8px 20px !important;
          border-radius: 50px !important;
          background: linear-gradient(135deg, #5e72e4, #825ee4) !important;
          transition: all 0.3s ease !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          letter-spacing: 0.3px !important;
          box-shadow: 0 4px 14px rgba(94, 114, 228, 0.4) !important;
        }
        .auth-nav-link:hover {
          color: #ffffff !important;
          background: linear-gradient(135deg, #4a5fd4, #6e4ed4) !important;
          box-shadow: 0 6px 20px rgba(94, 114, 228, 0.55) !important;
          transform: translateY(-1px) !important;
        }
      `}</style>
    </>
  );
};

export default AuthNavbar;
