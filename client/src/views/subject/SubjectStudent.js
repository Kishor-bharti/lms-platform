import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Badge, Button, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { withTimeZoneQuery } from 'utils/date';
import { TopicCardSkeleton } from 'components/Skeleton.js';

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
  return <span className="text-muted small">Due {due.toLocaleDateString('en-US')}</span>;
}

export default function SubjectStudent() {
  const { subjectId } = useParams();
  const navigate      = useNavigate();

  const [tab,             setTab]             = useState('sessions');
  const [subject,         setSubject]         = useState(null);
  const [sessions,        setSessions]        = useState([]);
  const [sessionDateStr,  setSessionDateStr]  = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [sessStatusFilter, setSessStatusFilter] = useState('all');
  const [sessTopicFilter,  setSessTopicFilter]  = useState('all');
  const [quizzes,     setQuizzes]     = useState([]);
  const [quizStatuses, setQuizStatuses] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [materials,   setMaterials]   = useState([]);
  const [topics,      setTopics]      = useState([]);
  const [topicView,   setTopicView]   = useState(null);

  // Assignment submit modal
  const [submitOpen,       setSubmitOpen]       = useState(false);
  const [submitTarget,     setSubmitTarget]      = useState(null);
  const [submitForm,       setSubmitForm]        = useState({ submission_url: '', notes: '' });
  const [submitting,       setSubmitting]        = useState(false);
  const [submitError,      setSubmitError]       = useState('');
  const [submitSuccess,    setSubmitSuccess]     = useState('');
  const [submitUploading,  setSubmitUploading]   = useState(false);
  const [submitFileName,   setSubmitFileName]    = useState('');
  const submitFileRef = useRef(null);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [sessRes, classRes, quizRes, assignRes, matRes, topicsRes] = await Promise.all([
        http.get(withTimeZoneQuery('/api/classes/my-sessions-v2')),
        http.get('/api/classes/my-classes-v2'),
        http.get(`/api/quizzes/subject/${subjectId}`),
        http.get(`/api/assignments/subject/${subjectId}`),
        http.get(`/api/materials/subject/${subjectId}`),
        http.get(`/api/subjects/${subjectId}/topics`),
      ]);
      setSessions((sessRes.data || []).filter((s) => s.subject_id === subjectId));
      const found = (classRes.data || []).find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setQuizzes((quizRes.data || []).filter((q) => q.is_published));
      setAssignments(assignRes.data || []);
      setMaterials(matRes.data || []);
      setTopics(topicsRes.data || []);
      // Fetch attempt status for all quizzes in one call
      try {
        const statusRes = await http.get(`/api/quizzes/subject/${subjectId}/status`);
        setQuizStatuses(statusRes.data || {});
      } catch (_) {}
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
    setSubmitFileName(existing?.submission_url ? '(previously uploaded)' : '');
    setSubmitError('');
    setSubmitSuccess('');
    setSubmitOpen(true);
  };

  const handleSubmitFileUpload = async (file) => {
    if (!file) return;
    setSubmitUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await http.post('/api/upload/assignment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitForm(f => ({ ...f, submission_url: res.data.url }));
      setSubmitFileName(res.data.name || file.name);
    } catch (err) {
      setSubmitError(err?.response?.data?.error || 'File upload failed');
    } finally {
      setSubmitUploading(false);
    }
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!submitForm.submission_url && !submitForm.notes) {
      setSubmitError('Please upload a file or add notes');
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

  const allSessions = sessions.filter((s) => !topicView || s.topic_id === topicView.id);

  const formatTimetz = (timetz) => {
    if (!timetz) return '';
    const [h, m] = timetz.slice(0, 5).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const navSessionDate = (offset) => {
    const [yr, mo, dy] = sessionDateStr.split('-').map(Number);
    const d = new Date(yr, mo - 1, dy + offset);
    setSessionDateStr(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const sessionDaySessions = allSessions
    .filter(s => (s.session_date || s.scheduled_at?.slice(0, 10)) === sessionDateStr)
    .filter(s => sessStatusFilter === 'all' || s.status   === sessStatusFilter)
    .filter(s => sessTopicFilter  === 'all' || s.topic_id === sessTopicFilter)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const allPracticeQuizzes = quizzes.filter(q => q.quiz_type === 'practice');
  const practiceQuizzes = allPracticeQuizzes.filter(q => !topicView || q.topic_id === topicView.id);
  const filteredAssignments = topicView ? assignments.filter(a => a.topic_id === topicView.id) : assignments;
  const filteredMaterials   = topicView ? materials.filter(m => m.topic_id === topicView.id) : materials;

  const TABS = [
    { key: 'sessions',    label: `Sessions (${allSessions.length})` },
    { key: 'quizzes',     label: `Practice (${practiceQuizzes.length})` },
    { key: 'assignments', label: `Assignments (${filteredAssignments.length})` },
    { key: 'materials',   label: `Materials (${filteredMaterials.length})` },
  ];

  if (loading) return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col><Card><CardBody className="py-4"><TopicCardSkeleton count={6} /></CardBody></Card></Col></Row>
      </Container>
    </>
  );

  // ---- TOPICS LIST VIEW ----
  if (!topicView) {
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

          {/* Topics grid */}
          <Row className="mb-3">
            <Col>
              <h4 style={{ color: '#32325d', marginBottom: 16 }}>📚 Topics</h4>
            </Col>
          </Row>
          <Row>
            {topics.length === 0 ? (
              <Col>
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                    <p className="text-muted">No topics available yet for this subject.</p>
                  </CardBody>
                </Card>
              </Col>
            ) : (
              topics.map(topic => (
                <Col key={topic.id} md="4" lg="3" className="mb-4">
                  <Card className="shadow" style={{ borderRadius: 14, cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s ease' }}
                    onClick={() => setTopicView(topic)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#5e72e4'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    <CardBody style={{ padding: 20, textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#5e72e4,#825ee4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, color: '#fff' }}>
                        📖
                      </div>
                      <h6 style={{ color: '#32325d', marginBottom: 4, lineHeight: 1.3 }}>{topic.name}</h6>
                      {topic.description && <p style={{ fontSize: 12, color: '#8898aa', marginBottom: 0 }}>{topic.description}</p>}
                    </CardBody>
                  </Card>
                </Col>
              ))
            )}
          </Row>
        </Container>
        <style>{`
          @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
          .live-blink { animation: liveBlink 1s infinite; }
        `}</style>
      </>
    );
  }

  // ---- TABBED VIEW (selected topic) ----
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

        {/* Back to Topics breadcrumb */}
        <Row className="mb-2">
          <Col>
            <button onClick={() => setTopicView(null)} style={{ background: 'none', border: 'none', color: '#5e72e4', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>
              ← Back to Topics
            </button>
            <span style={{ color: '#8898aa', margin: '0 8px' }}>›</span>
            <span style={{ color: '#32325d', fontWeight: 600, fontSize: 13 }}>{topicView.name}</span>
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
            <Col className="mb-4">
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#e3f9fc', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  {/* Row 1: title + date nav */}
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10, marginBottom: 10 }}>
                    <CardTitle className="mb-0">Sessions ({allSessions.length})</CardTitle>
                    <div className="d-flex align-items-center" style={{ gap: 6 }}>
                      <button onClick={() => navSessionDate(-1)}
                        style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ‹
                      </button>
                      <input type="date" value={sessionDateStr}
                        onChange={e => e.target.value && setSessionDateStr(e.target.value)}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 13 }} />
                      <button onClick={() => navSessionDate(1)}
                        style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ›
                      </button>
                      {sessionDateStr !== todayKey && (
                        <button onClick={() => setSessionDateStr(todayKey)}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #11cdef', background: 'transparent', color: '#11cdef', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Today
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Row 2: filters */}
                  <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                    <select value={sessStatusFilter} onChange={e => setSessStatusFilter(e.target.value)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12, background: '#fff', color: '#525f7f', cursor: 'pointer' }}>
                      <option value="all">All Status</option>
                      <option value="LIVE">Live</option>
                      <option value="TODAY">Today</option>
                      <option value="TOMORROW">Tomorrow</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="MISSED">Missed</option>
                    </select>
                    <select value={sessTopicFilter} onChange={e => setSessTopicFilter(e.target.value)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12, background: '#fff', color: '#525f7f', cursor: 'pointer' }}>
                      <option value="all">All Topics</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {(sessStatusFilter !== 'all' || sessTopicFilter !== 'all') && (
                      <button onClick={() => { setSessStatusFilter('all'); setSessTopicFilter('all'); }}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #f5365c', background: 'transparent', color: '#f5365c', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Clear ×
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardBody style={{ padding: '16px 20px' }}>
                  {sessionDaySessions.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                      <p className="text-muted">
                        No sessions on {new Date(sessionDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  ) : (
                    sessionDaySessions.map(s => {
                      const borderColor = { LIVE: '#f5365c', TODAY: '#fb6340', TOMORROW: '#11cdef', SCHEDULED: '#11cdef', COMPLETED: '#8898aa', MISSED: '#fb6340' }[s.status] || '#11cdef';
                      const startDisplay = s.start_time ? formatTimetz(s.start_time) : new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const endDisplay   = s.end_time ? formatTimetz(s.end_time) : null;
                      const isLive       = s.status === 'LIVE';
                      return (
                        <div key={s.id} className="mb-3 bg-white border rounded shadow-sm"
                          style={{ borderLeft: `4px solid ${borderColor}`, padding: '14px 16px' }}>
                          <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 10 }}>
                            {/* Left: info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="d-flex align-items-center flex-wrap" style={{ gap: 6, marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#32325d' }}>{s.title}</span>
                                {s.is_recurring && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#e3f9fc', color: '#11cdef', padding: '2px 7px', borderRadius: 10 }}>↺ RECURRING</span>
                                )}
                                {statusBadge(s.status)}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 12, color: '#525f7f' }}>
                                {s.course_name && <span>📚 {s.course_name}</span>}
                                {s.class_title && <span>📋 {s.class_title}</span>}
                                {s.teacher_name && <span>👤 {s.teacher_name}</span>}
                                {s.topic_name && <span style={{ color: '#5e72e4', fontWeight: 600 }}>📌 {s.topic_name}</span>}
                                <span>⏰ {startDisplay}{endDisplay ? ` – ${endDisplay}` : ''}</span>
                                {s.is_recurring && s.recur_until && (
                                  <span>📅 Until {new Date(s.recur_until + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                )}
                              </div>
                            </div>
                            {/* Right: action */}
                            <div style={{ flexShrink: 0 }}>
                              {isLive && s.zoom_link && (
                                <a href={s.zoom_link} target="_blank" rel="noreferrer">
                                  <Button color="danger" size="sm" style={{ borderRadius: 8, fontWeight: 700 }}>
                                    Join Live
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
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
              {practiceQuizzes.length === 0 ? (
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No practice quizzes published yet{topicView ? ' for this topic' : ''}</p>
                  </CardBody>
                </Card>
              ) : (
                <Row>
                  {practiceQuizzes.map((q) => (
                    <Col key={q.id} lg="4" md="6" className="mb-4">
                      <Card className="shadow h-100" style={{ borderRadius: 12, borderTop: '4px solid #5e72e4' }}>
                        <CardBody style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ flex: 1 }}>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <h5 style={{ color: '#32325d', marginBottom: 4, lineHeight: 1.3 }}>{q.title}</h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
                                <Badge color={q.quiz_type === 'test' ? 'danger' : 'info'} style={{ textTransform: 'capitalize' }}>
                                  {q.quiz_type}
                                </Badge>
                                {(() => {
                                  const s = quizStatuses[q.id];
                                  if (!s || s.attempts_used === 0) return (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                      background: '#f0f0f0', color: '#8898aa' }}>Not Attempted</span>
                                  );
                                  if (s.has_submitted) return (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                      background: '#d4edda', color: '#155724' }}>✓ Submitted</span>
                                  );
                                  if (s.has_partial) return (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                      background: '#fff3cd', color: '#856404' }}>⏸ In Progress</span>
                                  );
                                  return null;
                                })()}
                              </div>
                            </div>
                            {q.description && <p className="text-muted small mb-3">{q.description}</p>}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                              {[
                                { icon: '❓', val: `${q.question_count} questions` },
                                { icon: '⏱', val: `${q.duration_minutes} mins` },
                                { icon: '✅', val: q.passing_score ? `${q.passing_score}% to pass` : 'No pass points' },
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
                            {quizStatuses[q.id]?.has_submitted ? 'View Results' : quizStatuses[q.id]?.has_partial ? 'Resume' : 'Attempt Quiz'}
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
              {filteredAssignments.length === 0 ? (
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No assignments yet{topicView ? ' for this topic' : ''}</p>
                  </CardBody>
                </Card>
              ) : (
                filteredAssignments.map((a) => {
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
                              <span className="small text-muted">Max points: <strong>{a.max_marks}</strong></span>
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
                                      Points: {sub.marks_awarded} / {a.max_marks}
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
              {filteredMaterials.length === 0 ? (
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No materials uploaded yet{topicView ? ' for this topic' : ''}.</p>
                  </CardBody>
                </Card>
              ) : (
                <Row>
                  {filteredMaterials.map((m) => {
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
                <Label><strong>Upload File</strong></Label>
                <input type="file" ref={submitFileRef} style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                  onChange={e => e.target.files?.[0] && handleSubmitFileUpload(e.target.files[0])} />
                <div className="d-flex align-items-center" style={{ gap: 10, marginBottom: 4 }}>
                  <button type="button" onClick={() => submitFileRef.current?.click()}
                    disabled={submitUploading}
                    style={{ background: '#fb6340', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    {submitUploading ? 'Uploading…' : '📎 Choose File'}
                  </button>
                  {submitFileName && (
                    <span style={{ fontSize: 13, color: '#2dce89', fontWeight: 600 }}>✓ {submitFileName}</span>
                  )}
                </div>
                <small className="text-muted">PDF, Word, Excel, image (max 10 MB)</small>
              </FormGroup>
              <FormGroup>
                <Label>Notes <span className="text-muted small">(optional)</span></Label>
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
