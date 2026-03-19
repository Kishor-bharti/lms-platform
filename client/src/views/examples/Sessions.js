import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";
import { SessionCardSkeleton } from 'components/Skeleton.js';

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_PRIORITY = { LIVE: 0, TODAY: 1, TOMORROW: 2, SCHEDULED: 3, COMPLETED: 4 };

const sortSessions = (list) =>
  list.filter(Boolean).sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return a.status === 'COMPLETED' ? tb - ta : ta - tb;
  });

const Sessions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get('date') || TODAY;

  const [sessions,        setSessions]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [userRole,        setUserRole]        = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [actionError,     setActionError]     = useState("");

  useEffect(() => {
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    setUserRole(role);
  }, []);

  const fetchSessions = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await http.get(`/api/classes/my-sessions-v2?date=${date}`);
      setSessions(sortSessions(Array.isArray(res?.data) ? res.data : []));
    } catch (err) {
      console.error('[Sessions] fetch error:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the selected date changes
  useEffect(() => {
    fetchSessions(selectedDate);
    setExpandedSession(null);
    setActionError("");
  }, [selectedDate, fetchSessions]);

  // Poll every 60s — only for today's date (LIVE status updates)
  useEffect(() => {
    if (selectedDate !== TODAY) return;
    const interval = setInterval(() => fetchSessions(TODAY), 60000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchSessions]);

  const handleDateChange = (e) => {
    if (e.target.value) setSearchParams({ date: e.target.value });
  };

  const goToday = () => setSearchParams({ date: TODAY });

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

  const toggleDetails = (sessionId) => {
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
      if (updated && updated.id) {
        setSessions(prev => sortSessions(prev.map(s => s.id === sessionId ? updated : s)));
      }
      setExpandedSession(null);
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
      const updated = response?.data;
      if (updated && updated.id) {
        setSessions(prev => sortSessions(prev.map(s => s.id === sessionId ? updated : s)));
      }
      setExpandedSession(null);
    } catch (error) {
      console.error('Failed to end session:', error);
      setActionError(error?.response?.data?.error || 'Failed to end session');
    } finally {
      setStartingSession(null);
    }
  };

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  if (loading) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
          <Row><Col lg="12">
            <Card><CardBody className="py-4"><SessionCardSkeleton count={5} /></CardBody></Card>
          </Col></Row>
        </Container>
      </>
    );
  }

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                  <CardTitle className="mb-0">Sessions</CardTitle>
                  <div className="d-flex align-items-center" style={{ gap: 8 }}>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, color: '#525f7f', cursor: 'pointer' }}
                    />
                    {selectedDate !== TODAY && (
                      <Button size="sm" color="primary" outline onClick={goToday}>Today</Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardBody>
                {actionError && (
                  <div className="mb-3">
                    <small className="text-danger font-weight-bold">⚠ {actionError}</small>
                  </div>
                )}

                <div className="session-stack">
                  {sessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No sessions scheduled for {selectedDate}</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
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

                          {/* Action buttons */}
                          <div className="d-flex align-items-center" style={{ gap: '6px', marginLeft: '12px' }}>
                            {session.status === 'LIVE' && (
                              <Button size="sm" color="success" onClick={() => session.zoom_link && window.open(session.zoom_link, '_blank')}>
                                Join
                              </Button>
                            )}
                            {session.status === 'COMPLETED' && (
                              <Button size="sm" color="light" onClick={() => session.zoom_link && window.open(session.zoom_link, '_blank')}>
                                Replay
                              </Button>
                            )}
                            {isTeacherOrAdmin ? (
                              <Button size="sm" color="dark" onClick={() => toggleDetails(session.id)}>
                                {expandedSession === session.id ? 'Close' : 'Details'}
                              </Button>
                            ) : (
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
                              {session.status !== 'COMPLETED' && (
                                <button
                                  disabled={startingSession === session.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    session.status === 'LIVE'
                                      ? handleEndSession(session.id)
                                      : handleStartSession(session.id);
                                  }}
                                  style={{
                                    border: 'none', borderRadius: '6px', padding: '8px 20px',
                                    fontWeight: '600', fontSize: '14px',
                                    cursor: startingSession === session.id ? 'not-allowed' : 'pointer',
                                    opacity: startingSession === session.id ? 0.8 : 1,
                                    background: session.status === 'LIVE' ? '#f5365c' : '#2dce89',
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
