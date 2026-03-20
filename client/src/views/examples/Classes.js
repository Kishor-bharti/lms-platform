import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
} from "reactstrap";
import Header from "components/Headers/Header.js";
import http from "utils/http";
import { SessionCardSkeleton } from 'components/Skeleton.js';

const TODAY = new Date().toISOString().slice(0, 10);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

const RECUR_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatRecurrenceInfo(session) {
  const { recur_pattern: pattern, recur_days: days, recur_until: until } = session;
  if (pattern === 'daily') return `Repeats daily${until ? ` until ${until}` : ''}`;
  if (pattern === 'weekly') {
    const dayNames = days?.length ? days.map(d => RECUR_DAY_SHORT[d]).join(', ') : 'weekly';
    return `Repeats every ${dayNames}${until ? ` until ${until}` : ''}`;
  }
  return `Recurring (${pattern || 'regular'})`;
}

function shiftDay(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${MO_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'LIVE':      return <Badge color="danger" className="live-blink">● LIVE</Badge>;
    case 'TODAY':     return <Badge color="warning">TODAY</Badge>;
    case 'TOMORROW':  return <Badge color="info">TOMORROW</Badge>;
    case 'COMPLETED': return <Badge color="secondary">COMPLETED</Badge>;
    case 'SCHEDULED': return <Badge color="light">SCHEDULED</Badge>;
    case 'MISSED':    return <Badge color="dark">MISSED</Badge>;
    default:          return <Badge>{status}</Badge>;
  }
};

const Classes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get('date') || TODAY;

  const [sessions,        setSessions]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);

  // Filters — persist across date changes until manually cleared
  const EMPTY_FILTERS = { teacher: '', course: '', subject: '', topic: '' };
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const filterOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    return {
      teachers: uniq(sessions.map(s => s.teacher_name)),
      courses:  uniq(sessions.map(s => s.course_name)),
      subjects: uniq(sessions.map(s => s.class_title)),
      topics:   uniq(sessions.map(s => s.topic_name)),
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!Object.values(filters).some(Boolean)) return sessions;
    return sessions.filter(s => {
      if (filters.teacher && s.teacher_name !== filters.teacher) return false;
      if (filters.course  && s.course_name  !== filters.course)  return false;
      if (filters.subject && s.class_title  !== filters.subject) return false;
      if (filters.topic   && (s.topic_name  || '') !== filters.topic) return false;
      return true;
    });
  }, [sessions, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const fetchSessions = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await http.get(`/api/classes/my-sessions-v2?date=${date}`);
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error('[Classes] fetch error:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the selected date changes
  useEffect(() => {
    fetchSessions(selectedDate);
    setExpandedSession(null);
  }, [selectedDate, fetchSessions]);

  // Poll every 60s for today only (LIVE status updates)
  useEffect(() => {
    if (selectedDate !== TODAY) return;
    const interval = setInterval(() => fetchSessions(TODAY), 60000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchSessions]);

  const handleDateChange = (e) => {
    if (e.target.value) setSearchParams({ date: e.target.value });
  };

  const goToday = () => setSearchParams({ date: TODAY });
  const prevDay = () => setSearchParams({ date: shiftDay(selectedDate, -1) });
  const nextDay = () => setSearchParams({ date: shiftDay(selectedDate,  1) });

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
                    <CardTitle className="mb-0">My Classes</CardTitle>
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
                {/* ── Filter bar ── */}
                {(() => {
                  const defs = [
                    { key: 'teacher', label: 'Teacher', opts: filterOptions.teachers },
                    { key: 'course',  label: 'Course',  opts: filterOptions.courses  },
                    { key: 'subject', label: 'Subject', opts: filterOptions.subjects },
                    { key: 'topic',   label: 'Topic',   opts: filterOptions.topics   },
                  ];
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
                          {' '}class{filteredSessions.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="session-stack">
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">
                        {activeFilterCount > 0
                          ? 'No classes match the selected filters.'
                          : `No classes scheduled for ${selectedDate}`}
                      </p>
                      {activeFilterCount > 0 && (
                        <Button size="sm" color="secondary" outline onClick={clearFilters}>Clear filters</Button>
                      )}
                    </div>
                  ) : (
                    filteredSessions.map((session) => {
                      const scheduledDate = new Date(session.scheduled_at);
                      const dayName = DAY_NAMES[scheduledDate.getDay()];
                      const dateStr = scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={session.id}
                          className="session-item mb-3 bg-white border rounded"
                          style={{
                            borderLeft: `4px solid ${session.status === 'LIVE' ? '#dc3545' : session.status === 'MISSED' ? '#6c757d' : '#96c8ff'}`,
                            backgroundColor: session.status === 'LIVE' ? '#fff5f5' : session.status === 'MISSED' ? '#f8f9fa' : 'white',
                          }}
                        >
                          {/* ── Main row ── */}
                          <div className="p-3 d-flex justify-content-between align-items-start">
                            <div
                              className="flex-grow-1"
                              style={{ cursor: 'pointer' }}
                              onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                            >
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
                              {/* Row 2: subject · course · date · time */}
                              <div className="small text-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <span>📚 {session.class_title}</span>
                                {session.course_name && <span>🎓 {session.course_name}</span>}
                                <span>📅 {dayName}, {dateStr}</span>
                                <span>
                                  ⏰ {timeStr}
                                  {session.end_time ? ` – ${fmtTime(session.end_time)}` : ''}
                                </span>
                              </div>
                              {/* Row 3: teacher */}
                              {session.teacher_name && (
                                <div className="small text-muted mt-1">
                                  👤 {session.teacher_name}
                                </div>
                              )}
                            </div>

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
                              <Button
                                size="sm" color="dark"
                                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                              >
                                {expandedSession === session.id ? 'Close' : 'Details'}
                              </Button>
                            </div>
                          </div>

                          {/* ── Details panel (read-only for students) ── */}
                          {expandedSession === session.id && (
                            <div style={{ borderTop: '1px solid #e8f0f6', padding: '16px', backgroundColor: '#f8fbff' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Subject</div>
                                  <div style={{ fontWeight: 600 }}>{session.class_title}</div>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Course</div>
                                  <div style={{ fontWeight: 600 }}>{session.course_name || '—'}</div>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Date</div>
                                  <div style={{ fontWeight: 600 }}>{dayName}, {dateStr}</div>
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                  <div className="small text-muted mb-1">Time</div>
                                  <div style={{ fontWeight: 600 }}>
                                    {timeStr}{session.end_time ? ` – ${fmtTime(session.end_time)}` : ''}
                                  </div>
                                </div>
                                {session.teacher_name && (
                                  <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                    <div className="small text-muted mb-1">Teacher</div>
                                    <div style={{ fontWeight: 600 }}>{session.teacher_name}</div>
                                  </div>
                                )}
                                {session.is_recurring && session.recur_until && (
                                  <div style={{ background: '#fff', border: '1px solid #e9eef5', borderRadius: '8px', padding: '10px' }}>
                                    <div className="small text-muted mb-1">Repeats Until</div>
                                    <div style={{ fontWeight: 600 }}>{session.recur_until}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
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
    </>
  );
};

export default Classes;
