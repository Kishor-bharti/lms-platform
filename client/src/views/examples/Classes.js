import React, { useState, useEffect, useRef } from "react";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";
import { SessionCardSkeleton } from 'components/Skeleton.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Classes = () => {
  const [selectedView, setSelectedView] = useState('day');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const errorCount = useRef(0);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      if (errorCount.current >= 3) { clearInterval(interval); return; }
      fetchSessions();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await http.get('/api/classes/my-sessions-v2');
      const data = Array.isArray(response?.data) ? response.data : [];
      setSessions(data);
      setLoading(false);
      errorCount.current = 0;
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
      setLoading(false);
      errorCount.current += 1;
    }
  };

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

  const visibleSessions = filterSessionsByView(sessions);

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">My Classes</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView !== "day"} onClick={() => setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView !== "week"} className="ml-2" onClick={() => setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView !== "month"} className="ml-2" onClick={() => setSelectedView('month')}>Month</Button>
                </div>

                <div className="session-stack">
                  {visibleSessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">
                        {sessions.length === 0 ? 'No classes scheduled yet' : `No classes for this ${selectedView}`}
                      </p>
                    </div>
                  ) : (
                    visibleSessions.map((session) => {
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

                          {/* ── Details panel ── */}
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
