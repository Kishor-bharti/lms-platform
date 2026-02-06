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
  Collapse,
  FormGroup,
  Label,
  Input,
} from "reactstrap";
// core components
import Header from "components/Headers/Header.js";
import { apiUrl } from "utils/api";

const Sessions = () => {
  const [selectedView, setSelectedView] = useState('day');
  const [classes, setClasses] = useState([]);
  const [expandedSession, setExpandedSession] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/api/classes/teacher-classes'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
      setLoading(false);
    }
  };

  const toggleSessionPanel = (classId) => {
    setExpandedSession(expandedSession === classId ? null : classId);
    setSessionTitle('');
  };

  const handleStartSession = async (classId) => {
    if (!sessionTitle.trim()) {
      alert('Please enter a session title');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Create session
      const createResponse = await fetch(apiUrl('/api/classes/sessions/create'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          classId: classId,
          title: sessionTitle,
          scheduledAt: new Date().toISOString()
        })
      });

      if (createResponse.ok) {
        const session = await createResponse.json();

        // Start session
        const startResponse = await fetch(apiUrl('/api/classes/sessions/start'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: session.id
          })
        });

        if (startResponse.ok) {
          const startedSession = await startResponse.json();
          window.open(startedSession.zoom_link, '_blank');
          setExpandedSession(null);
          setSessionTitle('');
          fetchClasses();
        }
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session');
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
                  <p>Loading classes...</p>
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
        {/* Classes with Sessions */}
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Your Classes</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView!=="day"} onClick={()=>setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="week"} className="ml-2" onClick={()=>setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="month"} className="ml-2" onClick={()=>setSelectedView('month')}>Month</Button>
                </div>
                <div className="session-stack">
                  {classes.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No classes found</p>
                    </div>
                  ) : (
                    classes.map((classItem) => (
                      <div key={classItem.id} className="session-item p-3 mb-3 bg-white border rounded" style={{ borderLeft: '4px solid #96c8ff' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="flex-grow-1">
                            <h5 className="mb-1">{classItem.title}</h5>
                            <div className="small text-muted">📚 {classItem.subject || 'No subject'}</div>
                          </div>
                          <Button size="sm" color="info" onClick={() => toggleSessionPanel(classItem.id)}>
                            {expandedSession === classItem.id ? 'Cancel' : 'Start Session'}
                          </Button>
                        </div>
                        <Collapse isOpen={expandedSession === classItem.id}>
                          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
                            <FormGroup>
                              <Label for={`title-${classItem.id}`}>Session Title</Label>
                              <Input
                                id={`title-${classItem.id}`}
                                type="text"
                                placeholder="Enter session title"
                                value={sessionTitle}
                                onChange={(e) => setSessionTitle(e.target.value)}
                              />
                            </FormGroup>
                            <Button color="success" size="sm" onClick={() => handleStartSession(classItem.id)}>
                              Start Live Session
                            </Button>
                          </div>
                        </Collapse>
                      </div>
                    ))
                  )}
                </div>
                <style>{`
                  .session-stack .session-item { transition: box-shadow .15s ease; }
                  .session-stack .session-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.15); }
                `}</style>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Session History */}
        <Row>
          <Col lg="6">
            <Card className="shadow" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Upcoming Sessions</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="text-center py-5">
                  <span className="coming-soon-blink">Coming Soon</span>
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col lg="6">
            <Card className="shadow" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Session Statistics</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="text-center py-5">
                  <span className="coming-soon-blink">Coming Soon</span>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
      <style>{`
        @keyframes liveBlink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        .live-blink { animation: liveBlink 1s infinite; }
        @keyframes csBlinkSessions { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
        .coming-soon-blink { animation: csBlinkSessions 1.2s infinite; font-weight: 600; }
      `}</style>
    </>
  );
};

export default Sessions;
