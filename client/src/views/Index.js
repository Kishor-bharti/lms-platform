import Header from "components/Headers/Header.js";
import UpcomingClasses from "components/Dashboard/UpcomingClasses";
import CalendarWidget from "components/Dashboard/CalendarWidget";
import { Container, Row, Col } from "reactstrap";

const Index = (props) => {
  return (
    <>
      <Header />
      {/* Page content */}
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="8" className="mb-4">
            <UpcomingClasses />
          </Col>
          <Col lg="4" className="mb-4">
            <CalendarWidget />
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Index;
