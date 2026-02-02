// reactstrap components
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
  Container,
  Row,
  Col,
} from "reactstrap";
// core components
import Header from "components/Headers/Header.js";

const Sessions = () => {
  return (
    <>
      <Header />
      {/* Page content */}
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        {/* Ongoing Sessions */}
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Active Sessions</CardTitle>
              </CardHeader>
              <Table className="align-items-center table-flush" responsive>
                <thead className="thead-light">
                  <tr>
                    <th scope="col">Session Name</th>
                    <th scope="col">Instructor</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Live Math Class - Session 1</th>
                    <td>Dr. Smith</td>
                    <td>60 minutes</td>
                    <td>
                      <Badge color="success" className="live-blink">Live</Badge>
                    </td>
                    <td>
                      <Button color="info" size="sm">
                        Join Now
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Physics Workshop</th>
                    <td>Prof. Brown</td>
                    <td>90 minutes</td>
                    <td>
                      <Badge color="warning">Starting Soon</Badge>
                    </td>
                    <td>
                      <Button color="info" size="sm" disabled>
                        Scheduled
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Chemistry Practical Lab</th>
                    <td>Dr. Wilson</td>
                    <td>120 minutes</td>
                    <td>
                      <Badge color="secondary">Completed</Badge>
                    </td>
                    <td>
                      <Button color="secondary" size="sm">
                        Replay
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </Table>
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
              <Table className="align-items-center table-flush" responsive>
                <thead className="thead-light">
                  <tr>
                    <th scope="col">Session</th>
                    <th scope="col">Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">English Writing Workshop</th>
                    <td>Jan 27, 3:00 PM</td>
                  </tr>
                  <tr>
                    <th scope="row">History Discussion</th>
                    <td>Jan 28, 11:00 AM</td>
                  </tr>
                  <tr>
                    <th scope="row">Biology Field Session</th>
                    <td>Jan 29, 2:00 PM</td>
                  </tr>
                  <tr>
                    <th scope="row">Math Problem Solving</th>
                    <td>Jan 30, 4:00 PM</td>
                  </tr>
                </tbody>
              </Table>
            </Card>
          </Col>
          <Col lg="6">
            <Card className="shadow" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <CardTitle className="mb-0">Session Statistics</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-2">
                    <span>Sessions Attended</span>
                    <span className="font-weight-bold">24</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Average Attendance Rate</span>
                    <span className="font-weight-bold">92%</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Total Hours in Sessions</span>
                    <span className="font-weight-bold">36 hours</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Certificates Earned</span>
                    <span className="font-weight-bold">3</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
      <style>{`
        @keyframes liveBlink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        .live-blink { animation: liveBlink 1s infinite; }
      `}</style>
    </>
  );
};

export default Sessions;
