import React, { useState } from "react";
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
} from "reactstrap";
import Header from "components/Headers/Header.js";

const Resources = () => {
  const [openSubject, setOpenSubject] = useState(null);
  const subjects = [
    {
      name: "Mathematics",
      summary: "Strengthen algebra, geometry, and calculus fundamentals with curated exercises.",
      tags: ["Core", "STEM"],
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
  ];

  const toggleSubject = (index) => {
    setOpenSubject((prev) => (prev === index ? null : index));
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid>
        <Row className="justify-content-center">
          <Col lg="10">
            <Card className="shadow border-0 mb-4">
              <CardBody className="pb-3">
                <CardTitle tag="h2" className="mb-2">
                  Learning Resources
                </CardTitle>
                <p className="text-muted mb-0">
                  Browse subject-specific materials, launch assignments, and stay on top of upcoming work. Use the View button to reveal resources for each subject.
                </p>
              </CardBody>
            </Card>
            {subjects.map((subject, index) => (
              <Card key={subject.name} className="shadow-sm border-0 mb-3">
                <CardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h4 className="mb-1">{subject.name}</h4>
                    <div className="text-muted small">{subject.summary}</div>
                    <div className="mt-2">
                      {subject.tags.map((tag) => (
                        <Badge key={tag} color="info" pill className="me-2">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    color={openSubject === index ? "secondary" : "primary"}
                    onClick={() => toggleSubject(index)}
                  >
                    {openSubject === index ? "Hide Details" : "View Details"}
                  </Button>
                </CardHeader>
                <Collapse isOpen={openSubject === index}>
                  <CardBody>
                    <Row>
                      <Col md="6" className="mb-4">
                        <h5 className="text-primary">Materials</h5>
                        <ListGroup flush>
                          {subject.materials.map((item) => (
                            <ListGroupItem
                              key={item.title}
                              className="d-flex justify-content-between align-items-center"
                            >
                              <span>{item.title}</span>
                              <Badge color="light" className="text-uppercase">
                                {item.type}
                              </Badge>
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      </Col>
                      <Col md="6" className="mb-4">
                        <h5 className="text-primary">Upcoming Work</h5>
                        <ListGroup flush>
                          {subject.quizzes.map((quiz) => (
                            <ListGroupItem key={quiz} className="d-flex justify-content-between">
                              <span>{quiz}</span>
                              <Badge color="warning">Quiz</Badge>
                            </ListGroupItem>
                          ))}
                          {subject.assignments.map((assignment) => (
                            <ListGroupItem
                              key={assignment}
                              className="d-flex justify-content-between"
                            >
                              <span>{assignment}</span>
                              <Badge color="success">Assignment</Badge>
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <h5 className="text-primary">Additional Support</h5>
                        <ListGroup flush>
                          {subject.extras.map((item) => (
                            <ListGroupItem key={item}>{item}</ListGroupItem>
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
