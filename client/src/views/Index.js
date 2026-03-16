import Header from "components/Headers/Header.js";
import UpcomingClasses from "components/Dashboard/UpcomingClasses";
import CalendarWidget from "components/Dashboard/CalendarWidget";
import MyStudents from "components/Dashboard/MyStudents";
import SessionHistoryStats from "components/Dashboard/SessionHistoryStats";
import { Container, Row, Col } from "reactstrap";

const Index = (props) => {
  const role = (localStorage.getItem('role') || '').toLowerCase();
  const isTeacherOrAdmin = role === 'teacher' || role === 'admin';

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ background: "linear-gradient(180deg, #eef2f7 0%, #e3eaf4 100%)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="8" className="mb-4">
            <div className="dash-card-animate" style={{ animationDelay: '0.1s' }}>
              <UpcomingClasses />
            </div>
          </Col>
          <Col lg="4" className="mb-4">
            <div className="dash-card-animate" style={{ animationDelay: '0.2s' }}>
              <CalendarWidget />
            </div>
          </Col>
        </Row>
        {isTeacherOrAdmin && (
          <Row>
            <Col lg="6" className="mb-4">
              <div className="dash-card-animate" style={{ animationDelay: '0.3s' }}>
                <MyStudents />
              </div>
            </Col>
            <Col lg="6" className="mb-4">
              <div className="dash-card-animate" style={{ animationDelay: '0.4s' }}>
                <SessionHistoryStats />
              </div>
            </Col>
          </Row>
        )}
      </Container>
      <style>{`
        .dash-card-animate {
          animation: dashCardIn 0.5s ease both;
        }
        @keyframes dashCardIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default Index;
