import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Spinner,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

export default function CourseQuiz() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ open: false, quiz: null });

  // Per-quiz write permissions modal (admin only)
  const [permissionsModal, setPermissionsModal] = useState({ open: false, quiz: null });
  const [permTeachers, setPermTeachers] = useState([]); // merged: all teachers with has_write flag
  const [quizPermissionsLoading, setQuizPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState({});

  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const isStaff = isAdmin || isTeacher;

  const fetchQuizzes = useCallback(() => {
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
  }, [courseId]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

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

  // ---- Per-quiz permissions ----
  const refreshPermTeachers = async (quizId) => {
    const [allRes, writeRes] = await Promise.all([
      http.get('/api/admin/users?role=teacher&limit=500'),
      http.get(`/api/quizzes/${quizId}/permissions`),
    ]);
    const allTeachers = allRes.data?.users || [];
    const writeSet = new Set((writeRes.data || []).map(p => p.teacher_id));
    const writeMap = Object.fromEntries((writeRes.data || []).map(p => [p.teacher_id, p]));
    setPermTeachers(allTeachers.map(t => ({
      id: t.id,
      name: `${t.first_name} ${t.last_name}`,
      has_write: writeSet.has(t.id),
      granted_at: writeMap[t.id]?.granted_at || null,
      granted_by_name: writeMap[t.id]?.granted_by_name || null,
    })));
  };

  const openPermissionsModal = async (quiz) => {
    setPermissionsModal({ open: true, quiz });
    setQuizPermissionsLoading(true);
    try { await refreshPermTeachers(quiz.id); }
    catch { setPermTeachers([]); }
    finally { setQuizPermissionsLoading(false); }
  };

  const handleGrantWrite = async (teacherId) => {
    if (!permissionsModal.quiz) return;
    setPermissionsSaving(s => ({ ...s, [teacherId]: 'grant' }));
    try {
      await http.post(`/api/quizzes/${permissionsModal.quiz.id}/permissions`, { teacherId });
      await refreshPermTeachers(permissionsModal.quiz.id);
      fetchQuizzes();
    } catch (err) { alert(err?.response?.data?.error || 'Failed to grant permission'); }
    finally { setPermissionsSaving(s => ({ ...s, [teacherId]: false })); }
  };

  const handleRevokeWrite = async (teacherId) => {
    if (!permissionsModal.quiz) return;
    setPermissionsSaving(s => ({ ...s, [teacherId]: 'revoke' }));
    try {
      await http.delete(`/api/quizzes/${permissionsModal.quiz.id}/permissions/${teacherId}`);
      await refreshPermTeachers(permissionsModal.quiz.id);
      fetchQuizzes();
    } catch (err) { alert(err?.response?.data?.error || 'Failed to revoke permission'); }
    finally { setPermissionsSaving(s => ({ ...s, [teacherId]: false })); }
  };

  const tdStyle = { padding: '10px 12px', borderBottom: '1px solid #e9ecef', fontSize: 13, verticalAlign: 'middle' };
  const thStyle = { ...tdStyle, background: '#f8f9fa', fontWeight: 700, color: '#525f7f', whiteSpace: 'nowrap' };

  return (
    <>
      <Header hideSubtitle />
      <Container className="mt--7" fluid
        style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        <Row className="mb-3">
          <Col>
            <div style={{ color: '#fff' }}>
              <h2 style={{ margin: 0 }}>📝 {courseName} — Test Sets</h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>
                Full-length course tests. Complete each in one sitting.
              </p>
            </div>
          </Col>
        </Row>

        {/* Student card view */}
        {!isStaff && (
          loading ? (
            <div className="text-center py-5"><Spinner color="light" /></div>
          ) : quizzes.length === 0 ? (
            <Row><Col><Card className="shadow" style={{ borderRadius: 12 }}>
              <CardBody className="text-center py-5">
                <p className="text-muted">No test sets published yet. Check back later.</p>
              </CardBody>
            </Card></Col></Row>
          ) : (
            <Row>
              {quizzes.map(q => {
                const isSubmitted = q.my_attempt?.status === 'submitted';
                return (
                  <Col key={q.id} md="6" lg="4" className="mb-4">
                    <Card className="shadow h-100" style={{ borderRadius: 14 }}>
                      <CardBody style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1 }}>
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h5 style={{ color: '#32325d', marginBottom: 4 }}>{q.title}</h5>
                            <Badge color={isSubmitted ? 'success' : 'primary'}>
                              {isSubmitted ? 'Submitted' : 'Not Started'}
                            </Badge>
                          </div>
                          {q.topic_name && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 10px', borderRadius: 10 }}>
                                📌 {q.topic_name}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            <span style={{ background: '#f0f4f8', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#525f7f' }}>
                              {q.question_count} questions
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
                        <Button color={isSubmitted ? 'secondary' : 'primary'} outline={isSubmitted}
                          style={{ borderRadius: 8, fontWeight: 700 }}
                          onClick={() => navigate(`/admin/quiz/${q.id}`)}>
                          {isSubmitted ? 'View Results' : 'Start Test'}
                        </Button>
                      </CardBody>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )
        )}

        {/* Staff table view */}
        {isStaff && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <CardTitle className="mb-0">Test Sets</CardTitle>
                    {isAdmin && (
                      <Button color="primary" size="sm" style={{ borderRadius: 8 }}
                        onClick={() => navigate('/admin/quiz-builder', { state: { courseId, courseName, isCourseQuiz: true } })}>
                        + New Test Set
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  {loading ? (
                    <div className="text-center py-5"><Spinner /></div>
                  ) : quizzes.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No test sets yet{isAdmin ? '' : ' — contact admin to create content'}.</p>
                      {isAdmin && (
                        <Button color="primary" size="sm"
                          onClick={() => navigate('/admin/quiz-builder', { state: { courseId, courseName, isCourseQuiz: true } })}>
                          Create First Test Set
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>#</th>
                            <th style={thStyle}>Title</th>
                            <th style={thStyle}>Topic</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Questions</th>
                            <th style={thStyle}>Duration</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Created By</th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quizzes.map((q, idx) => (
                            <tr key={q.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                              <td style={tdStyle}>{idx + 1}</td>
                              <td style={tdStyle}>
                                <span style={{ fontWeight: 600, color: '#32325d' }}>{q.title}</span>
                                {isAdmin && q.write_teacher_count > 0 && (
                                  <span style={{ marginLeft: 6, fontSize: 11, color: '#5e72e4', background: '#eef0fd', padding: '1px 7px', borderRadius: 8 }}>
                                    ✏️ {q.write_teacher_count} writer{q.write_teacher_count !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </td>
                              <td style={tdStyle}>{q.topic_name || <span className="text-muted">—</span>}</td>
                              <td style={tdStyle}>
                                <Badge color={q.quiz_type === 'test' ? 'danger' : 'primary'} style={{ fontSize: 10 }}>
                                  {q.quiz_type}
                                </Badge>
                              </td>
                              <td style={tdStyle}>{q.question_count}</td>
                              <td style={tdStyle}>{q.duration_minutes} min</td>
                              <td style={tdStyle}>
                                <Badge color={q.is_published ? 'success' : 'warning'}>
                                  {q.is_published ? 'Published' : 'Draft'}
                                </Badge>
                              </td>
                              <td style={tdStyle}>{q.creator_name || '—'}</td>
                              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {/* View as Student — always visible for staff */}
                                  <Button color="light" outline size="sm" style={{ borderRadius: 6, padding: '2px 8px', fontSize: 11 }}
                                    onClick={() => navigate(`/admin/quiz/${q.id}`, { state: { previewMode: true } })}>
                                    👁 Preview
                                  </Button>
                                  {/* Edit — admin always; teacher only if has per-quiz write */}
                                  {q.can_edit && (
                                    <Button color="info" outline size="sm" style={{ borderRadius: 6, padding: '2px 8px', fontSize: 11 }}
                                      onClick={() => navigate('/admin/quiz-builder', { state: { courseId, courseName, isCourseQuiz: true, editQuizId: q.id } })}>
                                      ✏️ Edit
                                    </Button>
                                  )}
                                  {/* Publish/Unpublish — admin only */}
                                  {isAdmin && (
                                    <Button color={q.is_published ? 'warning' : 'success'} outline size="sm"
                                      style={{ borderRadius: 6, padding: '2px 8px', fontSize: 11 }}
                                      onClick={() => handlePublish(q, !q.is_published)}>
                                      {q.is_published ? 'Unpublish' : 'Publish'}
                                    </Button>
                                  )}
                                  {/* Permissions — admin only */}
                                  {isAdmin && (
                                    <Button color="secondary" outline size="sm"
                                      style={{ borderRadius: 6, padding: '2px 8px', fontSize: 11 }}
                                      onClick={() => openPermissionsModal(q)}>
                                      Permissions
                                    </Button>
                                  )}
                                  {/* Delete — admin only */}
                                  {isAdmin && (
                                    <Button color="danger" outline size="sm"
                                      style={{ borderRadius: 6, padding: '2px 8px', fontSize: 11 }}
                                      onClick={() => setDeleteModal({ open: true, quiz: q })}>
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* Delete Confirmation Modal */}
        <Modal isOpen={deleteModal.open} toggle={() => setDeleteModal({ open: false, quiz: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteModal({ open: false, quiz: null })}>Confirm Delete</ModalHeader>
          <ModalBody className="text-center">
            <p>Delete <strong>{deleteModal.quiz?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDelete}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteModal({ open: false, quiz: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Per-quiz Write Permissions Modal (admin only) */}
        <Modal isOpen={permissionsModal.open} toggle={() => setPermissionsModal({ open: false, quiz: null })} size="lg" centered>
          <ModalHeader toggle={() => setPermissionsModal({ open: false, quiz: null })}>
            Write Permissions — {permissionsModal.quiz?.title}
          </ModalHeader>
          <ModalBody>
            <div style={{ background: '#eaf3ff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#32325d' }}>
              Teachers with write permission can append new questions to this test set. Admin must review and publish when ready.
            </div>
            {quizPermissionsLoading ? (
              <div className="text-center py-3"><Spinner size="sm" /></div>
            ) : permTeachers.length === 0 ? (
              <p className="text-muted text-center">No teachers in the system yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={thStyle}>Teacher</th>
                    <th style={thStyle}>Quiz Write</th>
                    <th style={thStyle}>Granted At</th>
                    <th style={thStyle}>Granted By</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permTeachers.map(t => {
                    const saving = permissionsSaving[t.id];
                    return (
                      <tr key={t.id}>
                        <td style={tdStyle}>{t.name}</td>
                        <td style={tdStyle}>
                          <Badge color={t.has_write ? 'success' : 'light'}>
                            {t.has_write ? 'Write' : 'None'}
                          </Badge>
                        </td>
                        <td style={tdStyle}>{t.granted_at ? new Date(t.granted_at).toLocaleDateString() : '—'}</td>
                        <td style={tdStyle}>{t.granted_by_name || '—'}</td>
                        <td style={tdStyle}>
                          {t.has_write ? (
                            <Button color="danger" outline size="sm" style={{ borderRadius: 6, fontSize: 11 }}
                              disabled={Boolean(saving)}
                              onClick={() => handleRevokeWrite(t.id)}>
                              {saving === 'revoke' ? <Spinner size="sm" /> : 'Revoke'}
                            </Button>
                          ) : (
                            <Button color="success" outline size="sm" style={{ borderRadius: 6, fontSize: 11 }}
                              disabled={Boolean(saving)}
                              onClick={() => handleGrantWrite(t.id)}>
                              {saving === 'grant' ? <Spinner size="sm" /> : 'Grant Write'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" outline onClick={() => setPermissionsModal({ open: false, quiz: null })}>Close</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
