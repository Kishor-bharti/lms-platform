import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, CardBody, Button, Badge } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

export default function CourseQuiz() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const isStaff = userRole === 'admin' || userRole === 'teacher';

  useEffect(() => {
    Promise.all([
      http.get(`/api/quizzes/course/${courseId}`),
      http.get('/api/courses/my-courses'),
    ]).then(([quizRes, courseRes]) => {
      setQuizzes(quizRes.data || []);
      const course = (courseRes.data || []).find(c => c.id === courseId);
      if (course) setCourseName(course.name);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <>
      <Header />
      <Container className="mt--7" fluid
        style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
              <div>
                <h2 style={{ color: '#32325d', margin: 0 }}>📝 {courseName} — Test Sets</h2>
                <p className="text-muted small mt-1 mb-0">Full-length course tests. Complete each in one sitting.</p>
              </div>
              {isStaff && (
                <Button color="primary" style={{ borderRadius: 8, fontWeight: 700 }}
                  onClick={() => navigate('/admin/quiz-builder', { state: { courseId, courseName, isCourseQuiz: true } })}>
                  + New Test Set
                </Button>
              )}
            </div>
          </Col>
        </Row>

        {loading ? (
          <Row><Col><Card className="shadow" style={{ borderRadius: 12 }}>
            <CardBody className="text-center py-5"><p>Loading...</p></CardBody>
          </Card></Col></Row>
        ) : quizzes.length === 0 ? (
          <Row><Col><Card className="shadow" style={{ borderRadius: 12 }}>
            <CardBody className="text-center py-5">
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p className="text-muted">No test sets published yet. Check back later.</p>
            </CardBody>
          </Card></Col></Row>
        ) : (
          <Row>
            {quizzes.map((q, idx) => {
              const isSubmitted = q.my_attempt?.status === 'submitted';
              return (
                <Col key={q.id} md="6" lg="4" className="mb-4">
                  <Card className="shadow h-100"
                    style={{ borderRadius: 14, borderTop: `4px solid ${isSubmitted ? '#2dce89' : '#5e72e4'}` }}>
                    <CardBody style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 1 }}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 style={{ color: '#32325d', marginBottom: 4 }}>{q.title}</h5>
                          {isSubmitted ? (
                            <Badge color="success">Submitted</Badge>
                          ) : (
                            <Badge color="primary">Not Started</Badge>
                          )}
                        </div>
                        {q.topic_name && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 10px', borderRadius: 10 }}>📌 {q.topic_name}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                          <span style={{ background: '#f0f4f8', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#525f7f' }}>
                            ❓ {q.question_count} questions
                          </span>
                          <span style={{ background: '#f0f4f8', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#525f7f' }}>
                            ⏱ {q.duration_minutes} mins
                          </span>
                          {isSubmitted && q.my_attempt?.score_pct != null && (
                            <span style={{ background: '#eafaf1', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#2dce89', fontWeight: 700 }}>
                              {Number(q.my_attempt.score_pct).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        color={isSubmitted ? 'secondary' : 'primary'}
                        outline={isSubmitted}
                        style={{ borderRadius: 8, fontWeight: 700 }}
                        onClick={() => navigate(`/admin/quiz/${q.id}`)}>
                        {isSubmitted ? 'View Results' : 'Start Test'}
                      </Button>
                      {isStaff && (
                        <Button color="info" outline size="sm"
                          style={{ borderRadius: 8, fontWeight: 700, marginTop: 8 }}
                          onClick={() => navigate('/admin/quiz-builder', { state: { courseId, courseName, isCourseQuiz: true, editQuizId: q.id } })}>
                          ✏️ Edit
                        </Button>
                      )}
                    </CardBody>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Container>
    </>
  );
}
