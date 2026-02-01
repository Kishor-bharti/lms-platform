import React from "react";
import { Card, CardHeader, CardBody } from "reactstrap";

const sampleActivities = [
  { activity: "Assignment Submitted", course: "Mathematics 101", date: "Jan 25, 2026" },
  { activity: "Quiz Completed", course: "English Literature", date: "Jan 24, 2026" },
  { activity: "Lecture Notes Uploaded", course: "Physics Lab", date: "Jan 23, 2026" },
  { activity: "Grade Posted", course: "Chemistry Advanced", date: "Jan 22, 2026" },
];

export default function RecentActivity({ items = sampleActivities }) {
  return (
    <Card className="shadow" style={{ borderRadius: 18, background: "#e5dfd2" }}>
      <CardHeader style={{ background: "#d9d2c2", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <h3 className="mb-0" style={{ fontWeight: 700 }}>Recent Activity</h3>
      </CardHeader>
      <CardBody>
        <div className="activity-list" style={{ display: "grid", gap: 12 }}>
          {items.map((it, idx) => (
            <div key={idx} className="activity-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f5f2ea", borderRadius: 14, padding: "12px 14px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
              <div className="activity-info">
                <div style={{ fontWeight: 700, color: "#1f1f1f" }}>{it.activity}</div>
                <div style={{ color: "#7a7a7a" }}>{it.course}</div>
              </div>
              <span className="activity-date" style={{ background: "#2f3641", color: "#fff", borderRadius: 14, padding: "6px 10px", fontWeight: 700 }}>{it.date}</span>
            </div>
          ))}
        </div>
      </CardBody>
      <style>{`
        @media (max-width: 767.98px) {
          .activity-item { flex-direction: column; align-items: flex-start; }
          .activity-date { margin-top: 8px; }
        }
      `}</style>
    </Card>
  );
}
