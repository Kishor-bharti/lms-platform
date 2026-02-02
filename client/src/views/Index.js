import Header from "components/Headers/Header.js";
import UpcomingClasses from "components/Dashboard/UpcomingClasses";
import CalendarWidget from "components/Dashboard/CalendarWidget";
import {
  Container,
  Row,
  Col,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
} from "reactstrap";

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
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Announcements</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="mb-3">
                  <h6 className="text-primary font-weight-bold">
                    Mid-term Exams Schedule
                  </h6>
                  <p className="text-sm text-muted">
                    Mid-term exams will begin from March 15th. Please check your
                    individual class schedules for specific dates and times.
                  </p>
                </div>
                <hr />
                <div className="mb-3">
                  <h6 className="text-success font-weight-bold">
                    Assignment Submission Deadline
                  </h6>
                  <p className="text-sm text-muted">
                    All assignments for this week must be submitted by Friday,
                    January 31st before 5:00 PM.
                  </p>
                </div>
                <hr />
                <div>
                  <h6 className="text-warning font-weight-bold">
                    Campus Library Hours Update
                  </h6>
                  <p className="text-sm text-muted">
                    The main library will be closed on weekends for maintenance.
                    Extended hours available on weekdays.
                  </p>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col lg="12">
            <Card className="shadow" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Recent Activity</CardTitle>
              </CardHeader>
              <Table className="align-items-center table-flush" responsive>
                <thead className="thead-light">
                  <tr>
                    <th scope="col">Activity</th>
                    <th scope="col">Course</th>
                    <th scope="col">Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Assignment Submitted</th>
                    <td>Mathematics 101</td>
                    <td>Jan 25, 2026</td>
                  </tr>
                  <tr>
                    <th scope="row">Quiz Completed</th>
                    <td>English Literature</td>
                    <td>Jan 24, 2026</td>
                  </tr>
                  <tr>
                    <th scope="row">Lecture Notes Uploaded</th>
                    <td>Physics Lab</td>
                    <td>Jan 23, 2026</td>
                  </tr>
                  <tr>
                    <th scope="row">Grade Posted</th>
                    <td>Chemistry Advanced</td>
                    <td>Jan 22, 2026</td>
                  </tr>
                </tbody>
              </Table>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Index;
