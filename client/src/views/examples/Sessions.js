import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button, Card, CardHeader, CardBody, CardTitle,
  Container, Row, Col, Badge,
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
      case 'COMPLETED': return <Badge color="secondary">COMPLETED</Badge>;
      case 'SCHEDULED': return <Badge color="light">SCHEDULED</Badge>;
      case 'MISSED':    return <Badge color="dark">MISSED</Badge>;
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
                {actionError && (
                  <div className="mb-3">
                    <small className="text-danger font-weight-bold">⚠ {actionError}</small>
                  </div>
                )}

                <div className="session-stack">
                  {sessions.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-muted">No sessions scheduled for {selectedDate}</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
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
                                {/* Row 2: subject · course · date · time */}
                                <div className="small text-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                  <span>📚 {session.class_title}</span>
                                  {session.course_name && <span>🎓 {session.course_name}</span>}
                                  <span>📅 {session.scheduled_at.slice(0, 10)}</span>
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
                                    <span>🔁 Until {session.recur_until}</span>
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
                                  <span>🕐 {new Date(session.scheduled_at).toLocaleString()}</span>
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
                            <div style={{ marginBottom: '10px' }}>
                              <div className="small text-muted mb-1">Class</div>
                              <div style={{ fontWeight: 600, padding: '8px', backgroundColor: '#f0f4f8', borderRadius: '6px' }}>
                                {session.class_title}
                              </div>
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
    </>
  );
};

export default Sessions;
