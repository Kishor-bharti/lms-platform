import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Row,
  Col,
  Input,
  Table,
  Collapse,
} from "reactstrap";
import Header from "components/Headers/Header.js";

const Resources = () => {
  const [query, setQuery] = useState("");
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

  // Simple resource list to mirror the attached design
  const resourceItems = useMemo(
    () => [
      "AP Chemistry",
      "AP Chemistry FLTs 2025",
      "ESAT",
      "ESAT FLTs 2025",
      "IBDP Chemistry",
      "IGCSE Chemistry",
    ],
    []
  );
  const filtered = useMemo(
    () => resourceItems.filter((r) => r.toLowerCase().includes(query.toLowerCase())),
    [resourceItems, query]
  );

  const [openRow, setOpenRow] = useState(null);
  const toggleRow = (idx) => setOpenRow((prev) => (prev === idx ? null : idx));
  const handleAction = (subject, action) => {
    // TODO: wire these to routes or modals
    console.log(`Action: ${action} for ${subject}`);
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid>
        <Row
          className="justify-content-start"
          style={{
            background: "#f4efe7",
            minHeight: "calc(100vh - 180px)",
            paddingBottom: "40px",
            margin: "0 12px",
          }}
        >
          <Col lg="9" md="10">
            <Card className="shadow border-0">
              <CardHeader className="d-flex justify-content-between align-items-center bg-white border-0">
                <h3 className="mb-0">Resources</h3>
                <div style={{ maxWidth: 280 }}>
                  <Input
                    type="search"
                    placeholder="Search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="form-control-alternative"
                  />
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <Table className="table align-items-center" responsive>
                  <thead className="thead-light">
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col" className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((name, idx) => (
                      <React.Fragment key={name}>
                        <tr style={{ background: idx % 2 === 0 ? "#f5f1eb" : "transparent" }}>
                          <td>{name}</td>
                          <td className="text-right">
                            <Button
                              color="link"
                              className="text-muted p-0"
                              aria-label={`Show options for ${name}`}
                              onClick={() => toggleRow(idx)}
                              aria-expanded={openRow === idx}
                            >
                              <span className="ni ni-zoom-split-in" />
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="2" className="p-0">
                            <Collapse isOpen={openRow === idx}>
                              <div className="p-3" style={{ background: "#faf7f2", borderTop: "1px solid #eee" }}>
                                <ol className="mb-0" style={{ paddingLeft: 18 }}>
                                  <li className="py-1">
                                    <a href="#" className="text-body text-decoration-none" onClick={(e) => { e.preventDefault(); handleAction(name, "assignments"); }}>
                                      Assignments
                                    </a>
                                  </li>
                                  <li className="py-1">
                                    <a href="#" className="text-body text-decoration-none" onClick={(e) => { e.preventDefault(); handleAction(name, "quizzes"); }}>
                                      Quizzes
                                    </a>
                                  </li>
                                  <li className="py-1">
                                    <a href="#" className="text-body text-decoration-none" onClick={(e) => { e.preventDefault(); handleAction(name, "materials"); }}>
                                      Materials
                                    </a>
                                  </li>
                                </ol>
                              </div>
                            </Collapse>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Resources;
