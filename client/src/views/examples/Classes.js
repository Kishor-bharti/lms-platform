import React, { useState } from "react";
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

const Classes = () => {
  const [selectedView, setSelectedView] = useState('day');

  const classes = [
    {
      id: 1,
      title: "AP Chemistry",
      subject: "Chemistry",
      teacher: "Harmanpreet",
      status: "LIVE",
      time: "04:00 pm",
      joinLink: "https://meet.example.com/apchemistry",
      date: "Jan 29, 2026"
    },
    {
      id: 2,
      title: "AP Chemistry",
      subject: "Chemistry",
      teacher: "Harmanpreet",
      status: "TODAY",
      time: "07:00 pm",
      joinLink: "https://meet.example.com/apchemistry2",
      date: "Jan 29, 2026"
    },
    {
      id: 3,
      title: "IB Chemistry HL",
      subject: "Chemistry",
      teacher: "Harmanpreet",
      status: "UPCOMING",
      time: "06:01 pm",
      joinLink: "https://meet.example.com/ibchemistry",
      date: "Jan 30, 2026"
    },
    {
      id: 4,
      title: "IB Chemistry HL",
      subject: "Chemistry",
      teacher: "Harmanpreet",
      status: "UPCOMING",
      time: "07:00 pm",
      joinLink: "https://meet.example.com/ibchemistry2",
      date: "Jan 30, 2026"
    },
  ];

  const getStatusBadge = (status) => {
    switch(status) {
      case 'LIVE':
        return <Badge color="danger" className="live-blink">LIVE</Badge>;
      case 'TODAY':
        return <Badge color="info">TODAY</Badge>;
      case 'UPCOMING':
        return <Badge color="warning">TOMORROW</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleJoin = (joinLink) => {
    window.open(joinLink, '_blank');
  };

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
                <CardTitle className="mb-0">Upcoming Classes</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline={selectedView!=="day"} onClick={()=>setSelectedView('day')}>Day</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="week"} className="ml-2" onClick={()=>setSelectedView('week')}>Week</Button>
                  <Button size="sm" color="primary" outline={selectedView!=="month"} className="ml-2" onClick={()=>setSelectedView('month')}>Month</Button>
                </div>
                <div className="class-stack">
                  {classes.map((classItem) => (
                    <div key={classItem.id} className="class-item p-3 mb-3 bg-white border rounded" style={{ borderLeft: '4px solid #96c8ff', backgroundColor: classItem.status === 'LIVE' ? '#ffe6e6' : '#e6f2ff' }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 mr-2">{classItem.title}</h5>
                            {getStatusBadge(classItem.status)}
                          </div>
                          <div className="small text-muted mb-2">
                            <span className="mr-3">📚 {classItem.subject}</span>
                            <span className="mr-3">👨‍🏫 {classItem.teacher}</span>
                            <span>🕐 {classItem.time}</span>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          {classItem.status === 'LIVE' && (
                            <Button size="sm" color="success" onClick={() => handleJoin(classItem.joinLink)}>
                              Join
                            </Button>
                          )}
                          <Button size="sm" color="dark">Details</Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
