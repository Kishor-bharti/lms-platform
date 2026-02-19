import React, { useState, useEffect } from "react";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";

const Classes = () => {
  const [selectedView, setSelectedView] = useState('day');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState(null);

  useEffect(() => {
    fetchClasses();
    const interval = setInterval(fetchClasses, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await http.get('/api/classes/my-classes-v2');
      setClasses(Array.isArray(response?.data) ? response.data : []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
      setClasses([]);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
          <Row><Col lg="12">
            <Card><CardBody className="text-center py-5"><p>Loading classes...</p></CardBody></Card>
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
                <CardTitle className="mb-0">Enrolled Classes</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView !== "day"} onClick={() => setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView !== "week"} className="ml-2" onClick={() => setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView !== "month"} className="ml-2" onClick={() => setSelectedView('month')}>Month</Button>
                </div>

                <div className="class-stack">
                  {classes.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No enrolled classes yet</p>
                    </div>
                  ) : (
                    classes.map((classItem) => (
                      <div key={classItem.id} className="class-item mb-3 bg-white border rounded"
                        style={{ borderLeft: '4px solid #96c8ff' }}>

                        {/* ── Main row ── */}
                        <div className="p-3 d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h5 className="mb-1">{classItem.title}</h5>
                            <div className="small text-muted">
                              {/* FIX: was classItem.subject (undefined) → now course_name */}
                              <span className="mr-3">📚 {classItem.course_name}</span>
                              <span className="mr-3">👨‍🏫 {classItem.teacher_name}</span>
                              {classItem.code && (
                                <Badge color="light" style={{ fontSize: '11px' }}>{classItem.code}</Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm" color="dark"
                            onClick={() => setExpandedClass(expandedClass === classItem.id ? null : classItem.id)}
                          >
                            {expandedClass === classItem.id ? 'Close' : 'Details'}
                          </Button>
                        </div>

                        {/* ── Details panel (slide-down) ── */}
                        {expandedClass === classItem.id && (
                          <div style={{ borderTop: '1px solid #e8f0f6', padding: '16px', backgroundColor: '#f8fbff' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Subject</div>
                                <div style={{ fontWeight: 600 }}>{classItem.title}</div>
                              </div>
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Course</div>
                                <div style={{ fontWeight: 600 }}>{classItem.course_name}</div>
                              </div>
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Teacher</div>
                                <div style={{ fontWeight: 600 }}>{classItem.teacher_name}</div>
                              </div>
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Code</div>
                                <div style={{ fontWeight: 600 }}>{classItem.code || '—'}</div>
                              </div>
                            </div>
                            {classItem.description && (
                              <p className="small text-muted mb-0" style={{ fontStyle: 'italic' }}>{classItem.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <style>{`
                  .class-stack .class-item { transition: box-shadow .15s ease; }
                  .class-stack .class-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.1); }
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
