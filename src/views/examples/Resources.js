import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Collapse,
  Container,
  ListGroup,
  ListGroupItem,
  Row,
  Col,
  UncontrolledTooltip,
} from "reactstrap";
import Header from "components/Headers/Header.js";

const Resources = () => {
  const [openSubject, setOpenSubject] = useState(null);
  const subjects = useMemo(
    () => [
    {
      name: "Mathematics",
      summary: "Strengthen algebra, geometry, and calculus fundamentals with curated exercises.",
      tags: ["Core", "STEM"],
        accent: "primary",
      materials: [
        { title: "Algebra Mastery Guide", type: "PDF" },
        { title: "Interactive Geometry Workshop", type: "Video" },
        { title: "Calculus Problem Bank", type: "Practice" },
      ],
      quizzes: [
        "Linear Equations Diagnostic",
        "Geometry Proofs Challenge",
      ],
      assignments: [
        "Applied Calculus Project",
        "Statistics in Real Life Case Study",
      ],
      extras: ["Weekly math lab sessions", "Peer tutoring calendar"],
    },
    {
      name: "Science",
      summary: "Explore biology, chemistry, and physics through lab simulations and experiments.",
      tags: ["Core", "Lab"],
        accent: "success",
      materials: [
        { title: "Biology Concept Maps", type: "Slides" },
        { title: "Chemistry Lab Safety Kit", type: "Checklist" },
        { title: "Physics Simulation Library", type: "Interactive" },
      ],
      quizzes: [
        "Cell Processes Quiz",
        "Chemical Reactions Foundations",
      ],
      assignments: ["Physics Data Analysis Report"],
      extras: ["Virtual lab access", "Science fair guidelines"],
    },
    {
      name: "Humanities",
      summary: "Build critical thinking with literature reviews, historical analysis, and writing labs.",
      tags: ["Core", "Writing"],
        accent: "warning",
      materials: [
        { title: "World History Timeline Toolkit", type: "PDF" },
        { title: "Literature Discussion Prompts", type: "Workbook" },
        { title: "Academic Writing Lab", type: "Module" },
      ],
      quizzes: ["Renaissance Literature Check-in"],
      assignments: [
        "Comparative Essay Draft",
        "Primary Source Reflection Journal",
      ],
      extras: ["Writing center appointments", "Discussion board calendar"],
    },
    ],
    []
  );

  const toggleSubject = (index) => {
    setOpenSubject((prev) => (prev === index ? null : index));
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid>
        <Row className="justify-content-center">
          <Col lg="10">
            <Card className="shadow border-0 mb-4 overflow-hidden">
              <div
                className="w-100"
                style={{
                  height: "160px",
                  background: "linear-gradient(135deg, #6d5dfc 0%, #a575ff 50%, #4cd4f0 100%)",
                }}
              />
              <CardBody className="pb-3 position-relative" style={{ marginTop: "-100px" }}>
                <div className="rounded-4 shadow-sm bg-white p-4">
                  <CardTitle tag="h2" className="mb-3">
                    Learning Resources
                  </CardTitle>
                  <p className="text-muted mb-0">
                    Browse curated subject collections, track assigned work, and access support hubs. Expand each card to launch materials and stay organized.
                  </p>
                </div>
              </CardBody>
            </Card>
            {subjects.map((subject, index) => (
              <Card key={subject.name} className="shadow border-0 mb-4">
                <CardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2 border-0 bg-white">
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className={`icon icon-shape bg-gradient-${subject.accent} text-white rounded-circle shadow`}
                      style={{ width: 48, height: 48, display: "grid", placeItems: "center" }}
                    >
                      <span className="ni ni-books" />
                    </div>
                    <div>
                      <h4 className="mb-1">{subject.name}</h4>
                      <div className="text-muted small">{subject.summary}</div>
                      <div className="mt-2">
                        {subject.tags.map((tag) => (
                          <Badge key={tag} color={subject.accent} pill className="me-2 opacity-75">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    color={openSubject === index ? "secondary" : subject.accent}
                    onClick={() => toggleSubject(index)}
                    id={`toggle-${index}`}
                  >
                    {openSubject === index ? "Hide Details" : "View Details"}
                  </Button>
                  <UncontrolledTooltip placement="left" target={`toggle-${index}`}>
                    {openSubject === index ? "Collapse subject overview" : "Expand to explore materials"}
                  </UncontrolledTooltip>
                </CardHeader>
                <Collapse isOpen={openSubject === index}>
                  <CardBody>
                    <Row>
                      <Col md="6" className="mb-4">
                        <h5 className={`text-${subject.accent}`}>Materials</h5>
                        <ListGroup flush>
                          {subject.materials.map((item) => (
                            <ListGroupItem
                              key={item.title}
                              className="d-flex justify-content-between align-items-center"
                            >
                              <div>
                                <div className="fw-semibold">{item.title}</div>
                                <small className="text-muted">Download and review before class</small>
                              </div>
                              <Badge color={subject.accent} className="text-uppercase">
                                {item.type}
                              </Badge>
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      </Col>
                      <Col md="6" className="mb-4">
                        <h5 className={`text-${subject.accent}`}>Upcoming Work</h5>
                        <ListGroup flush>
                          {subject.quizzes.map((quiz) => (
                            <ListGroupItem key={quiz} className="d-flex justify-content-between align-items-center">
                              <span>{quiz}</span>
                              <Badge color="warning" className="text-uppercase">Quiz</Badge>
                            </ListGroupItem>
                          ))}
                          {subject.assignments.map((assignment) => (
                            <ListGroupItem
                              key={assignment}
                              className="d-flex justify-content-between align-items-center"
                            >
                              <span>{assignment}</span>
                              <Badge color="success" className="text-uppercase">Assignment</Badge>
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <h5 className={`text-${subject.accent}`}>Additional Support</h5>
                        <ListGroup flush className="list-group-flush">
                          {subject.extras.map((item) => (
                            <ListGroupItem key={item} className="d-flex align-items-center">
                              <span className="ni ni-bullet-list-67 text-muted me-2" />
                              {item}
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      </Col>
                    </Row>
                  </CardBody>
                </Collapse>
              </Card>
            ))}
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Resources;
