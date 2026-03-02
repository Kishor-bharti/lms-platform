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
                                    <button type="button" className="link-action" onClick={() => handleAction(name, "assignments")} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>
                                      Assignments
                                    </button>
                                  </li>
                                  <li className="py-1">
                                    <button type="button" className="link-action" onClick={() => handleAction(name, "quizzes")} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>
                                      Quizzes
                                    </button>
                                  </li>
                                  <li className="py-1">
                                    <button type="button" className="link-action" onClick={() => handleAction(name, "materials")} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>
                                      Materials
                                    </button>
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
