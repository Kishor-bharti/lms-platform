import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Card, CardBody } from 'reactstrap';
import Header from 'components/Headers/Header.js';

export default function CourseQuiz() {
  const { courseId } = useParams();
  return (
    <>
      <Header />
      <Container className="mt--7" fluid
        style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col>
          <Card className="shadow" style={{ borderRadius: 12 }}>
            <CardBody className="text-center py-5">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h4>Course Test Sets</h4>
              <p className="text-muted">Test Sets will appear here in Phase 4.</p>
              <p className="text-muted small">Course ID: {courseId}</p>
            </CardBody>
          </Card>
        </Col></Row>
      </Container>
    </>
  );
}
