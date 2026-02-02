import { Card, CardHeader, CardBody, Container, Row, Col } from "reactstrap";
import Header from "components/Headers/Header.js";

const Report = () => {
  return (
    <>
      <Header />
      <Container className="mt--7" fluid>
        <Row>
          <Col lg="12">
            <Card className="shadow">
              <CardHeader className="border-0">
                <h3 className="mb-0">Report</h3>
              </CardHeader>
              <CardBody>
                <p className="text-muted mb-4">
                  This is a demo report page. Add charts and summaries here.
                </p>
                <div className="d-flex flex-wrap">
                  <div className="mr-4 mb-3">
                    <span className="badge badge-primary">Chart A</span>
                  </div>
                  <div className="mr-4 mb-3">
                    <span className="badge badge-info">Chart B</span>
                  </div>
                  <div className="mr-4 mb-3">
                    <span className="badge badge-warning">KPI Summary</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Report;
