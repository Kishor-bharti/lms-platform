import { Button, Container, Row, Col } from "reactstrap";

const UserHeader = () => {
  const user = (() => {
    try {
      const raw = window.localStorage.getItem("user") || "";
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();
  const firstName = user.firstName || user.first_name || "";
  const lastName  = user.lastName  || user.last_name  || "";
  const name = firstName || lastName
    ? `${firstName} ${lastName}`.trim()
    : (typeof user.name === "string" ? user.name : "");
  const role = user.activeRole || user.role || "";
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "";
  return (
    <>
      <div className="header pb-8 pt-5 pt-lg-8 d-flex align-items-center user-header-modern">
        {/* Floating orbs */}
        <div className="uh-orb uh-orb-1" />
        <div className="uh-orb uh-orb-2" />
        <div className="uh-orb uh-orb-3" />
        {/* Gradient mask */}
        <span className="uh-mask" />
        <Container className="d-flex align-items-center" fluid>
          <Row>
            <Col lg="7" md="10">
              <div className="uh-content">
                <div className="uh-badge">{roleDisplay}</div>
                <h1 className="uh-title">{`Hello, ${name}`}</h1>
                <p className="uh-subtitle">Manage your profile, update your info, and keep learning.</p>
                <Button className="uh-edit-btn" onClick={(e) => e.preventDefault()}>
                  <i className="ni ni-settings mr-2" />
                  Edit profile
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
      <style>{`
        .user-header-modern {
          min-height: 500px;
          background: linear-gradient(135deg, #1a1f36 0%, #283593 40%, #1565c0 70%, #0d47a1 100%);
          position: relative;
          overflow: hidden;
        }
        .uh-mask {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(26,31,54,0.3) 0%, rgba(26,31,54,0.7) 100%);
        }
        .uh-orb {
          position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.12;
          animation: floatOrb 8s ease-in-out infinite;
        }
        .uh-orb-1 { width: 250px; height: 250px; background: #5e72e4; top: -30px; right: 15%; }
        .uh-orb-2 { width: 180px; height: 180px; background: #11cdef; bottom: -20px; left: 10%; animation-delay: -3s; }
        .uh-orb-3 { width: 120px; height: 120px; background: #2dce89; top: 30%; right: 40%; animation-delay: -5s; }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.9); }
        }
        .uh-content {
          position: relative; z-index: 2;
          animation: fadeInUp 0.6s ease;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .uh-badge {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 20px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          color: rgba(255,255,255,0.9);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }
        .uh-title {
          color: #fff;
          font-weight: 800;
          font-size: 2.2rem;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .uh-subtitle {
          color: rgba(255,255,255,0.6);
          font-size: 1rem;
          margin-bottom: 20px;
        }
        .uh-edit-btn {
          background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%) !important;
          border: none !important;
          padding: 10px 24px !important;
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          color: #fff !important;
          box-shadow: 0 6px 20px rgba(94,114,228,0.35) !important;
          transition: all 0.3s ease !important;
        }
        .uh-edit-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 28px rgba(94,114,228,0.45) !important;
        }
      `}</style>
    </>
  );
};

export default UserHeader;
