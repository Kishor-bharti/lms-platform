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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormGroup,
  Input,
  Label,
} from "reactstrap";
// core components
import Header from "components/Headers/Header.js";
import { apiUrl } from "utils/api";

const Classes = () => {
  const [selectedView, setSelectedView] = useState('day');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Create class modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');

  // Enroll modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [targetClassId, setTargetClassId] = useState(null);

  useEffect(() => {
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    setUserRole(role);
    fetchClasses();
    const interval = setInterval(fetchClasses, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/api/classes/my-classes-v2'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      } else {
        console.error('Failed to fetch classes:', response.status);
        setClasses([]);
      }
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
        {/* Classes List */}
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Enrolled Classes</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView!=="day"} onClick={()=>setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="week"} className="ml-2" onClick={()=>setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="month"} className="ml-2" onClick={()=>setSelectedView('month')}>Month</Button>
                </div>
                <div className="class-stack">
                  {classes.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No enrolled classes yet</p>
                    </div>
                  ) : (
                    classes.map((classItem) => (
                      <div key={classItem.id} className="class-item p-3 mb-3 bg-white border rounded" style={{ borderLeft: '4px solid #96c8ff' }}>
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h5 className="mb-0 mr-2">{classItem.title}</h5>
                            <div className="small text-muted mb-2">
                              <span className="mr-3">📚 {classItem.subject || 'N/A'}</span>
                              <span className="mr-3">👨‍🏫 {classItem.teacher_name}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {userRole === 'TEACHER' && (
                              <Button size="sm" color="primary" outline onClick={() => { setTargetClassId(classItem.id); setShowEnrollModal(true); }}>Enroll Student</Button>
                            )}
                            <Button size="sm" color="dark">Details</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <style>{`
                  .class-stack .class-item { transition: box-shadow .15s ease; }
                  .class-stack .class-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.15); }
                  @keyframes liveBlink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
                  .live-blink { animation: liveBlink 1s infinite; }
                `}</style>
              </CardBody>
            </Card>
          </Col>
                  {userRole === 'TEACHER' && (
                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <Button size="sm" color="success" onClick={() => setShowCreateModal(true)}>Create Class</Button>
                    </div>
                  )}
                  <style>{`
                    .class-stack .class-item { transition: box-shadow .15s ease; }
                    .class-stack .class-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.15); }
                    @keyframes liveBlink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
                    .live-blink { animation: liveBlink 1s infinite; }
                  `}</style>
                  {/* Create Class Modal */}
                  <Modal isOpen={showCreateModal} toggle={() => setShowCreateModal(false)}>
                    <ModalHeader toggle={() => setShowCreateModal(false)}>Create Class</ModalHeader>
                    <ModalBody>
                      <FormGroup>
                        <Label>Title</Label>
                        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Class title" />
                      </FormGroup>
                      <FormGroup>
                        <Label>Subject</Label>
                        <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Subject (optional)" />
                      </FormGroup>
                    </ModalBody>
                    <ModalFooter>
                      <Button color="primary" onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(apiUrl('/api/classes'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ title: newTitle, subject: newSubject })
                          });
                          if (res.ok) {
                            setShowCreateModal(false);
                            setNewTitle(''); setNewSubject('');
                            fetchClasses();
                          } else {
                            alert('Failed to create class');
                          }
                        } catch (err) { console.error(err); alert('Failed to create class'); }
                      }}>Create</Button>
                      <Button color="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    </ModalFooter>
                  </Modal>
                  {/* Enroll Modal */}
                  <Modal isOpen={showEnrollModal} toggle={() => setShowEnrollModal(false)}>
                    <ModalHeader toggle={() => setShowEnrollModal(false)}>Enroll Student</ModalHeader>
                    <ModalBody>
                      <FormGroup>
                        <Label>Student ID</Label>
                        <Input value={enrollStudentId} onChange={(e) => setEnrollStudentId(e.target.value)} placeholder="Numeric student id" />
                      </FormGroup>
                    </ModalBody>
                    <ModalFooter>
                      <Button color="primary" onClick={async () => {
                        const sid = Number(enrollStudentId);
                        if (!sid) { alert('Enter valid student id'); return; }
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(apiUrl(`/api/classes/${targetClassId}/enroll`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ studentId: sid })
                          });
                          if (res.ok) {
                            setShowEnrollModal(false);
                            setEnrollStudentId(''); setTargetClassId(null);
                            fetchClasses();
                          } else {
                            alert('Failed to enroll student');
                          }
                        } catch (err) { console.error(err); alert('Failed to enroll student'); }
                      }}>Enroll</Button>
                      <Button color="secondary" onClick={() => setShowEnrollModal(false)}>Cancel</Button>
                    </ModalFooter>
                  </Modal>
        </Row>
      </Container>
    </>
  );
};

export default Classes;
