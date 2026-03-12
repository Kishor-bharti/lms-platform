import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardBody } from "reactstrap";
import { useNavigate } from "react-router-dom";

function monthMatrix(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: prevMonthDays - startDay + 1 + i, type: "prev" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, type: "curr" });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, type: "next" });
  }
  return cells;
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarWidget() {
  const [current,  setCurrent]  = useState(new Date());
  const [selected, setSelected] = useState(null); // { year, month, day }
  const [view,     setView]     = useState("calendar"); // "calendar" | "month" | "year"
  const [yearPage, setYearPage] = useState(
    Math.floor(new Date().getFullYear() / 12) * 12
  );
  const today = new Date();
  const cells = useMemo(() => monthMatrix(current), [current]);
  const navigate = useNavigate();

  const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
  const sessionsPath = role === "student" ? "/admin/classes" : "/admin/sessions";

  const checkToday = (c) =>
    c.type === "curr" &&
    today.getDate()     === c.day &&
    today.getMonth()    === current.getMonth() &&
    today.getFullYear() === current.getFullYear();

  const checkSelected = (c) =>
    selected &&
    c.type === "curr" &&
    selected.day   === c.day &&
    selected.month === current.getMonth() &&
    selected.year  === current.getFullYear();

  const pickMonth = (idx) => {
    setCurrent(new Date(current.getFullYear(), idx, 1));
    setView("calendar");
  };

  const pickYear = (y) => {
    setCurrent(new Date(y, current.getMonth(), 1));
    setView("calendar");
  };

  const pickDay = (c) => {
    if (c.type === "prev") {
      const d = new Date(current.getFullYear(), current.getMonth() - 1, c.day);
      setCurrent(new Date(d.getFullYear(), d.getMonth(), 1));
      setSelected({ year: d.getFullYear(), month: d.getMonth(), day: c.day });
    } else if (c.type === "next") {
      const d = new Date(current.getFullYear(), current.getMonth() + 1, c.day);
      setCurrent(new Date(d.getFullYear(), d.getMonth(), 1));
      setSelected({ year: d.getFullYear(), month: d.getMonth(), day: c.day });
    } else {
      setSelected({ year: current.getFullYear(), month: current.getMonth(), day: c.day });
    }
  };

  return (
    <Card className="shadow cal-card">
      <CardHeader className="cal-header">
        {/* ── Month / Year clickable labels ── */}
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center" style={{ gap: 4 }}>
            <button
              className="cal-label-btn"
              onClick={() => setView(view === "month" ? "calendar" : "month")}
              title="Pick month"
            >
              {MONTHS_FULL[current.getMonth()]}
              <span className="cal-label-caret">{view === "month" ? "▲" : "▼"}</span>
            </button>
            <button
              className="cal-label-btn"
              onClick={() => {
                setYearPage(Math.floor(current.getFullYear() / 12) * 12);
                setView(view === "year" ? "calendar" : "year");
              }}
              title="Pick year"
            >
              {current.getFullYear()}
              <span className="cal-label-caret">{view === "year" ? "▲" : "▼"}</span>
            </button>
          </div>

          <div className="d-flex align-items-center" style={{ gap: 6 }}>
            {view === "year" && (
              <>
                <button className="cal-nav-btn" onClick={() => setYearPage(yearPage - 12)}>‹</button>
                <button className="cal-nav-btn" onClick={() => setYearPage(yearPage + 12)}>›</button>
              </>
            )}
            {view === "calendar" && (
              <>
                <button className="cal-nav-btn" title="Today"
                  onClick={() => { setCurrent(new Date()); setView("calendar"); }}>
                  Today
                </button>
                <button className="cal-nav-btn"
                  onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  ‹
                </button>
                <button className="cal-nav-btn"
                  onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  ›
                </button>
              </>
            )}
            {view !== "calendar" && (
              <button className="cal-nav-btn" onClick={() => setView("calendar")} title="Close">✕</button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardBody style={{ padding: "12px 16px 16px" }}>

        {/* ── MONTH PICKER ── */}
        {view === "month" && (
          <div className="cal-picker-grid cal-month-grid">
            {MONTHS_SHORT.map((m, i) => (
              <button
                key={m}
                className={`cal-picker-cell${i === current.getMonth() ? " cal-picker-active" : ""}`}
                onClick={() => pickMonth(i)}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* ── YEAR PICKER ── */}
        {view === "year" && (
          <>
            <div className="cal-year-range">
              {yearPage} – {yearPage + 11}
            </div>
            <div className="cal-picker-grid cal-year-grid">
              {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
                <button
                  key={y}
                  className={`cal-picker-cell${y === current.getFullYear() ? " cal-picker-active" : ""}`}
                  onClick={() => pickYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── CALENDAR DAY GRID ── */}
        {view === "calendar" && (
          <div className="cal-grid">
            {"Sun Mon Tue Wed Thu Fri Sat".split(" ").map((d) => (
              <div key={d} className="cal-weekday">{d}</div>
            ))}
            {cells.map((c, i) => {
              const isTodayCell = checkToday(c);
              const isSelectedCell = checkSelected(c);
              return (
                <div
                  key={i}
                  className={[
                    "cal-day",
                    c.type !== "curr" ? "cal-day--faded" : "",
                    isTodayCell      ? "cal-day--today"    : "",
                    isSelectedCell   ? "cal-day--selected" : "",
                  ].join(" ")}
                  onClick={() => pickDay(c)}
                  title={c.type === "curr"
                    ? `${MONTHS_FULL[current.getMonth()]} ${c.day}, ${current.getFullYear()}`
                    : ""}
                >
                  {c.day}
                </div>
              );
            })}
          </div>
        )}

        {/* selected date label */}
        {selected && view === "calendar" && (
          <div className="cal-selected-label">
            {MONTHS_FULL[selected.month]} {selected.day}, {selected.year}
          </div>
        )}

        <div className="text-center" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn cal-view-sessions-btn"
            onClick={() => navigate(sessionsPath)}
          >
            View Sessions →
          </button>
        </div>
      </CardBody>

      <style>{`
        .cal-card {
          border-radius: 18px !important;
          background: #232a34 !important;
          color: #fff !important;
          border: none !important;
        }
        .cal-header {
          background: #2b313b !important;
          border-top-left-radius: 18px !important;
          border-top-right-radius: 18px !important;
          padding: 14px 16px !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
        }
        /* clickable month / year labels */
        .cal-label-btn {
          background: none !important;
          border: none !important;
          color: #fff !important;
          font-size: 1rem !important;
          font-weight: 700 !important;
          padding: 4px 8px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: background 0.18s ease !important;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .cal-label-btn:hover {
          background: rgba(255,255,255,0.1) !important;
        }
        .cal-label-caret {
          font-size: 9px;
          opacity: 0.6;
        }
        /* prev / next / today nav buttons */
        .cal-nav-btn {
          background: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.8) !important;
          border: none !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          padding: 4px 10px !important;
          cursor: pointer !important;
          transition: all 0.18s ease !important;
        }
        .cal-nav-btn:hover {
          background: rgba(255,255,255,0.16) !important;
          color: #fff !important;
        }
        /* day grid */
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          margin-top: 6px;
        }
        .cal-weekday {
          color: #8892a4;
          font-weight: 600;
          font-size: 11px;
          text-align: center;
          padding-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .cal-day {
          background: rgba(255,255,255,0.04);
          color: #fff;
          border-radius: 10px;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.18s ease;
          user-select: none;
          border: 1.5px solid transparent;
        }
        .cal-day:hover {
          background: rgba(94,114,228,0.22) !important;
          border-color: rgba(94,114,228,0.4) !important;
        }
        .cal-day--faded {
          background: transparent !important;
          color: rgba(255,255,255,0.18) !important;
        }
        .cal-day--faded:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: transparent !important;
          color: rgba(255,255,255,0.5) !important;
        }
        .cal-day--today {
          background: linear-gradient(135deg, #5e72e4, #825ee4) !important;
          color: #fff !important;
          box-shadow: 0 4px 12px rgba(94,114,228,0.45) !important;
          border-color: transparent !important;
        }
        .cal-day--selected:not(.cal-day--today) {
          background: rgba(94,114,228,0.28) !important;
          border-color: #5e72e4 !important;
          color: #fff !important;
        }
        /* month / year pickers */
        .cal-picker-grid {
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }
        .cal-month-grid { grid-template-columns: repeat(3, 1fr); }
        .cal-year-grid  { grid-template-columns: repeat(4, 1fr); }
        .cal-picker-cell {
          background: rgba(255,255,255,0.06) !important;
          color: rgba(255,255,255,0.8) !important;
          border: 1.5px solid transparent !important;
          border-radius: 10px !important;
          padding: 10px 4px !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          transition: all 0.18s ease !important;
          text-align: center;
        }
        .cal-picker-cell:hover {
          background: rgba(94,114,228,0.22) !important;
          border-color: rgba(94,114,228,0.4) !important;
          color: #fff !important;
        }
        .cal-picker-active {
          background: linear-gradient(135deg, #5e72e4, #825ee4) !important;
          color: #fff !important;
          border-color: transparent !important;
          box-shadow: 0 3px 10px rgba(94,114,228,0.4) !important;
        }
        .cal-year-range {
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        /* selected date display */
        .cal-selected-label {
          text-align: center;
          margin-top: 10px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.3px;
        }
        /* View Sessions button */
        .cal-view-sessions-btn {
          background: linear-gradient(135deg, #5e72e4, #825ee4) !important;
          color: #fff !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 700 !important;
          padding: 8px 24px !important;
          font-size: 13px !important;
          box-shadow: 0 4px 14px rgba(94,114,228,0.35) !important;
          transition: all 0.3s ease !important;
        }
        .cal-view-sessions-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(94,114,228,0.5) !important;
        }
        @media (max-width: 767.98px) {
          .cal-day { min-height: 34px !important; font-size: 12px; }
          .cal-picker-cell { padding: 8px 2px !important; font-size: 12px !important; }
        }
      `}</style>
    </Card>
  );
}
