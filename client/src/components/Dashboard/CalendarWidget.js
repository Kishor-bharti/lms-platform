import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../utils/http";

/* ── helpers ─────────────────────────────────────────── */
function monthMatrix(date) {
  const y = date.getFullYear(), m = date.getMonth();
  const firstDay   = new Date(y, m, 1).getDay();
  const daysInMo   = new Date(y, m + 1, 0).getDate();
  const prevDays   = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++)
    cells.push({ day: prevDays - firstDay + 1 + i, type: "prev" });
  for (let d = 1; d <= daysInMo; d++)
    cells.push({ day: d, type: "curr" });
  let nd = 1;
  while (cells.length % 7 !== 0)
    cells.push({ day: nd++, type: "next" });
  return cells;
}

const MO_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MO_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HDRS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmt(y, m, d) {
  return `${DAY_HDRS[new Date(y,m,d).getDay()]}, ${MO_SHORT[m]} ${d}`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function toDateStr(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}



/* ── component ───────────────────────────────────────── */
export default function CalendarWidget() {
  const today     = useMemo(() => new Date(), []);
  const [cur,     setCur]     = useState(new Date());
  const [sel,     setSel]     = useState(null);          // {y,m,d}
  const [view,    setView]    = useState("cal");          // "cal"|"month"|"year"
  const [yrBase,  setYrBase]  = useState(() => Math.floor(today.getFullYear() / 12) * 12);
  const [sessions, setSessions] = useState([]);

  const cells = useMemo(() => monthMatrix(cur), [cur]);
  const navigate = useNavigate();

  const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
  const sessionsPath = role === "student" ? "/admin/classes" : "/admin/sessions";

  /* fetch all sessions once — used only for date dot indicators */
  useEffect(() => {
    http.get('/api/classes/my-sessions-v2')
      .then(res => setSessions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSessions([]));
  }, []);

  /* set of date strings that have sessions — for dot indicators */
  const sessionDateSet = useMemo(() => {
    const s = new Set();
    sessions.forEach(sess => {
      if (sess.scheduled_at) s.add(sess.scheduled_at.slice(0, 10));
    });
    return s;
  }, [sessions]);


  const isToday = c =>
    c.type === "curr" &&
    c.day === today.getDate() &&
    cur.getMonth()    === today.getMonth() &&
    cur.getFullYear() === today.getFullYear();

  const isSel = c =>
    sel && c.type === "curr" &&
    sel.d === c.day && sel.m === cur.getMonth() && sel.y === cur.getFullYear();

  const pickDay = c => {
    if (c.type === "prev") {
      const nb = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
      setCur(nb); setSel({ y: nb.getFullYear(), m: nb.getMonth(), d: c.day });
    } else if (c.type === "next") {
      const nb = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      setCur(nb); setSel({ y: nb.getFullYear(), m: nb.getMonth(), d: c.day });
    } else {
      setSel({ y: cur.getFullYear(), m: cur.getMonth(), d: c.day });
    }
  };

  const navMonth = delta => setCur(new Date(cur.getFullYear(), cur.getMonth() + delta, 1));
  const goToday  = () => { setCur(new Date()); setSel(null); setView("cal"); };

  const selLabel = sel ? fmt(sel.y, sel.m, sel.d)
    : fmt(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="cw-root">

      {/* ══ HEADER ══════════════════════════════════════ */}
      <div className="cw-head">
        <div className="cw-head-orb cw-orb1" />
        <div className="cw-head-orb cw-orb2" />

        {/* top row: nav arrows + month/year labels */}
        <div className="cw-head-row cw-head-top">
          <button className="cw-arrow" onClick={() => navMonth(-1)} title="Prev month">&#8249;</button>

          <div className="cw-head-labels">
            <button
              className={`cw-mo-btn${view === "month" ? " cw-lbl-active" : ""}`}
              onClick={() => setView(view === "month" ? "cal" : "month")}
            >
              {MO_FULL[cur.getMonth()]}
            </button>
            <button
              className={`cw-yr-btn${view === "year" ? " cw-lbl-active" : ""}`}
              onClick={() => { setYrBase(Math.floor(cur.getFullYear()/12)*12); setView(view === "year" ? "cal" : "year"); }}
            >
              {cur.getFullYear()}
            </button>
          </div>

          <button className="cw-arrow" onClick={() => navMonth(1)} title="Next month">&#8250;</button>
        </div>

        {/* bottom row: selected / today label + today chip */}
        <div className="cw-head-row cw-head-bot">
          <div className="cw-sel-label">
            <span className="cw-sel-dot" />
            {sel ? "Selected" : "Today"} — <strong>{selLabel}</strong>
          </div>
          <button className="cw-today-chip" onClick={goToday}>Today</button>
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════ */}
      <div className="cw-body">

        {/* MONTH PICKER */}
        {view === "month" && (
          <div className="cw-picker-overlay">
            <p className="cw-picker-hint">Select a month</p>
            <div className="cw-mo-grid">
              {MO_SHORT.map((m, i) => (
                <button
                  key={m}
                  className={`cw-picker-cell${i === cur.getMonth() ? " cw-pcell-active" : ""}`}
                  onClick={() => { setCur(new Date(cur.getFullYear(), i, 1)); setView("cal"); }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* YEAR PICKER */}
        {view === "year" && (
          <div className="cw-picker-overlay">
            <div className="cw-yr-nav">
              <button className="cw-yr-nav-btn" onClick={() => setYrBase(yrBase - 12)}>&#8249;</button>
              <span className="cw-picker-hint" style={{ margin: 0 }}>{yrBase} – {yrBase + 11}</span>
              <button className="cw-yr-nav-btn" onClick={() => setYrBase(yrBase + 12)}>&#8250;</button>
            </div>
            <div className="cw-yr-grid">
              {Array.from({ length: 12 }, (_, i) => yrBase + i).map(y => (
                <button
                  key={y}
                  className={`cw-picker-cell${y === cur.getFullYear() ? " cw-pcell-active" : ""}`}
                  onClick={() => { setCur(new Date(y, cur.getMonth(), 1)); setView("cal"); }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CALENDAR GRID */}
        {view === "cal" && (
          <div className="cw-grid">
            {DAY_HDRS.map((d, i) => (
              <div key={d} className={`cw-wdhdr${i === 0 || i === 6 ? " cw-wkend" : ""}`}>{d}</div>
            ))}
            {cells.map((c, i) => {
              const col    = i % 7;
              const isWknd = col === 0 || col === 6;
              const td     = isToday(c);
              const sc     = isSel(c);
              const cellDateStr = c.type === "curr"
                ? toDateStr(cur.getFullYear(), cur.getMonth(), c.day)
                : null;
              const hasDot = cellDateStr && sessionDateSet.has(cellDateStr) && !td && !sc;
              return (
                <div
                  key={i}
                  className={[
                    "cw-cell",
                    c.type !== "curr" ? "cw-faded"    : "",
                    isWknd            ? "cw-wkend-cell": "",
                    td                ? "cw-today"     : "",
                    sc && !td         ? "cw-selected"  : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => pickDay(c)}
                  title={c.type === "curr" ? `${MO_FULL[cur.getMonth()]} ${c.day}, ${cur.getFullYear()}` : undefined}
                >
                  <span className="cw-cell-inner">{c.day}</span>
                  {td && <span className="cw-today-ring" />}
                  {hasDot && <span className="cw-session-dot" />}
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW SESSIONS BUTTON — shown when a date is selected */}
        {view === "cal" && sel && (
          <div className="cw-sp">
            <div className="cw-sp-hdr">
              <span className="cw-sp-title">{selLabel}</span>
            </div>
            <button
              className="cw-view-date-btn"
              onClick={() => navigate(`${sessionsPath}?date=${toDateStr(sel.y, sel.m, sel.d)}`)}
            >
              <span>View Sessions for this date</span>
              <span className="cw-btn-arrow">→</span>
            </button>
          </div>
        )}
      </div>

      {/* ══ FOOTER ══════════════════════════════════════ */}
      <div className="cw-footer">
        <button className="cw-sessions-btn" onClick={() => navigate(sessionsPath)}>
          <span>View All Sessions</span>
          <span className="cw-btn-arrow">→</span>
        </button>
      </div>

      {/* ══ STYLES ══════════════════════════════════════ */}
      <style>{`
        /* ── root ── */
        .cw-root {
          border-radius: 20px;
          overflow: hidden;
          background: #16181f;
          box-shadow: 0 8px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          font-family: inherit;
          user-select: none;
        }

        /* ── header ── */
        .cw-head {
          background: linear-gradient(135deg, #1a1f36 0%, #252d5a 50%, #1e3a8a 100%);
          padding: 18px 20px 14px;
          position: relative;
          overflow: hidden;
        }
        .cw-head-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(50px);
          pointer-events: none;
        }
        .cw-orb1 {
          width: 160px; height: 160px;
          background: rgba(94,114,228,0.35);
          top: -40px; right: -20px;
        }
        .cw-orb2 {
          width: 100px; height: 100px;
          background: rgba(130,94,228,0.25);
          bottom: -20px; left: 10%;
        }
        .cw-head-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
        }
        .cw-head-top {
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .cw-head-bot {
          justify-content: space-between;
        }

        /* ── arrow buttons ── */
        .cw-arrow {
          width: 32px; height: 32px;
          background: rgba(255,255,255,0.1) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 50% !important;
          color: #fff !important;
          font-size: 18px !important;
          line-height: 1 !important;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          padding: 0 !important;
          flex-shrink: 0;
        }
        .cw-arrow:hover {
          background: rgba(255,255,255,0.2) !important;
          border-color: rgba(255,255,255,0.35) !important;
          transform: scale(1.08) !important;
        }

        /* ── month / year labels ── */
        .cw-head-labels {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .cw-mo-btn {
          background: none !important;
          border: none !important;
          color: #fff !important;
          font-size: 1.25rem !important;
          font-weight: 800 !important;
          letter-spacing: -0.3px !important;
          cursor: pointer !important;
          padding: 2px 6px !important;
          border-radius: 8px !important;
          transition: background 0.18s !important;
          line-height: 1.2 !important;
        }
        .cw-yr-btn {
          background: none !important;
          border: none !important;
          color: rgba(255,255,255,0.55) !important;
          font-size: 0.95rem !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          padding: 2px 6px !important;
          border-radius: 8px !important;
          transition: all 0.18s !important;
          line-height: 1.2 !important;
        }
        .cw-mo-btn:hover { background: rgba(255,255,255,0.12) !important; }
        .cw-yr-btn:hover { background: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.85) !important; }
        .cw-lbl-active {
          background: rgba(94,114,228,0.3) !important;
          color: #fff !important;
        }

        /* ── selected / today subline ── */
        .cw-sel-label {
          font-size: 11.5px;
          color: rgba(255,255,255,0.5);
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .cw-sel-label strong { color: rgba(255,255,255,0.85); font-weight: 600; }
        .cw-sel-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #5e72e4;
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(94,114,228,0.8);
        }
        .cw-today-chip {
          background: rgba(255,255,255,0.12) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          border-radius: 20px !important;
          color: rgba(255,255,255,0.75) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 3px 12px !important;
          cursor: pointer !important;
          transition: all 0.18s !important;
          letter-spacing: 0.3px !important;
          text-transform: uppercase !important;
        }
        .cw-today-chip:hover {
          background: rgba(94,114,228,0.3) !important;
          border-color: rgba(94,114,228,0.5) !important;
          color: #fff !important;
        }

        /* ── body ── */
        .cw-body {
          padding: 16px 16px 8px;
          background: #16181f;
          flex: 1;
        }

        /* ── weekday headers ── */
        .cw-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .cw-wdhdr {
          text-align: center;
          font-size: 10.5px;
          font-weight: 700;
          color: #4a5568;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          padding-bottom: 8px;
        }
        .cw-wkend { color: #5e72e4; }

        /* ── day cells ── */
        .cw-cell {
          position: relative;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 50%;
          transition: all 0.18s ease;
        }
        .cw-cell-inner {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          position: relative;
          z-index: 1;
          line-height: 1;
        }
        .cw-cell:not(.cw-faded):not(.cw-today):hover .cw-cell-inner {
          color: #fff;
        }
        .cw-cell:not(.cw-faded):not(.cw-today):hover {
          background: rgba(94,114,228,0.2);
        }

        /* faded (prev/next month) */
        .cw-faded .cw-cell-inner { color: rgba(255,255,255,0.15); }
        .cw-faded:hover { background: rgba(255,255,255,0.04) !important; }
        .cw-faded:hover .cw-cell-inner { color: rgba(255,255,255,0.3) !important; }

        /* weekend tint — only when NOT today or selected */
        .cw-wkend-cell:not(.cw-faded):not(.cw-today):not(.cw-selected) .cw-cell-inner {
          color: rgba(130,94,228,0.9);
        }

        /* today */
        .cw-today {
          background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%);
          box-shadow: 0 4px 14px rgba(94,114,228,0.5);
        }
        .cw-today .cw-cell-inner { color: #fff; font-weight: 800; }
        .cw-today-ring {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35);
          pointer-events: none;
        }

        /* selected (not today) */
        .cw-selected {
          background: rgba(94,114,228,0.18);
          outline: 2px solid #5e72e4;
          outline-offset: -2px;
        }
        .cw-selected .cw-cell-inner { color: #fff; font-weight: 700; }

        /* session dot indicator */
        .cw-session-dot {
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #5e72e4;
          pointer-events: none;
        }

        /* ── picker overlay ── */
        .cw-picker-overlay {
          animation: cwFadeIn 0.18s ease;
        }
        @keyframes cwFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cw-picker-hint {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .cw-mo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .cw-yr-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .cw-picker-cell {
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.07) !important;
          border-radius: 10px !important;
          color: rgba(255,255,255,0.65) !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          padding: 9px 4px !important;
          cursor: pointer !important;
          transition: all 0.18s !important;
          text-align: center;
        }
        .cw-picker-cell:hover {
          background: rgba(94,114,228,0.2) !important;
          border-color: rgba(94,114,228,0.4) !important;
          color: #fff !important;
        }
        .cw-pcell-active {
          background: linear-gradient(135deg, #5e72e4, #825ee4) !important;
          border-color: transparent !important;
          color: #fff !important;
          box-shadow: 0 3px 10px rgba(94,114,228,0.4) !important;
        }

        /* year nav row */
        .cw-yr-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .cw-yr-nav-btn {
          background: rgba(255,255,255,0.08) !important;
          border: none !important;
          border-radius: 8px !important;
          color: rgba(255,255,255,0.7) !important;
          font-size: 18px !important;
          width: 30px; height: 30px;
          cursor: pointer !important;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.18s !important;
          padding: 0 !important;
        }
        .cw-yr-nav-btn:hover {
          background: rgba(94,114,228,0.25) !important;
          color: #fff !important;
        }

        /* ── selected date panel ── */
        .cw-sp {
          margin-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.07);
          padding-top: 10px;
          animation: cwFadeIn 0.18s ease;
        }
        .cw-sp-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .cw-sp-title {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.7);
          letter-spacing: 0.2px;
        }
        .cw-view-date-btn {
          width: 100%;
          background: rgba(94,114,228,0.15) !important;
          border: 1px solid rgba(94,114,228,0.35) !important;
          border-radius: 12px !important;
          color: rgba(255,255,255,0.85) !important;
          font-size: 12.5px !important;
          font-weight: 700 !important;
          padding: 9px 14px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          transition: all 0.2s ease !important;
          letter-spacing: 0.2px;
        }
        .cw-view-date-btn:hover {
          background: rgba(94,114,228,0.28) !important;
          border-color: rgba(94,114,228,0.6) !important;
          color: #fff !important;
          transform: translateY(-1px) !important;
        }

        /* ── footer ── */
        .cw-footer {
          padding: 10px 16px 16px;
          background: #16181f;
        }
        .cw-sessions-btn {
          width: 100%;
          background: linear-gradient(135deg, #3b4fd8 0%, #5e72e4 50%, #825ee4 100%) !important;
          border: none !important;
          border-radius: 14px !important;
          color: #fff !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          padding: 11px 20px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          box-shadow: 0 4px 16px rgba(94,114,228,0.35) !important;
          transition: all 0.25s ease !important;
          letter-spacing: 0.2px;
        }
        .cw-sessions-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 24px rgba(94,114,228,0.5) !important;
          background: linear-gradient(135deg, #4a5fe8 0%, #6b80ed 50%, #9270e8 100%) !important;
        }
        .cw-btn-arrow {
          font-size: 15px;
          transition: transform 0.2s ease;
        }
        .cw-sessions-btn:hover .cw-btn-arrow {
          transform: translateX(4px);
        }

        /* ── responsive ── */
        @media (max-width: 768px) {
          .cw-cell-inner { font-size: 11px; }
          .cw-head { padding: 14px 14px 10px; }
          .cw-body { padding: 12px 12px 6px; }
          .cw-mo-btn { font-size: 1.1rem !important; }
        }
      `}</style>
    </div>
  );
}
