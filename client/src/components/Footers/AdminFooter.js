import { Row, Col, Nav, NavItem, NavLink } from "reactstrap";

const Footer = () => {
  return (
    <footer className="footer footer-modern">
      <Row className="align-items-center justify-content-xl-between">
        <Col xl="6">
          <div className="copyright text-center text-xl-left">
            <span style={{ color: '#8898aa', fontSize: 13 }}>© {new Date().getFullYear()}</span>{" "}
            <a
              className="footer-brand-link"
              href="https://10xaccel.com/"
              rel="noopener noreferrer"
              target="_blank"
            >
              10xAccel
            </a>
            <span style={{ color: '#adb5bd', fontSize: 12 }}> — Learning, Accelerated.</span>
          </div>
        </Col>
        <Col xl="6">
          <Nav className="nav-footer justify-content-center justify-content-xl-end">
            <NavItem>
              <NavLink href="https://10xaccel.com/" rel="noopener noreferrer" target="_blank" className="footer-link">
                About Us
              </NavLink>
            </NavItem>
          </Nav>
        </Col>
      </Row>
      <style>{`
        .footer-modern {
          background: linear-gradient(180deg, transparent 0%, rgba(248,250,255,0.8) 100%);
          border-top: 1px solid rgba(94,114,228,0.08);
          padding: 1.2rem 1.5rem;
        }
        .footer-brand-link {
          font-weight: 800;
          background: linear-gradient(135deg, #5e72e4, #825ee4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          transition: all 0.3s ease;
        }
        .footer-brand-link:hover {
          filter: brightness(1.2);
          text-decoration: none;
        }
        .footer-link {
          color: #525f7f !important;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.3s ease !important;
          border-radius: 8px;
          padding: 4px 12px !important;
        }
        .footer-link:hover {
          color: #5e72e4 !important;
          background: rgba(94,114,228,0.06);
        }
      `}</style>
    </footer>
  );
};

export default Footer;
