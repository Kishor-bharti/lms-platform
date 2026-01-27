import Header from "components/Headers/Header.js";
import {
  Container,
  Row,
  Col,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
  Badge,
} from "reactstrap";

const Index = (props) => {
  return (
    <>
      <Header />
      {/* Page content */}
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="6">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Upcoming Classes</CardTitle>
              </CardHeader>
              <Table className="align-items-center table-flush" responsive>
                <thead className="thead-light">
                  <tr>
                    <th scope="col">Class</th>
                    <th scope="col">Instructor</th>
                    <th scope="col">Time</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Mathematics 101</th>
                    <td>Dr. Smith</td>
                    <td>10:00 AM</td>
                    <td>
                      <Badge color="info">Today</Badge>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">English Literature</th>
                    <td>Prof. Johnson</td>
                    <td>2:30 PM</td>
                    <td>
                      <Badge color="info">Today</Badge>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Physics Lab</th>
                    <td>Dr. Brown</td>
                    <td>11:00 AM</td>
                    <td>
                      <Badge color="warning">Tomorrow</Badge>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Chemistry Advanced</th>
                    <td>Prof. Davis</td>
                    <td>3:00 PM</td>
                    <td>
                      <Badge color="warning">Tomorrow</Badge>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Card>
          </Col>
          <Col lg="6">
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
