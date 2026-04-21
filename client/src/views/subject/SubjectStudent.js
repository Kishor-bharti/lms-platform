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

  // Student Uploads
  const [studentUploads,    setStudentUploads]    = useState([]);
  const [subjectTeachers,   setSubjectTeachers]   = useState([]);
  const [uplFilterTitle,    setUplFilterTitle]    = useState('');
  const [uplFilterTeacher,  setUplFilterTeacher]  = useState('all');
  const [uplFilterFeedback, setUplFilterFeedback] = useState('all');
  // Assignment filters
  const [assignFilterTitle,  setAssignFilterTitle]  = useState('');
  const [assignFilterStatus, setAssignFilterStatus] = useState('all'); // 'all' | 'graded' | 'submitted' | 'not_submitted'
  // Material filters
  const [matFilterTitle,  setMatFilterTitle]  = useState('');
  const [matFilterType,   setMatFilterType]   = useState('all');
  const [uploadOpen,        setUploadOpen]        = useState(false);
  const [uploadForm,        setUploadForm]        = useState({ title: '', description: '', teacherId: '', file_url: '', file_name: '' });
  const [uploadSaving,      setUploadSaving]      = useState(false);
  const [uploadError,       setUploadError]       = useState('');
  const [uploadFileUploading, setUploadFileUploading] = useState(false);
  const uploadFileRef = useRef(null);

  const openFile = async (type, id, field) => {
    try {
      let endpoint;
      if (type === 'material')   endpoint = `/api/materials/${id}/url`;
      else if (type === 'assignment') endpoint = `/api/assignments/${id}/url`;
      else if (type === 'upload')     endpoint = `/api/student-uploads/${id}/url${field === 'feedback' ? '?field=feedback' : ''}`;
      const res = await http.get(endpoint);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch (err) {
      console.error('[openFile]', err);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [sessRes, classRes, quizRes, assignRes, matRes, topicsRes, uploadsRes, teachersRes] = await Promise.all([
        http.get(withTimeZoneQuery('/api/classes/my-sessions-v2')),
        http.get('/api/classes/my-classes-v2'),
        http.get(`/api/quizzes/subject/${subjectId}`),
        http.get(`/api/assignments/subject/${subjectId}`),
        http.get(`/api/materials/subject/${subjectId}`),
        http.get(`/api/subjects/${subjectId}/topics`),
        http.get(`/api/student-uploads/subject/${subjectId}`).catch(() => ({ data: [] })),
        http.get(`/api/student-uploads/my-teachers/${subjectId}`).catch(() => ({ data: [] })),
      ]);
      setSessions((sessRes.data || []).filter((s) => s.subject_id === subjectId));
      const found = (classRes.data || []).find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setQuizzes(quizRes.data || []);
      setAssignments(assignRes.data || []);
      setMaterials(matRes.data || []);
      setTopics(topicsRes.data || []);
      setStudentUploads(uploadsRes.data || []);
      setSubjectTeachers(teachersRes.data || []);
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
      setSubmitForm(f => ({ ...f, submission_url: res.data.ref || res.data.url }));
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

  // ---- Upload handlers ----
  const handleUploadFile = async (file) => {
    if (!file) return;
    setUploadFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await http.post('/api/upload/assignment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadForm(f => ({ ...f, file_url: res.data.ref || res.data.url, file_name: res.data.name || file.name }));
    } catch (err) {
      setUploadError(err?.response?.data?.error || 'File upload failed');
    } finally {
      setUploadFileUploading(false);
    }
  };

  const handleCreateUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.title || !uploadForm.file_url) {
      setUploadError('Title and file are required');
      return;
    }
    setUploadSaving(true);
    setUploadError('');
    try {
      await http.post('/api/student-uploads', {
        subjectId,
        teacherId: uploadForm.teacherId || undefined,
        topicId: topicView?.id || undefined,
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        file_url: uploadForm.file_url,
        file_name: uploadForm.file_name || undefined,
      });
      setUploadOpen(false);
      setUploadForm({ title: '', description: '', teacherId: '', file_url: '', file_name: '' });
      fetchData();
    } catch (err) {
      setUploadError(err?.response?.data?.error || 'Failed to upload');
    } finally {
      setUploadSaving(false);
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    if (!window.confirm('Delete this upload?')) return;
    try {
      await http.delete(`/api/student-uploads/${uploadId}`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete upload', err);
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
  const filteredUploads     = topicView ? studentUploads.filter(u => u.topic_id === topicView.id) : studentUploads;

  const TABS = [
    { key: 'sessions',    label: 'Sessions',    count: allSessions.length },
    { key: 'quizzes',     label: 'Practice',    count: practiceQuizzes.length },
    { key: 'assignments', label: 'Assignments', count: filteredAssignments.length },
    { key: 'materials',   label: 'Materials',   count: filteredMaterials.length },
    { key: 'uploads',     label: 'Uploads',     count: filteredUploads.length },
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
              <Card className="shadow-lg" style={{ borderRadius: 16, overflow: 'hidden', border: 'none' }}>
                <div style={{ background: 'linear-gradient(135deg, #32325d 0%, #44467a 100%)', padding: '24px 28px 20px' }}>
                  <div className="d-flex align-items-start justify-content-between flex-wrap" style={{ gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <button onClick={() => navigate(-1)}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                        ‹
                      </button>
                      <div>
                        <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>{subject?.title || 'Subject'}</h2>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{subject?.course_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: 'rgba(255,255,255,.9)', padding: '2px 10px', borderRadius: 6 }}>{subject?.code}</span>
                        </div>
                        {subjectTeachers.length > 0 ? (
                          <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                            Teacher: {subjectTeachers.map(t => `${t.first_name} ${t.last_name}`).join(', ')}
                          </div>
                        ) : subject?.teacher_name ? (
                          <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Teacher: {subject.teacher_name}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Topics grid */}
          <Row className="mb-3">
            <Col>
              <h4 style={{ color: '#32325d', marginBottom: 16, fontWeight: 700 }}>Topics</h4>
            </Col>
          </Row>
          <Row>
            {topics.length === 0 ? (
              <Col>
                <Card className="shadow" style={{ borderRadius: 14 }}>
                  <CardBody className="text-center py-5">
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                    <p className="text-muted">No topics available yet for this subject.</p>
                  </CardBody>
                </Card>
              </Col>
            ) : (
              topics.map((topic, idx) => (
                <Col key={topic.id} md="4" lg="3" className="mb-4">
                  <Card className="shadow-sm" style={{ borderRadius: 14, cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s ease' }}
                    onClick={() => setTopicView(topic)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#5e72e4'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <CardBody style={{ padding: 20, textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#5e72e4,#825ee4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 18, color: '#fff', fontWeight: 700 }}>
                        {idx + 1}
                      </div>
                      <h6 style={{ color: '#32325d', marginBottom: 4, lineHeight: 1.3, fontSize: 14 }}>{topic.name}</h6>
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
            <Card className="shadow-lg" style={{ borderRadius: 16, overflow: 'hidden', border: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg, #32325d 0%, #44467a 100%)', padding: '24px 28px 20px' }}>
                <div className="d-flex align-items-start justify-content-between flex-wrap" style={{ gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <button onClick={() => setTopicView(null)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                      ‹
                    </button>
                    <div>
                      <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>{subject?.title || 'Subject'}</h2>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{subject?.course_name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: 'rgba(255,255,255,.9)', padding: '2px 10px', borderRadius: 6 }}>{subject?.code}</span>
                      </div>
                      {subjectTeachers.length > 0 ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                          Teacher: {subjectTeachers.map(t => `${t.first_name} ${t.last_name}`).join(', ')}
                        </div>
                      ) : subject?.teacher_name ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Teacher: {subject.teacher_name}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Breadcrumb */}
        <Row className="mb-2">
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: '#8898aa' }}>Topics</span>
              <span style={{ color: '#8898aa' }}>/</span>
              <span style={{ color: '#32325d', fontWeight: 700 }}>{topicView.name}</span>
            </div>
          </Col>
        </Row>

        {/* Tab nav */}
        <Row className="mb-3">
          <Col>
            <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 11, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13, transition: 'all .15s ease',
                    background: isActive ? '#5e72e4' : 'transparent',
                    color: isActive ? '#fff' : '#525f7f',
                    boxShadow: isActive ? '0 4px 12px rgba(94,114,228,.35)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {t.label}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
                      background: isActive ? 'rgba(255,255,255,.2)' : '#f0f2f5',
                      color: isActive ? '#fff' : '#8898aa',
                    }}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </Col>
        </Row>

        {/* ---- SESSIONS TAB ---- */}
        {tab === 'sessions' && (
          <Row>
            <Col className="mb-4">
              <Card className="shadow" style={{ borderRadius: 14 }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#eaf3ff,#dfe8ff)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  {/* Row 1: title + date nav */}
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10, marginBottom: 10 }}>
                    <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>Sessions</CardTitle>
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
                <Card className="shadow" style={{ borderRadius: 14 }}>
                  <CardBody className="text-center py-5">
                    <p className="text-muted">No practice quizzes published yet{topicView ? ' for this topic' : ''}</p>
                  </CardBody>
                </Card>
              ) : (
                <Row>
                  {practiceQuizzes.map((q) => (
                    <Col key={q.id} lg="4" md="6" className="mb-4">
                      <Card className="shadow h-100" style={{ borderRadius: 14, borderTop: '4px solid #5e72e4' }}>
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
        {tab === 'assignments' && (() => {
          const getStatus = (a) => { const s = a.my_submission; if (s?.status === 'graded') return 'graded'; if (s && s.status !== 'pending') return 'submitted'; return 'not_submitted'; };
          const visibleAssigns = filteredAssignments
            .filter(a => !assignFilterTitle || a.title.toLowerCase().includes(assignFilterTitle.toLowerCase()))
            .filter(a => assignFilterStatus === 'all' || getStatus(a) === assignFilterStatus);
          const hasAssignFilters = assignFilterTitle || assignFilterStatus !== 'all';

          return (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 14 }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#fff5ec,#ffe8d6)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                    <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>
                      Assignments
                      {filteredAssignments.length > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', marginLeft: 8 }}>
                          {hasAssignFilters ? `${visibleAssigns.length} / ${filteredAssignments.length}` : filteredAssignments.length}
                        </span>
                      )}
                    </CardTitle>
                  </div>
                  {filteredAssignments.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                      <input placeholder="Search title..." value={assignFilterTitle}
                        onChange={(e) => setAssignFilterTitle(e.target.value)}
                        style={{ width: 160, padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12 }} />
                      <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #dee2e6' }}>
                        {[['all', 'All'], ['graded', 'Graded'], ['submitted', 'Submitted'], ['not_submitted', 'Pending']].map(([val, label]) => (
                          <button key={val} onClick={() => setAssignFilterStatus(val)}
                            style={{
                              padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                              background: assignFilterStatus === val ? '#5e72e4' : '#fff',
                              color: assignFilterStatus === val ? '#fff' : '#525f7f',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {hasAssignFilters && (
                        <button onClick={() => { setAssignFilterTitle(''); setAssignFilterStatus('all'); }}
                          style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f5365c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardBody style={{ padding: '16px 22px' }}>
                  {filteredAssignments.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
                      <p className="text-muted">No assignments yet{topicView ? ' for this topic' : ''}</p>
                    </div>
                  ) : visibleAssigns.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No assignments match filters.</p>
                    </div>
                  ) : (
                    visibleAssigns.map((a) => {
                      const sub = a.my_submission;
                      const isSubmitted = sub && sub.status !== 'pending';
                      const isGraded    = sub?.status === 'graded';
                      const borderColor = isGraded ? '#2dce89' : isSubmitted ? '#5e72e4' : '#fb6340';

                      return (
                        <div key={a.id} className="mb-3" style={{ borderLeft: `4px solid ${borderColor}`, padding: '14px 16px', background: '#fff', borderRadius: 10, border: `1px solid #f0f4f8`, borderLeftColor: borderColor, borderLeftWidth: 4 }}>
                          <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="d-flex align-items-center flex-wrap" style={{ gap: 8, marginBottom: 4 }}>
                                <strong style={{ color: '#32325d', fontSize: 15 }}>{a.title}</strong>
                                {dueDateLabel(a.due_date)}
                              </div>
                              {a.description && <p className="text-muted small mb-2">{a.description}</p>}

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: '#525f7f' }}>
                                <span>Max points: <strong>{a.max_marks}</strong></span>
                                {a.attachment_url && (
                                  <button type="button" onClick={() => openFile('assignment', a.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#5e72e4', fontWeight: 600 }}>
                                    View Materials
                                  </button>
                                )}
                              </div>
                              {(a.assigned_by_name || a.student_assigned_at) && (
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: '#8898aa' }}>
                                  {a.assigned_by_name && <span>Assigned by: <strong>{a.assigned_by_name}</strong></span>}
                                  {a.student_assigned_at && <span>Assigned on: <strong>{new Date(a.student_assigned_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>}
                                  {a.due_date && <span>Due: <strong style={{ color: new Date(a.due_date) < new Date() ? '#f5365c' : '#2dce89' }}>{new Date(a.due_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>}
                                </div>
                              )}

                              {/* Submission status */}
                              {isSubmitted && (
                                <div style={{ marginTop: 10, padding: '10px 14px', background: isGraded ? '#eafaf1' : '#eef0fd', borderRadius: 8, borderLeft: `3px solid ${isGraded ? '#2dce89' : '#5e72e4'}` }}>
                                  {isGraded ? (
                                    <div>
                                      <span style={{ fontWeight: 700, color: '#2dce89', fontSize: 14 }}>
                                        Points: {sub.marks_awarded} / {a.max_marks}
                                      </span>
                                      {sub.feedback && <p className="small text-muted mb-0 mt-1">Feedback: {sub.feedback}</p>}
                                      {sub.feedback_file_url && (
                                        <button type="button" onClick={() => openFile('upload', sub.id, 'feedback')} className="small d-block mt-1" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#5e72e4', fontWeight: 600 }}>
                                          View Checked File
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ fontWeight: 600, color: '#5e72e4', fontSize: 13 }}>Submitted — awaiting grade</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: isGraded ? '#d4edda' : isSubmitted ? '#e8eeff' : '#fff3e0',
                                color: isGraded ? '#155724' : isSubmitted ? '#3d5af1' : '#e65100',
                              }}>
                                {isGraded ? 'Graded' : isSubmitted ? 'Submitted' : 'Not Submitted'}
                              </span>
                              {!isGraded && (
                                <Button
                                  color={isSubmitted ? 'default' : 'warning'}
                                  size="sm"
                                  outline={isSubmitted}
                                  style={{ borderRadius: 20, fontSize: 11, fontWeight: 600 }}
                                  onClick={() => openSubmitModal(a)}
                                >
                                  {isSubmitted ? 'Edit Submission' : 'Submit'}
                                </Button>
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
          );
        })()}

        {/* ---- MATERIALS TAB ---- */}
        {tab === 'materials' && (() => {
          const visibleMats = filteredMaterials
            .filter(m => !matFilterTitle || m.title.toLowerCase().includes(matFilterTitle.toLowerCase()))
            .filter(m => matFilterType === 'all' || m.material_type === matFilterType);
          const matTypes = [...new Set(filteredMaterials.map(m => m.material_type))];
          const hasMatFilters = matFilterTitle || matFilterType !== 'all';

          return (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 14 }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#e8fff0,#d6f5e0)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                    <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>
                      Study Materials
                      {filteredMaterials.length > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', marginLeft: 8 }}>
                          {hasMatFilters ? `${visibleMats.length} / ${filteredMaterials.length}` : filteredMaterials.length}
                        </span>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                {filteredMaterials.length > 0 && (
                  <div style={{ padding: '12px 22px', background: '#f6f9fc', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', borderBottom: '1px solid #e9ecef' }}>
                    <input placeholder="Search title..." value={matFilterTitle}
                      onChange={(e) => setMatFilterTitle(e.target.value)}
                      style={{ width: 150, padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12 }} />
                    {matTypes.length > 1 && (
                      <select value={matFilterType} onChange={(e) => setMatFilterType(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12 }}>
                        <option value="all">All Types</option>
                        {matTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    )}
                    {hasMatFilters && (
                      <button onClick={() => { setMatFilterTitle(''); setMatFilterType('all'); }}
                        style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f5365c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                    <span style={{ fontSize: 12, color: '#8898aa', marginLeft: 'auto' }}>
                      {hasMatFilters ? `${visibleMats.length} / ${filteredMaterials.length}` : `${filteredMaterials.length}`} material{filteredMaterials.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                <CardBody style={{ padding: '16px 22px' }}>
                  {filteredMaterials.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
                      <p className="text-muted">No materials uploaded yet{topicView ? ' for this topic' : ''}.</p>
                    </div>
                  ) : visibleMats.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No materials match filters.</p>
                    </div>
                  ) : (
                    <Row>
                      {visibleMats.map((m) => {
                        const typeIcon  = { pdf: '📄', video: '🎥', doc: '📝', image: '🖼', pptx: '📊', zip: '📦' }[m.material_type] || '📁';
                        const typeColor = { pdf: '#f5365c', video: '#825ee4', doc: '#fb6340', image: '#2dce89', pptx: '#5e72e4', zip: '#8898aa' }[m.material_type] || '#8898aa';
                        return (
                          <Col key={m.id} md="6" lg="4" className="mb-3">
                            <div onClick={() => openFile('material', m.id)} style={{ textDecoration: 'none', cursor: 'pointer' }}>
                              <Card className="shadow-sm h-100" style={{ borderRadius: 12, borderTop: `3px solid ${typeColor}`, cursor: 'pointer', transition: 'transform 0.15s ease' }}
                                onMouseEnter={(e) => e.currentTarget.style.transform='translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform='translateY(0)'}>
                                <CardBody style={{ padding: 16 }}>
                                  <div style={{ fontSize: 28, marginBottom: 8 }}>{typeIcon}</div>
                                  <h6 style={{ color: '#32325d', marginBottom: 4, lineHeight: 1.3, fontSize: 14 }}>{m.title}</h6>
                                  {m.description && <p style={{ fontSize: 12, color: '#8898aa', marginBottom: 8 }}>{m.description}</p>}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, color: typeColor, fontWeight: 700, textTransform: 'uppercase', background: typeColor + '20', padding: '2px 8px', borderRadius: 10 }}>
                                      {m.material_type}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#8898aa' }}>by {m.uploader_name}</span>
                                  </div>
                                </CardBody>
                              </Card>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
          );
        })()}

        {/* ---- UPLOADS TAB ---- */}
        {tab === 'uploads' && (() => {
          const visibleUploads = filteredUploads
            .filter(u => !uplFilterTitle || u.title.toLowerCase().includes(uplFilterTitle.toLowerCase()))
            .filter(u => uplFilterTeacher === 'all' || (uplFilterTeacher === 'none' ? !u.teacher_id : u.teacher_id === uplFilterTeacher))
            .filter(u => uplFilterFeedback === 'all' || (uplFilterFeedback === 'given' ? (u.feedback_text || u.feedback_file_url) : (!u.feedback_text && !u.feedback_file_url)));
          const uniqueTeachers = [...new Map(filteredUploads.filter(u => u.teacher_id).map(u => [u.teacher_id, u.teacher_name])).entries()];
          const hasUplFilters = uplFilterTitle || uplFilterTeacher !== 'all' || uplFilterFeedback !== 'all';

          return (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 14 }}>
                <CardHeader className="d-flex justify-content-between align-items-center" style={{ background: 'linear-gradient(135deg,#ffecd2,#fcb69f)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>
                    My Uploads
                    {filteredUploads.length > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', marginLeft: 8 }}>
                        {hasUplFilters ? `${visibleUploads.length} / ${filteredUploads.length}` : filteredUploads.length}
                      </span>
                    )}
                  </CardTitle>
                  <Button color="warning" size="sm" style={{ borderRadius: 20, fontWeight: 600, fontSize: 12 }}
                    onClick={() => { setUploadForm({ title: '', description: '', teacherId: '', file_url: '', file_name: '' }); setUploadError(''); setUploadOpen(true); }}>
                    + Upload File
                  </Button>
                </CardHeader>
                {filteredUploads.length > 0 && (
                  <div style={{ padding: '12px 22px', background: '#f6f9fc', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', borderBottom: '1px solid #e9ecef' }}>
                    <input placeholder="Search title..." value={uplFilterTitle}
                      onChange={(e) => setUplFilterTitle(e.target.value)}
                      style={{ width: 150, padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12 }} />
                    {uniqueTeachers.length > 0 && (
                      <select value={uplFilterTeacher} onChange={(e) => setUplFilterTeacher(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12 }}>
                        <option value="all">All Teachers</option>
                        <option value="none">No Teacher</option>
                        {uniqueTeachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    )}
                    <select value={uplFilterFeedback} onChange={(e) => setUplFilterFeedback(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 12 }}>
                      <option value="all">All</option>
                      <option value="given">Feedback Received</option>
                      <option value="pending">Pending</option>
                    </select>
                    {hasUplFilters && (
                      <button onClick={() => { setUplFilterTitle(''); setUplFilterTeacher('all'); setUplFilterFeedback('all'); }}
                        style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f5365c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                )}
                <CardBody style={{ padding: '16px 22px' }}>
                  {filteredUploads.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📤</div>
                      <p className="text-muted">No uploads yet{topicView ? ' for this topic' : ''}.</p>
                      <Button color="warning" size="sm" style={{ borderRadius: 20, fontWeight: 600 }}
                        onClick={() => { setUploadForm({ title: '', description: '', teacherId: '', file_url: '', file_name: '' }); setUploadError(''); setUploadOpen(true); }}>
                        Upload Your First File
                      </Button>
                    </div>
                  ) : visibleUploads.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No uploads match filters.</p>
                    </div>
                  ) : (
                    <div>
                      {visibleUploads.map((u, idx) => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f0f4f8' }}>
                          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: '#8898aa', fontSize: 12, minWidth: 24 }}>{idx + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#32325d', fontSize: 14 }}>{u.title}</div>
                              {u.description && <div style={{ fontSize: 12, color: '#8898aa', marginTop: 2 }}>{u.description}</div>}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: '#8898aa', marginTop: 4 }}>
                                {u.teacher_name && <span>To: <strong>{u.teacher_name}</strong></span>}
                                {u.topic_name && <span style={{ color: '#5e72e4', fontWeight: 600 }}>{u.topic_name}</span>}
                                <span>{new Date(u.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              </div>
                              {(u.feedback_text || u.feedback_file_url) && (
                                <div style={{ marginTop: 8, padding: '8px 12px', background: '#eafaf1', borderRadius: 8, borderLeft: '3px solid #2dce89' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2dce89', marginBottom: 2 }}>Teacher Feedback</div>
                                  {u.feedback_text && <div style={{ fontSize: 13, color: '#32325d' }}>{u.feedback_text}</div>}
                                  {u.feedback_file_url && (
                                    <button type="button" onClick={() => openFile('upload', u.id, 'feedback')}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#5e72e4', marginTop: 4, display: 'inline-block' }}>
                                      View Feedback File
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', marginLeft: 12, flexShrink: 0 }}>
                            <button type="button" onClick={() => openFile('upload', u.id)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#5e72e4' }}>
                              {u.file_name || 'Download'}
                            </button>
                            {(u.feedback_text || u.feedback_file_url) ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#d4edda', color: '#155724' }}>Reviewed</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fff3cd', color: '#856404' }}>Pending</span>
                            )}
                            <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11 }}
                              onClick={() => handleDeleteUpload(u.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
          );
        })()}

        {/* Upload File Modal */}
        <Modal isOpen={uploadOpen} toggle={() => setUploadOpen(false)} centered>
          <ModalHeader toggle={() => setUploadOpen(false)}>Upload File</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleCreateUpload}>
              <FormGroup>
                <Label><strong>Title</strong></Label>
                <Input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="e.g. Math Homework Week 5" required />
              </FormGroup>
              <FormGroup>
                <Label>Description <span className="text-muted small">(optional)</span></Label>
                <Input type="textarea" rows={2} value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Any notes about this file..." />
              </FormGroup>
              <FormGroup>
                <Label>Send to Teacher <span className="text-muted small">(optional)</span></Label>
                <Input type="select" value={uploadForm.teacherId}
                  onChange={(e) => setUploadForm({ ...uploadForm, teacherId: e.target.value })}>
                  <option value="">— None —</option>
                  {subjectTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </Input>
              </FormGroup>
              <FormGroup>
                <Label><strong>File</strong></Label>
                <input type="file" ref={uploadFileRef} style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.zip"
                  onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])} />
                <div className="d-flex align-items-center" style={{ gap: 10, marginBottom: 4 }}>
                  <button type="button" onClick={() => uploadFileRef.current?.click()}
                    disabled={uploadFileUploading}
                    style={{ background: '#fb6340', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    {uploadFileUploading ? 'Uploading...' : 'Choose File'}
                  </button>
                  {uploadForm.file_name && (
                    <span style={{ fontSize: 13, color: '#2dce89', fontWeight: 600 }}>&#10003; {uploadForm.file_name}</span>
                  )}
                </div>
                <small className="text-muted">PDF, Word, Excel, image, ZIP (max 100 MB)</small>
              </FormGroup>
              {uploadError && <p className="text-danger small">{uploadError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="warning" disabled={uploadSaving || uploadFileUploading} onClick={handleCreateUpload}>
              {uploadSaving ? 'Saving...' : 'Upload'}
            </Button>
            <Button color="link" onClick={() => setUploadOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

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
                <small className="text-muted">PDF, Word, Excel, image (max 100 MB)</small>
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
