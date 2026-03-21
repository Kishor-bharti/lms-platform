import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TableSkeleton } from 'components/Skeleton.js';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button,
  Modal, ModalHeader, ModalBody, ModalFooter, Badge,
  Form, FormGroup, Label, Input, FormText,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

const STATUS_STYLE = {
  live:      { bg: '#fde8ec', color: '#f5365c' },
  scheduled: { bg: '#e8eeff', color: '#5e72e4' },
  completed: { bg: '#f0f0f0', color: '#8898aa' },
  cancelled: { bg: '#fff3e0', color: '#fb6340' },
  missed:    { bg: '#fff3e0', color: '#fb6340' },
};

const SELECT_STYLE = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #dee2e6',
  fontSize: 13, background: '#fff', color: '#525f7f', cursor: 'pointer',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BLANK_FORM = {
  teacherId: '', subjectId: '', studentIds: [], title: '',
  sessionDate: '', startTime: '', endTime: '', topicId: '',
  isRecurring: false, recurPattern: 'weekly', recurDays: [], recurEndDate: '',
};

const ADMIN_TODAY = new Date().toISOString().slice(0, 10);

// ─── Recurring scope options (Google Calendar style) ────────────────────────
const SCOPE_OPTIONS = [
  { value: 'this',              label: 'This event',                  desc: 'Only this occurrence'                       },
  { value: 'this_and_following', label: 'This and following events',  desc: 'This and all future events in the series'   },
  { value: 'all',               label: 'All events',                  desc: 'Every occurrence in the series'             },
];

export default function AdminSessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get('date') || ADMIN_TODAY;

  const [sessions,      setSessions]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [courseFilter,  setCourseFilter]  = useState('all');
  const [showAllDates,  setShowAllDates]  = useState(false);

  // Multi-select
  const [selected,      setSelected]      = useState(new Set());
  const [bulkDeleting,  setBulkDeleting]  = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [saving,     setSaving]     = useState(false);
  const [preview,    setPreview]    = useState([]);

  // Edit modal — includes recurMode for recurring sessions
  const [editOpen,    setEditOpen]    = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [editForm,    setEditForm]    = useState({ title: '', sessionDate: '', startTime: '', endTime: '', recurMode: 'this' });
  const [editSaving,  setEditSaving]  = useState(false);

  // Recurring delete modal
  const [deleteModal, setDeleteModal] = useState({ open: false, session: null, scope: 'this' });
  const [deleting,    setDeleting]    = useState(false);

  // Students detail modal
  const [studentsModal, setStudentsModal] = useState({ open: false, session: null, students: [], loading: false });

  // Create-form data
  const [allSubjects,     setAllSubjects]     = useState([]);
  const [subjectStudents, setSubjectStudents] = useState([]);
  const [subjectTeachers, setSubjectTeachers] = useState([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const url = showAllDates
        ? '/api/admin/sessions'
        : `/api/admin/sessions?date=${selectedDate}`;
      const res = await http.get(url);
      setSessions(res.data || []);
    } catch (err) {
      console.error('[AdminSessions]', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showAllDates]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    http.get('/api/admin/subjects')
      .then(r => setAllSubjects(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.subjectId) { setSubjectStudents([]); setSubjectTeachers([]); return; }
    const sub = allSubjects.find(s => s.id === form.subjectId);
    if (sub) {
      const teachers = (sub.teacher_ids || []).map((id, i) => ({ id, name: (sub.teacher_names || [])[i] || id }));
      setSubjectTeachers(teachers);
      setForm(f => ({ ...f, teacherId: teachers.length === 1 ? teachers[0].id : '' }));
    }
    http.get(`/api/admin/subjects/${form.subjectId}/enrollments`)
      .then(r => setSubjectStudents(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setSubjectStudents([]));
    setForm(f => ({ ...f, studentIds: [] }));
  }, [form.subjectId, allSubjects]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.isRecurring || !form.sessionDate || !form.recurEndDate) { setPreview([]); return; }
    const dates = [];
    const end   = new Date(form.recurEndDate + 'T00:00:00Z');
    let   cur   = new Date(form.sessionDate  + 'T00:00:00Z');
    while (cur <= end && dates.length < 60) {
      const dow = cur.getUTCDay();
      const iso = cur.toISOString().slice(0, 10);
      if (form.recurPattern === 'daily' || form.recurDays.length === 0 || form.recurDays.includes(dow))
        dates.push(iso);
      cur = new Date(cur.getTime() + 86400000);
    }
    setPreview(dates);
  }, [form.isRecurring, form.sessionDate, form.recurEndDate, form.recurPattern, form.recurDays]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setField  = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const toggleDay = (d)    => setForm(p => ({ ...p, recurDays: p.recurDays.includes(d) ? p.recurDays.filter(x => x !== d) : [...p.recurDays, d] }));
  const toggleStu = (id)   => setForm(p => ({ ...p, studentIds: p.studentIds.includes(id) ? p.studentIds.filter(s => s !== id) : [...p.studentIds, id] }));

  const teachers = useMemo(() => {
    const map = new Map();
    sessions.forEach(s => { if (s.teacher_id && s.teacher_name && !map.has(s.teacher_id)) map.set(s.teacher_id, s.teacher_name); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions]);

  const courses = useMemo(() => [...new Set(sessions.map(s => s.course_name).filter(Boolean))].sort(), [sessions]);

  const filtered = sessions.filter(s => {
    const q = `${s.title} ${s.subject_name} ${s.teacher_name} ${s.course_name} ${s.topic_name || ''}`.toLowerCase();
    return q.includes(search.toLowerCase())
      && (statusFilter  === 'all' || s.status    === statusFilter)
      && (teacherFilter === 'all' || s.teacher_id === teacherFilter)
      && (courseFilter  === 'all' || s.course_name === courseFilter);
  });

  const counts = {
    all:       sessions.length,
    live:      sessions.filter(s => s.status === 'live').length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id));
  const someSelected        = selected.size > 0;

  const toggleSelect = (id) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(s => n.delete(s.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(s => n.add(s.id)); return n; });
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.teacherId || !form.subjectId || !form.title || !form.sessionDate || !form.startTime || !form.endTime) {
      alert('Please fill all required fields (Teacher, Subject, Title, Date, Start, End Time).'); return;
    }
    setSaving(true);
    try {
      await http.post('/api/admin/sessions', {
        teacherId: form.teacherId, subjectId: form.subjectId,
        title: form.title, sessionDate: form.sessionDate,
        startTime: form.startTime, endTime: form.endTime,
        topicId: form.topicId || undefined,
        studentIds: form.studentIds.length ? form.studentIds : undefined,
        isRecurring: form.isRecurring, recurPattern: form.recurPattern,
        recurDays: form.recurDays, recurEndDate: form.recurEndDate || undefined,
      });
      setCreateOpen(false);
      fetchSessions();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to create session');
    } finally { setSaving(false); }
  };

  const openEdit = (s) => {
    setEditSession(s);
    setEditForm({
      title:       s.title,
      sessionDate: s.session_date || s.scheduled_at?.slice(0, 10) || '',
      startTime:   s.start_time?.slice(0, 5) || '',
      endTime:     s.end_time?.slice(0, 5)   || '',
      recurMode:   'this',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editSession) return;
    setEditSaving(true);
    try {
      const payload = {
        title:       editForm.title       || undefined,
        sessionDate: editForm.sessionDate || undefined,
        startTime:   editForm.startTime   || undefined,
        endTime:     editForm.endTime     || undefined,
      };
      if (editSession.is_recurring && editSession.recurrence_id && editForm.recurMode !== 'this') {
        Object.assign(payload, {
          recurMode:    editForm.recurMode,
          recurrenceId: editSession.recurrence_id,
          originalDate: editSession.session_date,
        });
      }
      await http.patch(`/api/admin/sessions/${editSession.id}`, payload);
      setEditOpen(false);
      setSelected(new Set());
      fetchSessions();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update session');
    } finally { setEditSaving(false); }
  };

  // Single delete — opens recurring scope modal if recurring, otherwise confirms directly
  const handleDeleteClick = (s) => {
    if (s.is_recurring && s.recurrence_id) {
      setDeleteModal({ open: true, session: s, scope: 'this' });
    } else {
      if (!window.confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
      doDeleteSingle(s.id);
    }
  };

  const doDeleteSingle = async (sessionId) => {
    try {
      await http.delete(`/api/admin/sessions/${sessionId}`);
      setSelected(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
      fetchSessions();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete session');
    }
  };

  const handleRecurringDelete = async () => {
    const { session, scope } = deleteModal;
    if (!session) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({ mode: scope });
      if (scope !== 'this' && session.recurrence_id) {
        params.set('recurrenceId', session.recurrence_id);
        params.set('sessionDate',  session.session_date || '');
      }
      await http.delete(`/api/admin/sessions/${session.id}?${params}`);
      setDeleteModal({ open: false, session: null, scope: 'this' });
      setSelected(new Set());
      fetchSessions();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete session');
    } finally { setDeleting(false); }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (!window.confirm(`Delete ${ids.length} selected session${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await http.post('/api/admin/sessions/bulk-delete', { ids });
      setSelected(new Set());
      fetchSessions();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete sessions');
    } finally { setBulkDeleting(false); }
  };

  const openStudents = async (session) => {
    if (!session.subject_id) return;
    setStudentsModal({ open: true, session, students: [], loading: true });
    try {
      const res = await http.get(`/api/admin/subjects/${session.subject_id}/enrollments`);
      setStudentsModal(p => ({ ...p, students: res.data || [], loading: false }));
    } catch { setStudentsModal(p => ({ ...p, students: [], loading: false })); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row>
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 10 }}>
                  <CardTitle className="mb-0">All Sessions</CardTitle>
                  <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>

                    {/* Date picker + Show All toggle */}
                    {!showAllDates && (
                      <>
                        <input
                          type="date" value={selectedDate}
                          onChange={e => { if (e.target.value) setSearchParams({ date: e.target.value }); }}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 13, color: '#525f7f', cursor: 'pointer' }}
                        />
                        {selectedDate !== ADMIN_TODAY && (
                          <button onClick={() => setSearchParams({ date: ADMIN_TODAY })}
                            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #5e72e4', background: 'transparent', color: '#5e72e4', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            Today
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => { setShowAllDates(v => !v); setSelected(new Set()); }}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #dee2e6', background: showAllDates ? '#5e72e4' : 'transparent', color: showAllDates ? '#fff' : '#525f7f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {showAllDates ? '📅 All Dates' : '📅 Show All'}
                    </button>

                    <input
                      placeholder="Search sessions..." value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, width: 180 }}
                    />
                    <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} style={SELECT_STYLE}>
                      <option value="all">All Teachers</option>
                      {teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                    <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={SELECT_STYLE}>
                      <option value="all">All Courses</option>
                      {courses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {['all', 'live', 'scheduled', 'completed'].map(s => (
                      <Button key={s} size="sm" color="primary" outline={statusFilter !== s}
                        onClick={() => setStatusFilter(s)}
                        style={{ borderRadius: 20, textTransform: 'capitalize' }}>
                        {s}{counts[s] > 0 && <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: '0 6px', marginLeft: 4, fontSize: 11 }}>{counts[s]}</span>}
                      </Button>
                    ))}
                    <Button size="sm" color="primary" style={{ borderRadius: 20, fontWeight: 700 }} onClick={() => { setForm(BLANK_FORM); setPreview([]); setCreateOpen(true); }}>
                      + Schedule Session
                    </Button>
                  </div>
                </div>

                {/* Bulk action toolbar */}
                {someSelected && (
                  <div className="d-flex align-items-center flex-wrap mt-2" style={{ gap: 8, padding: '8px 12px', background: '#fff3cd', borderRadius: 8 }}>
                    <span style={{ fontWeight: 700, color: '#856404', fontSize: 13 }}>
                      {selected.size} session{selected.size !== 1 ? 's' : ''} selected
                    </span>
                    <Button size="sm" color="danger" style={{ borderRadius: 6 }} disabled={bulkDeleting} onClick={handleBulkDelete}>
                      {bulkDeleting ? 'Deleting…' : `✕ Delete ${selected.size} selected`}
                    </Button>
                    <Button size="sm" color="link" style={{ fontSize: 12 }} onClick={() => setSelected(new Set())}>
                      Clear selection
                    </Button>
                  </div>
                )}

                {(teacherFilter !== 'all' || courseFilter !== 'all' || statusFilter !== 'all' || search) && (
                  <div className="d-flex align-items-center flex-wrap mt-2" style={{ gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#8898aa' }}>Showing {filtered.length} of {sessions.length} sessions</span>
                    <Button size="sm" color="link" style={{ padding: '0 4px', fontSize: 12 }}
                      onClick={() => { setSearch(''); setStatusFilter('all'); setTeacherFilter('all'); setCourseFilter('all'); }}>
                      Clear filters ×
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardBody style={{ overflowX: 'auto' }}>
                {filtered.length === 0 && !loading ? (
                  <p className="text-center text-muted py-4">No sessions found</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {/* Select-all checkbox */}
                        <th style={{ padding: '10px 14px', width: 36 }}>
                          <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                            title={allFilteredSelected ? 'Deselect all' : 'Select all visible'}
                            style={{ cursor: 'pointer', width: 16, height: 16 }} />
                        </th>
                        {['Title', 'Topic', 'Subject', 'Course', 'Teacher', 'Date & Time', 'Students', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    {loading ? <TableSkeleton cols={10} rows={6} /> : (
                      <tbody>
                        {filtered.map(s => {
                          const style   = STATUS_STYLE[s.status] || STATUS_STYLE.scheduled;
                          const isRecur = s.is_recurring && s.recurrence_id;
                          const isChk   = selected.has(s.id);
                          return (
                            <tr key={s.id}
                              style={{ borderBottom: '1px solid #f0f4f8', background: isChk ? '#f0f4ff' : 'transparent', transition: 'background 0.1s' }}>

                              {/* Checkbox */}
                              <td style={{ padding: '12px 14px' }}>
                                <input type="checkbox" checked={isChk} onChange={() => toggleSelect(s.id)}
                                  style={{ cursor: 'pointer', width: 16, height: 16 }} />
                              </td>

                              <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d', whiteSpace: 'nowrap' }}>
                                <span>{s.title}</span>
                                {isRecur && (
                                  <span title="Recurring series" style={{ marginLeft: 6, fontSize: 10, background: '#eef0fd', color: '#5e72e4', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                                    ↺ recurring
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {s.topic_name
                                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>📌 {s.topic_name}</span>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.subject_name}</td>
                              <td style={{ padding: '12px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#11cdef', background: '#e0f9ff', padding: '2px 8px', borderRadius: 10 }}>{s.course_name}</span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 600 }}>{s.teacher_name}</div>
                                <div style={{ fontSize: 11, color: '#8898aa' }}>{s.teacher_email}</div>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13, whiteSpace: 'nowrap' }}>
                                {s.session_date
                                  ? `${new Date(s.session_date + 'T00:00:00').toLocaleDateString()} ${s.start_time?.slice(0, 5) || ''}`
                                  : new Date(s.scheduled_at).toLocaleString()}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <button onClick={() => openStudents(s)}
                                  style={{ background: '#eef0fd', border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#5e72e4', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  👥 {s.enrolled_count ?? '—'}
                                </button>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ background: style.bg, color: style.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                                  {s.status}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                {s.status === 'live' && s.zoom_link && (
                                  <button onClick={() => window.open(s.zoom_link, '_blank')}
                                    style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: 16, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 4 }}>
                                    Join
                                  </button>
                                )}
                                {(s.status === 'scheduled' || isRecur) && (
                                  <button onClick={() => openEdit(s)}
                                    style={{ background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 16, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 4 }}>
                                    Edit
                                  </button>
                                )}
                                <button onClick={() => handleDeleteClick(s)}
                                  style={{ background: '#f5365c', color: '#fff', border: 'none', borderRadius: 16, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    )}
                  </table>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* ── Create / Schedule Session Modal ─────────────────────────────── */}
      <Modal isOpen={createOpen} toggle={() => setCreateOpen(false)} centered size="lg">
        <ModalHeader toggle={() => setCreateOpen(false)}
          style={{ background: 'linear-gradient(135deg, #3b4a67 0%, #6286c3 100%)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          Schedule Session
        </ModalHeader>
        <ModalBody style={{ background: '#f8fbff', maxHeight: '75vh', overflowY: 'auto' }}>
          <Form>
            <FormGroup>
              <Label><strong>Subject *</strong></Label>
              <Input type="select" value={form.subjectId} onChange={e => setField('subjectId', e.target.value)}>
                <option value="">— Select subject —</option>
                {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.course_name})</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label><strong>Teacher *</strong></Label>
              <Input type="select" value={form.teacherId} onChange={e => setField('teacherId', e.target.value)} disabled={!form.subjectId}>
                <option value="">— Select teacher —</option>
                {subjectTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Input>
              {form.subjectId && subjectTeachers.length === 0 && <FormText color="danger">No teachers assigned yet.</FormText>}
            </FormGroup>
            <FormGroup>
              <Label><strong>Session Title *</strong></Label>
              <Input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Algebra — Week 5" />
            </FormGroup>
            <Row form>
              <Col md={4}><FormGroup><Label><strong>Date *</strong></Label>
                <Input type="date" value={form.sessionDate} onChange={e => setField('sessionDate', e.target.value)} />
              </FormGroup></Col>
              <Col md={4}><FormGroup><Label><strong>Start Time *</strong></Label>
                <Input type="time" value={form.startTime} onChange={e => setField('startTime', e.target.value)} />
              </FormGroup></Col>
              <Col md={4}><FormGroup><Label><strong>End Time *</strong></Label>
                <Input type="time" value={form.endTime} onChange={e => setField('endTime', e.target.value)} />
              </FormGroup></Col>
            </Row>
            {subjectStudents.length > 0 && (
              <FormGroup>
                <Label><strong>Target Students</strong> <span style={{ fontWeight: 400, color: '#8898aa', fontSize: 13 }}>(leave blank = all enrolled)</span></Label>
                <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: 8, padding: 8, background: '#fff' }}>
                  {subjectStudents.map(st => (
                    <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <input type="checkbox" id={`st-${st.id}`} checked={form.studentIds.includes(st.id)} onChange={() => toggleStu(st.id)} />
                      <label htmlFor={`st-${st.id}`} style={{ margin: 0, cursor: 'pointer', fontSize: 13 }}>
                        {st.first_name} {st.last_name} <span style={{ color: '#8898aa' }}>({st.email})</span>
                      </label>
                    </div>
                  ))}
                </div>
              </FormGroup>
            )}
            <FormGroup check className="mb-3">
              <Input type="checkbox" id="isRecurring" checked={form.isRecurring} onChange={e => setField('isRecurring', e.target.checked)} />
              <Label check htmlFor="isRecurring"><strong>Recurring session</strong></Label>
            </FormGroup>
            {form.isRecurring && (
              <>
                <FormGroup>
                  <Label>Repeat pattern</Label>
                  <div className="d-flex" style={{ gap: 16 }}>
                    {['daily', 'weekly'].map(p => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="radio" name="recurPattern" value={p} checked={form.recurPattern === p} onChange={() => setField('recurPattern', p)} />
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </label>
                    ))}
                  </div>
                </FormGroup>
                {form.recurPattern === 'weekly' && (
                  <FormGroup>
                    <Label>Days of week <span style={{ color: '#8898aa', fontWeight: 400, fontSize: 13 }}>(blank = every day)</span></Label>
                    <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                      {DAY_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{ width: 40, height: 40, borderRadius: 20, border: '2px solid', borderColor: form.recurDays.includes(i) ? '#5e72e4' : '#dee2e6', background: form.recurDays.includes(i) ? '#5e72e4' : '#fff', color: form.recurDays.includes(i) ? '#fff' : '#525f7f', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </FormGroup>
                )}
                <FormGroup>
                  <Label><strong>Repeat until *</strong></Label>
                  <Input type="date" value={form.recurEndDate} onChange={e => setField('recurEndDate', e.target.value)} />
                </FormGroup>
                {preview.length > 0 && (
                  <div style={{ background: '#eef0fd', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5e72e4', marginBottom: 6 }}>
                      Preview — {preview.length} session{preview.length !== 1 ? 's' : ''} will be created:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto' }}>
                      {preview.map(d => (
                        <span key={d} style={{ background: '#fff', border: '1px solid #c5cae9', borderRadius: 8, padding: '2px 8px', fontSize: 12, color: '#3b4a67' }}>
                          {new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Form>
        </ModalBody>
        <ModalFooter style={{ background: '#f8fbff' }}>
          <Button color="primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Scheduling…' : form.isRecurring && preview.length > 1 ? `Create ${preview.length} Sessions` : 'Create Session'}
          </Button>
          <Button color="link" onClick={() => setCreateOpen(false)}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* ── Edit / Reschedule Modal ─────────────────────────────────────── */}
      <Modal isOpen={editOpen} toggle={() => setEditOpen(false)} centered>
        <ModalHeader toggle={() => setEditOpen(false)}>
          {editSession?.is_recurring ? '↺ Edit Recurring Session' : 'Reschedule'} — {editSession?.title}
        </ModalHeader>
        <ModalBody>
          {/* Google Calendar–style scope selector for recurring sessions */}
          {editSession?.is_recurring && editSession?.recurrence_id && (
            <div style={{ background: '#f8f9fc', borderRadius: 10, padding: '12px 16px', marginBottom: 20, border: '1px solid #e0e6ef' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#32325d', marginBottom: 10 }}>Edit recurring event</div>
              {SCOPE_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, border: '2px solid', borderColor: editForm.recurMode === opt.value ? '#5e72e4' : '#e0e6ef', marginBottom: 8, cursor: 'pointer', background: editForm.recurMode === opt.value ? '#eef0fd' : '#fff' }}>
                  <input type="radio" name="editRecurMode" value={opt.value} checked={editForm.recurMode === opt.value}
                    onChange={() => setEditForm(f => ({ ...f, recurMode: opt.value }))} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#32325d', fontSize: 13 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#8898aa' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <Form>
            <FormGroup>
              <Label><strong>Title</strong></Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </FormGroup>
            {/* Date only editable for "this event" scope */}
            {(!editSession?.is_recurring || editForm.recurMode === 'this') && (
              <FormGroup>
                <Label><strong>Date</strong></Label>
                <Input type="date" value={editForm.sessionDate} onChange={e => setEditForm(f => ({ ...f, sessionDate: e.target.value }))} />
              </FormGroup>
            )}
            <Row form>
              <Col md={6}><FormGroup><Label><strong>Start Time</strong></Label>
                <Input type="time" value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))} />
              </FormGroup></Col>
              <Col md={6}><FormGroup><Label><strong>End Time</strong></Label>
                <Input type="time" value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))} />
              </FormGroup></Col>
            </Row>
            {editSession?.is_recurring && editForm.recurMode !== 'this' && (
              <div style={{ fontSize: 12, color: '#8898aa', marginTop: -8, marginBottom: 8 }}>
                Note: date changes only apply when editing "This event" only.
              </div>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleEdit} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button color="link" onClick={() => setEditOpen(false)}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* ── Recurring Delete Modal ──────────────────────────────────────── */}
      <Modal isOpen={deleteModal.open} toggle={() => setDeleteModal(p => ({ ...p, open: false }))} centered>
        <ModalHeader toggle={() => setDeleteModal(p => ({ ...p, open: false }))}
          style={{ background: '#fff5f5' }}>
          ↺ Delete Recurring Session
        </ModalHeader>
        <ModalBody>
          <p style={{ color: '#525f7f', marginBottom: 16 }}>
            <strong>"{deleteModal.session?.title}"</strong> is a recurring session. Which events do you want to delete?
          </p>
          {SCOPE_OPTIONS.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, border: '2px solid', borderColor: deleteModal.scope === opt.value ? '#f5365c' : '#e0e6ef', marginBottom: 8, cursor: 'pointer', background: deleteModal.scope === opt.value ? '#fff5f5' : '#fff' }}>
              <input type="radio" name="deleteScope" value={opt.value} checked={deleteModal.scope === opt.value}
                onChange={() => setDeleteModal(p => ({ ...p, scope: opt.value }))} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 700, color: '#32325d', fontSize: 13 }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#8898aa' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={handleRecurringDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button color="link" onClick={() => setDeleteModal({ open: false, session: null, scope: 'this' })}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* ── Enrolled Students Modal ──────────────────────────────────────── */}
      <Modal isOpen={studentsModal.open} toggle={() => setStudentsModal(p => ({ ...p, open: false }))} centered size="lg">
        <ModalHeader toggle={() => setStudentsModal(p => ({ ...p, open: false }))}>
          👥 Enrolled Students — {studentsModal.session?.subject_name}
          <div style={{ fontSize: 12, fontWeight: 400, color: '#8898aa', marginTop: 2 }}>
            {studentsModal.session?.title} · {studentsModal.session?.course_name}
          </div>
        </ModalHeader>
        <ModalBody>
          {studentsModal.loading ? (
            <p className="text-center text-muted py-3">Loading...</p>
          ) : studentsModal.students.length === 0 ? (
            <p className="text-center text-muted py-3">No enrolled students</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['#', 'Name', 'Email', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsModal.students.map((st, i) => (
                  <tr key={st.id || i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                    <td style={{ padding: '10px 12px', color: '#8898aa', fontSize: 13 }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#32325d' }}>{st.first_name} {st.last_name}</td>
                    <td style={{ padding: '10px 12px', color: '#525f7f', fontSize: 13 }}>{st.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge color={st.status === 'active' ? 'success' : 'secondary'} style={{ textTransform: 'capitalize' }}>{st.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ModalBody>
      </Modal>
    </>
  );
}
