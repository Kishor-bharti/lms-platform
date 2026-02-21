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

export default function SubjectTeacher() {
  const { subjectId } = useParams();
  const navigate = useNavigate();

  const [tab,             setTab]             = useState('sessions');
  const [subject,         setSubject]         = useState(null);
  const [sessions,        setSessions]        = useState([]);
  const [quizzes,         setQuizzes]         = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [startingSession, setStartingSession] = useState(null);
  const [actionError,     setActionError]     = useState('');

  // Schedule session modal
  const [scheduleOpen,  setScheduleOpen]  = useState(false);
  const [scheduleForm,  setScheduleForm]  = useState({ title: '', date: '', time: '' });
  const [scheduling,    setScheduling]    = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Create assignment modal
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [assignForm,   setAssignForm]   = useState({ title: '', description: '', due_date: '', max_marks: 100, attachment_url: '' });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError,  setAssignError]  = useState('');

  // Submissions panel
  const [viewSubs,      setViewSubs]      = useState(null); // assignmentId
  const [submissions,   setSubmissions]   = useState([]);
  const [gradingId,     setGradingId]     = useState(null);
  const [gradeForm,     setGradeForm]     = useState({ marks: '', feedback: '' });

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [sessRes, classRes, quizRes, assignRes] = await Promise.all([
        http.get('/api/classes/my-sessions-v2'),
        http.get('/api/classes/my-classes-v2'),
        http.get(`/api/quizzes/subject/${subjectId}`),
        http.get(`/api/assignments/subject/${subjectId}`),
      ]);
      setSessions((sessRes.data || []).filter((s) => s.subject_id === subjectId));
      const found = (classRes.data || []).find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setQuizzes(quizRes.data || []);
      setAssignments(assignRes.data || []);
    } catch (err) {
      console.error('[SubjectTeacher]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (sessionId) => {
    setStartingSession(sessionId); setActionError('');
    try {
      const res = await http.post(`/api/classes/sessions/${sessionId}/start`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? res.data : s));
      const url = res.data?.start_url || res.data?.zoom_link;
      if (url) window.open(url, '_blank');
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Failed to start session');
    } finally { setStartingSession(null); }
  };

  const handleEnd = async (sessionId) => {
    setStartingSession(sessionId); setActionError('');
    try {
      const res = await http.post(`/api/classes/sessions/${sessionId}/complete`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? res.data : s));
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Failed to end session');
    } finally { setStartingSession(null); }
  };

  const handleSchedule = async (e) => {
    e.preventDefault(); setScheduleError('');
    if (!scheduleForm.title || !scheduleForm.date || !scheduleForm.time) {
      setScheduleError('All fields are required'); return;
    }
    setScheduling(true);
    try {
      await http.post('/api/classes/sessions/create', {
        subjectId, title: scheduleForm.title,
        sessionDate: scheduleForm.date, startTime: scheduleForm.time + ':00+05:30',
      });
      setScheduleOpen(false); setScheduleForm({ title: '', date: '', time: '' }); fetchData();
    } catch (err) {
      setScheduleError(err?.response?.data?.error || 'Failed to schedule');
    } finally { setScheduling(false); }
  };

  const toggleQuizPublish = async (quizId, current) => {
    try {
      await http.patch(`/api/quizzes/${quizId}/publish`, { is_published: !current });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault(); setAssignError('');
    if (!assignForm.title) { setAssignError('Title is required'); return; }
    setAssignSaving(true);
    try {
      await http.post('/api/assignments', { subjectId, ...assignForm, max_marks: Number(assignForm.max_marks) });
      setAssignOpen(false); setAssignForm({ title: '', description: '', due_date: '', max_marks: 100, attachment_url: '' }); fetchData();
    } catch (err) {
      setAssignError(err?.response?.data?.error || 'Failed to create assignment');
    } finally { setAssignSaving(false); }
  };

  const toggleAssignPublish = async (assignId, current) => {
    try {
      await http.patch(`/api/assignments/${assignId}/publish`, { is_published: !current });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const loadSubmissions = async (assignId) => {
    setViewSubs(assignId); setGradingId(null);
    const res = await http.get(`/api/assignments/${assignId}/submissions`);
    setSubmissions(res.data || []);
  };

  const handleGrade = async (subId) => {
    try {
      await http.patch(`/api/assignments/submissions/${subId}/grade`, {
        marks_awarded: Number(gradeForm.marks), feedback: gradeForm.feedback,
      });
      setGradingId(null); setGradeForm({ marks: '', feedback: '' });
      loadSubmissions(viewSubs);
    } catch (err) { console.error(err); }
  };

  const upcoming = sessions.filter((s) => s.status !== 'COMPLETED');
  const past     = sessions.filter((s) => s.status === 'COMPLETED');

  const TABS = [
    { key: 'sessions',    label: `Sessions (${sessions.length})` },
    { key: 'quizzes',     label: `Quizzes (${quizzes.length})` },
    { key: 'assignments', label: `Assignments (${assignments.length})` },
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
            <Card className="shadow" style={{ borderRadius: 12, borderLeft: '5px solid #fb6340' }}>
              <CardBody>
                <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#32325d' }}>{subject?.title || 'Subject'}</h2>
                    <div className="text-muted small mt-1">
                      <span className="mr-3">Course: {subject?.course_name}</span>
                      <Badge color="light">{subject?.code}</Badge>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button color="success" size="sm" style={{ borderRadius: 8 }} onClick={() => setScheduleOpen(true)}>+ Session</Button>
                    <Button color="primary" size="sm" style={{ borderRadius: 8 }}
                      onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                      + Quiz
                    </Button>
                    <Button color="warning" size="sm" style={{ borderRadius: 8 }} onClick={() => setAssignOpen(true)}>+ Assignment</Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {actionError && <Row className="mb-2"><Col><div className="alert alert-danger py-2">{actionError}</div></Col></Row>}

        {/* Tab nav */}
        <Row className="mb-3">
          <Col>
            <div style={{ display: 'flex', gap: 6 }}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13,
                  background: tab === t.key ? '#5e72e4' : '#fff',
                  color: tab === t.key ? '#fff' : '#525f7f',
                  boxShadow: tab === t.key ? '0 4px 10px rgba(94,114,228,.3)' : '0 1px 3px rgba(0,0,0,.1)',
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
            <Col lg="8" className="mb-4">
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <CardTitle className="mb-0">Sessions</CardTitle>
                </CardHeader>
                <CardBody>
                  {sessions.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No sessions yet</p>
                      <Button color="success" size="sm" onClick={() => setScheduleOpen(true)}>Schedule First</Button>
                    </div>
                  ) : (
                    <>
                      {upcoming.length > 0 && <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mb-2">Upcoming</p>
                        {upcoming.map((s) => (
                          <div key={s.id} className="p-3 mb-2 bg-white border rounded"
                            style={{ borderLeft: `3px solid ${s.status === 'LIVE' ? '#f5365c' : '#fb6340'}` }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <div className="d-flex align-items-center mb-1" style={{ gap: 8 }}>
                                  <strong>{s.title}</strong>{statusBadge(s.status)}
                                </div>
                                <div className="small text-muted">{new Date(s.scheduled_at).toLocaleString()}</div>
                              </div>
                              <button
                                disabled={startingSession === s.id}
                                onClick={() => s.status === 'LIVE' ? handleEnd(s.id) : handleStart(s.id)}
                                style={{
                                  border: 'none', borderRadius: 6, padding: '7px 16px',
                                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                  background: s.status === 'LIVE' ? '#f5365c' : '#2dce89', color: '#fff',
                                }}>
                                {startingSession === s.id ? '...' : s.status === 'LIVE' ? 'End Session' : 'Start Live Session'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </>}
                      {past.length > 0 && <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mt-3 mb-2">Past</p>
                        {past.map((s) => (
                          <div key={s.id} className="p-3 mb-2 bg-white border rounded" style={{ opacity: 0.7 }}>
                            <strong>{s.title}</strong>
                            <span className="small text-muted ml-2">{new Date(s.scheduled_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </>}
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
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <CardTitle className="mb-0">Quizzes</CardTitle>
                    <Button color="primary" size="sm" style={{ borderRadius: 8 }}
                      onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                      + Create Quiz
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  {quizzes.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No quizzes yet</p>
                      <Button color="primary" size="sm"
                        onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                        Create First Quiz
                      </Button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          {['Title', 'Type', 'Questions', 'Duration', 'Passing', 'Status', 'Actions'].map((h) => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((q) => (
                          <tr key={q.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>{q.title}</td>
                            <td style={{ padding: '12px 14px' }}><Badge color="light" style={{ textTransform: 'capitalize' }}>{q.quiz_type}</Badge></td>
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.question_count}</td>
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.duration_minutes}m</td>
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.passing_score ? `${q.passing_score}%` : 'N/A'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: q.is_published ? '#d4edda' : '#fff3cd',
                                color: q.is_published ? '#155724' : '#856404' }}>
                                {q.is_published ? 'Published' : 'Draft'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <Button size="sm" color={q.is_published ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 11 }}
                                onClick={() => toggleQuizPublish(q.id, q.is_published)}>
                                {q.is_published ? 'Unpublish' : 'Publish'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* ---- ASSIGNMENTS TAB ---- */}
        {tab === 'assignments' && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <CardTitle className="mb-0">Assignments</CardTitle>
                    <Button color="warning" size="sm" style={{ borderRadius: 8 }} onClick={() => setAssignOpen(true)}>
                      + Create Assignment
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  {assignments.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No assignments yet</p>
                      <Button color="warning" size="sm" onClick={() => setAssignOpen(true)}>Create First</Button>
                    </div>
                  ) : (
                    <>
                      {assignments.map((a) => (
                        <div key={a.id} className="mb-3 p-3 bg-white border rounded" style={{ borderLeft: '3px solid #fb6340' }}>
                          <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 8 }}>
                            <div>
                              <strong style={{ color: '#32325d' }}>{a.title}</strong>
                              {a.description && <p className="small text-muted mb-1 mt-1">{a.description}</p>}
                              <div className="small text-muted">
                                <span className="mr-3">Max marks: {a.max_marks}</span>
                                {a.due_date && <span>Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                                <span className="ml-3">Submissions: {a.submission_count || 0}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11 }}
                                onClick={() => loadSubmissions(a.id)}>
                                View Submissions
                              </Button>
                              <Button size="sm" color={a.is_published ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 11 }}
                                onClick={() => toggleAssignPublish(a.id, a.is_published)}>
                                {a.is_published ? 'Unpublish' : 'Publish'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardBody>
              </Card>

              {/* Submissions panel */}
              {viewSubs && (
                <Card className="shadow mt-4" style={{ borderRadius: 12 }}>
                  <CardHeader style={{ background: '#fff5e6', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <CardTitle className="mb-0">Submissions</CardTitle>
                      <Button size="sm" color="link" onClick={() => setViewSubs(null)}>Close</Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {submissions.length === 0 ? (
                      <p className="text-muted text-center py-3">No submissions yet</p>
                    ) : submissions.map((sub) => (
                      <div key={sub.id} className="mb-3 p-3 bg-white border rounded">
                        <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 8 }}>
                          <div>
                            <strong>{sub.student_name}</strong>
                            <div className="small text-muted">{sub.student_email}</div>
                            {sub.submission_url && (
                              <a href={sub.submission_url} target="_blank" rel="noreferrer" className="small" style={{ color: '#5e72e4' }}>View Submission</a>
                            )}
                            {sub.notes && <p className="small text-muted mt-1 mb-0">{sub.notes}</p>}
                            {sub.marks_awarded != null && (
                              <div className="small mt-1">
                                <strong>Marks: {sub.marks_awarded}</strong>
                                {sub.feedback && <span className="text-muted ml-2">— {sub.feedback}</span>}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: sub.status === 'graded' ? '#d4edda' : '#fff3cd',
                              color: sub.status === 'graded' ? '#155724' : '#856404' }}>
                              {sub.status}
                            </span>
                            {sub.status === 'submitted' && (
                              <Button size="sm" color="success" outline style={{ borderRadius: 20, fontSize: 11 }}
                                onClick={() => { setGradingId(sub.id); setGradeForm({ marks: '', feedback: '' }); }}>
                                Grade
                              </Button>
                            )}
                          </div>
                        </div>
                        {gradingId === sub.id && (
                          <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
                            <Row>
                              <Col md="4">
                                <FormGroup className="mb-2">
                                  <Label className="small">Marks Awarded</Label>
                                  <Input type="number" bsSize="sm" value={gradeForm.marks}
                                    onChange={(e) => setGradeForm({ ...gradeForm, marks: e.target.value })} />
                                </FormGroup>
                              </Col>
                              <Col md="8">
                                <FormGroup className="mb-2">
                                  <Label className="small">Feedback</Label>
                                  <Input bsSize="sm" value={gradeForm.feedback}
                                    onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
                                </FormGroup>
                              </Col>
                            </Row>
                            <Button size="sm" color="success" style={{ borderRadius: 8 }} onClick={() => handleGrade(sub.id)}>Submit Grade</Button>
                            <Button size="sm" color="link" onClick={() => setGradingId(null)}>Cancel</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardBody>
                </Card>
              )}
            </Col>
          </Row>
        )}

        {/* Schedule Session Modal */}
        <Modal isOpen={scheduleOpen} toggle={() => setScheduleOpen(false)} centered>
          <ModalHeader toggle={() => setScheduleOpen(false)}>Schedule New Session</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSchedule}>
              <FormGroup><Label>Title</Label><Input value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} placeholder="e.g. Algebra Basics" /></FormGroup>
              <FormGroup><Label>Date</Label><Input type="date" value={scheduleForm.date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })} /></FormGroup>
              <FormGroup><Label>Start Time</Label><Input type="time" value={scheduleForm.time} onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })} /></FormGroup>
              {scheduleError && <p className="text-danger small">{scheduleError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={scheduling} onClick={handleSchedule}>{scheduling ? 'Scheduling...' : 'Schedule'}</Button>
            <Button color="link" onClick={() => setScheduleOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Create Assignment Modal */}
        <Modal isOpen={assignOpen} toggle={() => setAssignOpen(false)} centered>
          <ModalHeader toggle={() => setAssignOpen(false)}>Create Assignment</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleCreateAssignment}>
              <FormGroup><Label>Title *</Label><Input value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })} placeholder="Assignment title" /></FormGroup>
              <FormGroup><Label>Description</Label><Input type="textarea" rows={2} value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} /></FormGroup>
              <Row>
                <Col md="6"><FormGroup><Label>Due Date</Label><Input type="datetime-local" value={assignForm.due_date} onChange={(e) => setAssignForm({ ...assignForm, due_date: e.target.value })} /></FormGroup></Col>
                <Col md="6"><FormGroup><Label>Max Marks</Label><Input type="number" value={assignForm.max_marks} onChange={(e) => setAssignForm({ ...assignForm, max_marks: e.target.value })} /></FormGroup></Col>
              </Row>
              <FormGroup><Label>Attachment URL</Label><Input value={assignForm.attachment_url} onChange={(e) => setAssignForm({ ...assignForm, attachment_url: e.target.value })} placeholder="https://..." /></FormGroup>
              {assignError && <p className="text-danger small">{assignError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="warning" disabled={assignSaving} onClick={handleCreateAssignment}>{assignSaving ? 'Creating...' : 'Create Assignment'}</Button>
            <Button color="link" onClick={() => setAssignOpen(false)}>Cancel</Button>
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
