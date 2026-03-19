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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const Classes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get('date') || TODAY;

  const [sessions,        setSessions]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);

  const fetchSessions = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await http.get(`/api/classes/my-sessions-v2?date=${date}`);
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error('[Classes] fetch error:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the selected date changes
  useEffect(() => {
    fetchSessions(selectedDate);
    setExpandedSession(null);
  }, [selectedDate, fetchSessions]);

  // Poll every 60s for today only (LIVE status updates)
  useEffect(() => {
    if (selectedDate !== TODAY) return;
    const interval = setInterval(() => fetchSessions(TODAY), 60000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchSessions]);

  const handleDateChange = (e) => {
    if (e.target.value) setSearchParams({ date: e.target.value });
  };

  const goToday = () => setSearchParams({ date: TODAY });

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
                  <CardTitle className="mb-0">My Classes</CardTitle>
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
                <div className="session-stack">
                  {sessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No classes scheduled for {selectedDate}</p>
                    </div>
                  ) : (
                    sessions.map((session) => {
                      const scheduledDate = new Date(session.scheduled_at);
                      const dayName = DAY_NAMES[scheduledDate.getDay()];
                      const dateStr = scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                      return (
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
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center mb-1" style={{ gap: '8px' }}>
                                <h5 className="mb-0">{session.title || 'Untitled Session'}</h5>
                                {getStatusBadge(session.status)}
                              </div>
                              <div className="small text-muted">
                                <span className="mr-3">📚 {session.class_title}</span>
                                <span className="mr-3">📅 {dayName}, {dateStr}</span>
                                <span>🕐 {timeStr}</span>
                              </div>
                            </div>

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
                              <Button
                                size="sm" color="dark"
                                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                              >
                                {expandedSession === session.id ? 'Close' : 'Details'}
                              </Button>
                            </div>
                          </div>

                          {/* ── Details panel (read-only for students) ── */}
                          {expandedSession === session.id && (
                            <div style={{ borderTop: '1px solid #e8f0f6', padding: '16px', backgroundColor: '#f8fbff' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Class</div>
                                  <div style={{ fontWeight: 600 }}>{session.class_title}</div>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Day</div>
                                  <div style={{ fontWeight: 600 }}>{dayName}</div>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Date</div>
                                  <div style={{ fontWeight: 600 }}>{dateStr}</div>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Time</div>
                                  <div style={{ fontWeight: 600 }}>{timeStr}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
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

export default Classes;
