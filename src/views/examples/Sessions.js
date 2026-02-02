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
              <CardBody>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" color="primary" outline>Day</Button>
                  <Button size="sm" color="primary" outline className="ml-2">Week</Button>
                  <Button size="sm" color="primary" outline className="ml-2">Month</Button>
                </div>
                <div className="session-stack">
                  <div className="session-item p-3 mb-3 bg-white border rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-1">AP Chemistry by Harmanpreet</h5>
                      <div className="small text-muted">04:00 pm</div>
                    </div>
                    <div className="small text-muted">• Recurring • Online</div>
                  </div>

                  <div className="session-item p-3 mb-3 bg-white border rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-1">AP Chemistry by Harmanpreet</h5>
                      <div className="small text-muted">06:00 pm</div>
                    </div>
                    <div className="small text-muted">• Recurring • Online</div>
                  </div>

                  <div className="session-item p-3 mb-3 bg-white border rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-1">IB Chemistry HL by Harmanpreet</h5>
                      <div className="small text-muted">07:00 pm</div>
                    </div>
                    <div className="small text-muted">• Recurring • Online</div>
                  </div>
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
