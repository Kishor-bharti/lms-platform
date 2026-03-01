import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

const STATUS_STYLE = {
  live:      { bg: '#fde8ec', color: '#f5365c' },
  scheduled: { bg: '#e8eeff', color: '#5e72e4' },
  completed: { bg: '#f0f0f0', color: '#8898aa' },
  cancelled: { bg: '#fff3e0', color: '#fb6340' },
};

export default function AdminSessions() {
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filtered = sessions.filter((s) => {
    const matchSearch = `${s.title} ${s.subject_name} ${s.teacher_name} ${s.course_name} ${s.topic_name || ''}`
      .toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
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
                <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                  <CardTitle className="mb-0">All Sessions</CardTitle>
                  <div className="d-flex align-items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <input
                      placeholder="Search sessions..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, width: 200 }}
                    />
                    {['all', 'live', 'scheduled', 'completed'].map((s) => (
                      <Button key={s} size="sm" color="primary" outline={statusFilter !== s}
                        onClick={() => setStatusFilter(s)}
                        style={{ borderRadius: 20, textTransform: 'capitalize' }}>
                        {s} {counts[s] > 0 && <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: '0 6px', marginLeft: 4, fontSize: 11 }}>{counts[s]}</span>}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto' }}>
                {loading ? (
                  <p className="text-center text-muted py-4">Loading...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-center text-muted py-4">No sessions found</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Title', 'Topic', 'Subject', 'Course', 'Teacher', 'Date & Time', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
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
                            <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.course_name}</td>
                            <td style={{ padding: '12px 14px', color: '#525f7f', whiteSpace: 'nowrap' }}>
                              <div>{s.teacher_name}</div>
                              <div style={{ fontSize: 11, color: '#8898aa' }}>{s.teacher_email}</div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13, whiteSpace: 'nowrap' }}>
                              {new Date(s.scheduled_at).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ background: style.bg, color: style.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                                {s.status}
                              </span>
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
