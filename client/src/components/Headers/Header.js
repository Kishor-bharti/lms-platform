import { useState, useEffect } from "react";
import { Container } from "reactstrap";

const QUOTES = [
  "Every expert was once a beginner. Keep going! 🚀",
  "Learning is the passport to the future. 🌍",
  "Small progress is still progress. Keep pushing!",
  "Your only limit is your mind. Believe in yourself! ✨",
  "Success is the sum of small efforts, repeated daily. 🏆",
  "The more you learn, the more you earn. 📚",
  "Dream big. Study hard. Stay humble. 🌟",
  "Knowledge is power. Keep leveling up! ⚡",
  "Today's effort is tomorrow's achievement. 🎯",
  "You are capable of amazing things. Keep going!",
];

function useTypewriter(text, speed = 45) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

const Header = ({ hideSubtitle = false }) => {
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

  const [quoteIndex, setQuoteIndex] = useState(0);
  const { displayed, done } = useTypewriter(QUOTES[quoteIndex]);

  // After typing finishes, wait 4s then move to next quote
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length);
    }, 4000);
    return () => clearTimeout(t);
  }, [done]);

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
              {greeting}{user ? `, ${user}` : ""}
            </h2>
            {!hideSubtitle && (
              <p className="header-subtitle">
                {displayed}
                <span className="type-cursor" />
              </p>
            )}
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
          min-height: 1.4em;
        }
        .type-cursor {
          display: inline-block;
          width: 2px;
          height: 0.85em;
          background: rgba(255,255,255,0.65);
          margin-left: 2px;
          vertical-align: middle;
          animation: cursorBlink 0.75s step-end infinite;
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
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
