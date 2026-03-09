import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";

const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [selectedView, setSelectedView] = useState('day');
  const [actionError, setActionError] = useState("");
  const errorCount = useRef(0);

  // Priority order: LIVE → TODAY → TOMORROW → SCHEDULED → COMPLETED
  const STATUS_PRIORITY = { LIVE: 0, TODAY: 1, TOMORROW: 2, SCHEDULED: 3, COMPLETED: 4 };

  const sortSessions = (list) => {
    return [...list].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 9;
      const pb = STATUS_PRIORITY[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      const ta = new Date(a.scheduled_at).getTime();
      const tb = new Date(b.scheduled_at).getTime();
      return a.status === 'COMPLETED' ? tb - ta : ta - tb;
    });
  };

  const fetchSessions = useCallback(async () => {
    try {
      const response = await http.get('/api/classes/my-sessions-v2');
      const data = Array.isArray(response?.data) ? response.data : [];
      setSessions(sortSessions(data));
      setLoading(false);
      errorCount.current = 0;
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
      setLoading(false);
      errorCount.current += 1;
      if (errorCount.current >= 3) {
        console.warn('[polling] Stopped after 3 consecutive errors');
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    setUserRole(role);
    fetchSessions();
    const interval = setInterval(() => {
      if (errorCount.current >= 3) {
        clearInterval(interval);
        return;
      }
      fetchSessions();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'LIVE':      return <Badge color="danger" className="live-blink">● LIVE</Badge>;
      case 'TODAY':     return <Badge color="warning">TODAY</Badge>;
      case 'TOMORROW':  return <Badge color="info">TOMORROW</Badge>;
      case 'COMPLETED': return <Badge color="secondary">COMPLETED</Badge>;
      case 'SCHEDULED': return <Badge color="light">SCHEDULED</Badge>;
      default:          return <Badge>{status}</Badge>;
    }
  };

  const handleJoin = (zoomLink) => {
    if (zoomLink) window.open(zoomLink, '_blank');
  };

  const toggleDetails = (sessionId) => {
    // Only teachers/admins can expand to see controls
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    if (role === 'teacher' || role === 'admin') {
      setExpandedSession(expandedSession === sessionId ? null : sessionId);
    }
  };

  const handleStartSession = async (sessionId) => {
    setStartingSession(sessionId);
    setActionError("");
    try {
      const response = await http.post(`/api/classes/sessions/${sessionId}/start`);
      const updated = response?.data;
      setSessions(sessions.map(s => s.id === sessionId ? updated : s));
      setExpandedSession(null);
      // Open Zoom for the teacher (start_url)
      const openUrl = updated?.start_url || updated?.zoom_link;
      if (openUrl) window.open(openUrl, '_blank');
    } catch (error) {
      console.error('Failed to start session:', error);
      setActionError(error?.response?.data?.error || 'Failed to start session');
    } finally {
      setStartingSession(null);
    }
  };

  const handleEndSession = async (sessionId) => {
    setStartingSession(sessionId);
    setActionError("");
    try {
      const response = await http.post(`/api/classes/sessions/${sessionId}/complete`);
      setSessions(sessions.map(s => s.id === sessionId ? response?.data : s));
      setExpandedSession(null);
    } catch (error) {
      console.error('Failed to end session:', error);
      setActionError(error?.response?.data?.error || 'Failed to end session');
    } finally {
      setStartingSession(null);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
          <Row><Col lg="12">
            <Card><CardBody className="text-center py-5"><p>Loading sessions...</p></CardBody></Card>
          </Col></Row>
        </Container>
      </>
    );
  }

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  const filterSessionsByView = (list) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return list.filter((s) => {
      const d = new Date(s.scheduled_at);
      if (selectedView === 'day') return d.toISOString().slice(0, 10) === today;
      if (selectedView === 'week') return d >= weekStart && d <= weekEnd;
      if (selectedView === 'month') return d >= monthStart && d <= monthEnd;
      return true;
    });
  };

  const visibleSessions = filterSessionsByView(sessions);

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Sessions</CardTitle>
              </CardHeader>
              <CardBody>
                {actionError && (
                  <div className="mb-3">
                    <small className="text-danger font-weight-bold">⚠ {actionError}</small>
                  </div>
                )}

                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView !== "day"} onClick={() => setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView !== "week"} className="ml-2" onClick={() => setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView !== "month"} className="ml-2" onClick={() => setSelectedView('month')}>Month</Button>
                </div>

                <div className="session-stack">
                  {visibleSessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">
                        {sessions.length === 0 ? 'No sessions scheduled yet' : `No sessions for this ${selectedView}`}
                      </p>
                    </div>
                  ) : (
                    visibleSessions.map((session) => (
                      <div
                        key={session.id}
                        className="session-item mb-3 bg-white border rounded"
                        style={{
                          borderLeft: `4px solid ${session.status === 'LIVE' ? '#dc3545' : '#96c8ff'}`,
                          backgroundColor: session.status === 'LIVE' ? '#fff5f5' : 'white',
                        }}
                      >
                        {/* ── Main row ── */}
                        <div className="p-3 d-flex justify-content-between align-items-start">
                          <div
                            className="flex-grow-1"
                            style={{ cursor: isTeacherOrAdmin ? 'pointer' : 'default' }}
                            onClick={() => toggleDetails(session.id)}
                          >
                            <div className="d-flex align-items-center mb-1" style={{ gap: '8px' }}>
                              <h5 className="mb-0">{session.title || 'Untitled Session'}</h5>
                              {getStatusBadge(session.status)}
                            </div>
                            <div className="small text-muted">
                              <span className="mr-3">📚 {session.class_title}</span>
                              <span>🕐 {new Date(session.scheduled_at).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Action buttons (right side) */}
                          <div className="d-flex align-items-center" style={{ gap: '6px', marginLeft: '12px' }}>
                            {session.status === 'LIVE' && (
                              <Button size="sm" color="success" onClick={() => handleJoin(session.zoom_link)}>
                                Join
                              </Button>
                            )}
                            {session.status === 'COMPLETED' && (
                              <Button size="sm" color="light" onClick={() => handleJoin(session.zoom_link)}>
                                Replay
                              </Button>
                            )}
                            {isTeacherOrAdmin && (
                              <Button
                                size="sm" color="dark"
                                onClick={() => toggleDetails(session.id)}
                              >
                                {expandedSession === session.id ? 'Close' : 'Details'}
                              </Button>
                            )}
                            {!isTeacherOrAdmin && (
                              <Button size="sm" color="dark">Details</Button>
                            )}
                          </div>
                        </div>

                        {/* ── Details panel — teacher/admin only ── */}
                        {expandedSession === session.id && isTeacherOrAdmin && (
                          <div style={{ borderTop: '1px solid #e8f0f6', padding: '16px', backgroundColor: '#f8fbff' }}>
                            <div style={{ marginBottom: '10px' }}>
                              <div className="small text-muted mb-1">Class</div>
                              <div style={{ fontWeight: 600, padding: '8px', backgroundColor: '#f0f4f8', borderRadius: '6px' }}>
                                {session.class_title}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {/* Single smart button: green → Starting... → red End Session */}
                              {session.status !== 'COMPLETED' && (
                                <button
                                  disabled={startingSession === session.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (session.status === 'LIVE') {
                                      handleEndSession(session.id);
                                    } else {
                                      handleStartSession(session.id);
                                    }
                                  }}
                                  style={{
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 20px',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: startingSession === session.id ? 'not-allowed' : 'pointer',
                                    opacity: startingSession === session.id ? 0.8 : 1,
                                    background: session.status === 'LIVE'
                                      ? '#f5365c'
                                      : startingSession === session.id
                                        ? '#2dce89'
                                        : '#2dce89',
                                    color: '#fff',
                                    boxShadow: session.status === 'LIVE'
                                      ? '0 4px 6px rgba(245,54,92,.35)'
                                      : '0 4px 6px rgba(45,206,137,.35)',
                                    transition: 'background 0.3s ease, box-shadow 0.3s ease',
                                  }}
                                >
                                  {startingSession === session.id
                                    ? 'Starting...'
                                    : session.status === 'LIVE'
                                      ? 'End Session'
                                      : 'Start Live Session'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <style>{`
                  .session-stack .session-item { transition: box-shadow .15s ease; }
                  .session-stack .session-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.1); }
                  @keyframes liveBlink { 0%,100% { opacity:1 } 50% { opacity:.4 } }
                  .live-blink { animation: liveBlink 1s infinite; }
                `}</style>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Sessions;
