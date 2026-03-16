import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { TableSkeleton, StatValueSkeleton } from 'components/Skeleton.js';

export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [statsRes, sessRes] = await Promise.all([
        http.get('/api/admin/stats'),
        http.get('/api/admin/sessions'),
      ]);
      setStats(statsRes.data);
      setSessions((sessRes.data || []).slice(0, 6));
    } catch (err) {
      console.error('[AdminDashboard]', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Students',    value: stats.total_students, icon: 'ni ni-single-02',     color: '#5e72e4', bg: '#eef0fd' },
    { label: 'Teachers',    value: stats.total_teachers, icon: 'ni ni-hat-3',          color: '#11cdef', bg: '#e3f9fc' },
    { label: 'Courses',     value: stats.total_courses,  icon: 'ni ni-book-bookmark',  color: '#fb6340', bg: '#fff0eb' },
    { label: 'Subjects',    value: stats.total_subjects, icon: 'ni ni-collection',     color: '#2dce89', bg: '#e3f9ee' },
    { label: 'Sessions',    value: stats.total_sessions, icon: 'ni ni-calendar-grid-58', color: '#f4a261', bg: '#fff4e8' },
    { label: 'Live Now',    value: stats.live_sessions,  icon: 'ni ni-button-play',    color: '#f5365c', bg: '#fde8ec' },
  ] : [];

  const statusColor = (s) => {
    if (s === 'live')      return '#f5365c';
    if (s === 'scheduled') return '#5e72e4';
    return '#adb5bd';
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        {/* Stat cards */}
        <Row className="mb-4">
          {statCards.map((c) => (
            <Col key={c.label} lg="2" md="4" sm="6" className="mb-3">
              <Card className="shadow" style={{ borderRadius: 12, border: 'none' }}>
                <CardBody style={{ padding: '16px 20px' }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <div className="text-muted small" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{c.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#32325d', lineHeight: 1.2 }}>
                        {loading ? <StatValueSkeleton /> : c.value}
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

        {/* Quick Actions */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardBody>
                <div className="d-flex flex-wrap" style={{ gap: 10 }}>
                  <Button color="primary" style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-users')}>
                    + Create User
                  </Button>
                  <Button color="success" style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-courses')}>
                    + Create Course
                  </Button>
                  <Button color="warning" style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-subjects')}>
                    + Add Subject
                  </Button>
                  <Button color="info" style={{ borderRadius: 8 }} onClick={() => navigate('/admin/admin-sessions')}>
                    View All Sessions
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Recent sessions */}
        <Row>
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle className="mb-0">Recent Sessions</CardTitle>
                <Button size="sm" color="primary" outline onClick={() => navigate('/admin/admin-sessions')}>View All</Button>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto' }}>
                {sessions.length === 0 && !loading ? (
                  <p className="text-muted text-center py-3">No sessions yet</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Session', 'Subject', 'Course', 'Teacher', 'Date', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    {loading ? <TableSkeleton cols={6} rows={5} /> : <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>{s.title}</td>
                          <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.subject_name}</td>
                          <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.course_name}</td>
                          <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.teacher_name}</td>
                          <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13 }}>{new Date(s.scheduled_at).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: statusColor(s.status) + '20', color: statusColor(s.status), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>}
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
