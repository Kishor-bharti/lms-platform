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

const Classes = () => {
  const [selectedView, setSelectedView] = useState('day');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
    const interval = setInterval(fetchClasses, 5000);
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

  const getStatusBadge = (status) => {
    switch(status) {
      case 'LIVE':
        return <Badge color="danger" className="live-blink">LIVE</Badge>;
      case 'SCHEDULED':
        return <Badge color="info">TODAY</Badge>;
      case 'COMPLETED':
        return <Badge color="secondary">COMPLETED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleJoin = (zoomLink) => {
    if (zoomLink) {
      window.open(zoomLink, '_blank');
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
                          <Button size="sm" color="dark">Details</Button>
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
        </Row>
      </Container>
    </>
  );
};

export default Classes;
