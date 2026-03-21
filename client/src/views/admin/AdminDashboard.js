import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { TableSkeleton, StatValueSkeleton } from 'components/Skeleton.js';

// ─── Popup (generic inline dropdown) ────────────────────────────────────────
function Popup({ items, onClose, renderItem }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 1000, background: '#fff',
      border: '1px solid #e0e6ef', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      minWidth: 220, maxHeight: 300, overflowY: 'auto', padding: '6px 0',
    }}>
      {items.length === 0
        ? <div style={{ padding: '10px 16px', color: '#adb5bd', fontSize: 13 }}>None assigned</div>
        : items.map((item, i) => <div key={i}>{renderItem(item)}</div>)
      }
    </div>
  );
}

// ─── Clickable badge that opens a popup ─────────────────────────────────────
function BadgePopup({ count, color, items, renderItem, label }) {
  const [open, setOpen] = useState(false);
  if (count === 0 && items.length === 0) {
    return <span style={{ color: '#adb5bd', fontSize: 13 }}>—</span>;
  }
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          background: color + '18', color, border: 'none', borderRadius: 20,
          padding: '3px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}
        title={`Click to see ${label}`}
      >
        {count ?? items.length}
      </button>
      {open && (
        <Popup items={items} onClose={() => setOpen(false)} renderItem={renderItem} />
      )}
    </span>
  );
}

const STATUS_COLORS = {
  scheduled: '#5e72e4',
  live:      '#f5365c',
  completed: '#2dce89',
  missed:    '#fb6340',
  cancelled: '#adb5bd',
};
const STATUSES = ['scheduled', 'live', 'completed', 'missed', 'cancelled'];

export default function AdminDashboard() {
  const [stats,           setStats]           = useState(null);
  const [overview,        setOverview]        = useState({ students: [], teachers: [] });
  const [sessions,        setSessions]        = useState([]);
  const [statsLoading,    setStatsLoading]    = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeTab,       setActiveTab]       = useState('students');

  // Session filters
  const [filters, setFilters] = useState({
    date: '', courseId: '', subjectId: '', teacherId: '', studentId: '', status: '',
  });

  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      http.get('/api/admin/stats'),
      http.get('/api/admin/overview'),
    ]).then(([statsRes, overviewRes]) => {
      setStats(statsRes.data);
      setOverview(overviewRes.data);
    }).catch(console.error).finally(() => {
      setStatsLoading(false);
      setOverviewLoading(false);
    });
    fetchSessions({});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSessions = async (f) => {
    setSessionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.date)      params.set('date',      f.date);
      if (f.courseId)  params.set('courseId',  f.courseId);
      if (f.subjectId) params.set('subjectId', f.subjectId);
      if (f.teacherId) params.set('teacherId', f.teacherId);
      if (f.studentId) params.set('studentId', f.studentId);
      if (f.status)    params.set('status',    f.status);
      const qs = params.toString();
      const res = await http.get(`/api/admin/sessions${qs ? '?' + qs : ''}`);
      setSessions(res.data || []);
    } catch (err) {
      console.error('[AdminDashboard] sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const applyFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    if (key === 'courseId') next.subjectId = '';
    setFilters(next);
    fetchSessions(next);
  };

  const clearFilters = () => {
    const empty = { date: '', courseId: '', subjectId: '', teacherId: '', studentId: '', status: '' };
    setFilters(empty);
    fetchSessions(empty);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  // Derive unique courses, subjects, teachers from sessions for filter dropdowns
  const { courses, subjects, teachers } = useMemo(() => {
    const courseMap = {}, subjectMap = {}, teacherMap = {};
    sessions.forEach((s) => {
      if (s.course_id)  courseMap[s.course_id]   = s.course_name;
      if (s.subject_id) subjectMap[s.subject_id] = { name: s.subject_name, courseId: s.course_id };
      if (s.teacher_id) teacherMap[s.teacher_id] = s.teacher_name;
    });
    return {
      courses:  Object.entries(courseMap).map(([id, name]) => ({ id, name })),
      subjects: Object.entries(subjectMap)
        .filter(([, v]) => !filters.courseId || v.courseId === filters.courseId)
        .map(([id, v]) => ({ id, name: v.name })),
      teachers: Object.entries(teacherMap).map(([id, name]) => ({ id, name })),
    };
  }, [sessions, filters.courseId]);

  // Students for filter dropdown (from overview)
  const studentOptions = useMemo(() =>
    overview.students.map((s) => ({ id: s.id, name: s.name })),
    [overview.students]
  );

  const statCards = stats ? [
    { label: 'Students', value: stats.total_students, icon: 'ni ni-single-02',       color: '#5e72e4', bg: '#eef0fd' },
    { label: 'Teachers', value: stats.total_teachers, icon: 'ni ni-hat-3',            color: '#11cdef', bg: '#e3f9fc' },
    { label: 'Courses',  value: stats.total_courses,  icon: 'ni ni-book-bookmark',    color: '#fb6340', bg: '#fff0eb' },
    { label: 'Subjects', value: stats.total_subjects, icon: 'ni ni-collection',       color: '#2dce89', bg: '#e3f9ee' },
    { label: 'Sessions', value: stats.total_sessions, icon: 'ni ni-calendar-grid-58', color: '#f4a261', bg: '#fff4e8' },
    { label: 'Live Now', value: stats.live_sessions,  icon: 'ni ni-button-play',      color: '#f5365c', bg: '#fde8ec' },
  ] : [];

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (t) => t ? t.slice(0, 5) : '—';

  return (
    <>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        {/* ── Stat Cards ── */}
        <Row className="mb-4">
          {statCards.map((c) => (
            <Col key={c.label} lg="2" md="4" sm="6" className="mb-3">
              <Card className="shadow" style={{ borderRadius: 12, border: 'none' }}>
                <CardBody style={{ padding: '16px 20px' }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <div className="text-muted small" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{c.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#32325d', lineHeight: 1.2 }}>
                        {statsLoading ? <StatValueSkeleton /> : c.value}
                      </div>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={c.icon} style={{ color: c.color, fontSize: 20 }} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Quick Actions ── */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardBody>
                <div className="d-flex flex-wrap" style={{ gap: 10 }}>
                  <Button color="primary"   style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-users')}>+ Create User</Button>
                  <Button color="success"   style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-courses')}>+ Create Course</Button>
                  <Button color="warning"   style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-subjects')}>+ Add Subject</Button>
                  <Button color="secondary" style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-allocations')}>Manage Allocations</Button>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* ── Platform Overview ── */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="d-flex align-items-center justify-content-between">
                  <CardTitle className="mb-0" style={{ fontWeight: 700, color: '#32325d' }}>Platform Overview</CardTitle>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['students', 'teachers'].map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: activeTab === tab ? '#5e72e4' : '#e0e6ef',
                        color: activeTab === tab ? '#fff' : '#525f7f',
                        transition: 'all 0.15s',
                      }}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto', padding: 0 }}>
                {overviewLoading ? (
                  <table style={{ width: '100%' }}><TableSkeleton cols={4} rows={5} /></table>
                ) : activeTab === 'students' ? (
                  <StudentsTable students={overview.students} />
                ) : (
                  <TeachersTable teachers={overview.teachers} />
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* ── Session History ── */}
        <Row>
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                  <CardTitle className="mb-0" style={{ fontWeight: 700, color: '#32325d' }}>Session History</CardTitle>
                  <Button size="sm" color="primary" outline onClick={() => navigate('/admin/admin-sessions')}>Manage Sessions</Button>
                </div>
              </CardHeader>

              {/* Filter Bar */}
              <div style={{ padding: '12px 20px', background: '#f8f9fc', borderBottom: '1px solid #e9ecef', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => applyFilter('date', e.target.value)}
                  style={{ ...selectStyle, minWidth: 140 }}
                />
                <FilterSelect
                  value={filters.courseId} placeholder="All Courses"
                  options={courses} onChange={(v) => applyFilter('courseId', v)}
                />
                <FilterSelect
                  value={filters.subjectId} placeholder="All Subjects"
                  options={subjects} onChange={(v) => applyFilter('subjectId', v)}
                />
                <FilterSelect
                  value={filters.teacherId} placeholder="All Teachers"
                  options={teachers} onChange={(v) => applyFilter('teacherId', v)}
                />
                <FilterSelect
                  value={filters.studentId} placeholder="All Students"
                  options={studentOptions} onChange={(v) => applyFilter('studentId', v)}
                />
                <select
                  value={filters.status}
                  onChange={(e) => applyFilter('status', e.target.value)}
                  style={selectStyle}
                >
                  <option value="">All Statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
                {hasFilters && (
                  <button onClick={clearFilters} style={{
                    border: 'none', background: '#f5365c18', color: '#f5365c',
                    borderRadius: 6, padding: '5px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  }}>
                    ✕ Clear Filters
                  </button>
                )}
                {!sessionsLoading && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8898aa', fontWeight: 600 }}>
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <CardBody style={{ overflowX: 'auto', padding: 0 }}>
                {sessionsLoading ? (
                  <table style={{ width: '100%' }}><TableSkeleton cols={9} rows={6} /></table>
                ) : sessions.length === 0 ? (
                  <p className="text-muted text-center py-4">No sessions found</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Title', 'Course', 'Subject', 'Topic', 'Teacher', 'Students', 'Date', 'Time', 'Status', 'Link'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => {
                        const sc = STATUS_COLORS[s.status] || '#adb5bd';
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                            <td style={{ padding: '11px 14px', fontWeight: 600, color: '#32325d', whiteSpace: 'nowrap' }}>{s.title}</td>
                            <td style={{ padding: '11px 14px', color: '#525f7f' }}>{s.course_name}</td>
                            <td style={{ padding: '11px 14px', color: '#525f7f' }}>{s.subject_name}</td>
                            <td style={{ padding: '11px 14px', color: '#8898aa' }}>{s.topic_name || <span style={{ color: '#d0d5dd' }}>—</span>}</td>
                            <td style={{ padding: '11px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>{s.teacher_name}</td>
                            <td style={{ padding: '11px 14px' }}>
                              {s.students.length === 0 ? (
                                <span style={{ color: '#adb5bd', fontSize: 12 }}>All enrolled</span>
                              ) : (
                                <BadgePopup
                                  count={s.students.length}
                                  color="#5e72e4"
                                  items={s.students}
                                  label="students"
                                  renderItem={(st) => (
                                    <div style={{ padding: '7px 16px', fontSize: 13, color: '#32325d', borderBottom: '1px solid #f0f4f8' }}>
                                      {st.student_name}
                                    </div>
                                  )}
                                />
                              )}
                            </td>
                            <td style={{ padding: '11px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>{fmtDate(s.session_date)}</td>
                            <td style={{ padding: '11px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>
                              {fmtTime(s.start_time)}{s.end_time ? ` – ${fmtTime(s.end_time)}` : ''}
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ background: sc + '20', color: sc, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                {s.status}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <SessionLink session={s} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

      </Container>
    </>
  );
}

// ─── Students Table ──────────────────────────────────────────────────────────
function StudentsTable({ students }) {
  if (students.length === 0) {
    return <p className="text-muted text-center py-4">No students found</p>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f8f9fa' }}>
          {['Name', 'Email', 'Subjects Enrolled', 'Allocated Teachers'].map((h) => (
            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {students.map((s) => (
          <tr key={s.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#32325d' }}>{s.name}</td>
            <td style={{ padding: '12px 16px', color: '#525f7f' }}>{s.email}</td>
            <td style={{ padding: '12px 16px' }}>
              <BadgePopup
                count={s.subjects.length}
                color="#2dce89"
                items={s.subjects}
                label="subjects"
                renderItem={(sub) => (
                  <div style={{ padding: '7px 16px', borderBottom: '1px solid #f0f4f8' }}>
                    <div style={{ fontWeight: 600, color: '#32325d', fontSize: 13 }}>{sub.name}</div>
                    <div style={{ color: '#8898aa', fontSize: 11 }}>{sub.course_name}</div>
                  </div>
                )}
              />
            </td>
            <td style={{ padding: '12px 16px' }}>
              <BadgePopup
                count={s.teachers.length}
                color="#11cdef"
                items={s.teachers}
                label="teachers"
                renderItem={(t) => (
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f4f8' }}>
                    <div style={{ fontWeight: 600, color: '#32325d', fontSize: 13 }}>{t.teacher_name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {(t.subjects || []).map((sub, i) => (
                        <span key={i} style={{ background: '#11cdef18', color: '#11cdef', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                          {sub.subject_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Teachers Table ──────────────────────────────────────────────────────────
function TeachersTable({ teachers }) {
  if (teachers.length === 0) {
    return <p className="text-muted text-center py-4">No teachers found</p>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f8f9fa' }}>
          {['Name', 'Email', 'Subjects Teaching', 'Students Allocated'].map((h) => (
            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {teachers.map((t) => (
          <tr key={t.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#32325d' }}>{t.name}</td>
            <td style={{ padding: '12px 16px', color: '#525f7f' }}>{t.email}</td>
            <td style={{ padding: '12px 16px' }}>
              <BadgePopup
                count={t.subjects.length}
                color="#fb6340"
                items={t.subjects}
                label="subjects"
                renderItem={(sub) => (
                  <div style={{ padding: '7px 16px', borderBottom: '1px solid #f0f4f8' }}>
                    <div style={{ fontWeight: 600, color: '#32325d', fontSize: 13 }}>{sub.name}</div>
                    <div style={{ color: '#8898aa', fontSize: 11 }}>{sub.course_name}</div>
                  </div>
                )}
              />
            </td>
            <td style={{ padding: '12px 16px' }}>
              <BadgePopup
                count={t.total_students}
                color="#5e72e4"
                items={t.students || []}
                label="students"
                renderItem={(s) => (
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f4f8', fontSize: 13, color: '#32325d' }}>
                    {s.student_name}
                  </div>
                )}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Session Link / Action button ────────────────────────────────────────────
function SessionLink({ session }) {
  const { status, zoom_link } = session;
  if (status === 'live') {
    return (
      <a
        href={zoom_link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: '#f5365c', color: '#fff', borderRadius: 6,
          padding: '4px 11px', fontSize: 12, fontWeight: 700, textDecoration: 'none',
          cursor: zoom_link ? 'pointer' : 'default', opacity: zoom_link ? 1 : 0.6,
        }}
        onClick={!zoom_link ? (e) => e.preventDefault() : undefined}
      >
        <span style={{ animation: 'blink 1s step-start infinite', fontSize: 8 }}>●</span>
        Join
      </a>
    );
  }
  if (status === 'completed') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#f0f0f0', color: '#adb5bd', border: '1px solid #e0e0e0',
        borderRadius: 6, padding: '4px 11px', fontSize: 12, fontWeight: 700,
        cursor: 'not-allowed',
      }}>
        ▶ Replay
      </span>
    );
  }
  return <span style={{ color: '#d0d5dd' }}>—</span>;
}

// ─── Filter helpers ──────────────────────────────────────────────────────────
const selectStyle = {
  border: '1px solid #d0d9e8', borderRadius: 6, padding: '5px 10px',
  fontSize: 12, color: '#525f7f', background: '#fff', cursor: 'pointer',
  minWidth: 130,
};

function FilterSelect({ value, placeholder, options, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}
