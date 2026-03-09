import { Container } from "reactstrap";

const Header = () => {
  const user = (() => {
    try {
      const raw = window.localStorage.getItem("user") || "";
      const u = raw ? JSON.parse(raw) : {};
      return u.firstName || u.first_name || "";
    } catch { return ""; }
  })();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  return (
    <>
      <div className="header header-animated pb-8 pt-5 pt-md-8">
        {/* Floating orbs */}
        <div className="header-orb orb-1" />
        <div className="header-orb orb-2" />
        <div className="header-orb orb-3" />
        <Container fluid>
          <div className="header-welcome">
            <h2 className="header-greeting">
              {greeting}{user ? `, ${user}` : ""} <span className="wave-emoji">👋</span>
            </h2>
            <p className="header-subtitle">Here's what's happening with your learning today</p>
          </div>
        </Container>
      </div>
      <style>{`
        .header-animated {
          background: linear-gradient(135deg, #1a1f36 0%, #283593 40%, #1565c0 70%, #0d47a1 100%);
          position: relative;
          overflow: hidden;
        }
        .header-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.15;
          animation: floatOrb 8s ease-in-out infinite;
        }
        .orb-1 {
          width: 300px; height: 300px;
          background: #5e72e4;
          top: -50px; right: 10%;
          animation-delay: 0s;
        }
        .orb-2 {
          width: 200px; height: 200px;
          background: #11cdef;
          bottom: -30px; left: 15%;
          animation-delay: -3s;
        }
        .orb-3 {
          width: 150px; height: 150px;
          background: #2dce89;
          top: 20%; left: 60%;
          animation-delay: -5s;
        }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.9); }
        }
        .header-welcome {
          position: relative;
          z-index: 2;
          animation: fadeInUp 0.6s ease;
        }
        .header-greeting {
          color: #fff;
          font-weight: 800;
          font-size: 1.6rem;
          margin-bottom: 4px;
          letter-spacing: -0.3px;
        }
        .header-subtitle {
          color: rgba(255,255,255,0.65);
          font-size: 0.95rem;
          margin: 0;
          font-weight: 400;
        }
        .wave-emoji {
          display: inline-block;
          animation: wave 2.5s ease-in-out infinite;
          transform-origin: 70% 70%;
        }
        @keyframes wave {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(14deg); }
          20%  { transform: rotate(-8deg); }
          30%  { transform: rotate(14deg); }
          40%  { transform: rotate(-4deg); }
          50%  { transform: rotate(10deg); }
          60%  { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default Header;
