import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardBody } from "reactstrap";

function monthMatrix(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = first.getDay(); // 0-6 Sun-Sat
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  const cells = [];
  // Fill leading days from previous month
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: prevMonthDays - startDay + 1 + i, type: "prev" });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, type: "curr" });
  }
  // Trailing days to complete 6 rows
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length % 7 + 1, type: "next" });
  }
  return cells;
}

export default function CalendarWidget() {
  const [current, setCurrent] = useState(new Date());
  const today = new Date();
  const cells = useMemo(() => monthMatrix(current), [current]);

  const fmtMonth = (d) => d.toLocaleString(undefined, { month: "long" });

  return (
    <Card className="shadow" style={{ borderRadius: 18, background: "#232a34", color: "#fff" }}>
      <CardHeader style={{ background: "#2b313b", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <div className="d-flex align-items-center justify-content-between">
          <h4 className="mb-0" style={{ fontWeight: 700, color: "#fff" }}>{fmtMonth(current)} {current.getFullYear()}</h4>
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <button className="btn btn-sm" style={{ background: "#3c4450", color: "#fff" }} onClick={() => setCurrent(new Date())}>today</button>
            <button className="btn btn-sm" style={{ background: "#3c4450", color: "#fff" }} onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}>{"<"}</button>
            <button className="btn btn-sm" style={{ background: "#3c4450", color: "#fff" }} onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}>{">"}</button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 8 }}>
          {"Sun Mon Tue Wed Thu Fri Sat".split(" ").map((d) => (
            <div key={d} style={{ color: "#b4bcc8", fontWeight: 600 }}>{d}</div>
          ))}
          {cells.map((c, i) => {
            const isToday = c.type === "curr" && today.getDate() === c.day && today.getMonth() === current.getMonth() && today.getFullYear() === current.getFullYear();
            const bg = c.type === "curr" ? (isToday ? "#6c757d" : "#2f3641") : "#232a34";
            const color = c.type === "curr" ? "#fff" : "#6c757d";
            return (
              <div key={i} style={{ background: bg, color, borderRadius: 10, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {c.day}
              </div>
            );
          })}
        </div>
        <div className="text-center" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn p-0"
            style={{ background: "transparent", color: "#ffca28", fontWeight: 700, textDecoration: "underline" }}
            onClick={() => { /* TODO: navigate to sessions */ }}
            aria-label="View Sessions"
          >
            View Sessions
          </button>
        </div>
      </CardBody>
      <style>{`
        @media (max-width: 767.98px) {
          .card-header h4 { font-size: 1.05rem; }
          .card-header .btn { padding: 2px 6px; }
          .card-body div[style*="gridTemplateColumns"] div { min-height: 34px !important; }
        }
      `}</style>
    </Card>
  );
}
