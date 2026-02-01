import React from "react";
import { Card, CardHeader, CardBody } from "reactstrap";

const sampleAnnouncements = [
  {
    title: "Mid-term Exams Schedule",
    body:
      "Mid-term exams will begin from March 15th. Please check your individual class schedules for specific dates and times.",
    tone: "primary",
  },
  {
    title: "Assignment Submission Deadline",
    body:
      "All assignments for this week must be submitted by Friday, January 31st before 5:00 PM.",
    tone: "success",
  },
  {
    title: "Campus Library Hours Update",
    body:
      "The main library will be closed on weekends for maintenance. Extended hours available on weekdays.",
    tone: "warning",
  },
];

export default function Announcements({ items = sampleAnnouncements }) {
  return (
    <Card className="shadow" style={{ borderRadius: 18, background: "#e5dfd2" }}>
      <CardHeader style={{ background: "#d9d2c2", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <h3 className="mb-0" style={{ fontWeight: 700 }}>Announcements</h3>
      </CardHeader>
      <CardBody>
        <div className="announce-list" style={{ display: "grid", gap: 12 }}>
          {items.map((a, idx) => (
            <div key={idx} className="announce-item" style={{ background: "#f5f2ea", borderRadius: 14, padding: "12px 14px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
              <div className="announce-head" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="announce-icon" style={{ width: 34, height: 34, borderRadius: 17, background: "#fff", border: "1px solid #e9ecef", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ni ni-bell-55" />
                </span>
                <h6 className={`mb-1 text-${a.tone}`} style={{ fontWeight: 700 }}>{a.title}</h6>
              </div>
              <p className="mb-0 announce-body" style={{ color: "#6b6b6b", marginLeft: 44 }}>{a.body}</p>
            </div>
          ))}
        </div>
      </CardBody>
      <style>{`
        @media (max-width: 767.98px) {
          .announce-list { gap: 10px; }
          .announce-head h6 { font-size: 0.95rem; }
          .announce-icon { width: 28px; height: 28px; border-radius: 14px; }
          .announce-body { margin-left: 0; margin-top: 6px; }
        }
      `}</style>
    </Card>
  );
}
