import React, { useState, useEffect } from "react";
import {
  Card, CardHeader, CardBody, CardTitle,
  Table, Badge, Input, InputGroup, InputGroupAddon, InputGroupText,
  Spinner
} from "reactstrap";
import http from "utils/http";

// ─── Teacher view: students enrolled per subject ──────────────────────────────
function TeacherStudentsView() {
  const [subjects, setSubjects] = useState([]);
  const [studentsBySubject, setStudentsBySubject] = useState({});
  const [activeSubject, setActiveSubject] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await http.get('/api/classes/my-classes-v2');
        const data = Array.isArray(res?.data) ? res.data : [];
        setSubjects(data);
        if (data.length > 0) setActiveSubject(data[0].id);
      } catch {
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!activeSubject || studentsBySubject[activeSubject] !== undefined) return;
    http.get(`/api/classes/subjects/${activeSubject}/students`)
      .then(res => setStudentsBySubject(prev => ({ ...prev, [activeSubject]: Array.isArray(res?.data) ? res.data : [] })))
      .catch(() => setStudentsBySubject(prev => ({ ...prev, [activeSubject]: [] })));
  }, [activeSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  const students = (studentsBySubject[activeSubject] || []).filter(s =>
    !search || `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const loadingStudents = activeSubject && studentsBySubject[activeSubject] === undefined;

  return (
    <Card className="shadow-lg" style={{ borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
      <CardHeader className="border-0" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #fff 100%)', padding: '20px 24px' }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
          <div className="d-flex align-items-center">
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ni ni-single-02" style={{ color: '#fff', fontSize: 16 }} />
            </span>
            <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>My Students</CardTitle>
          </div>
          {subjects.length > 1 && (
            <Input type="select" bsSize="sm" value={activeSubject || ''} onChange={e => setActiveSubject(e.target.value)}
              style={{ width: 'auto', minWidth: 160, borderRadius: 10, fontWeight: 600 }}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title || s.name}</option>)}
            </Input>
          )}
        </div>
        {subjects.length > 0 && (
          <InputGroup className="mt-3" size="sm">
            <InputGroupAddon addonType="prepend">
              <InputGroupText style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }}>
                <i className="ni ni-zoom-split-in" style={{ color: '#8898aa' }} />
              </InputGroupText>
            </InputGroupAddon>
            <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }} />
          </InputGroup>
        )}
      </CardHeader>
      <CardBody style={{ paddingTop: 0, maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-4 text-muted">No subjects assigned</div>
        ) : loadingStudents ? (
          <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
        ) : (
          <Table className="align-items-center table-flush mb-0" size="sm">
            <thead className="thead-light">
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan="3" className="text-center py-3 text-muted">{search ? 'No matching students' : 'No enrolled students'}</td></tr>
              ) : students.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ color: '#8898aa', fontWeight: 600, width: 36 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: '#3b4a67' }}>{s.first_name} {s.last_name}</td>
                  <td style={{ color: '#6b778c' }}>{s.email}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {!loading && students.length > 0 && (
          <div className="text-muted small text-right pt-2 pr-1">
            {students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardBody>
      <style>{`
        .shadow-lg { box-shadow: 0 10px 40px rgba(0,0,0,0.06) !important; }
        .thead-light th { color: #8898aa !important; font-weight: 700 !important; letter-spacing: .5px; font-size: 11px; text-transform: uppercase; }
      `}</style>
    </Card>
  );
}

// ─── Admin view: all users across the platform with filter tabs ───────────────
function AdminStudentsView() {
  const [tab, setTab] = useState('students'); // students | teachers | sessions
  const [subjects, setSubjects] = useState([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Load subjects for filter dropdown
  useEffect(() => {
    http.get('/api/admin/subjects').then(r => setSubjects(Array.isArray(r?.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setRows([]);
    setSearch('');
    const params = filterSubject ? `?subjectId=${filterSubject}` : '';
    const endpoints = {
      students: `/api/admin/users?role=student${filterSubject ? `&subjectId=${filterSubject}` : ''}`,
      teachers: `/api/admin/users?role=teacher`,
      sessions: `/api/admin/sessions${params}`,
    };
    http.get(endpoints[tab])
      .then(r => {
        const data = r?.data;
        // users endpoint returns { users: [], total, page, limit }; sessions returns []
        setRows(Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab, filterSubject]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const hay = tab === 'sessions'
      ? `${r.title} ${r.subject_title} ${r.teacher_name}`
      : `${r.first_name} ${r.last_name} ${r.email}`;
    return hay.toLowerCase().includes(search.toLowerCase());
  });

  const tabStyle = (t) => ({
    padding: '6px 16px',
    borderRadius: 20,
    border: 'none',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    background: tab === t ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f3f4f6',
    color: tab === t ? '#fff' : '#6b778c',
    transition: 'all 0.2s',
  });

  return (
    <Card className="shadow-lg" style={{ borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
      <CardHeader className="border-0" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #fff 100%)', padding: '20px 24px' }}>
        <div className="d-flex align-items-center mb-3">
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ni ni-single-02" style={{ color: '#fff', fontSize: 16 }} />
          </span>
          <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>Platform Overview</CardTitle>
        </div>
        <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
          <button style={tabStyle('students')} onClick={() => setTab('students')}>Students</button>
          <button style={tabStyle('teachers')} onClick={() => setTab('teachers')}>Teachers</button>
          <button style={tabStyle('sessions')} onClick={() => setTab('sessions')}>Sessions</button>
          {(tab === 'students' || tab === 'sessions') && subjects.length > 0 && (
            <Input type="select" bsSize="sm" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              style={{ width: 'auto', minWidth: 140, borderRadius: 10, fontWeight: 600, marginLeft: 8 }}>
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title || s.name}</option>)}
            </Input>
          )}
        </div>
        <InputGroup className="mt-3" size="sm">
          <InputGroupAddon addonType="prepend">
            <InputGroupText style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }}>
              <i className="ni ni-zoom-split-in" style={{ color: '#8898aa' }} />
            </InputGroupText>
          </InputGroupAddon>
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: '#f3f4f6', border: '1px solid #e9eef5' }} />
        </InputGroup>
      </CardHeader>
      <CardBody style={{ paddingTop: 0, maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
        ) : tab === 'sessions' ? (
          <Table className="align-items-center table-flush mb-0" size="sm">
            <thead className="thead-light">
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-3 text-muted">No sessions found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: '#3b4a67' }}>{s.title}</td>
                  <td style={{ color: '#6b778c' }}>{s.subject_title || s.class_title || '—'}</td>
                  <td style={{ color: '#6b778c' }}>{s.teacher_name || '—'}</td>
                  <td style={{ color: '#6b778c' }}>{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString('en-US') : '—'}</td>
                  <td>
                    <Badge color={s.status === 'completed' ? 'success' : s.status === 'live' ? 'danger' : 'secondary'}
                      style={{ borderRadius: 10, padding: '3px 8px', textTransform: 'uppercase', fontSize: 10 }}>
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table className="align-items-center table-flush mb-0" size="sm">
            <thead className="thead-light">
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                {tab === 'students' && <th>Subject</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={tab === 'students' ? 4 : 3} className="text-center py-3 text-muted">No results</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: '#8898aa', fontWeight: 600, width: 36 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: '#3b4a67' }}>{u.first_name} {u.last_name}</td>
                  <td style={{ color: '#6b778c' }}>{u.email}</td>
                  {tab === 'students' && <td style={{ color: '#6b778c' }}>{u.subject_title || '—'}</td>}
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

// ─── Export: renders teacher or admin view based on role ──────────────────────
export default function MyStudents() {
  const role = (localStorage.getItem('role') || '').toLowerCase();
  if (role === 'admin') return <AdminStudentsView />;
  if (role === 'teacher') return <TeacherStudentsView />;
  return null;
}
