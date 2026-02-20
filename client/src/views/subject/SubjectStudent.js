// SubjectStudent.js — Subject detail page for STUDENTS
// Route: /admin/subject/:subjectId
// Shows: subject info, upcoming sessions with join button, upcoming quizzes, materials

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Container, Row, Col, Card, CardHeader, CardBody,
  CardTitle, Badge, Button,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";

function statusBadge(status) {
  switch (status) {
    case "LIVE":      return <Badge color="danger" className="live-blink">● LIVE</Badge>;
    case "TODAY":     return <Badge color="warning">TODAY</Badge>;
    case "TOMORROW":  return <Badge color="info">TOMORROW</Badge>;
    case "COMPLETED": return <Badge color="secondary">COMPLETED</Badge>;
    default:          return <Badge color="light">SCHEDULED</Badge>;
  }
}

export default function SubjectStudent() {
  const { subjectId } = useParams();
  const [subject,  setSubject]  = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!subjectId) return;
    fetchData();
    const iv = setInterval(fetchData, 15000); // poll for live status
    return () => clearInterval(iv);
  }, [subjectId]);

  const fetchData = async () => {
    try {
      // Fetch all my sessions and filter to this subject
      const [sessRes, classRes] = await Promise.all([
        http.get("/api/classes/my-sessions-v2"),
        http.get("/api/classes/my-classes-v2"),
      ]);

      const allSessions = Array.isArray(sessRes?.data) ? sessRes.data : [];
      const allClasses  = Array.isArray(classRes?.data) ? classRes.data : [];

      // Filter sessions to this subject
      const subjectSessions = allSessions.filter((s) => s.subject_id === subjectId);
      setSessions(subjectSessions);

      // Get subject info from classes response
      const found = allClasses.find((c) => c.id === subjectId);
      if (found) setSubject(found);

      setLoading(false);
    } catch (err) {
      console.error("[SubjectStudent] Error:", err);
      setError("Failed to load subject data");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196,214,226)", minHeight: "100vh", paddingTop: 30 }}>
          <Row><Col><Card><CardBody className="text-center py-5"><p>Loading...</p></CardBody></Card></Col></Row>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196,214,226)", minHeight: "100vh", paddingTop: 30 }}>
          <Row><Col><Card><CardBody className="text-center py-5"><p className="text-danger">{error}</p></CardBody></Card></Col></Row>
        </Container>
      </>
    );
  }

  const upcoming = sessions.filter((s) => s.status !== "COMPLETED");
  const past     = sessions.filter((s) => s.status === "COMPLETED");

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196,214,226)", minHeight: "100vh", paddingTop: 30, paddingBottom: 30 }}>

        {/* ── Subject Info Card ── */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12, borderLeft: "5px solid #5e72e4" }}>
              <CardBody>
                <div className="d-flex align-items-center justify-content-between flex-wrap">
                  <div>
                    <h2 className="mb-1" style={{ color: "#32325d" }}>
                      {subject?.title || "Subject"}
                    </h2>
                    <div className="text-muted small">
                      <span className="mr-3">📚 {subject?.course_name}</span>
                      <span className="mr-3">👨‍🏫 {subject?.teacher_name}</span>
                      <Badge color="light">{subject?.code}</Badge>
                    </div>
                    {subject?.description && (
                      <p className="mt-2 mb-0 text-muted" style={{ maxWidth: 600 }}>{subject.description}</p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Row>
          {/* ── Upcoming Sessions ── */}
          <Col lg="8" className="mb-4">
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: "#eaf3ff", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <CardTitle className="mb-0">📅 Sessions</CardTitle>
              </CardHeader>
              <CardBody>
                {sessions.length === 0 ? (
                  <p className="text-muted text-center py-3">No sessions scheduled yet</p>
                ) : (
                  <>
                    {upcoming.length > 0 && (
                      <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mb-2">Upcoming</p>
                        {upcoming.map((s) => (
                          <div key={s.id} className="d-flex justify-content-between align-items-center p-3 mb-2 bg-white border rounded"
                            style={{ borderLeft: `3px solid ${s.status === "LIVE" ? "#f5365c" : "#5e72e4"}` }}>
                            <div>
                              <div className="d-flex align-items-center mb-1" style={{ gap: 8 }}>
                                <strong>{s.title}</strong>
                                {statusBadge(s.status)}
                              </div>
                              <div className="small text-muted">
                                🕐 {new Date(s.scheduled_at).toLocaleString()}
                              </div>
                            </div>
                            {s.status === "LIVE" && (
                              <Button size="sm" color="success"
                                style={{ borderRadius: 20 }}
                                onClick={() => window.open(s.zoom_link, "_blank")}>
                                Join Now
                              </Button>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {past.length > 0 && (
                      <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mt-3 mb-2">Past Sessions</p>
                        {past.map((s) => (
                          <div key={s.id} className="d-flex justify-content-between align-items-center p-3 mb-2 bg-white border rounded"
                            style={{ borderLeft: "3px solid #adb5bd", opacity: 0.75 }}>
                            <div>
                              <div className="d-flex align-items-center mb-1" style={{ gap: 8 }}>
                                <strong>{s.title}</strong>
                                {statusBadge(s.status)}
                              </div>
                              <div className="small text-muted">
                                🕐 {new Date(s.scheduled_at).toLocaleString()}
                              </div>
                            </div>
                            <Button size="sm" color="secondary" outline
                              onClick={() => s.zoom_link && window.open(s.zoom_link, "_blank")}>
                              Replay
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          </Col>

          {/* ── Quick Actions (right column) ── */}
          <Col lg="4">
            <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: "#fff5e6", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <CardTitle className="mb-0">Quick Actions</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-grid" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Button color="primary" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    📝 Attempt Quiz
                  </Button>
                  <Button color="success" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    📤 Submit Assignment
                  </Button>
                  <Button color="info" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    📚 View Materials
                  </Button>
                  <Button color="warning" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    📊 My Progress
                  </Button>
                </div>
                <p className="small text-muted mt-3 mb-0">
                  Quizzes, assignments and materials coming in Phase 4.
                </p>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
      <style>{`
        @keyframes liveBlink { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        .live-blink { animation: liveBlink 1s infinite; }
      `}</style>
    </>
  );
}
