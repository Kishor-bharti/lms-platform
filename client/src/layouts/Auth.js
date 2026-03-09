import React from "react";
import { useLocation, Route, Routes, Navigate } from "react-router-dom";
import { Container, Row, Col } from "reactstrap";
import AuthNavbar from "components/Navbars/AuthNavbar.js";
import AuthFooter from "components/Footers/AuthFooter.js";
import routes from "routes.js";

const Auth = (props) => {
  const mainContent = React.useRef(null);
  const location = useLocation();

  React.useEffect(() => {
    document.body.classList.add("bg-default");
    return () => {
      document.body.classList.remove("bg-default");
    };
  }, []);
  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    mainContent.current.scrollTop = 0;
  }, [location]);

  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.layout === "/auth") {
        return (
          <Route path={prop.path} element={prop.component} key={key} exact />
        );
      } else {
        return null;
      }
    });
  };

  return (
    <>
      <div className="main-content auth-main-modern" ref={mainContent}>
        <AuthNavbar />
        <div className="header auth-header-animated py-7 py-lg-8">
          {/* Floating shapes */}
          <div className="auth-shape auth-shape-1" />
          <div className="auth-shape auth-shape-2" />
          <div className="auth-shape auth-shape-3" />
          <Container>
            <div className="header-body text-center mb-7">
              <Row className="justify-content-center">
                <Col lg="5" md="6">
                  <div className="auth-welcome-animate">
                    <h1 className="auth-title">Welcome! <span className="wave-emoji">👋</span></h1>
                    <p className="auth-subtitle">
                      Access your learning management system. Choose your role to get started.
                    </p>
                  </div>
                </Col>
              </Row>
            </div>
          </Container>
          <div className="separator separator-bottom separator-skew zindex-100">
            <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" version="1.1" viewBox="0 0 2560 100" x="0" y="0">
              <polygon className="fill-default" points="2560 0 2560 100 0 100" />
            </svg>
          </div>
        </div>
        <Container className="mt--8 pb-5">
          <Row className="justify-content-center">
            <Routes>
              {getRoutes(routes)}
              <Route path="*" element={<Navigate to="/auth/login" replace />} />
            </Routes>
          </Row>
        </Container>
      </div>
      <AuthFooter />
      <style>{`
        .auth-main-modern {
          min-height: 100vh;
          background: #172b4d;
        }
        .auth-header-animated {
          background: linear-gradient(135deg, #1a1f36 0%, #283593 35%, #1565c0 65%, #0d47a1 100%) !important;
          position: relative;
          overflow: hidden;
        }
        .auth-shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.1;
          animation: authFloat 10s ease-in-out infinite;
        }
        .auth-shape-1 {
          width: 400px; height: 400px;
          background: #5e72e4;
          top: -100px; right: 5%;
        }
        .auth-shape-2 {
          width: 300px; height: 300px;
          background: #11cdef;
          bottom: -80px; left: 10%;
          animation-delay: -4s;
        }
        .auth-shape-3 {
          width: 200px; height: 200px;
          background: #2dce89;
          top: 20%; left: 50%;
          animation-delay: -7s;
        }
        @keyframes authFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.1); }
          66% { transform: translate(-30px, 20px) scale(0.9); }
        }
        .auth-welcome-animate {
          animation: fadeInUp 0.7s ease;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-title {
          color: #fff;
          font-weight: 800;
          font-size: 2rem;
          letter-spacing: -0.5px;
        }
        .auth-subtitle {
          color: rgba(255,255,255,0.65);
          font-size: 1rem;
          line-height: 1.6;
        }
        .wave-emoji {
          display: inline-block;
          animation: wave 2.5s ease-in-out infinite;
          transform-origin: 70% 70%;
        }
        @keyframes wave {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
          60%, 100% { transform: rotate(0deg); }
        }
      `}</style>
    </>
  );
};

export default Auth;
