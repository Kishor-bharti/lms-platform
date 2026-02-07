import React, { useState, useEffect } from "react";
// reactstrap components
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Container,
  Row,
  Col,
  Badge,
} from "reactstrap";
// core components
import Header from "components/Headers/Header.js";
import { apiUrl } from "utils/api";

const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [selectedView, setSelectedView] = useState('day');

  useEffect(() => {
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    setUserRole(role);
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/api/classes/my-sessions-v2'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      } else {
        setSessions([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'LIVE':
        return <Badge color="danger" className="live-blink">LIVE</Badge>;
      case 'TODAY':
        return <Badge color="warning">TODAY</Badge>;
      case 'TOMORROW':
        return <Badge color="info">TOMORROW</Badge>;
      case 'COMPLETED':
        return <Badge color="secondary">COMPLETED</Badge>;
      case 'SCHEDULED':
        return <Badge color="light">SCHEDULED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleJoin = (zoomLink) => {
    if (zoomLink) {
      window.open(zoomLink, '_blank');
    }
  };

  const toggleSessionPanel = (sessionId) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  const handleStartSession = async (sessionId) => {
    setStartingSession(sessionId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/classes/sessions/${sessionId}/start`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedSession = await response.json();
        setSessions(sessions.map(s => s.id === sessionId ? updatedSession : s));
        setExpandedSession(null);
        const teacherOpenUrl = updatedSession.start_url || updatedSession.zoom_link;
        if (teacherOpenUrl) {
          window.open(teacherOpenUrl, '_blank');
        }
      } else {
        alert('Failed to start session');
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session');
    } finally {
      setStartingSession(null);
    }
  };

  const handleEndSession = async (sessionId) => {
    setStartingSession(sessionId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/api/classes/sessions/${sessionId}/complete`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedSession = await response.json();
        setSessions(sessions.map(s => s.id === sessionId ? updatedSession : s));
        setExpandedSession(null);
      } else {
        alert('Failed to end session');
      }
    } catch (error) {
      console.error('Failed to end session:', error);
      alert('Failed to end session');
    } finally {
      setStartingSession(null);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
          <Row>
            <Col lg="12">
              <Card>
                <CardBody className="text-center py-5">
                  <p>Loading sessions...</p>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </>
    );
  }
  return (
    <>
      <Header />
      {/* Page content */}
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        {/* Sessions List */}
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Sessions</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView!=="day"} onClick={()=>setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="week"} className="ml-2" onClick={()=>setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="month"} className="ml-2" onClick={()=>setSelectedView('month')}>Month</Button>
                </div>
                <div className="session-stack">
                  {sessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No sessions scheduled yet</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.id} className="session-item p-3 mb-3 bg-white border rounded" style={{ borderLeft: '4px solid #96c8ff', backgroundColor: session.status === 'LIVE' ? '#ffe6e6' : 'white', cursor: userRole === 'TEACHER' ? 'pointer' : 'default' }} onClick={() => userRole === 'TEACHER' && toggleSessionPanel(session.id)}>
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-2">
                              <h5 className="mb-0 mr-2">{session.title || 'Untitled Session'}</h5>
                              {getStatusBadge(session.status)}
                            </div>
                            <div className="small text-muted mb-2">
                              <span className="mr-3">📚 {session.class_title}</span>
                              <span>🕐 {new Date(session.scheduled_at).toLocaleString()}</span>
                            </div>
                            {expandedSession === session.id && userRole === 'TEACHER' && (
                              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
                                <div style={{ marginBottom: '10px' }}>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#555' }}>Class</label>
                                  <div style={{ padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px', fontSize: '14px' }}>{session.class_title}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {session.status !== 'LIVE' && (
                                    <Button 
                                      color="success" 
                                      size="sm" 
                                      onClick={(e) => { e.stopPropagation(); handleStartSession(session.id); }}
                                      disabled={startingSession === session.id}
                                    >
                                      {startingSession === session.id ? 'Starting...' : 'Start Live Session'}
                                    </Button>
                                  )}
                                  {session.status === 'LIVE' && (
                                    <Button 
                                      color="danger" 
                                      size="sm" 
                                      onClick={(e) => { e.stopPropagation(); handleEndSession(session.id); }}
                                      disabled={startingSession === session.id}
                                    >
                                      {startingSession === session.id ? 'Ending...' : 'End Session'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="d-flex gap-2">
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
                            <Button size="sm" color="dark">Details</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <style>{`
                  .session-stack .session-item { transition: box-shadow .15s ease; }
                  .session-stack .session-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.15); }
                  @keyframes liveBlink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
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
