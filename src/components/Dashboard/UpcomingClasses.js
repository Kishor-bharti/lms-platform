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
    <Card className="shadow" style={{ borderRadius: 18, background: "#e5dfd2" }}>
      <CardHeader className="d-flex align-items-center" style={{ background: "#d9d2c2", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <h3 className="mb-0" style={{ fontWeight: 700 }}>Upcoming Classes</h3>
      </CardHeader>
      <CardBody>
        <div style={{ display: "grid", gap: 16 }}>
          {classes.map((c, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f5f2ea", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 82, height: 82, borderRadius: 16, background: "#36c37e", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 700, marginRight: 16 }}>
                  <div style={{ fontSize: 16 }}>{c.dow}</div>
                  <div style={{ fontSize: 22 }}>{c.day}</div>
                  <div style={{ fontSize: 13 }}>{c.time}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#6b6b6b", fontSize: 12 }}>
                    {c.recurring && (<span title="Recurring"><i className="ni ni-time-alarm" /></span>)}
                    {c.online && (<span title="Online"><i className="ni ni-world" /></span>)}
                  </div>
                  <div style={{ fontWeight: 700, color: "#1f1f1f" }}>{c.title}</div>
                  <div style={{ color: "#888" }}>{c.subtitle}</div>
                </div>
              </div>
              <button type="button" className="btn" style={{ background: "#212529", color: "#fff", borderRadius: 24, padding: "8px 18px" }}>Details</button>
            </div>
          ))}
        </div>
      </CardBody>
      <style>{`
        @media (max-width: 991.98px) {
          .upcoming-card { margin-bottom: 1rem; }
        }
      `}</style>
    </Card>
  );
}
