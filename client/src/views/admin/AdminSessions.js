import React, { useState, useEffect, useMemo } from 'react';
import { TableSkeleton } from 'components/Skeleton.js';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button,
  Modal, ModalHeader, ModalBody, Badge,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

const STATUS_STYLE = {
  live:      { bg: '#fde8ec', color: '#f5365c' },
  scheduled: { bg: '#e8eeff', color: '#5e72e4' },
  completed: { bg: '#f0f0f0', color: '#8898aa' },
  cancelled: { bg: '#fff3e0', color: '#fb6340' },
};

const SELECT_STYLE = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #dee2e6',
  fontSize: 13, background: '#fff', color: '#525f7f', cursor: 'pointer',
};

export default function AdminSessions() {
  const [sessions,       setSessions]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [teacherFilter,  setTeacherFilter]  = useState('all');
  const [courseFilter,   setCourseFilter]   = useState('all');
  const [studentsModal,  setStudentsModal]  = useState({ open: false, session: null, students: [], loading: false });

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await http.get('/api/admin/sessions');
      setSessions(res.data || []);
    } catch (err) {
      console.error('[AdminSessions]', err);
    } finally {
      setLoading(false);
    }
  };

  const openStudents = async (session) => {
    if (!session.subject_id) {
      alert('Reload the page — session data needs a server restart to include enrolled students.');
      return;
    }
    setStudentsModal({ open: true, session, students: [], loading: true });
    try {
      const res = await http.get(`/api/admin/subjects/${session.subject_id}/enrollments`);
      setStudentsModal((p) => ({ ...p, students: res.data || [], loading: false }));
    } catch {
      setStudentsModal((p) => ({ ...p, students: [], loading: false }));
    }
  };

  // Unique teacher and course options derived from data — filter out undefined values
  const teachers = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => {
      if (s.teacher_id && s.teacher_name && !map.has(s.teacher_id)) {
        map.set(s.teacher_id, s.teacher_name);
      }
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions]);

  const courses = useMemo(() => {
    const set = new Set(sessions.map((s) => s.course_name).filter(Boolean));
    return [...set].sort();
  }, [sessions]);

  const filtered = sessions.filter((s) => {
    const matchSearch  = `${s.title} ${s.subject_name} ${s.teacher_name} ${s.course_name} ${s.topic_name || ''}`
      .toLowerCase().includes(search.toLowerCase());
    const matchStatus  = statusFilter  === 'all' || s.status === statusFilter;
    const matchTeacher = teacherFilter === 'all' || s.teacher_id === teacherFilter;
    const matchCourse  = courseFilter  === 'all' || s.course_name === courseFilter;
    return matchSearch && matchStatus && matchTeacher && matchCourse;
  });

  const counts = {
    all:       sessions.length,
    live:      sessions.filter((s) => s.status === 'live').length,
    scheduled: sessions.filter((s) => s.status === 'scheduled').length,
    completed: sessions.filter((s) => s.status === 'completed').length,
  };

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
                    {/* Search */}
                    <input
                      placeholder="Search sessions..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, width: 180 }}
                    />

                    {/* Teacher filter */}
                    <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} style={SELECT_STYLE}>
                      <option value="all">All Teachers</option>
                      {teachers.map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>

                    {/* Course filter */}
                    <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={SELECT_STYLE}>
                      <option value="all">All Courses</option>
                      {courses.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>

                    {/* Status filter */}
                    {['all', 'live', 'scheduled', 'completed'].map((s) => (
                      <Button key={s} size="sm" color="primary" outline={statusFilter !== s}
                        onClick={() => setStatusFilter(s)}
                        style={{ borderRadius: 20, textTransform: 'capitalize' }}>
                        {s} {counts[s] > 0 && <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: '0 6px', marginLeft: 4, fontSize: 11 }}>{counts[s]}</span>}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Active filters summary */}
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
                        {['Title', 'Topic', 'Subject', 'Course', 'Teacher', 'Date & Time', 'Students', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    {loading ? <TableSkeleton cols={8} rows={6} /> : <tbody>
                      {filtered.map((s) => {
                        const style = STATUS_STYLE[s.status] || STATUS_STYLE.scheduled;
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d', whiteSpace: 'nowrap' }}>{s.title}</td>
                            <td style={{ padding: '12px 14px' }}>
                              {s.topic_name
                                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>📌 {s.topic_name}</span>
                                : <span className="text-muted small">—</span>}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.subject_name}</td>
                            <td style={{ padding: '12px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#11cdef', background: '#e0f9ff', padding: '2px 8px', borderRadius: 10 }}>
                                {s.course_name}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600 }}>{s.teacher_name}</div>
                              <div style={{ fontSize: 11, color: '#8898aa' }}>{s.teacher_email}</div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13, whiteSpace: 'nowrap' }}>
                              {new Date(s.scheduled_at).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <button
                                onClick={() => openStudents(s)}
                                style={{ background: '#eef0fd', border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#5e72e4', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                👥 {s.enrolled_count ?? '—'}
                              </button>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ background: style.bg, color: style.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>}
                  </table>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Enrolled Students Modal */}
      <Modal isOpen={studentsModal.open} toggle={() => setStudentsModal((p) => ({ ...p, open: false }))} centered size="lg">
        <ModalHeader toggle={() => setStudentsModal((p) => ({ ...p, open: false }))}>
          👥 Enrolled Students — {studentsModal.session?.subject_name}
          <div style={{ fontSize: 12, fontWeight: 400, color: '#8898aa', marginTop: 2 }}>
            Session: {studentsModal.session?.title} · {studentsModal.session?.course_name}
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
                  {['#', 'Name', 'Email', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsModal.students.map((st, i) => (
                  <tr key={st.id || i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                    <td style={{ padding: '10px 12px', color: '#8898aa', fontSize: 13 }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#32325d' }}>
                      {st.first_name} {st.last_name}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#525f7f', fontSize: 13 }}>{st.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge color={st.status === 'active' ? 'success' : 'secondary'} style={{ textTransform: 'capitalize' }}>
                        {st.status}
                      </Badge>
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
