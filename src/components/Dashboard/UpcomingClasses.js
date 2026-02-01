import React from "react";
import { Card, CardHeader, CardBody } from "reactstrap";

const sampleClasses = [
  {
    dow: "Wed",
    day: 21,
    time: "04:00 pm",
    title: "AP Chemistry by Harmanpreet",
    subtitle: "AP Chemistry",
    recurring: true,
    online: true,
  },
  {
    dow: "Wed",
    day: 21,
    time: "07:00 pm",
    title: "IB Chemistry HL by Harmanpreet",
    subtitle: "IBDP Chemistry",
    recurring: true,
    online: true,
  },
  {
    dow: "Wed",
    day: 21,
    time: "06:01 pm",
    title: "AP Chemistry by Harmanpreet",
    subtitle: "AP Chemistry",
    recurring: true,
    online: true,
  },
  {
    dow: "Thu",
    day: 22,
    time: "07:00 pm",
    title: "IBDP Chemistry SL by Harmanpreet",
    subtitle: "IBDP Chemistry",
    recurring: true,
    online: true,
  },
];

export default function UpcomingClasses({ classes = sampleClasses }) {
  return (
    <Card className="shadow upcoming-card" style={{ borderRadius: 18, background: "#e5dfd2" }}>
      <CardHeader className="d-flex align-items-center" style={{ background: "#d9d2c2", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <h3 className="mb-0" style={{ fontWeight: 700 }}>Upcoming Classes</h3>
      </CardHeader>
      <CardBody>
        <div className="upcoming-list" style={{ display: "grid", gap: 16 }}>
          {classes.map((c, idx) => (
            <div key={idx} className="upcoming-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f5f2ea", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
              <div className="upcoming-left" style={{ display: "flex", alignItems: "center" }}>
                <div className="date-pill" style={{ width: 82, height: 82, borderRadius: 16, background: "#36c37e", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 700, marginRight: 16 }}>
                  <div className="date-dow" style={{ fontSize: 16 }}>{c.dow}</div>
                  <div className="date-day" style={{ fontSize: 22 }}>{c.day}</div>
                  <div className="date-time" style={{ fontSize: 13 }}>{c.time}</div>
                </div>
                <div className="upcoming-info" style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#6b6b6b", fontSize: 12 }}>
                    {c.recurring && (<span title="Recurring"><i className="ni ni-time-alarm" /></span>)}
                    {c.online && (<span title="Online"><i className="ni ni-world" /></span>)}
                  </div>
                  <div style={{ fontWeight: 700, color: "#1f1f1f" }}>{c.title}</div>
                  <div style={{ color: "#888" }}>{c.subtitle}</div>
                </div>
              </div>
              <button type="button" className="btn details-btn" style={{ background: "#212529", color: "#fff", borderRadius: 24, padding: "8px 18px" }}>Details</button>
            </div>
          ))}
        </div>
      </CardBody>
      <style>{`
        @media (max-width: 991.98px) {
          .upcoming-card { margin-bottom: 1rem; }
        }
        @media (max-width: 767.98px) {
          .upcoming-list { gap: 12px; }
          .upcoming-item { flex-direction: column; align-items: stretch; }
          .upcoming-left { margin-bottom: 10px; }
          .date-pill { width: 64px; height: 64px; border-radius: 12px; margin-right: 12px; }
          .date-dow { font-size: 14px; }
          .date-day { font-size: 18px; }
          .date-time { font-size: 12px; }
          .details-btn { align-self: flex-end; padding: 6px 14px; border-radius: 20px; }
        }
      `}</style>
    </Card>
  );
}
