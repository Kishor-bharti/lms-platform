import { NavItem, NavLink, Nav, Container, Row, Col } from "reactstrap";

const AuthFooter = () => {
  return (
    <>
      <footer className="py-5 auth-footer-modern">
        <Container>
          <Row className="align-items-center justify-content-xl-between">
            <Col xl="6">
              <div className="copyright text-center text-xl-left">
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>© {new Date().getFullYear()}</span>{" "}
                <a className="auth-footer-brand" href="https://10xaccel.com/" rel="noopener noreferrer" target="_blank">
                  10xAccel
                </a>
              </div>
            </Col>
            <Col xl="6">
              <Nav className="nav-footer justify-content-center justify-content-xl-end">
                <NavItem>
                  <NavLink href="https://10xaccel.com/" rel="noopener noreferrer" target="_blank" className="auth-footer-link">
                    10xAccel
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink href="https://10xaccel.com/" rel="noopener noreferrer" target="_blank" className="auth-footer-link">
                    About Us
                  </NavLink>
                </NavItem>
              </Nav>
            </Col>
          </Row>
        </Container>
      </footer>
      <style>{`
        .auth-footer-modern { position: relative; z-index: 2; }
        .auth-footer-brand {
          font-weight: 800;
          color: rgba(255,255,255,0.9) !important;
          text-decoration: none;
          transition: all 0.3s ease;
        }
        .auth-footer-brand:hover { color: #fff !important; text-shadow: 0 0 20px rgba(255,255,255,0.3); text-decoration: none; }
        .auth-footer-link {
          color: rgba(255,255,255,0.6) !important;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.3s ease !important;
        }
        .auth-footer-link:hover { color: rgba(255,255,255,0.95) !important; }
      `}</style>
    </>
  );
};

export default AuthFooter;
