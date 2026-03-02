import React, { useState, useEffect, useRef } from 'react';
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

  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const userId = (() => { try { return JSON.parse(window.localStorage.getItem('user') || '{}').id || null; } catch { return null; } })();
  const isAdmin = userRole === 'admin';

  const [tab,             setTab]             = useState('topics');
  const [subject,         setSubject]         = useState(null);
  const [sessions,        setSessions]        = useState([]);
  const [quizzes,         setQuizzes]         = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [startingSession, setStartingSession] = useState(null);
  const [actionError,     setActionError]     = useState('');
  const [deleteQuizModal,     setDeleteQuizModal]     = useState({ open: false, quiz: null });
  const [deleteSessionModal,  setDeleteSessionModal]  = useState({ open: false, session: null });
  const [deleteAssignModal,   setDeleteAssignModal]   = useState({ open: false, assign: null });
  const [deleteMatModal,      setDeleteMatModal]      = useState({ open: false, mat: null });

  // Schedule session modal
  const [scheduleOpen,  setScheduleOpen]  = useState(false);
  const [scheduleForm,  setScheduleForm]  = useState({ title: '', date: '', time: '', topicId: '' });
  const [scheduling,    setScheduling]    = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Create assignment modal
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [assignForm,   setAssignForm]   = useState({ title: '', description: '', due_date: '', max_marks: 100, attachment_url: '', topicId: '' });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError,  setAssignError]  = useState('');

  // Materials
  const [materials,    setMaterials]    = useState([]);
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [matForm,      setMatForm]      = useState({ title: '', description: '', material_type: 'link', file_url: '', topicId: '' });
  const [matSaving,    setMatSaving]    = useState(false);
  const [matError,     setMatError]     = useState('');

  // Submissions panel
  const [viewSubs,      setViewSubs]      = useState(null); // assignmentId
  const [submissions,   setSubmissions]   = useState([]);
  const [gradingId,     setGradingId]     = useState(null);
  const [gradeForm,     setGradeForm]     = useState({ marks: '', feedback: '' });

  // Topics
  const [topics,        setTopics]        = useState([]);
  const [topicModal,    setTopicModal]    = useState(false);
  const [editingTopic,  setEditingTopic]  = useState(null); // null = create, object = edit
  const [topicForm,     setTopicForm]     = useState({ name: '', description: '', order_index: 0 });
  const [topicSaving,   setTopicSaving]   = useState(false);
  const [topicError,    setTopicError]    = useState('');
  const [topicDeleting, setTopicDeleting] = useState(null);

  const errorCount = useRef(0);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => {
      if (errorCount.current >= 3) {
        clearInterval(iv);
        return;
      }
      fetchData();
    }, 60000);
    return () => clearInterval(iv);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [sessRes, classRes, quizRes, assignRes, matRes, topicsRes] = await Promise.all([
        http.get('/api/classes/my-sessions-v2'),
        http.get('/api/classes/my-classes-v2'),
        http.get(`/api/quizzes/subject/${subjectId}`),
        http.get(`/api/assignments/subject/${subjectId}`),
        http.get(`/api/materials/subject/${subjectId}`),
        http.get(`/api/subjects/${subjectId}/topics`),
      ]);
      setSessions((sessRes.data || []).filter((s) => s.subject_id === subjectId));
      const found = (classRes.data || []).find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setQuizzes(quizRes.data || []);
      setAssignments(assignRes.data || []);
      setMaterials(matRes.data || []);
      setTopics(topicsRes.data || []);
      errorCount.current = 0;
    } catch (err) {
      console.error('[SubjectTeacher]', err);
      errorCount.current += 1;
      if (errorCount.current >= 3) {
        console.warn('[polling] Stopped after 3 consecutive errors');
      }
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
    if (!scheduleForm.topicId) { setScheduleError('Topic is required'); return; }
    setScheduling(true);
    try {
      await http.post('/api/classes/sessions/create', {
        subjectId, title: scheduleForm.title,
        sessionDate: scheduleForm.date, startTime: scheduleForm.time + ':00+05:30',
        topicId: scheduleForm.topicId || undefined,
      });
      setScheduleOpen(false); setScheduleForm({ title: '', date: '', time: '', topicId: '' }); fetchData();
    } catch (err) {
      setScheduleError(err?.response?.data?.error || 'Failed to schedule');
    } finally { setScheduling(false); }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault(); setMatError('');
    if (!matForm.title || !matForm.file_url) { setMatError('Title and URL are required'); return; }
    if (!matForm.topicId) { setMatError('Topic is required'); return; }
    setMatSaving(true);
    try {
      await http.post('/api/materials', { subjectId, ...matForm, topicId: matForm.topicId || undefined });
      setMatModalOpen(false);
      setMatForm({ title: '', description: '', material_type: 'link', file_url: '', topicId: '' });
      fetchData();
    } catch (err) {
      setMatError(err?.response?.data?.error || 'Failed to add material');
    } finally { setMatSaving(false); }
  };

  const handleDeleteMaterial = async () => {
    if (!deleteMatModal.mat) return;
    try { await http.delete(`/api/materials/${deleteMatModal.mat.id}`); setDeleteMatModal({ open: false, mat: null }); fetchData(); }
    catch (err) { alert(err?.response?.data?.error || 'Failed to delete material'); }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionModal.session) return;
    try {
      await http.delete(`/api/classes/sessions/${deleteSessionModal.session.id}`);
      setDeleteSessionModal({ open: false, session: null }); fetchData();
    } catch (err) { alert(err?.response?.data?.error || 'Failed to delete session'); }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignModal.assign) return;
    try {
      await http.delete(`/api/assignments/${deleteAssignModal.assign.id}`);
      setDeleteAssignModal({ open: false, assign: null }); fetchData();
    } catch (err) { alert(err?.response?.data?.error || 'Failed to delete assignment'); }
  };

  const canEditItem = (item) => isAdmin || item.created_by === userId;
  const canEditMaterial = (m) => isAdmin || m.uploaded_by === userId;
  const canEditSession = (s) => isAdmin || s.teacher_id === userId;

  const canEditQuiz = (quiz) => {
    return isAdmin || quiz.created_by === userId;
  };

  const handleDeleteQuiz = async () => {
    if (!deleteQuizModal.quiz) return;
    try {
      await http.delete(`/api/quizzes/${deleteQuizModal.quiz.id}`);
      setDeleteQuizModal({ open: false, quiz: null });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete quiz');
    }
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
    if (!assignForm.topicId) { setAssignError('Topic is required'); return; }
    setAssignSaving(true);
    try {
      await http.post('/api/assignments', { subjectId, ...assignForm, max_marks: Number(assignForm.max_marks), topicId: assignForm.topicId || undefined });
      setAssignOpen(false); setAssignForm({ title: '', description: '', due_date: '', max_marks: 100, attachment_url: '', topicId: '' }); fetchData();
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

  // ---- Topics CRUD ----
  const openCreateTopic = () => {
    setEditingTopic(null);
    setTopicForm({ name: '', description: '', order_index: topics.length });
    setTopicError('');
    setTopicModal(true);
  };

  const openEditTopic = (topic) => {
    setEditingTopic(topic);
    setTopicForm({ name: topic.name, description: topic.description || '', order_index: topic.order_index });
    setTopicError('');
    setTopicModal(true);
  };

  const handleSaveTopic = async (e) => {
    e.preventDefault();
    setTopicError('');
    if (!topicForm.name.trim()) { setTopicError('Topic name is required'); return; }
    setTopicSaving(true);
    try {
      if (editingTopic) {
        await http.patch(`/api/subjects/${subjectId}/topics/${editingTopic.id}`, topicForm);
      } else {
        await http.post(`/api/subjects/${subjectId}/topics`, { ...topicForm, order_index: Number(topicForm.order_index) || 0 });
      }
      setTopicModal(false);
      fetchData();
    } catch (err) {
      setTopicError(err?.response?.data?.error || 'Failed to save topic');
    } finally {
      setTopicSaving(false);
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Delete this topic? Questions tagged to it will be untagged.')) return;
    setTopicDeleting(topicId);
    try {
      await http.delete(`/api/subjects/${subjectId}/topics/${topicId}`);
      fetchData();
    } catch (err) {
      console.error('[topic delete]', err);
    } finally {
      setTopicDeleting(null);
    }
  };

  const upcoming = sessions.filter((s) => s.status !== 'COMPLETED');
  const past     = sessions.filter((s) => s.status === 'COMPLETED');

  const TABS = [
    { key: 'topics',      label: `Topics (${topics.length})` },
    { key: 'sessions',    label: `Sessions (${sessions.length})` },
    { key: 'quizzes',     label: `Practice (${quizzes.length})` },
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
                      + Practice
                    </Button>
                    <Button color="warning" size="sm" style={{ borderRadius: 8 }} onClick={() => setAssignOpen(true)}>+ Assignment</Button>
                    <Button color="secondary" size="sm" style={{ borderRadius: 8 }} onClick={() => setMatModalOpen(true)}>+ Material</Button>
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

        {/* ---- TOPICS TAB ---- */}
        {tab === 'topics' && (
          <Row>
            <Col lg="8">
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#f0f4ff,#e8edff)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <CardTitle className="mb-0" style={{ color: '#32325d' }}>📚 Topics</CardTitle>
                      <small className="text-muted">Topics appear as the entry screen for students when they click this subject.</small>
                    </div>
                    {isAdmin && (
                      <Button color="primary" size="sm" style={{ borderRadius: 8, fontWeight: 700 }} onClick={openCreateTopic}>
                        + Add Topic
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  {topics.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                      <p className="text-muted mb-3">No topics yet. {isAdmin ? 'Add topics so students can navigate this subject.' : 'Contact admin to add topics.'}</p>
                      {isAdmin && <Button color="primary" size="sm" style={{ borderRadius: 8 }} onClick={openCreateTopic}>Add First Topic</Button>}
                    </div>
                  ) : (
                    <div>
                      {topics.map((topic, idx) => (
                        <div key={topic.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                          borderBottom: idx < topics.length - 1 ? '1px solid #f0f4f8' : 'none',
                          background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                        }}>
                          {/* Order badge */}
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg,#5e72e4,#825ee4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: 13,
                          }}>
                            {idx + 1}
                          </div>
                          {/* Topic info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#32325d', fontSize: 14 }}>{topic.name}</div>
                            {topic.description && (
                              <div className="text-muted small mt-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {topic.description}
                              </div>
                            )}
                          </div>
                          {/* Actions - Admin only */}
                          {isAdmin && (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11, padding: '3px 12px' }}
                                onClick={() => openEditTopic(topic)}>
                                ✏️ Edit
                              </Button>
                              <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11, padding: '3px 12px' }}
                                disabled={topicDeleting === topic.id}
                                onClick={() => handleDeleteTopic(topic.id)}>
                                {topicDeleting === topic.id ? '...' : '🗑 Delete'}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Info box */}
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#eef0fd', borderRadius: 10, border: '1px solid #d1d8f8' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>💡</span>
                  <div style={{ fontSize: 13, color: '#525f7f' }}>
                    <strong>How topics work:</strong> When a student clicks this subject in the sidebar, they first see the topic grid.
                    Clicking a topic takes them to sessions, practice quizzes, assignments, and materials.
                    Topics can also be tagged to individual quiz questions in the Quiz Builder.
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        )}

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
                                {s.topic_name && (
                                  <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {s.topic_name}</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {canEditSession(s) && s.status !== 'LIVE' && (
                                  <Button size="sm" color="danger" outline style={{ borderRadius: 8, fontSize: 11 }}
                                    onClick={() => setDeleteSessionModal({ open: true, session: s })}>
                                    Delete
                                  </Button>
                                )}
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
                          </div>
                        ))}
                      </>}
                      {past.length > 0 && <>
                        <p className="text-xs font-weight-bold text-uppercase text-muted mt-3 mb-2">Past</p>
                        {past.map((s) => (
                          <div key={s.id} className="p-3 mb-2 bg-white border rounded" style={{ opacity: 0.7 }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <strong>{s.title}</strong>
                                <span className="small text-muted ml-2">{new Date(s.scheduled_at).toLocaleDateString()}</span>
                                {s.topic_name && (
                                  <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {s.topic_name}</span>
                                )}
                              </div>
                              {canEditSession(s) && (
                                <Button size="sm" color="danger" outline style={{ borderRadius: 8, fontSize: 11 }}
                                  onClick={() => setDeleteSessionModal({ open: true, session: s })}>
                                  Delete
                                </Button>
                              )}
                            </div>
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
                    <CardTitle className="mb-0">Practice Sets</CardTitle>
                    <Button color="primary" size="sm" style={{ borderRadius: 8 }}
                      onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                      + Create Practice Set
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  {quizzes.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No practice sets yet</p>
                      <Button color="primary" size="sm"
                        onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                        Create First Practice Set
                      </Button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          {['Title', 'Topic', 'Creator', 'Questions', 'Duration', 'Status', 'Actions'].map((h) => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((q) => (
                          <tr key={q.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>{q.title}</td>
                            <td style={{ padding: '12px 14px' }}>
                              {q.topic_name
                                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {q.topic_name}</span>
                                : <span className="text-muted small">—</span>}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 12 }}>{q.creator_name || '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.question_count}</td>
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.duration_minutes ? `${q.duration_minutes}m` : '∞'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: q.is_published ? '#d4edda' : '#fff3cd',
                                color: q.is_published ? '#155724' : '#856404' }}>
                                {q.is_published ? 'Published' : 'Draft'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {canEditQuiz(q) && (
                                  <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11 }}
                                    onClick={() => navigate('/admin/quiz-builder', {
                                      state: { subjectId, subjectName: subject?.title, editQuizId: q.id }
                                    })}>
                                    Edit
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button size="sm" color={q.is_published ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 11 }}
                                    onClick={() => toggleQuizPublish(q.id, q.is_published)}>
                                    {q.is_published ? 'Unpublish' : 'Publish'}
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11 }}
                                    onClick={() => setDeleteQuizModal({ open: true, quiz: q })}>
                                    Delete
                                  </Button>
                                )}
                              </div>
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
                              {a.topic_name && (
                                <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {a.topic_name}</span>
                              )}
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
                              {canEditItem(a) && (
                                <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11 }}
                                  onClick={() => setDeleteAssignModal({ open: true, assign: a })}>
                                  Delete
                                </Button>
                              )}
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

        {/* ---- MATERIALS TAB ---- */}
        {tab === 'materials' && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <CardTitle className="mb-0">Study Materials</CardTitle>
                    <Button color="secondary" size="sm" style={{ borderRadius: 8 }} onClick={() => setMatModalOpen(true)}>
                      + Add Material
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  {materials.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No materials yet. Add PDFs, videos, or links.</p>
                      <Button color="secondary" size="sm" onClick={() => setMatModalOpen(true)}>Add First Material</Button>
                    </div>
                  ) : (
                    materials.map((m) => {
                      const typeIcon = { pdf: '📄', video: '🎥', link: '🔗', doc: '📝', image: '🖼' }[m.material_type] || '📁';
                      const typeColor = { pdf: '#f5365c', video: '#825ee4', link: '#5e72e4', doc: '#fb6340', image: '#2dce89' }[m.material_type] || '#8898aa';
                      return (
                        <div key={m.id} className="d-flex align-items-center mb-3 p-3 bg-white border rounded" style={{ borderLeft: `3px solid ${typeColor}`, gap: 12 }}>
                          <div style={{ fontSize: 24, flexShrink: 0 }}>{typeIcon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a href={m.file_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: '#32325d', display: 'block' }}>{m.title}</a>
                            {m.description && <p className="small text-muted mb-0 mt-1">{m.description}</p>}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: typeColor, fontWeight: 700, textTransform: 'uppercase', background: typeColor + '20', padding: '2px 8px', borderRadius: 10 }}>{m.material_type}</span>
                              {m.topic_name && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {m.topic_name}</span>
                              )}
                            </div>
                          </div>
                          {canEditMaterial(m) && (
                            <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11, flexShrink: 0 }}
                              onClick={() => setDeleteMatModal({ open: true, mat: m })}>Remove</Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
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
              <FormGroup>
                <Label>Topic <span className="text-danger">*</span></Label>
                <Input type="select" value={scheduleForm.topicId} onChange={(e) => setScheduleForm({ ...scheduleForm, topicId: e.target.value })}>
                  <option value="">— Select topic —</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Input>
              </FormGroup>
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
              <FormGroup>
                <Label>Topic <span className="text-danger">*</span></Label>
                <Input type="select" value={assignForm.topicId} onChange={(e) => setAssignForm({ ...assignForm, topicId: e.target.value })}>
                  <option value="">— Select topic —</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Input>
              </FormGroup>
              {assignError && <p className="text-danger small">{assignError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="warning" disabled={assignSaving} onClick={handleCreateAssignment}>{assignSaving ? 'Creating...' : 'Create Assignment'}</Button>
            <Button color="link" onClick={() => setAssignOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

      {/* Topic Create / Edit Modal */}
        <Modal isOpen={topicModal} toggle={() => setTopicModal(false)} centered>
          <ModalHeader toggle={() => setTopicModal(false)}>
            {editingTopic ? 'Edit Topic' : 'Add New Topic'}
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSaveTopic}>
              <FormGroup>
                <Label>Topic Name *</Label>
                <Input
                  value={topicForm.name}
                  onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                  placeholder="e.g. Algebra — Quadratic Equations"
                  autoFocus
                />
              </FormGroup>
              <FormGroup>
                <Label>Description <span className="text-muted small">(optional)</span></Label>
                <Input
                  type="textarea"
                  rows={2}
                  value={topicForm.description}
                  onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                  placeholder="Brief description of this topic..."
                />
              </FormGroup>
              <FormGroup>
                <Label>Order / Position</Label>
                <Input
                  type="number"
                  min={0}
                  value={topicForm.order_index}
                  onChange={(e) => setTopicForm({ ...topicForm, order_index: Number(e.target.value) })}
                  style={{ maxWidth: 100 }}
                />
                <small className="text-muted">Lower number = appears first (0 = top)</small>
              </FormGroup>
              {topicError && <p className="text-danger small mb-0">{topicError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" disabled={topicSaving} onClick={handleSaveTopic} style={{ borderRadius: 8, fontWeight: 700 }}>
              {topicSaving ? 'Saving...' : editingTopic ? 'Save Changes' : 'Add Topic'}
            </Button>
            <Button color="link" onClick={() => setTopicModal(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

      {/* Add Material Modal */}
        <Modal isOpen={matModalOpen} toggle={() => setMatModalOpen(false)} centered>
          <ModalHeader toggle={() => setMatModalOpen(false)}>Add Study Material</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleAddMaterial}>
              <FormGroup><Label>Title *</Label><Input value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} placeholder="e.g. Chapter 3 Notes" /></FormGroup>
              <FormGroup><Label>Type</Label>
                <Input type="select" value={matForm.material_type} onChange={(e) => setMatForm({ ...matForm, material_type: e.target.value })}>
                  <option value="link">Link</option>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="doc">Document</option>
                  <option value="image">Image</option>
                </Input>
              </FormGroup>
              <FormGroup><Label>URL *</Label><Input value={matForm.file_url} onChange={(e) => setMatForm({ ...matForm, file_url: e.target.value })} placeholder="https://..." /></FormGroup>
              <FormGroup><Label>Description</Label><Input type="textarea" rows={2} value={matForm.description} onChange={(e) => setMatForm({ ...matForm, description: e.target.value })} placeholder="Optional..." /></FormGroup>
              <FormGroup>
                <Label>Topic <span className="text-danger">*</span></Label>
                <Input type="select" value={matForm.topicId} onChange={(e) => setMatForm({ ...matForm, topicId: e.target.value })}>
                  <option value="">— Select topic —</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Input>
              </FormGroup>
              {matError && <p className="text-danger small">{matError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" disabled={matSaving} onClick={handleAddMaterial}>{matSaving ? 'Adding...' : 'Add Material'}</Button>
            <Button color="link" onClick={() => setMatModalOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Quiz Confirmation Modal */}
        <Modal isOpen={deleteQuizModal.open} toggle={() => setDeleteQuizModal({ open: false, quiz: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteQuizModal({ open: false, quiz: null })}>
            Confirm Delete
          </ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Are you sure you want to delete <strong>{deleteQuizModal.quiz?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteQuiz}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteQuizModal({ open: false, quiz: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Session Confirmation Modal */}
        <Modal isOpen={deleteSessionModal.open} toggle={() => setDeleteSessionModal({ open: false, session: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteSessionModal({ open: false, session: null })}>Confirm Delete Session</ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Delete session <strong>{deleteSessionModal.session?.title}</strong>?</p>
            <p className="text-muted small">This will mark the session as cancelled.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteSession}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteSessionModal({ open: false, session: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Assignment Confirmation Modal */}
        <Modal isOpen={deleteAssignModal.open} toggle={() => setDeleteAssignModal({ open: false, assign: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteAssignModal({ open: false, assign: null })}>Confirm Delete Assignment</ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Delete assignment <strong>{deleteAssignModal.assign?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteAssignment}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteAssignModal({ open: false, assign: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Material Confirmation Modal */}
        <Modal isOpen={deleteMatModal.open} toggle={() => setDeleteMatModal({ open: false, mat: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteMatModal({ open: false, mat: null })}>Confirm Remove Material</ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Remove <strong>{deleteMatModal.mat?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteMaterial}>Yes, Remove</Button>
            <Button color="secondary" outline onClick={() => setDeleteMatModal({ open: false, mat: null })}>Cancel</Button>
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
