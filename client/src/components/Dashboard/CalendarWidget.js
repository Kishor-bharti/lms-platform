// CalendarWidget.js — only change: "View Sessions" button now navigates correctly
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
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length % 7 + 1, type: "next" });
  }
  return cells;
}

export default function CalendarWidget() {
  const [current, setCurrent] = useState(new Date());
  const today = new Date();
  const cells = useMemo(() => monthMatrix(current), [current]);
  const navigate = useNavigate();

  // Role-aware: students go to /classes, teachers/admin go to /sessions
  const role = typeof window !== "undefined"
    ? window.localStorage.getItem("role")
    : null;
  const sessionsPath = role === "student" ? "/admin/classes" : "/admin/sessions";

  const fmtMonth = (d) => d.toLocaleString(undefined, { month: "long" });

  return (
    <Card className="shadow" style={{ borderRadius: 18, background: "#232a34", color: "#fff" }}>
      <CardHeader style={{ background: "#2b313b", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <div className="d-flex align-items-center justify-content-between">
          <h4 className="mb-0" style={{ fontWeight: 700, color: "#fff" }}>
            {fmtMonth(current)} {current.getFullYear()}
          </h4>
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <button className="btn btn-sm" style={{ background: "#3c4450", color: "#fff" }}
              onClick={() => setCurrent(new Date())}>today</button>
            <button className="btn btn-sm" style={{ background: "#3c4450", color: "#fff" }}
              onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}>{"<"}</button>
            <button className="btn btn-sm" style={{ background: "#3c4450", color: "#fff" }}
              onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}>{">"}</button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 8 }}>
          {"Sun Mon Tue Wed Thu Fri Sat".split(" ").map((d) => (
            <div key={d} style={{ color: "#b4bcc8", fontWeight: 600 }}>{d}</div>
          ))}
          {cells.map((c, i) => {
            const isToday = c.type === "curr" &&
              today.getDate() === c.day &&
              today.getMonth() === current.getMonth() &&
              today.getFullYear() === current.getFullYear();
            const bg = c.type === "curr" ? (isToday ? "linear-gradient(135deg, #5e72e4, #825ee4)" : "rgba(255,255,255,0.04)") : "transparent";
            const color = c.type === "curr" ? "#fff" : "rgba(255,255,255,0.2)";
            return (
              <div key={i} style={{ background: bg, color, borderRadius: 10, minHeight: 44,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                boxShadow: isToday ? '0 4px 12px rgba(94,114,228,0.4)' : 'none',
                transition: 'all 0.2s ease',
                cursor: c.type === 'curr' ? 'default' : 'default' }}>
                {c.day}
              </div>
            );
          })}
        </div>
        <div className="text-center" style={{ marginTop: 16 }}>
          {/* FIX: navigate to correct page based on role */}
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
        .cal-nav-btn {
          background: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.7) !important;
          border: none !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          transition: all 0.2s ease !important;
          padding: 4px 10px !important;
        }
        .cal-nav-btn:hover {
          background: rgba(255,255,255,0.15) !important;
          color: #fff !important;
        }
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
        @media (max-width: 1040px), (max-height: 780px) {
          .card-header .d-flex { flex-wrap: wrap; }
          .card-header .btn { padding: 2px 6px; }
          .card-body div[style*="gridTemplateColumns"] { gap: 6px !important; }
          .card-body div[style*="gridTemplateColumns"] div { min-height: 36px !important; font-size: .95rem; }
        }
        @media (max-width: 767.98px) {
          .card-header h4 { font-size: 1.05rem; }
          .card-header .btn { padding: 2px 6px; }
          .card-body div[style*="gridTemplateColumns"] div { min-height: 34px !important; }
        }
      `}</style>
    </Card>
  );
}
