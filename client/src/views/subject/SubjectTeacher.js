// SubjectTeacher.js — Subject detail page for TEACHERS
// Route: /admin/subject/:subjectId
// Shows: subject info, session list with start/end, schedule new session modal, enrolled students

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Badge, Button, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
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

export default function SubjectTeacher() {
  const { subjectId } = useParams();
  const [subject,         setSubject]        = useState(null);
  const [sessions,        setSessions]       = useState([]);
  const [loading,         setLoading]        = useState(true);
  const [, setError] = useState("");
  const [startingSession, setStartingSession] = useState(null);
  const [actionError,     setActionError]    = useState("");

  // Schedule new session modal
  const [scheduleOpen,  setScheduleOpen]  = useState(false);
  const [scheduleForm,  setScheduleForm]  = useState({ title: "", date: "", time: "" });
  const [scheduling,    setScheduling]    = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  useEffect(() => {
    if (!subjectId) return;
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const fetchData = async () => {
    try {
      const [sessRes, classRes] = await Promise.all([
        http.get("/api/classes/my-sessions-v2"),
        http.get("/api/classes/my-classes-v2"),
      ]);

      const allSessions = Array.isArray(sessRes?.data)  ? sessRes.data  : [];
      const allClasses  = Array.isArray(classRes?.data) ? classRes.data : [];

      setSessions(allSessions.filter((s) => s.subject_id === subjectId));
      const found = allClasses.find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setLoading(false);
    } catch (err) {
      console.error("[SubjectTeacher] Error:", err);
      setError("Failed to load subject data");
      setLoading(false);
    }
  };

  const handleStart = async (sessionId) => {
    setStartingSession(sessionId);
    setActionError("");
    try {
      const res = await http.post(`/api/classes/sessions/${sessionId}/start`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? res.data : s));
      const url = res.data?.start_url || res.data?.zoom_link;
      if (url) window.open(url, "_blank");
    } catch (err) {
      setActionError(err?.response?.data?.error || "Failed to start session");
    } finally {
      setStartingSession(null);
    }
  };

  const handleEnd = async (sessionId) => {
    setStartingSession(sessionId);
    setActionError("");
    try {
      const res = await http.post(`/api/classes/sessions/${sessionId}/complete`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? res.data : s));
    } catch (err) {
      setActionError(err?.response?.data?.error || "Failed to end session");
    } finally {
      setStartingSession(null);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setScheduleError("");
    if (!scheduleForm.title || !scheduleForm.date || !scheduleForm.time) {
      setScheduleError("All fields are required");
      return;
    }
    setScheduling(true);
    try {
      await http.post("/api/classes/sessions/create", {
        subjectId,
        title:      scheduleForm.title,
        sessionDate: scheduleForm.date,
        startTime:  scheduleForm.time + ":00+05:30",
        endTime:    scheduleForm.time + ":00+05:30",  // backend can default +1hr
      });
      setScheduleOpen(false);
      setScheduleForm({ title: "", date: "", time: "" });
      fetchData();
    } catch (err) {
      setScheduleError(err?.response?.data?.error || "Failed to schedule session");
    } finally {
      setScheduling(false);
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

  const upcoming = sessions.filter((s) => s.status !== "COMPLETED");
  const past     = sessions.filter((s) => s.status === "COMPLETED");

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196,214,226)", minHeight: "100vh", paddingTop: 30, paddingBottom: 30 }}>

        {/* ── Subject Info Card ── */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12, borderLeft: "5px solid #fb6340" }}>
              <CardBody>
                <div className="d-flex align-items-center justify-content-between flex-wrap">
                  <div>
                    <h2 className="mb-1" style={{ color: "#32325d" }}>
                      {subject?.title || "Subject"}
                    </h2>
                    <div className="text-muted small">
                      <span className="mr-3">📚 {subject?.course_name}</span>
                      <Badge color="light">{subject?.code}</Badge>
                    </div>
                    {subject?.description && (
                      <p className="mt-2 mb-0 text-muted">{subject.description}</p>
                    )}
                  </div>
                  <Button
                    color="success"
                    onClick={() => setScheduleOpen(true)}
                    style={{ borderRadius: 8, marginTop: 8 }}
                  >
                    + Schedule New Session
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {actionError && (
          <Row className="mb-3">
            <Col><div className="alert alert-danger py-2">{actionError}</div></Col>
          </Row>
        )}

        <Row>
          {/* ── Sessions ── */}
          <Col lg="8" className="mb-4">
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: "#eaf3ff", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <CardTitle className="mb-0">📅 Sessions</CardTitle>
              </CardHeader>
              <CardBody>
                {sessions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted">No sessions yet</p>
                    <Button color="success" size="sm" onClick={() => setScheduleOpen(true)}>
                      Schedule First Session
                    </Button>
                  </div>
                ) : (
                  <>
                    {upcoming.length > 0 && (
                      <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mb-2">Upcoming</p>
                        {upcoming.map((s) => (
                          <div key={s.id} className="p-3 mb-2 bg-white border rounded"
                            style={{ borderLeft: `3px solid ${s.status === "LIVE" ? "#f5365c" : "#fb6340"}` }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <div className="d-flex align-items-center mb-1" style={{ gap: 8 }}>
                                  <strong>{s.title}</strong>
                                  {statusBadge(s.status)}
                                </div>
                                <div className="small text-muted">🕐 {new Date(s.scheduled_at).toLocaleString()}</div>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  disabled={startingSession === s.id}
                                  onClick={() => s.status === "LIVE" ? handleEnd(s.id) : handleStart(s.id)}
                                  style={{
                                    border: "none", borderRadius: 6, padding: "7px 16px",
                                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                                    background: s.status === "LIVE" ? "#f5365c" : "#2dce89",
                                    color: "#fff",
                                    boxShadow: s.status === "LIVE"
                                      ? "0 4px 6px rgba(245,54,92,.3)"
                                      : "0 4px 6px rgba(45,206,137,.3)",
                                  }}
                                >
                                  {startingSession === s.id
                                    ? "..."
                                    : s.status === "LIVE"
                                      ? "End Session"
                                      : "Start Live Session"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {past.length > 0 && (
                      <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mt-3 mb-2">Past Sessions</p>
                        {past.map((s) => (
                          <div key={s.id} className="p-3 mb-2 bg-white border rounded"
                            style={{ borderLeft: "3px solid #adb5bd", opacity: 0.75 }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <strong>{s.title}</strong>
                                <div className="small text-muted">🕐 {new Date(s.scheduled_at).toLocaleString()}</div>
                              </div>
                              {statusBadge(s.status)}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          </Col>

          {/* ── Teacher Quick Actions ── */}
          <Col lg="4">
            <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: "#fff5e6", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <CardTitle className="mb-0">Actions</CardTitle>
              </CardHeader>
              <CardBody>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Button color="success" outline style={{ borderRadius: 8, textAlign: "left" }}
                    onClick={() => setScheduleOpen(true)}>
                    📅 Schedule Session
                  </Button>
                  <Button color="primary" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    ✏️ Create Quiz
                  </Button>
                  <Button color="warning" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    📋 Create Assignment
                  </Button>
                  <Button color="info" outline style={{ borderRadius: 8, textAlign: "left" }}>
                    📁 Upload Material
                  </Button>
                </div>
                <p className="small text-muted mt-3 mb-0">
                  Quiz, assignment and material features coming in Phase 4.
                </p>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* ── Schedule Session Modal ── */}
        <Modal isOpen={scheduleOpen} toggle={() => setScheduleOpen(false)} centered>
          <ModalHeader toggle={() => setScheduleOpen(false)}>
            Schedule New Session
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSchedule}>
              <FormGroup>
                <Label>Session Title</Label>
                <Input
                  placeholder="e.g. Algebra Basics"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={scheduleForm.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                />
              </FormGroup>
              {scheduleError && <p className="text-danger small">{scheduleError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={scheduling} onClick={handleSchedule}>
              {scheduling ? "Scheduling..." : "Schedule Session"}
            </Button>
            <Button color="link" onClick={() => setScheduleOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

      </Container>
      <style>{`
        @keyframes liveBlink { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        .live-blink { animation: liveBlink 1s infinite; }
      `}</style>
    </>
  );
}
