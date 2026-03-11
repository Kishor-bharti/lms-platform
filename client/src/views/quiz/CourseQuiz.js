import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, CardBody, Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { QuizCardSkeleton } from 'components/Skeleton.js';

export default function CourseQuiz() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ open: false, quiz: null });

  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const userId = (() => { try { return JSON.parse(window.localStorage.getItem('user') || '{}').id || null; } catch { return null; } })();
  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const isStaff = isAdmin || isTeacher;

  const fetchQuizzes = () => {
    setLoading(true);
    Promise.all([
      http.get(`/api/quizzes/course/${courseId}`),
      http.get('/api/courses/my-courses'),
    ]).then(([quizRes, courseRes]) => {
      setQuizzes(quizRes.data || []);
      const course = (courseRes.data || []).find(c => c.id === courseId);
      if (course) setCourseName(course.name);
    }).catch(console.error)
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuizzes();
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePublish = async (quiz, publish) => {
    try {
      await http.patch(`/api/quizzes/${quiz.id}/publish`, { is_published: publish });
      fetchQuizzes();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update quiz');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.quiz) return;
    try {
      await http.delete(`/api/quizzes/${deleteModal.quiz.id}`);
      setDeleteModal({ open: false, quiz: null });
      fetchQuizzes();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete quiz');
    }
  };

  const canEdit = (quiz) => {
    // Teachers can edit their own quizzes, admin can edit all
    return isAdmin || (isTeacher && quiz.created_by === userId);
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid
        style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
              <div>
                <h2 style={{ color: '#fff', margin: 0 }}>📝 {courseName} — Test Sets</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>Full-length course tests. Complete each in one sitting.</p>
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
          <QuizCardSkeleton count={6} />
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
              const showStaffView = isStaff;
              return (
                <Col key={q.id} md="6" lg="4" className="mb-4">
                  <Card className="shadow h-100"
                    style={{ borderRadius: 14, borderTop: `4px solid ${!q.is_published ? '#fb6340' : isSubmitted ? '#2dce89' : '#5e72e4'}` }}>
                    <CardBody style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 1 }}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 style={{ color: '#32325d', marginBottom: 4 }}>{q.title}</h5>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {showStaffView && !q.is_published && (
                              <Badge color="warning">Draft</Badge>
                            )}
                            {showStaffView && q.is_published && (
                              <Badge color="success">Published</Badge>
                            )}
                            {!showStaffView && isSubmitted && (
                              <Badge color="success">Submitted</Badge>
                            )}
                            {!showStaffView && !isSubmitted && (
                              <Badge color="primary">Not Started</Badge>
                            )}
                          </div>
                        </div>

                        {/* Creator info for staff */}
                        {showStaffView && q.creator_name && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: '#8898aa' }}>
                              👤 Created by: <strong>{q.creator_name}</strong>
                            </span>
                          </div>
                        )}

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

                      {/* Student actions */}
                      {!isStaff && (
                        <Button
                          color={isSubmitted ? 'secondary' : 'primary'}
                          outline={isSubmitted}
                          style={{ borderRadius: 8, fontWeight: 700 }}
                          onClick={() => navigate(`/admin/quiz/${q.id}`)}>
                          {isSubmitted ? 'View Results' : 'Start Test'}
                        </Button>
                      )}

                      {/* Staff actions */}
                      {showStaffView && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Edit - only if owner or admin */}
                          {canEdit(q) && (
                            <Button color="info" outline size="sm"
                              style={{ borderRadius: 8, fontWeight: 700 }}
                              onClick={() => navigate('/admin/quiz-builder', { state: { courseId, courseName, isCourseQuiz: true, editQuizId: q.id } })}>
                              ✏️ Edit
                            </Button>
                          )}

                          {/* Publish/Unpublish - admin only */}
                          {isAdmin && (
                            <Button
                              color={q.is_published ? 'warning' : 'success'}
                              outline
                              size="sm"
                              style={{ borderRadius: 8, fontWeight: 700 }}
                              onClick={() => handlePublish(q, !q.is_published)}>
                              {q.is_published ? '📤 Unpublish' : '📥 Publish'}
                            </Button>
                          )}

                          {/* Delete - admin only */}
                          {isAdmin && (
                            <Button color="danger" outline size="sm"
                              style={{ borderRadius: 8, fontWeight: 700 }}
                              onClick={() => setDeleteModal({ open: true, quiz: q })}>
                              🗑️ Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* Delete Confirmation Modal */}
        <Modal isOpen={deleteModal.open} toggle={() => setDeleteModal({ open: false, quiz: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteModal({ open: false, quiz: null })}>
            Confirm Delete
          </ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Are you sure you want to delete <strong>{deleteModal.quiz?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDelete}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteModal({ open: false, quiz: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
