import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
  Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";
import { SessionCardSkeleton } from 'components/Skeleton.js';

const TODAY = new Date().toISOString().slice(0, 10);

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MO_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Shift a YYYY-MM-DD string by ±n days */
function shiftDay(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

/** Format YYYY-MM-DD → "Monday, January 20, 2026" */
function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${MO_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format YYYY-MM-DD → "M/D/YYYY" (US) */
function fmtDateUS(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

/** Format "HH:MM:SS" or "HH:MM:SS+05:30" → "6:30 PM" */
function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

const RECUR_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Build the hover tooltip text for the recurring badge */
function formatRecurrenceInfo(session) {
  const { recur_pattern: pattern, recur_days: days, recur_until: until } = session;
  if (pattern === 'daily') return `Repeats daily${until ? ` until ${until}` : ''}`;
  if (pattern === 'weekly') {
    const dayNames = days?.length ? days.map(d => RECUR_DAY_SHORT[d]).join(', ') : 'weekly';
    return `Repeats every ${dayNames}${until ? ` until ${until}` : ''}`;
  }
  return `Recurring (${pattern || 'regular'})`;
}

/** Returns true if now >= scheduledAt − 5 min */
function canStartSession(scheduledAt) {
  return Date.now() >= new Date(scheduledAt).getTime() - 5 * 60 * 1000;
}

const STATUS_PRIORITY = { LIVE: 0, TODAY: 1, TOMORROW: 2, SCHEDULED: 3, MISSED: 4, COMPLETED: 5 };

const sortSessions = (list) =>
  list.filter(Boolean).sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return a.status === 'COMPLETED' ? tb - ta : ta - tb;
  });

const Sessions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get('date') || TODAY;

  const [sessions,        setSessions]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [userRole,        setUserRole]        = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [actionError,     setActionError]     = useState("");

  const [deleteModal,     setDeleteModal]     = useState({ open: false, session: null });
  const [deletingSession, setDeletingSession] = useState(false);

  const [rescheduleModal,  setRescheduleModal]  = useState({ open: false, session: null });
  const [rescheduleForm,   setRescheduleForm]   = useState({ title: '', date: '', time: '', endTime: '' });
  const [rescheduling,     setRescheduling]     = useState(false);
  const [rescheduleError,  setRescheduleError]  = useState('');

  // Admin-only filter state — intentionally NOT reset on date change
  const EMPTY_FILTERS = { teacher: '', course: '', subject: '', topic: '', student: '' };
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Build dropdown options from the full (unfiltered) session list
  const filterOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    const studentSet = new Set();
    sessions.forEach(s => {
      if (s.target_students) s.target_students.split(',').forEach(n => studentSet.add(n.trim()));
    });
    return {
      teachers: uniq(sessions.map(s => s.teacher_name)),
      courses:  uniq(sessions.map(s => s.course_name)),
      subjects: uniq(sessions.map(s => s.class_title)),
      topics:   uniq(sessions.map(s => s.topic_name)),
      students: [...studentSet].sort(),
    };
  }, [sessions]);

  // Apply active filters to the session list (all roles)
  const filteredSessions = useMemo(() => {
    if (!Object.values(filters).some(Boolean)) return sessions;
    return sessions.filter(s => {
      if (filters.teacher && s.teacher_name !== filters.teacher) return false;
      if (filters.course  && s.course_name  !== filters.course)  return false;
      if (filters.subject && s.class_title  !== filters.subject) return false;
      if (filters.topic   && (s.topic_name  || '') !== filters.topic) return false;
      if (filters.student) {
        if (!s.target_students) return false;
        const names = s.target_students.split(',').map(n => n.trim());
        if (!names.includes(filters.student)) return false;
      }
      return true;
    });
  }, [sessions, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  useEffect(() => {
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    setUserRole(role);
  }, []);

  const fetchSessions = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await http.get(`/api/classes/my-sessions-v2?date=${date}`);
      setSessions(sortSessions(Array.isArray(res?.data) ? res.data : []));
    } catch (err) {
      console.error('[Sessions] fetch error:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the selected date changes
  useEffect(() => {
    fetchSessions(selectedDate);
    setExpandedSession(null);
    setActionError("");
  }, [selectedDate, fetchSessions]);

  // Poll every 60s — only for today's date (LIVE status updates)
  useEffect(() => {
    if (selectedDate !== TODAY) return;
    const interval = setInterval(() => fetchSessions(TODAY), 60000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchSessions]);

  const handleDateChange = (e) => {
    if (e.target.value) setSearchParams({ date: e.target.value });
  };

  const goToday   = () => setSearchParams({ date: TODAY });
  const prevDay   = () => setSearchParams({ date: shiftDay(selectedDate, -1) });
  const nextDay   = () => setSearchParams({ date: shiftDay(selectedDate,  1) });

  // Left / right arrow keys navigate between days
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft')  prevDay();
      if (e.key === 'ArrowRight') nextDay();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // no deps — always reads latest selectedDate via closure

  const getStatusBadge = (status) => {
    switch (status) {
      case 'LIVE':      return <Badge color="danger" className="live-blink">● LIVE</Badge>;
      case 'TODAY':     return <Badge color="warning">TODAY</Badge>;
      case 'TOMORROW':  return <Badge color="info">TOMORROW</Badge>;
      case 'COMPLETED': return <Badge style={{ background: '#6c757d', color: '#fff' }}>COMPLETED</Badge>;
      case 'SCHEDULED': return <Badge color="light">SCHEDULED</Badge>;
      case 'MISSED':
        return userRole === 'student'
          ? <Badge style={{ background: '#212529', color: '#fff' }}>About to Reschedule</Badge>
          : <Badge color="danger">MISSED</Badge>;
      default:          return <Badge>{status}</Badge>;
    }
  };

  const toggleDetails = (sessionId) => {
    const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
    if (role === 'teacher' || role === 'admin') {
      setExpandedSession(expandedSession === sessionId ? null : sessionId);
    }
  };

  const handleStartSession = async (sessionId) => {
    setStartingSession(sessionId);
    setActionError("");
    try {
      const response = await http.post(`/api/classes/sessions/${sessionId}/start`);
      const updated = response?.data;
      if (updated && updated.id) {
        setSessions(prev => sortSessions(prev.map(s => s.id === sessionId ? updated : s)));
      }
      setExpandedSession(null);
      const openUrl = updated?.start_url || updated?.zoom_link;
      if (openUrl) window.open(openUrl, '_blank');
    } catch (error) {
      console.error('Failed to start session:', error);
      setActionError(error?.response?.data?.error || 'Failed to start session');
    } finally {
      setStartingSession(null);
    }
  };

  const handleEndSession = async (sessionId) => {
    setStartingSession(sessionId);
    setActionError("");
    try {
      const response = await http.post(`/api/classes/sessions/${sessionId}/complete`);
      const updated = response?.data;
      if (updated && updated.id) {
        setSessions(prev => sortSessions(prev.map(s => s.id === sessionId ? updated : s)));
      }
      setExpandedSession(null);
    } catch (error) {
      console.error('Failed to end session:', error);
      setActionError(error?.response?.data?.error || 'Failed to end session');
    } finally {
      setStartingSession(null);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteModal.session) return;
    setDeletingSession(true);
    try {
      await http.delete(`/api/classes/sessions/${deleteModal.session.id}`);
      setDeleteModal({ open: false, session: null });
      setExpandedSession(null);
      fetchSessions(selectedDate);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete session');
    } finally {
      setDeletingSession(false);
    }
  };

  const openReschedule = (session) => {
    setRescheduleForm({
      title:   session.title || '',
      date:    session.scheduled_at.slice(0, 10),
      time:    session.scheduled_at.slice(11, 16),
      endTime: session.end_time ? session.end_time.slice(0, 5) : '',
    });
    setRescheduleError('');
    setRescheduleModal({ open: true, session });
  };

  const handleReschedule = async () => {
    if (!rescheduleForm.title || !rescheduleForm.date || !rescheduleForm.time) {
      setRescheduleError('Title, date, and start time are required');
      return;
    }
    setRescheduling(true);
    setRescheduleError('');
    try {
      await http.patch(`/api/admin/sessions/${rescheduleModal.session.id}`, {
        title:       rescheduleForm.title,
        sessionDate: rescheduleForm.date,
        startTime:   rescheduleForm.time + ':00+05:30',
        endTime:     rescheduleForm.endTime ? rescheduleForm.endTime + ':00+05:30' : undefined,
      });
      setRescheduleModal({ open: false, session: null });
      fetchSessions(selectedDate);
    } catch (err) {
      setRescheduleError(err?.response?.data?.error || 'Failed to reschedule session');
    } finally {
      setRescheduling(false);
    }
  };

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  if (loading) {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
          <Row><Col lg="12">
            <Card><CardBody className="py-4"><SessionCardSkeleton count={5} /></CardBody></Card>
          </Col></Row>
        </Container>
      </>
    );
  }

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: "rgb(196, 214, 226)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="12">
            <Card className="shadow mb-4" style={{ backgroundColor: "#f0f4f8", borderRadius: "8px" }}>
              <CardHeader className="border-0" style={{ backgroundColor: "#e8f0f6", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                  <div>
                    <CardTitle className="mb-0">Sessions</CardTitle>
                    <div className="small text-muted mt-1" style={{ fontWeight: 600, fontSize: 13 }}>
                      {formatDayLabel(selectedDate)}
                    </div>
                  </div>
                  <div className="d-flex align-items-center" style={{ gap: 6 }}>
                    <button onClick={prevDay} title="Previous day (←)"
                      style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525f7f' }}>
                      ‹
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, color: '#525f7f', cursor: 'pointer' }}
                    />
                    <button onClick={nextDay} title="Next day (→)"
                      style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525f7f' }}>
                      ›
                    </button>
                    <Button
                      size="sm"
                      color="primary"
                      outline={selectedDate !== TODAY}
                      onClick={goToday}
                      style={{ opacity: selectedDate === TODAY ? 0.55 : 1 }}
                      disabled={selectedDate === TODAY}
                    >Today</Button>
                  </div>
                </div>
              </CardHeader>

              <CardBody>
                {/* ── Filter bar (all roles, columns vary by role) ── */}
                {userRole && (() => {
                  // admin → all 5; teacher → no teacher; student → no student
                  const defs = [
                    userRole !== 'teacher'  && { key: 'teacher', label: 'Teacher',  opts: filterOptions.teachers },
                    { key: 'course',  label: 'Course',   opts: filterOptions.courses  },
                    { key: 'subject', label: 'Subject',  opts: filterOptions.subjects },
                    { key: 'topic',   label: 'Topic',    opts: filterOptions.topics   },
                    userRole !== 'student'  && { key: 'student', label: 'Student',  opts: filterOptions.students },
                  ].filter(Boolean);
                  // only render if at least one dropdown has options
                  if (defs.every(d => d.opts.length === 0)) return null;
                  return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                      <span className="small font-weight-bold" style={{ color: '#525f7f', marginRight: 4 }}>Filter:</span>

                      {defs.map(({ key, label, opts }) => (
                        <select
                          key={key}
                          value={filters[key]}
                          onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
                          style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${filters[key] ? '#5e72e4' : '#dee2e6'}`, fontSize: 13, color: filters[key] ? '#5e72e4' : '#525f7f', background: filters[key] ? '#eef0fd' : '#fff', cursor: 'pointer', fontWeight: filters[key] ? 600 : 400 }}
                        >
                          <option value="">All {label}s</option>
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ))}

                      {activeFilterCount > 0 && (
                        <Button size="sm" color="danger" outline onClick={clearFilters} style={{ fontSize: 12 }}>
                          Clear ({activeFilterCount})
                        </Button>
                      )}

                      <span className="small ml-auto" style={{ color: '#525f7f' }}>
                        <strong>{filteredSessions.length}</strong>
                        {activeFilterCount > 0 && <span style={{ color: '#8898aa' }}> / {sessions.length}</span>}
                        {' '}session{filteredSessions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  );
                })()}

                {actionError && (
                  <div className="mb-3">
                    <small className="text-danger font-weight-bold">⚠ {actionError}</small>
                  </div>
                )}

                <div className="session-stack">
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">
                        {activeFilterCount > 0
                          ? 'No sessions match the selected filters.'
                          : `No sessions scheduled for ${selectedDate}`}
                      </p>
                      {activeFilterCount > 0 && (
                        <Button size="sm" color="secondary" outline onClick={clearFilters}>Clear filters</Button>
                      )}
                    </div>
                  ) : (
                    filteredSessions.map((session) => (
                      <div
                        key={session.id}
                        className="session-item mb-3 bg-white border rounded"
                        style={{
                          borderLeft: `4px solid ${session.status === 'LIVE' ? '#dc3545' : session.status === 'MISSED' ? (isTeacherOrAdmin ? '#dc3545' : '#343a40') : '#96c8ff'}`,
                          backgroundColor: session.status === 'LIVE' ? '#fff5f5' : session.status === 'MISSED' ? (isTeacherOrAdmin ? '#fff5f5' : '#f8f9fa') : 'white',
                        }}
                      >
                        {/* ── Main row ── */}
                        <div className="p-3 d-flex justify-content-between align-items-start">
                          <div
                            className="flex-grow-1"
                            style={{ cursor: isTeacherOrAdmin ? 'pointer' : 'default' }}
                            onClick={() => toggleDetails(session.id)}
                          >
                            {isTeacherOrAdmin ? (
                              <>
                                {/* Row 1: title + session type + status */}
                                <div className="d-flex align-items-center mb-1" style={{ gap: '6px', flexWrap: 'wrap' }}>
                                  <h5 className="mb-0">{session.title || 'Untitled Session'}</h5>
                                  {session.is_recurring ? (
                                    <span title={formatRecurrenceInfo(session)} style={{ cursor: 'help' }}>
                                      <Badge color="info" style={{ fontSize: 10 }}>↻ RECURRING ⓘ</Badge>
                                    </span>
                                  ) : (
                                    <Badge color="light" style={{ fontSize: 10, color: '#6c757d', border: '1px solid #dee2e6' }}>ONE-TIME</Badge>
                                  )}
                                  {getStatusBadge(session.status)}
                                </div>
                                {/* Row 2: subject · course · teacher (admin) · date · time */}
                                <div className="small text-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                  <span>📚 {session.class_title}</span>
                                  {session.course_name && <span>🎓 {session.course_name}</span>}
                                  {userRole === 'admin' && session.teacher_name && <span>👤 {session.teacher_name}</span>}
                                  <span>📅 {fmtDateUS(session.scheduled_at.slice(0, 10))}</span>
                                  <span>
                                    ⏰ {fmtTime(session.scheduled_at.slice(11, 19))}
                                    {session.end_time ? ` – ${fmtTime(session.end_time)}` : ''}
                                  </span>
                                </div>
                                {/* Row 3: topic · target students · recur-until */}
                                <div className="small text-muted mt-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                  {session.topic_name && <span>📖 {session.topic_name}</span>}
                                  <span>
                                    👥 {session.target_count > 0
                                      ? `${session.target_count} student${session.target_count > 1 ? 's' : ''} targeted`
                                      : 'All enrolled'}
                                  </span>
                                  {session.is_recurring && session.recur_until && (
                                    <span>🔁 Until {fmtDateUS(session.recur_until)}</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="d-flex align-items-center mb-1" style={{ gap: '8px' }}>
                                  <h5 className="mb-0">{session.title || 'Untitled Session'}</h5>
                                  {getStatusBadge(session.status)}
                                </div>
                                <div className="small text-muted">
                                  <span className="mr-3">📚 {session.class_title}</span>
                                  <span>🕐 {new Date(session.scheduled_at).toLocaleString('en-US')}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="d-flex align-items-center" style={{ gap: '6px', marginLeft: '12px' }}>
                            {session.status === 'LIVE' && (
                              <Button size="sm" color="success" onClick={() => session.zoom_link && window.open(session.zoom_link, '_blank')}>
                                Join
                              </Button>
                            )}
                            {session.status === 'COMPLETED' && (
                              <Button size="sm" color="light" onClick={() => session.zoom_link && window.open(session.zoom_link, '_blank')}>
                                Replay
                              </Button>
                            )}
                            {isTeacherOrAdmin ? (
                              <Button size="sm" color="dark" onClick={() => toggleDetails(session.id)}>
                                {expandedSession === session.id ? 'Close' : 'Details'}
                              </Button>
                            ) : (
                              <Button size="sm" color="dark">Details</Button>
                            )}
                          </div>
                        </div>

                        {/* ── Details panel — teacher/admin only ── */}
                        {expandedSession === session.id && isTeacherOrAdmin && (
                          <div style={{ borderTop: '1px solid #e8f0f6', padding: '16px', backgroundColor: '#f8fbff' }}>
                            {/* Info grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Subject</div>
                                <div style={{ fontWeight: 600 }}>{session.class_title}</div>
                              </div>
                              {session.course_name && (
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Course</div>
                                  <div style={{ fontWeight: 600 }}>{session.course_name}</div>
                                </div>
                              )}
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Date</div>
                                <div style={{ fontWeight: 600 }}>{formatDayLabel(session.scheduled_at.slice(0, 10))}</div>
                              </div>
                              <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                <div className="small text-muted mb-1">Time</div>
                                <div style={{ fontWeight: 600 }}>
                                  {fmtTime(session.scheduled_at.slice(11, 19))}
                                  {session.end_time ? ` – ${fmtTime(session.end_time)}` : ''}
                                </div>
                              </div>
                              {userRole === 'admin' && session.teacher_name && (
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Teacher</div>
                                  <div style={{ fontWeight: 600 }}>{session.teacher_name}</div>
                                </div>
                              )}
                              {session.topic_name && (
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Topic</div>
                                  <div style={{ fontWeight: 600 }}>{session.topic_name}</div>
                                </div>
                              )}
                              {session.is_recurring && session.recur_until && (
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Repeats Until</div>
                                  <div style={{ fontWeight: 600 }}>{fmtDateUS(session.recur_until)}</div>
                                </div>
                              )}
                              {session.target_count > 0 && session.target_students && (
                                <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Targeted Students ({session.target_count})</div>
                                  <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {session.target_students.split(',').map((name, i) => (
                                      <div key={i} className="small" style={{ padding: '3px 0', borderBottom: '1px solid #f0f4f8' }}>
                                        {name.trim()}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {session.status === 'MISSED' ? (
                              <div style={{ padding: '10px 14px', background: '#fff3cd', borderRadius: 6, color: '#856404', fontSize: 13, fontWeight: 500 }}>
                                This session was not started within the allowed window and has been marked as missed.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {session.status !== 'COMPLETED' && (() => {
                                  const isLive  = session.status === 'LIVE';
                                  const okToStart = isLive || canStartSession(session.scheduled_at);
                                  const busy    = startingSession === session.id;
                                  return (
                                    <button
                                      disabled={busy || (!isLive && !okToStart)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        isLive ? handleEndSession(session.id) : handleStartSession(session.id);
                                      }}
                                      title={!isLive && !okToStart ? 'Available 5 minutes before scheduled start time' : ''}
                                      style={{
                                        border: 'none', borderRadius: '6px', padding: '8px 20px',
                                        fontWeight: '600', fontSize: '14px',
                                        cursor: busy || (!isLive && !okToStart) ? 'not-allowed' : 'pointer',
                                        opacity: busy || (!isLive && !okToStart) ? 0.5 : 1,
                                        background: isLive ? '#f5365c' : '#2dce89',
                                        color: '#fff',
                                        boxShadow: isLive
                                          ? '0 4px 6px rgba(245,54,92,.35)'
                                          : '0 4px 6px rgba(45,206,137,.35)',
                                        transition: 'background 0.3s ease, box-shadow 0.3s ease',
                                      }}
                                    >
                                      {busy
                                        ? 'Processing...'
                                        : isLive
                                          ? 'End Session'
                                          : okToStart ? 'Start Live Session' : 'Not Available Yet'}
                                    </button>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Admin-only: Delete + Reschedule */}
                            {userRole === 'admin' && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                {session.status !== 'COMPLETED' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openReschedule(session); }}
                                    style={{ border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', background: '#5e72e4', color: '#fff', boxShadow: '0 4px 6px rgba(94,114,228,.3)' }}
                                  >
                                    Reschedule
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, session }); }}
                                  style={{ border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', background: '#f5365c', color: '#fff', boxShadow: '0 4px 6px rgba(245,54,92,.3)' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <style>{`
                  .session-stack .session-item { transition: box-shadow .15s ease; }
                  .session-stack .session-item:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.1); }
                  @keyframes liveBlink { 0%,100% { opacity:1 } 50% { opacity:.4 } }
                  .live-blink { animation: liveBlink 1s infinite; }
                `}</style>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* ── Delete Session Confirmation Modal ── */}
      <Modal isOpen={deleteModal.open} toggle={() => setDeleteModal({ open: false, session: null })} centered size="sm">
        <ModalHeader toggle={() => setDeleteModal({ open: false, session: null })}>Confirm Delete Session</ModalHeader>
        <ModalBody className="text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p>Delete session <strong>{deleteModal.session?.title}</strong>?</p>
          <p className="text-muted small">This will permanently remove the session for all users.</p>
        </ModalBody>
        <ModalFooter className="justify-content-center">
          <Button color="danger" disabled={deletingSession} onClick={handleDeleteSession}>
            {deletingSession ? 'Deleting…' : 'Yes, Delete'}
          </Button>
          <Button color="secondary" outline onClick={() => setDeleteModal({ open: false, session: null })}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* ── Reschedule Session Modal ── */}
      <Modal isOpen={rescheduleModal.open} toggle={() => setRescheduleModal({ open: false, session: null })} centered size="lg">
        <ModalHeader
          toggle={() => setRescheduleModal({ open: false, session: null })}
          style={{ background: 'linear-gradient(135deg,#3b4a67,#6286c3)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
        >
          Reschedule Session
        </ModalHeader>
        <ModalBody style={{ background: '#f8fbff' }}>
          <Form>
            <FormGroup>
              <Label><strong>Title *</strong></Label>
              <Input
                value={rescheduleForm.title}
                onChange={e => setRescheduleForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Session title"
              />
            </FormGroup>
            <Row form>
              <Col md={4}>
                <FormGroup>
                  <Label><strong>Date *</strong></Label>
                  <Input
                    type="date"
                    value={rescheduleForm.date}
                    onChange={e => setRescheduleForm(f => ({ ...f, date: e.target.value }))}
                  />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label><strong>Start Time *</strong></Label>
                  <Input
                    type="time"
                    value={rescheduleForm.time}
                    onChange={e => setRescheduleForm(f => ({ ...f, time: e.target.value }))}
                  />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={rescheduleForm.endTime}
                    onChange={e => setRescheduleForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </FormGroup>
              </Col>
            </Row>
            {rescheduleError && <p className="text-danger small mt-2">{rescheduleError}</p>}
          </Form>
        </ModalBody>
        <ModalFooter style={{ background: '#f8fbff' }}>
          <Button color="primary" disabled={rescheduling} onClick={handleReschedule}>
            {rescheduling ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button color="link" onClick={() => setRescheduleModal({ open: false, session: null })}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default Sessions;
