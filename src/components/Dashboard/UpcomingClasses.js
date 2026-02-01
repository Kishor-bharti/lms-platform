import React from "react";
import { Card, CardHeader, CardBody, CardTitle, Table, Badge, Button } from "reactstrap";

const rows = [
  { cls: "AP Chemistry", instructor: "Harmanpreet", date: "Jan 29, 2026", time: "04:00 PM", status: "Today" },
  { cls: "IBDP Chemistry", instructor: "Harmanpreet", date: "Jan 29, 2026", time: "07:00 PM", status: "Today" },
  { cls: "AP Chemistry", instructor: "Harmanpreet", date: "Jan 30, 2026", time: "06:01 PM", status: "Tomorrow" },
  { cls: "IBDP Chemistry", instructor: "Harmanpreet", date: "Jan 30, 2026", time: "07:00 PM", status: "Tomorrow" },
];

export default function UpcomingClasses() {
  return (
    <Card className="shadow upcoming-legacy" style={{ borderRadius: 12, background: "#f8fbff" }}>
      <CardHeader className="border-0" style={{ background: "#eaf3ff", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <CardTitle className="mb-0" style={{ fontWeight: 700 }}>Upcoming Classes</CardTitle>
      </CardHeader>
      <CardBody style={{ paddingTop: 0 }}>
        <div className="table-responsive">
          <Table className="align-items-center table-flush mb-0">
            <thead className="thead-light">
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Instructor</th>
                <th scope="col">Date</th>
                <th scope="col">Time</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row" style={{ fontWeight: 700, color: "#3b4a67" }}>{r.cls}</th>
                  <td>{r.instructor}</td>
                  <td>{r.date}</td>
                  <td>{r.time}</td>
                  <td>
                    <Badge color={r.status === "Today" ? "info" : "warning"} style={{ borderRadius: 12, padding: "4px 8px" }}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Button size="sm" style={{ background: "#212529", color: "#fff", borderRadius: 20, padding: "6px 12px" }}>
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </CardBody>
      <style>{`
        .upcoming-legacy { box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .thead-light th { color: #7f8da7; font-weight: 700; letter-spacing: .02em; }
        @media (max-width: 767.98px) {
          .upcoming-legacy { border-radius: 10px; }
          .upcoming-legacy .card-header { padding: .75rem 1rem; }
          .table-responsive { overflow-x: auto; }
          table { font-size: .9rem; }
        }
      `}</style>
    </Card>
  );
}
