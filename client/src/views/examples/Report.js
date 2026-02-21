import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Badge,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

// ---- Mini bar component (no chart lib needed) ----
function ScoreBar({ value, max = 100, color = '#5e72e4', label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 6 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#525f7f', marginBottom: 3 }}>
          <span>{label}</span>
          <span style={{ fontWeight: 700 }}>{value !== null ? `${value}%` : 'N/A'}</span>
        </div>
      )}
      <div style={{ height: 8, background: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function StatChip({ icon, label, value, color = '#5e72e4' }) {
  return (
    <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 90 }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.2 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// ---- Student view ----
function StudentReport({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card className="shadow" style={{ borderRadius: 12 }}>
        <CardBody className="text-center py-5">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p className="text-muted">No progress data yet. Complete quizzes and assignments to see your stats here.</p>
        </CardBody>
      </Card>
    );
  }

  // Overall summary
  const totalQuizzes  = data.reduce((s, d) => s + d.quizzes_attempted, 0);
  const totalPassed   = data.reduce((s, d) => s + d.quizzes_passed, 0);
  const totalAssign   = data.reduce((s, d) => s + d.assignments_submitted, 0);
  const totalGraded   = data.reduce((s, d) => s + d.assignments_graded, 0);
  const avgScore      = data.filter((d) => d.avg_score_pct !== null).length > 0
    ? (data.reduce((s, d) => s + (d.avg_score_pct ?? 0), 0) / data.filter((d) => d.avg_score_pct !== null).length).toFixed(1)
    : null;

  return (
    <>
      {/* Overall summary */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #5e72e4 0%, #825ee4 100%)' }}>
            <CardBody style={{ padding: '24px 28px' }}>
              <h4 style={{ color: '#fff', marginBottom: 20 }}>Overall Progress</h4>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatChip icon="📚" label="Subjects"    value={data.length}     color="#fff" />
                <StatChip icon="✅" label="Quizzes Done" value={totalQuizzes}   color="#fff" />
                <StatChip icon="🏆" label="Passed"      value={totalPassed}     color="#fff" />
                <StatChip icon="📝" label="Assignments"  value={totalAssign}    color="#fff" />
                <StatChip icon="⭐" label="Graded"       value={totalGraded}    color="#fff" />
                <StatChip icon="📈" label="Avg Score"    value={avgScore ? `${avgScore}%` : 'N/A'} color="#fff" />
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Per-subject cards */}
      <Row>
        {data.map((subj) => {
          const passRate = subj.quizzes_attempted > 0
            ? Math.round((subj.quizzes_passed / subj.quizzes_attempted) * 100)
            : null;
          const assignRate = subj.assignments_submitted > 0 && subj.avg_assignment_marks !== null && subj.max_assignment_marks
            ? Math.round((subj.avg_assignment_marks / subj.max_assignment_marks) * 100)
            : null;

          const scoreColor = subj.avg_score_pct == null ? '#8898aa'
            : subj.avg_score_pct >= 70 ? '#2dce89'
            : subj.avg_score_pct >= 40 ? '#fb6340'
            : '#f5365c';

          return (
            <Col key={subj.subject_id} lg="6" className="mb-4">
              <Card className="shadow h-100" style={{ borderRadius: 12, borderTop: `4px solid ${scoreColor}` }}>
                <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <CardTitle className="mb-0" style={{ color: '#32325d' }}>{subj.subject_name}</CardTitle>
                      <small className="text-muted">{subj.course_name}</small>
                    </div>
                    <Badge color="light" style={{ fontWeight: 700 }}>{subj.subject_code}</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  {/* Quiz section */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      Quizzes
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { l: 'Attempted', v: subj.quizzes_attempted, c: '#5e72e4' },
                        { l: 'Passed',    v: subj.quizzes_passed,    c: '#2dce89' },
                        { l: 'Pass Rate', v: passRate !== null ? `${passRate}%` : 'N/A', c: '#fb6340' },
                      ].map((item) => (
                        <div key={item.l} style={{ background: '#f0f4f8', borderRadius: 8, padding: '6px 12px', textAlign: 'center', flex: 1, minWidth: 70 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: item.c }}>{item.v}</div>
                          <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 700 }}>{item.l}</div>
                        </div>
                      ))}
                    </div>
                    <ScoreBar value={subj.avg_score_pct ?? 0} color="#5e72e4" label="Avg Score" />
                    <ScoreBar value={subj.best_score_pct ?? 0} color="#2dce89" label="Best Score" />
                  </div>

                  {/* Assignments section */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      Assignments
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      {[
                        { l: 'Submitted', v: subj.assignments_submitted, c: '#5e72e4' },
                        { l: 'Graded',    v: subj.assignments_graded,    c: '#2dce89' },
                        { l: 'Avg Marks', v: subj.avg_assignment_marks !== null ? subj.avg_assignment_marks : 'N/A', c: '#fb6340' },
                      ].map((item) => (
                        <div key={item.l} style={{ background: '#f0f4f8', borderRadius: 8, padding: '6px 12px', textAlign: 'center', flex: 1, minWidth: 70 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: item.c }}>{item.v}</div>
                          <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 700 }}>{item.l}</div>
                        </div>
                      ))}
                    </div>
                    {assignRate !== null && (
                      <ScoreBar value={assignRate} color="#fb6340" label="Assignment Score %" />
                    )}
                  </div>

                  {subj.last_activity_at && (
                    <div style={{ marginTop: 12, fontSize: 11, color: '#8898aa' }}>
                      Last activity: {new Date(subj.last_activity_at).toLocaleDateString()}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>
    </>
  );
}

// ---- Teacher view ----
function TeacherReport({ data }) {
  const [expanded, setExpanded] = useState(null);

  if (!data || data.length === 0) {
    return (
      <Card className="shadow" style={{ borderRadius: 12 }}>
        <CardBody className="text-center py-5">
          <p className="text-muted">No subjects assigned yet. Contact admin to be assigned to subjects.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      {data.map((subj) => {
        const avgScore = subj.students.length > 0 && subj.students.some((s) => s.avg_score_pct !== null)
          ? (subj.students.reduce((sum, s) => sum + (s.avg_score_pct ?? 0), 0) / subj.students.filter((s) => s.avg_score_pct !== null).length).toFixed(1)
          : null;
        const isOpen = expanded === subj.subject_id;

        return (
          <Card key={subj.subject_id} className="shadow mb-4" style={{ borderRadius: 12 }}>
            <CardHeader
              style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12, cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : subj.subject_id)}
            >
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <CardTitle className="mb-0" style={{ color: '#32325d' }}>{subj.subject_name}</CardTitle>
                  <small className="text-muted">{subj.course_name}</small>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ background: '#5e72e420', color: '#5e72e4', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                    {subj.students.length} students
                  </span>
                  {avgScore && (
                    <span style={{ background: '#2dce8920', color: '#2dce89', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                      Class avg: {avgScore}%
                    </span>
                  )}
                  <span style={{ color: '#8898aa', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardBody style={{ overflowX: 'auto' }}>
                {subj.students.length === 0 ? (
                  <p className="text-muted text-center py-3">No enrolled students</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Student', 'Quizzes', 'Passed', 'Avg Score', 'Best Score', 'Assignments', 'Graded', 'Avg Marks', 'Last Active'].map((h) => (
                          <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subj.students.map((s) => (
                        <tr key={s.student_id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: '#32325d' }}>{s.student_name}</div>
                            <div style={{ fontSize: 11, color: '#8898aa' }}>{s.student_email}</div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>{s.quizzes_attempted}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ color: '#2dce89', fontWeight: 700 }}>{s.quizzes_passed}</span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {s.avg_score_pct !== null ? (
                              <span style={{
                                fontWeight: 700,
                                color: s.avg_score_pct >= 70 ? '#2dce89' : s.avg_score_pct >= 40 ? '#fb6340' : '#f5365c',
                              }}>
                                {s.avg_score_pct}%
                              </span>
                            ) : <span style={{ color: '#8898aa' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>
                            {s.best_score_pct !== null ? `${s.best_score_pct}%` : '—'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>{s.assignments_submitted}</td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>{s.assignments_graded}</td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>
                            {s.avg_assignment_marks !== null ? s.avg_assignment_marks : '—'}
                          </td>
                          <td style={{ padding: '12px', color: '#8898aa', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {s.last_activity_at ? new Date(s.last_activity_at).toLocaleDateString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardBody>
            )}
          </Card>
        );
      })}
    </>
  );
}

// ---- Main Report page ----
export default function Report() {
  const [loading,  setLoading]  = useState(true);
  const [role,     setRole]     = useState('');
  const [data,     setData]     = useState([]);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
    setRole(userRole);
    if (userRole !== 'student' && userRole !== 'teacher') {
      setLoading(false);
      return;
    }
    http.get('/api/progress/me')
      .then((res) => { setData(res.data.data || []); })
      .catch(() => setError('Failed to load progress'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row className="mb-4">
          <Col>
            <h2 style={{ color: '#32325d', margin: 0 }}>
              {role === 'teacher' ? 'Class Report' : 'My Progress'}
            </h2>
            <p className="text-muted small mt-1">
              {role === 'teacher' ? 'Live performance data for all your subjects' : 'Your quiz and assignment results across all subjects'}
            </p>
          </Col>
        </Row>

        {loading && (
          <Row><Col><Card className="shadow" style={{ borderRadius: 12 }}><CardBody className="text-center py-5">Loading...</CardBody></Card></Col></Row>
        )}

        {error && (
          <Row><Col><div className="alert alert-danger">{error}</div></Col></Row>
        )}

        {!loading && !error && role === 'student' && <StudentReport data={data} />}
        {!loading && !error && role === 'teacher' && <TeacherReport data={data} />}

        {!loading && role === 'admin' && (
          <Row><Col><Card className="shadow" style={{ borderRadius: 12 }}>
            <CardBody className="text-center py-5">
              <p className="text-muted">Use the Admin Panel to view platform-wide statistics.</p>
            </CardBody>
          </Card></Col></Row>
        )}
      </Container>
    </>
  );
}
