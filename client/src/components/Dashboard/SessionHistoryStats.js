import React, { useState, useEffect } from "react";
import {
  Card, CardHeader, CardBody, CardTitle,
  Table, Badge, Input, InputGroup, InputGroupAddon, InputGroupText,
  Spinner
} from "reactstrap";
import http from "utils/http";

// ─── Teacher view: per-student session count from /api/classes/my-session-stats
function TeacherSessionHistory() {
  const [stats, setStats] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http.get('/api/classes/my-session-stats')
      .then(r => setStats(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stats.filter(s =>
    !search || `${s.student_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const maxCount = Math.max(...stats.map(s => Number(s.sessions_count)), 1);

  return (
    <Card className="shadow-lg" style={{ borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
      <CardHeader className="border-0" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #fff 100%)', padding: '20px 24px' }}>
        <div className="d-flex align-items-center mb-3">
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #11cdef, #1171ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ni ni-chart-bar-32" style={{ color: '#fff', fontSize: 16 }} />
          </span>
          <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>Session History</CardTitle>
        </div>
        <InputGroup size="sm">
          <InputGroupAddon addonType="prepend">
            <InputGroupText style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }}>
              <i className="ni ni-zoom-split-in" style={{ color: '#8898aa' }} />
            </InputGroupText>
          </InputGroupAddon>
          <Input placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }} />
        </InputGroup>
      </CardHeader>
      <CardBody style={{ paddingTop: 0, maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
        ) : stats.length === 0 ? (
          <div className="text-center py-4 text-muted">No completed sessions yet</div>
        ) : (
          <Table className="align-items-center table-flush mb-0" size="sm">
            <thead className="thead-light">
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Sessions</th>
                <th>Last Session</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-3 text-muted">No matching students</td></tr>
              ) : filtered.map(s => {
                const count = Number(s.sessions_count);
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <tr key={s.student_id}>
                    <td style={{ fontWeight: 700, color: '#3b4a67' }}>{s.student_name}</td>
                    <td style={{ color: '#6b778c' }}>{s.email}</td>
                    <td>
                      <div className="d-flex align-items-center" style={{ gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 4, background: '#e9eef5', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #11cdef, #1171ef)' }} />
                        </div>
                        <Badge color="primary" pill style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{count}</Badge>
                      </div>
                    </td>
                    <td style={{ color: '#6b778c', whiteSpace: 'nowrap' }}>
                      {s.last_session ? new Date(s.last_session).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {!loading && filtered.length > 0 && (
          <div className="text-muted small text-right pt-2 pr-1">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''} · {stats.reduce((a, s) => a + Number(s.sessions_count), 0)} total sessions
          </div>
        )}
      </CardBody>
      <style>{`
        .thead-light th { color: #8898aa !important; font-weight: 700 !important; letter-spacing: .5px; font-size: 11px; text-transform: uppercase; }
      `}</style>
    </Card>
  );
}

// ─── Admin view: session history across all teachers ─────────────────────────
function AdminSessionHistory() {
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http.get('/api/admin/sessions')
      .then(r => setSessions(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter(s => {
    const matchSearch = !search || `${s.title} ${s.teacher_name} ${s.subject_title}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusColor = (st) => ({ completed: 'success', live: 'danger', scheduled: 'info', cancelled: 'secondary' }[st] || 'secondary');

  const summary = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    live: sessions.filter(s => s.status === 'live').length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
  };

  return (
    <Card className="shadow-lg" style={{ borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
      <CardHeader className="border-0" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #fff 100%)', padding: '20px 24px' }}>
        <div className="d-flex align-items-center mb-3">
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #11cdef, #1171ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ni ni-chart-bar-32" style={{ color: '#fff', fontSize: 16 }} />
          </span>
          <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>Session History</CardTitle>
        </div>
        {/* Summary chips */}
        <div className="d-flex flex-wrap mb-3" style={{ gap: 8 }}>
          {[
            { label: 'Total', val: summary.total, color: '#6366f1' },
            { label: 'Completed', val: summary.completed, color: '#28a745' },
            { label: 'Live', val: summary.live, color: '#dc3545' },
            { label: 'Scheduled', val: summary.scheduled, color: '#17a2b8' },
          ].map(chip => (
            <div key={chip.label} style={{ background: '#f3f4f6', borderRadius: 10, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: chip.color, display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3b4a67' }}>{chip.val} {chip.label}</span>
            </div>
          ))}
        </div>
        <div className="d-flex flex-wrap" style={{ gap: 8 }}>
          <InputGroup size="sm" style={{ flex: 1, minWidth: 160 }}>
            <InputGroupAddon addonType="prepend">
              <InputGroupText style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }}>
                <i className="ni ni-zoom-split-in" style={{ color: '#8898aa' }} />
              </InputGroupText>
            </InputGroupAddon>
            <Input placeholder="Search session / teacher…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }} />
          </InputGroup>
          <Input type="select" bsSize="sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ width: 'auto', minWidth: 120, borderRadius: 10, fontWeight: 600 }}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Input>
        </div>
      </CardHeader>
      <CardBody style={{ paddingTop: 0, maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
        ) : (
          <Table className="align-items-center table-flush mb-0" size="sm">
            <thead className="thead-light">
              <tr>
                <th>Title</th>
                <th>Teacher</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-3 text-muted">No sessions found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: '#3b4a67' }}>{s.title || 'Untitled'}</td>
                  <td style={{ color: '#6b778c' }}>{s.teacher_name || '—'}</td>
                  <td style={{ color: '#6b778c' }}>{s.subject_title || s.class_title || '—'}</td>
                  <td style={{ color: '#6b778c', whiteSpace: 'nowrap' }}>
                    {s.session_date ? new Date(s.session_date).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <Badge color={statusColor(s.status)}
                      style={{ borderRadius: 10, padding: '3px 8px', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {!loading && filtered.length > 0 && (
          <div className="text-muted small text-right pt-2 pr-1">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function SessionHistoryStats() {
  const role = (localStorage.getItem('role') || '').toLowerCase();
  if (role === 'admin') return <AdminSessionHistory />;
  if (role === 'teacher') return <TeacherSessionHistory />;
  return null;
}
