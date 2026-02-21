import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Badge, Button, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

function statusBadge(status) {
  switch (status) {
    case 'LIVE':      return <Badge color="danger" className="live-blink">LIVE</Badge>;
    case 'TODAY':     return <Badge color="warning">TODAY</Badge>;
    case 'TOMORROW':  return <Badge color="info">TOMORROW</Badge>;
    case 'COMPLETED': return <Badge color="secondary">COMPLETED</Badge>;
    default:          return <Badge color="light">SCHEDULED</Badge>;
  }
}

function dueDateLabel(due_date) {
  if (!due_date) return null;
  const due = new Date(due_date);
  const now = new Date();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)   return <Badge color="danger">Overdue</Badge>;
  if (diffDays === 0) return <Badge color="warning">Due Today</Badge>;
  if (diffDays <= 3)  return <Badge color="warning">Due in {diffDays}d</Badge>;
  return <span className="text-muted small">Due {due.toLocaleDateString()}</span>;
}

export default function SubjectStudent() {
  const { subjectId } = useParams();
  const navigate      = useNavigate();

  const [tab,         setTab]         = useState('sessions');
  const [subject,     setSubject]     = useState(null);
  const [sessions,    setSessions]    = useState([]);
  const [quizzes,     setQuizzes]     = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [materials,   setMaterials]   = useState([]);

  // Assignment submit modal
  const [submitOpen,    setSubmitOpen]    = useState(false);
  const [submitTarget,  setSubmitTarget]  = useState(null);
  const [submitForm,    setSubmitForm]    = useState({ submission_url: '', notes: '' });
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [sessRes, classRes, quizRes, assignRes, matRes] = await Promise.all([
        http.get('/api/classes/my-sessions-v2'),
        http.get('/api/classes/my-classes-v2'),
        http.get(`/api/quizzes/subject/${subjectId}`),
        http.get(`/api/assignments/subject/${subjectId}`),
        http.get(`/api/materials/subject/${subjectId}`),
      ]);
      setSessions((sessRes.data || []).filter((s) => s.subject_id === subjectId));
      const found = (classRes.data || []).find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setQuizzes((quizRes.data || []).filter((q) => q.is_published));
      setAssignments(assignRes.data || []);
      setMaterials(matRes.data || []);
    } catch (err) {
      console.error('[SubjectStudent]', err);
    } finally {
      setLoading(false);
    }
  };

  const openSubmitModal = (assignment) => {
    setSubmitTarget(assignment);
    const existing = assignment.my_submission;
    setSubmitForm({
      submission_url: existing?.submission_url || '',
      notes:          existing?.notes || '',
    });
    setSubmitError('');
    setSubmitSuccess('');
    setSubmitOpen(true);
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!submitForm.submission_url && !submitForm.notes) {
      setSubmitError('Please provide a submission URL or notes');
      return;
    }
    setSubmitting(true);
    try {
      await http.post(`/api/assignments/${submitTarget.id}/submit`, submitForm);
      setSubmitSuccess('Submitted successfully!');
      fetchData();
      setTimeout(() => setSubmitOpen(false), 1200);
    } catch (err) {
      setSubmitError(err?.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const upcoming = sessions.filter((s) => s.status !== 'COMPLETED');
  const past     = sessions.filter((s) => s.status === 'COMPLETED');

  const TABS = [
    { key: 'sessions',    label: `Sessions (${sessions.length})` },
    { key: 'quizzes',     label: `Quizzes (${quizzes.length})` },
    { key: 'assignments', label: `Assignments (${assignments.length})` },
    { key: 'materials',   label: `Materials (${materials.length})` },
  ];

  if (loading) return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col><Card><CardBody className="text-center py-5"><p>Loading...</p></CardBody></Card></Col></Row>
      </Container>
    </>
  );

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        {/* Subject header */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12, borderLeft: '5px solid #11cdef' }}>
              <CardBody>
                <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#32325d' }}>{subject?.title || 'Subject'}</h2>
                    <div className="text-muted small mt-1">
                      <span className="mr-3">Course: {subject?.course_name}</span>
                      <Badge color="light">{subject?.code}</Badge>
                    </div>
                    {subject?.teacher_name && (
                      <div className="text-muted small mt-1">Teacher: {subject.teacher_name}</div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Tab nav */}
        <Row className="mb-3">
          <Col>
            <div style={{ display: 'flex', gap: 6 }}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13,
                  background: tab === t.key ? '#11cdef' : '#fff',
                  color: tab === t.key ? '#fff' : '#525f7f',
                  boxShadow: tab === t.key ? '0 4px 10px rgba(17,205,239,.3)' : '0 1px 3px rgba(0,0,0,.1)',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </Col>
        </Row>

        {/* ---- SESSIONS TAB ---- */}
        {tab === 'sessions' && (
          <Row>
            <Col lg="8">
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#e3f9fc', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <CardTitle className="mb-0">Sessions</CardTitle>
                </CardHeader>
                <CardBody>
                  {sessions.length === 0 ? (
                    <p className="text-muted text-center py-4">No sessions scheduled yet</p>
                  ) : (
                    <>
                      {upcoming.length > 0 && (
                        <>
                          <p className="text-xs font-weight-bold text-uppercase text-muted mb-2">Upcoming</p>
                          {upcoming.map((s) => (
                            <div key={s.id} className="p-3 mb-2 bg-white border rounded"
                              style={{ borderLeft: `3px solid ${s.status === 'LIVE' ? '#f5365c' : '#11cdef'}` }}>
                              <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
                                <div>
                                  <div className="d-flex align-items-center mb-1" style={{ gap: 8 }}>
                                    <strong>{s.title}</strong>{statusBadge(s.status)}
                                  </div>
                                  <div className="small text-muted">{new Date(s.scheduled_at).toLocaleString()}</div>
                                </div>
                                {s.status === 'LIVE' && s.zoom_link && (
                                  <a href={s.zoom_link} target="_blank" rel="noreferrer">
                                    <Button color="danger" size="sm" style={{ borderRadius: 8, fontWeight: 700 }}>
                                      Join Live
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {past.length > 0 && (
                        <>
                          <p className="text-xs font-weight-bold text-uppercase text-muted mt-3 mb-2">Past</p>
                          {past.map((s) => (
                            <div key={s.id} className="p-3 mb-2 bg-white border rounded" style={{ opacity: 0.7 }}>
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <strong>{s.title}</strong>
                                  <div className="small text-muted">{new Date(s.scheduled_at).toLocaleDateString()}</div>
                                </div>
                                {s.recording_url && (
                                  <a href={s.recording_url} target="_blank" rel="noreferrer">
                                    <Button color="primary" size="sm" outline style={{ borderRadius: 8 }}>Replay</Button>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* ---- QUIZZES TAB ---- */}
        {tab === 'quizzes' && (
          <Row>
            <Col>
              {quizzes.length === 0 ? (
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No quizzes published yet</p>
                  </CardBody>
                </Card>
              ) : (
                <Row>
                  {quizzes.map((q) => (
                    <Col key={q.id} lg="4" md="6" className="mb-4">
                      <Card className="shadow h-100" style={{ borderRadius: 12, borderTop: '4px solid #5e72e4' }}>
                        <CardBody style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ flex: 1 }}>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <h5 style={{ color: '#32325d', marginBottom: 4, lineHeight: 1.3 }}>{q.title}</h5>
                              <Badge color={q.quiz_type === 'test' ? 'danger' : 'info'} style={{ flexShrink: 0, marginLeft: 8, textTransform: 'capitalize' }}>
                                {q.quiz_type}
                              </Badge>
                            </div>
                            {q.description && <p className="text-muted small mb-3">{q.description}</p>}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                              {[
                                { icon: '❓', val: `${q.question_count} questions` },
                                { icon: '⏱', val: `${q.duration_minutes} mins` },
                                { icon: '✅', val: q.passing_score ? `${q.passing_score}% to pass` : 'No pass mark' },
                                { icon: '🔄', val: q.max_attempts ? `${q.max_attempts} attempts` : 'Unlimited' },
                              ].map((item) => (
                                <div key={item.icon} style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#525f7f' }}>
                                  {item.icon} {item.val}
                                </div>
                              ))}
                            </div>
                          </div>

                          <Button
                            color="primary"
                            style={{ borderRadius: 8, fontWeight: 700 }}
                            onClick={() => navigate(`/admin/quiz/${q.id}`)}
                          >
                            Attempt Quiz
                          </Button>
                        </CardBody>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Col>
          </Row>
        )}

        {/* ---- ASSIGNMENTS TAB ---- */}
        {tab === 'assignments' && (
          <Row>
            <Col>
              {assignments.length === 0 ? (
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No assignments yet</p>
                  </CardBody>
                </Card>
              ) : (
                assignments.map((a) => {
                  const sub = a.my_submission;
                  const isSubmitted = sub && sub.status !== 'pending';
                  const isGraded    = sub?.status === 'graded';

                  return (
                    <Card key={a.id} className="shadow mb-3" style={{ borderRadius: 12, borderLeft: `4px solid ${isGraded ? '#2dce89' : isSubmitted ? '#5e72e4' : '#fb6340'}` }}>
                      <CardBody>
                        <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div className="d-flex align-items-center" style={{ gap: 8, marginBottom: 4 }}>
                              <strong style={{ color: '#32325d', fontSize: 16 }}>{a.title}</strong>
                              {dueDateLabel(a.due_date)}
                            </div>
                            {a.description && <p className="text-muted small mb-2">{a.description}</p>}

                            <div className="d-flex align-items-center" style={{ gap: 16, flexWrap: 'wrap' }}>
                              <span className="small text-muted">Max marks: <strong>{a.max_marks}</strong></span>
                              {a.attachment_url && (
                                <a href={a.attachment_url} target="_blank" rel="noreferrer" className="small" style={{ color: '#5e72e4' }}>
                                  View Materials
                                </a>
                              )}
                            </div>

                            {/* Submission status */}
                            {isSubmitted && (
                              <div style={{ marginTop: 10, padding: '10px 14px', background: isGraded ? '#eafaf1' : '#eef0fd', borderRadius: 8 }}>
                                {isGraded ? (
                                  <div>
                                    <span style={{ fontWeight: 700, color: '#2dce89' }}>
                                      Graded: {sub.marks_awarded} / {a.max_marks}
                                    </span>
                                    {sub.feedback && <p className="small text-muted mb-0 mt-1">Feedback: {sub.feedback}</p>}
                                  </div>
                                ) : (
                                  <span style={{ fontWeight: 700, color: '#5e72e4' }}>Submitted — awaiting grade</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <span style={{
                              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: isGraded ? '#d4edda' : isSubmitted ? '#e8eeff' : '#fff3e0',
                              color: isGraded ? '#155724' : isSubmitted ? '#3d5af1' : '#e65100',
                            }}>
                              {isGraded ? 'Graded' : isSubmitted ? 'Submitted' : 'Not Submitted'}
                            </span>
                            <Button
                              color={isSubmitted ? 'secondary' : 'warning'}
                              size="sm"
                              style={{ borderRadius: 8, minWidth: 110 }}
                              onClick={() => openSubmitModal(a)}
                            >
                              {isSubmitted ? 'Edit Submission' : 'Submit'}
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </Col>
          </Row>
        )}

        {/* ---- MATERIALS TAB ---- */}
        {tab === 'materials' && (
          <Row>
            <Col>
              {materials.length === 0 ? (
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No materials uploaded yet. Check back later.</p>
                  </CardBody>
                </Card>
              ) : (
                <Row>
                  {materials.map((m) => {
                    const typeIcon  = { pdf: '📄', video: '🎥', link: '🔗', doc: '📝', image: '🖼' }[m.material_type] || '📁';
                    const typeColor = { pdf: '#f5365c', video: '#825ee4', link: '#5e72e4', doc: '#fb6340', image: '#2dce89' }[m.material_type] || '#8898aa';
                    return (
                      <Col key={m.id} md="6" lg="4" className="mb-3">
                        <a href={m.file_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          <Card className="shadow h-100" style={{ borderRadius: 12, borderTop: `3px solid ${typeColor}`, cursor: 'pointer', transition: 'transform 0.15s ease' }}
                            onMouseEnter={(e) => e.currentTarget.style.transform='translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform='translateY(0)'}>
                            <CardBody style={{ padding: 16 }}>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>{typeIcon}</div>
                              <h6 style={{ color: '#32325d', marginBottom: 4, lineHeight: 1.3 }}>{m.title}</h6>
                              {m.description && <p style={{ fontSize: 12, color: '#8898aa', marginBottom: 8 }}>{m.description}</p>}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: typeColor, fontWeight: 700, textTransform: 'uppercase', background: typeColor + '20', padding: '2px 8px', borderRadius: 10 }}>
                                  {m.material_type}
                                </span>
                                <span style={{ fontSize: 11, color: '#8898aa' }}>by {m.uploader_name}</span>
                              </div>
                            </CardBody>
                          </Card>
                        </a>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Col>
          </Row>
        )}

        {/* Submit Assignment Modal */}
        <Modal isOpen={submitOpen} toggle={() => setSubmitOpen(false)} centered>
          <ModalHeader toggle={() => setSubmitOpen(false)}>
            {submitTarget?.my_submission ? 'Update Submission' : 'Submit Assignment'}
          </ModalHeader>
          <ModalBody>
            <p style={{ fontWeight: 600, color: '#32325d', marginBottom: 16 }}>{submitTarget?.title}</p>
            <Form onSubmit={handleSubmitAssignment}>
              <FormGroup>
                <Label>Submission URL</Label>
                <Input
                  value={submitForm.submission_url}
                  onChange={(e) => setSubmitForm({ ...submitForm, submission_url: e.target.value })}
                  placeholder="https://docs.google.com/... or GitHub link"
                />
              </FormGroup>
              <FormGroup>
                <Label>Notes</Label>
                <Input
                  type="textarea"
                  rows={3}
                  value={submitForm.notes}
                  onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })}
                  placeholder="Any notes for your teacher..."
                />
              </FormGroup>
              {submitError   && <p className="text-danger small">{submitError}</p>}
              {submitSuccess && <p className="text-success small">{submitSuccess}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="warning" disabled={submitting} onClick={handleSubmitAssignment}>
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
            <Button color="link" onClick={() => setSubmitOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

      </Container>
      <style>{`
        @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .live-blink { animation: liveBlink 1s infinite; }
      `}</style>
    </>
  );
}
