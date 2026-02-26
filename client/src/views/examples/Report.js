import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Badge, Button,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function perfLabel(score) {
  if (score === null || score === undefined) return { label: 'N/A', color: '#8898aa', bg: '#f0f4f8' };
  if (score >= 80) return { label: 'Strong',     color: '#2dce89', bg: '#e3f9ee' };
  if (score >= 60) return { label: 'Good',       color: '#5e72e4', bg: '#eef0fd' };
  if (score >= 40) return { label: 'Needs Work', color: '#fb6340', bg: '#fff0eb' };
  return             { label: 'At Risk',         color: '#f5365c', bg: '#fde8ec' };
}

function fmtTime(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtSecs(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max = 100, color = '#5e72e4', label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#525f7f', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{value !== null ? `${value}%` : 'N/A'}</span>
      </div>
      <div style={{ height: 8, background: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value, color = '#5e72e4' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', textAlign: 'center', minWidth: 88, flex: 1 }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1.2, marginTop: 4 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Weekly Activity Chart ─────────────────────────────────────────────────

function WeeklyChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxQ = Math.max(...data.map(d => d.quizzes), 1);
  const totalQ   = data.reduce((s, d) => s + d.quizzes, 0);
  const totalC   = data.reduce((s, d) => s + d.correct, 0);
  const totalI   = data.reduce((s, d) => s + d.incorrect, 0);
  const totalMin = data.reduce((s, d) => s + d.time_mins, 0);

  return (
    <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
      <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div className="d-flex justify-content-between align-items-center">
          <CardTitle className="mb-0" style={{ color: '#32325d', fontSize: 15 }}>📅 This Week's Activity</CardTitle>
          <span style={{ fontSize: 12, color: '#8898aa' }}>Last 7 days</span>
        </div>
      </CardHeader>
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, paddingBottom: 4 }}>
          {data.map((day, i) => {
            const heightPct = maxQ > 0 ? (day.quizzes / maxQ) * 80 : 0;
            const isToday   = i === data.length - 1;
            const dayLabel  = DAY_LABELS[new Date(day.date + 'T12:00:00').getDay()];
            const tooltip   = `${dayLabel}: ${day.quizzes} quiz(es), ${day.correct}✓ ${day.incorrect}✗, ${fmtTime(day.time_mins)}`;
            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 700, minHeight: 14 }}>
                  {day.quizzes > 0 ? day.quizzes : ''}
                </div>
                <div
                  title={tooltip}
                  style={{
                    width: '100%',
                    height: day.quizzes > 0 ? `${Math.max(heightPct, 8)}%` : '5%',
                    background: isToday ? '#5e72e4' : day.quizzes > 0 ? '#a8b8f8' : '#e9ecef',
                    borderRadius: '4px 4px 2px 2px',
                    transition: 'height 0.4s ease',
                  }}
                />
                <div style={{ fontSize: 10, color: isToday ? '#5e72e4' : '#8898aa', fontWeight: isToday ? 700 : 400 }}>
                  {dayLabel}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Quizzes',   value: totalQ,          color: '#5e72e4' },
            { label: 'Correct',   value: totalC,          color: '#2dce89' },
            { label: 'Incorrect', value: totalI,          color: '#f5365c' },
            { label: 'Time',      value: fmtTime(totalMin), color: '#fb6340' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
              <span style={{ fontSize: 12, color: '#525f7f' }}>
                {item.label}: <strong style={{ color: item.color }}>{item.value}</strong>
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Quiz History Table ───────────────────────────────────────────────────────

function QuizHistory({ data }) {
  const [showAll, setShowAll] = useState(false);
  if (!data || data.length === 0) return null;
  const visible = showAll ? data : data.slice(0, 5);

  return (
    <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
      <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div className="d-flex justify-content-between align-items-center">
          <CardTitle className="mb-0" style={{ color: '#32325d', fontSize: 15 }}>📋 Recent Quiz History</CardTitle>
          <span style={{ fontSize: 12, color: '#8898aa' }}>{data.length} attempts</span>
        </div>
      </CardHeader>
      <CardBody style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {['Quiz', 'Subject', 'Score', '✓', '✗', 'Time', 'Date', 'Level'].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const perf = perfLabel(item.score_pct);
              return (
                <tr key={item.attempt_id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d', maxWidth: 180 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.quiz_title}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13, whiteSpace: 'nowrap' }}>{item.subject_name}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: perf.color }}>
                      {item.score_pct !== null ? `${item.score_pct}%` : '—'}
                    </span>
                    {item.score_pct !== null && (
                      <div style={{ height: 4, background: '#e9ecef', borderRadius: 2, width: 56, marginTop: 3 }}>
                        <div style={{ height: '100%', width: `${item.score_pct}%`, background: perf.color, borderRadius: 2 }} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ color: '#2dce89', fontWeight: 700 }}>{item.correct}</span>
                    <span style={{ color: '#ccc', fontSize: 11 }}>/{item.total_questions}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ color: '#f5365c', fontWeight: 700 }}>{item.incorrect}</span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {fmtSecs(item.time_taken_seconds)}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#8898aa', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(item.submitted_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: perf.bg, color: perf.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {perf.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length > 5 && (
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <Button size="sm" color="link" onClick={() => setShowAll(!showAll)} style={{ color: '#5e72e4', fontWeight: 600 }}>
              {showAll ? 'Show less ▲' : `Show all ${data.length} attempts ▼`}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Student Report ───────────────────────────────────────────────────────────

function StudentReport({ data, weekly, history }) {
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

  const totalQuizzes  = data.reduce((s, d) => s + d.quizzes_attempted, 0);
  const totalPassed   = data.reduce((s, d) => s + d.quizzes_passed, 0);
  const totalAssign   = data.reduce((s, d) => s + d.assignments_submitted, 0);
  const totalTimeMins = data.reduce((s, d) => s + d.total_time_spent_mins, 0);
  const scoredSubjs   = data.filter(d => d.avg_score_pct !== null);
  const avgScore      = scoredSubjs.length > 0
    ? (scoredSubjs.reduce((s, d) => s + d.avg_score_pct, 0) / scoredSubjs.length).toFixed(1)
    : null;
  const overallPerf   = perfLabel(avgScore !== null ? parseFloat(avgScore) : null);

  const weekCorrect  = (weekly || []).reduce((s, d) => s + d.correct, 0);
  const weekTotal    = weekCorrect + (weekly || []).reduce((s, d) => s + d.incorrect, 0);
  const weekAccuracy = weekTotal > 0 ? Math.round((weekCorrect / weekTotal) * 100) : null;

  return (
    <>
      {/* Hero card */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow" style={{ borderRadius: 16, background: 'linear-gradient(135deg, #5e72e4 0%, #825ee4 100%)', border: 'none' }}>
            <CardBody style={{ padding: '28px 32px' }}>
              <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 20 }}>
                <div>
                  <h3 style={{ color: '#fff', marginBottom: 8 }}>Overall Performance</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {avgScore !== null ? (
                      <>
                        <span style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{avgScore}%</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '5px 16px', fontSize: 14, fontWeight: 700 }}>
                          {overallPerf.label}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>No quiz attempts yet</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 500 }}>
                  <StatChip icon="📚" label="Subjects"    value={data.length}              color="#fff" />
                  <StatChip icon="✅" label="Quizzes"     value={totalQuizzes}             color="#fff" />
                  <StatChip icon="🏆" label="Passed"      value={totalPassed}              color="#fff" />
                  <StatChip icon="📝" label="Assignments" value={totalAssign}              color="#fff" />
                  <StatChip icon="⏱️" label="Time Spent"  value={fmtTime(totalTimeMins)}   color="#fff" />
                  {weekAccuracy !== null && (
                    <StatChip icon="🎯" label="Week Acc."  value={`${weekAccuracy}%`}       color="#fff" />
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Weekly chart */}
      <WeeklyChart data={weekly} />

      {/* Quiz history */}
      <QuizHistory data={history} />

      {/* Subject breakdown heading */}
      <Row className="mb-2">
        <Col>
          <h5 style={{ color: '#32325d', marginBottom: 16, fontWeight: 700 }}>Subject Breakdown</h5>
        </Col>
      </Row>

      {/* Per-subject cards */}
      <Row>
        {data.map((subj) => {
          const perf       = perfLabel(subj.avg_score_pct);
          const passRate   = subj.quizzes_attempted > 0
            ? Math.round((subj.quizzes_passed / subj.quizzes_attempted) * 100)
            : null;
          const assignRate = subj.assignments_submitted > 0 && subj.avg_assignment_marks !== null && subj.max_assignment_marks
            ? Math.round((subj.avg_assignment_marks / subj.max_assignment_marks) * 100)
            : null;

          return (
            <Col key={subj.subject_id} lg="6" className="mb-4">
              <Card className="shadow h-100" style={{ borderRadius: 14, borderTop: `4px solid ${perf.color}` }}>
                <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <CardTitle className="mb-0" style={{ color: '#32325d' }}>{subj.subject_name}</CardTitle>
                      <small className="text-muted">{subj.course_name}</small>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Badge color="light" style={{ fontWeight: 700 }}>{subj.subject_code}</Badge>
                      <span style={{ background: perf.bg, color: perf.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                        {perf.label}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  {/* Quiz stats */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      Quizzes
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { l: 'Attempted', v: subj.quizzes_attempted,  c: '#5e72e4' },
                        { l: 'Passed',    v: subj.quizzes_passed,     c: '#2dce89' },
                        { l: 'Pass Rate', v: passRate !== null ? `${passRate}%` : 'N/A', c: passRate !== null && passRate >= 70 ? '#2dce89' : passRate !== null && passRate >= 40 ? '#fb6340' : '#f5365c' },
                        { l: 'Best',      v: subj.best_score_pct !== null ? `${subj.best_score_pct}%` : 'N/A', c: '#825ee4' },
                      ].map((item) => (
                        <div key={item.l} style={{ background: '#f0f4f8', borderRadius: 8, padding: '8px 10px', textAlign: 'center', flex: 1, minWidth: 60 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: item.c }}>{item.v}</div>
                          <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 700 }}>{item.l}</div>
                        </div>
                      ))}
                    </div>
                    <ScoreBar value={subj.avg_score_pct  ?? 0} color="#5e72e4" label="Avg Score"  />
                    <ScoreBar value={subj.best_score_pct ?? 0} color="#2dce89" label="Best Score" />
                  </div>

                  {/* Assignments */}
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
                        <div key={item.l} style={{ background: '#f0f4f8', borderRadius: 8, padding: '8px 10px', textAlign: 'center', flex: 1, minWidth: 60 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: item.c }}>{item.v}</div>
                          <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 700 }}>{item.l}</div>
                        </div>
                      ))}
                    </div>
                    {assignRate !== null && (
                      <ScoreBar value={assignRate} color="#fb6340" label="Assignment Score %" />
                    )}
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8898aa' }}>
                    <span>⏱ {fmtTime(subj.total_time_spent_mins)} spent</span>
                    {subj.last_activity_at && (
                      <span>Last active: {new Date(subj.last_activity_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>
    </>
  );
}

// ─── Teacher Report ───────────────────────────────────────────────────────────

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
        const scoredStudents = subj.students.filter(s => s.avg_score_pct !== null);
        const avgScore = scoredStudents.length > 0
          ? (scoredStudents.reduce((sum, s) => sum + s.avg_score_pct, 0) / scoredStudents.length).toFixed(1)
          : null;
        const isOpen     = expanded === subj.subject_id;
        const classPerf  = perfLabel(avgScore !== null ? parseFloat(avgScore) : null);

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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: '#5e72e420', color: '#5e72e4', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                    {subj.students.length} students
                  </span>
                  {avgScore && (
                    <span style={{ background: classPerf.bg, color: classPerf.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                      Class avg: {avgScore}% · {classPerf.label}
                    </span>
                  )}
                  <span style={{ color: '#8898aa', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardBody style={{ overflowX: 'auto', padding: 0 }}>
                {subj.students.length === 0 ? (
                  <p className="text-muted text-center py-4">No enrolled students</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Student', 'Quizzes', 'Passed', 'Avg Score', 'Best', 'Assignments', 'Graded', 'Avg Marks', 'Level', 'Last Active'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subj.students.map((s) => {
                        const sp = perfLabel(s.avg_score_pct);
                        return (
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
                              {s.avg_score_pct !== null
                                ? <span style={{ fontWeight: 700, color: sp.color }}>{s.avg_score_pct}%</span>
                                : <span style={{ color: '#8898aa' }}>—</span>}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>
                              {s.best_score_pct !== null ? `${s.best_score_pct}%` : '—'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>{s.assignments_submitted}</td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>{s.assignments_graded}</td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>
                              {s.avg_assignment_marks !== null ? s.avg_assignment_marks : '—'}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ background: sp.bg, color: sp.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                                {sp.label}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: '#8898aa', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {s.last_activity_at ? new Date(s.last_activity_at).toLocaleDateString() : 'Never'}
                            </td>
                          </tr>
                        );
                      })}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Report() {
  const [loading,  setLoading]  = useState(true);
  const [role,     setRole]     = useState('');
  const [data,     setData]     = useState([]);
  const [weekly,   setWeekly]   = useState([]);
  const [history,  setHistory]  = useState([]);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
    setRole(userRole);

    if (userRole !== 'student' && userRole !== 'teacher') {
      setLoading(false);
      return;
    }

    const requests = [http.get('/api/progress/me')];
    if (userRole === 'student') {
      requests.push(
        http.get('/api/progress/weekly').catch(() => ({ data: [] })),
        http.get('/api/progress/quiz-history').catch(() => ({ data: [] })),
      );
    }

    Promise.all(requests)
      .then(([progressRes, weeklyRes, historyRes]) => {
        setData(progressRes.data.data || []);
        if (weeklyRes)  setWeekly(weeklyRes.data   || []);
        if (historyRes) setHistory(historyRes.data  || []);
      })
      .catch(() => setError('Failed to load progress data. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <Container
        className="mt--7"
        fluid
        style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 40 }}
      >
        <Row className="mb-4">
          <Col>
            <h2 style={{ color: '#32325d', margin: 0 }}>
              {role === 'teacher' ? '📊 Class Report' : '📊 My Progress'}
            </h2>
            <p className="text-muted small mt-1">
              {role === 'teacher'
                ? 'Live performance data for all your subjects'
                : 'Your quiz results, weekly activity, and subject progress'}
            </p>
          </Col>
        </Row>

        {loading && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardBody className="text-center py-5">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                  <p className="text-muted">Loading your progress...</p>
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {error && (
          <Row>
            <Col>
              <div className="alert alert-danger" style={{ borderRadius: 10 }}>{error}</div>
            </Col>
          </Row>
        )}

        {!loading && !error && role === 'student' && (
          <StudentReport data={data} weekly={weekly} history={history} />
        )}
        {!loading && !error && role === 'teacher' && (
          <TeacherReport data={data} />
        )}
        {!loading && role === 'admin' && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardBody className="text-center py-5">
                  <p className="text-muted">Use the Admin Panel to view platform-wide statistics.</p>
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </>
  );
}
