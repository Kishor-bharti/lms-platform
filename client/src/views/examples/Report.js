import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Badge, Button, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import LatexRenderer from 'components/LatexRenderer.js';
import http from 'utils/http';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function perfLabel(score) {
  if (score === null || score === undefined) return { label: 'N/A',               color: '#8898aa', bg: '#f0f4f8' };
  if (score >= 90) return { label: 'Strong',           color: '#2dce89', bg: '#e3f9ee' };
  if (score >= 80) return { label: 'Good',             color: '#5e72e4', bg: '#eef0fd' };
  if (score >= 60) return { label: 'Needs Improvement',color: '#fb6340', bg: '#fff0eb' };
  return             { label: 'Needs Work',            color: '#f5365c', bg: '#fde8ec' };
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
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekRange(offset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek - (offset * 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`,
  };
}

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

// ─── Activity Chart with Week/Month Toggle ─────────────────────────────────

function ActivityChart({ data: initialData, studentId, isTeacherView }) {
  const [mode, setMode] = useState('week'); // 'week' or 'month'
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initialData || []);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (m, o) => {
    setLoading(true);
    try {
      const range = m === 'week' ? getWeekRange(o) : getMonthRange(o);
      const base = isTeacherView ? `/api/progress/student/${studentId}/activity` : '/api/progress/activity';
      const res = await http.get(`${base}?start=${range.start}&end=${range.end}`);
      setData(res.data || []);
    } catch { setData([]); }
    setLoading(false);
  }, [studentId, isTeacherView]);

  useEffect(() => {
    if (offset === 0 && mode === 'week' && initialData && initialData.length > 0) {
      setData(initialData);
    } else {
      fetchData(mode, offset);
    }
  }, [mode, offset, fetchData, initialData]);

  const handleModeChange = (m) => { setMode(m); setOffset(0); };

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.quizzes + (d.practices || 0)), 1);
  const totalQ   = data.reduce((s, d) => s + d.quizzes, 0);
  const totalP   = data.reduce((s, d) => s + (d.practices || 0), 0);
  const totalC   = data.reduce((s, d) => s + d.correct, 0);
  const totalI   = data.reduce((s, d) => s + d.incorrect, 0);
  const totalMin = data.reduce((s, d) => s + d.time_mins, 0);

  const rangeInfo = mode === 'week' ? getWeekRange(offset) : getMonthRange(offset);

  return (
    <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
      <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
          <CardTitle className="mb-0" style={{ color: '#32325d', fontSize: 15 }}>📅 Activity</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #dee2e6' }}>
              <button
                onClick={() => handleModeChange('week')}
                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: mode === 'week' ? '#5e72e4' : '#fff', color: mode === 'week' ? '#fff' : '#525f7f' }}
              >Week</button>
              <button
                onClick={() => handleModeChange('month')}
                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: mode === 'month' ? '#5e72e4' : '#fff', color: mode === 'month' ? '#fff' : '#525f7f' }}
              >Month</button>
            </div>
            <button onClick={() => setOffset(o => o + 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#5e72e4' }}>◀</button>
            <span style={{ fontSize: 12, color: '#8898aa', minWidth: 120, textAlign: 'center' }}>{rangeInfo.label}</span>
            <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}
              style={{ border: 'none', background: 'none', cursor: offset === 0 ? 'default' : 'pointer', fontSize: 16, color: offset === 0 ? '#ccc' : '#5e72e4' }}>▶</button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#8898aa' }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: mode === 'month' ? 2 : 8, height: 130, paddingBottom: 4, overflowX: 'auto' }}>
              {data.map((day, i) => {
                const qVal = day.quizzes;
                const pVal = day.practices || 0;
                const total = qVal + pVal;
                const qH = maxVal > 0 ? (qVal / maxVal) * 80 : 0;
                const pH = maxVal > 0 ? (pVal / maxVal) * 80 : 0;
                const isToday = offset === 0 && i === data.length - 1;
                const dayLabel = mode === 'week'
                  ? DAY_LABELS[new Date(day.date + 'T12:00:00').getDay()]
                  : (i + 1).toString();
                const tooltip = `${day.date}: ${qVal} quiz, ${pVal} practice, ${day.correct}✓ ${day.incorrect}✗`;
                return (
                  <div key={day.date} title={tooltip} style={{ flex: mode === 'month' ? '1 0 auto' : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: mode === 'month' ? 12 : 'auto' }}>
                    <div style={{ fontSize: 9, color: '#8898aa', fontWeight: 700, minHeight: 12 }}>
                      {total > 0 ? total : ''}
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {pVal > 0 && (
                        <div style={{ width: '80%', height: `${Math.max(pH, 4)}px`, background: '#2dce89', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease' }} />
                      )}
                      <div style={{
                        width: '80%',
                        height: total > 0 ? `${Math.max(qH, 4)}px` : '3px',
                        background: isToday ? '#5e72e4' : qVal > 0 ? '#a8b8f8' : '#e9ecef',
                        borderRadius: pVal > 0 ? '0 0 3px 3px' : '3px',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: mode === 'month' ? 8 : 10, color: isToday ? '#5e72e4' : '#8898aa', fontWeight: isToday ? 700 : 400 }}>
                      {mode === 'month' ? (i % 5 === 0 ? dayLabel : '') : dayLabel}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Quizzes',   value: totalQ,          color: '#5e72e4' },
                { label: 'Practice',  value: totalP,          color: '#2dce89' },
                { label: 'Correct',   value: totalC,          color: '#11cdef' },
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
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Attempt Review Panel ─────────────────────────────────────────────────

function AttemptReviewPanel({ attemptId, studentId, isTeacherView, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const url = isTeacherView && studentId
      ? `/api/progress/student/${studentId}/attempt/${attemptId}/review`
      : `/api/progress/attempt/${attemptId}/review`;
    http.get(url)
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load review. The attempt may not be available.'))
      .finally(() => setLoading(false));
  }, [attemptId, studentId, isTeacherView]);

  if (loading) {
    return (
      <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
        <CardBody className="text-center py-5">
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <p className="text-muted">Loading review...</p>
        </CardBody>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
        <CardBody className="text-center py-4">
          <p className="text-danger">{error || 'No data'}</p>
          <Button size="sm" color="secondary" onClick={onClose}>← Back</Button>
        </CardBody>
      </Card>
    );
  }

  const { attempt, answers } = data;
  const scorePct = Number(attempt.score_pct || 0).toFixed(1);
  const timeSecs = attempt.time_taken_seconds || 0;
  const mins = Math.floor(timeSecs / 60);
  const secs = timeSecs % 60;
  const correctCount = answers?.filter(a => a.is_correct).length || 0;

  return (
    <>
      <div className="mb-3">
        <Button size="sm" color="secondary" onClick={onClose} style={{ fontWeight: 600 }}>← Back to History</Button>
      </div>
      <Card className="shadow mb-4" style={{ borderRadius: 16, textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #5e72e4, #825ee4)', padding: '28px 20px' }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{scorePct}%</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
            {Number(attempt.marks_obtained || 0).toFixed(1)} / {Number(attempt.total_marks || 0).toFixed(1)} points
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginTop: 4 }}>{attempt.quiz_title}</div>
        </div>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, padding: '12px 0' }}>
            <div>
              <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase' }}>Time Taken</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#32325d' }}>{mins}m {secs}s</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase' }}>Correct</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#32325d' }}>{correctCount} / {answers?.length || 0}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <h4 style={{ color: '#32325d', marginBottom: 16 }}>Review Answers</h4>
      {answers?.map((a, idx) => (
        <Card key={a.question_id} className="shadow mb-3" style={{ borderRadius: 12, borderLeft: `4px solid ${a.is_correct ? '#2dce89' : '#f5365c'}` }}>
          <CardBody>
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div style={{ fontWeight: 600, color: '#32325d', flex: 1, lineHeight: 1.5 }}>
                <span>{idx + 1}. </span><LatexRenderer text={a.question_text || ''} />
              </div>
              <Badge color={a.is_correct ? 'success' : 'danger'} style={{ marginLeft: 12, flexShrink: 0 }}>
                {a.is_correct ? `+${Number(a.marks_awarded).toFixed(1)}` : '0'} points
              </Badge>
            </div>
            {a.image_url && (
              <div style={{ background: '#f8f9fa', padding: 10, borderRadius: 8, margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: 200, overflow: 'hidden' }}>
                <img src={a.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {a.topic_name && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {a.topic_name}</span>
              )}
              {a.difficulty && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize',
                  background: a.difficulty === 'easy' ? '#d4edda' : a.difficulty === 'hard' ? '#f8d7da' : '#fff3cd',
                  color: a.difficulty === 'easy' ? '#155724' : a.difficulty === 'hard' ? '#721c24' : '#856404' }}>
                  {a.difficulty}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ background: a.is_correct ? '#eafaf1' : '#fde8ec', border: `1px solid ${a.is_correct ? '#2dce89' : '#f5365c'}`, borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>Your answer: </span>
                {a.selected_label ? <><span>{a.selected_label}. </span><LatexRenderer text={a.selected_text || ''} /></> : 'Not answered'}
              </div>
              {!a.is_correct && (
                <div style={{ background: '#eafaf1', border: '1px solid #2dce89', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>Correct: </span>
                  <span>{a.correct_label}. </span><LatexRenderer text={a.correct_text || ''} />
                </div>
              )}
            </div>
            {a.explanation && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff8e6', borderRadius: 8, fontSize: 13, color: '#525f7f' }}>
                <span style={{ fontWeight: 700 }}>Explanation: </span><LatexRenderer text={a.explanation} />
                {a.explanation_image_url && (
                  <div style={{ marginTop: 8, background: '#f8f9fa', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={a.explanation_image_url} alt="Explanation" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'contain', display: 'block' }} />
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      ))}
    </>
  );
}

// ─── History Table (shared for Quiz & Practice) ──────────────────────────────

function HistoryTable({ data, title, icon, nameCol, contextCol, contextField, studentId, isTeacherView }) {
  const [showAll, setShowAll] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState(null);
  if (!data || data.length === 0) return null;

  if (reviewAttemptId) {
    return (
      <AttemptReviewPanel
        attemptId={reviewAttemptId}
        studentId={studentId}
        isTeacherView={isTeacherView}
        onClose={() => setReviewAttemptId(null)}
      />
    );
  }

  const visible = showAll ? data : data.slice(0, 5);

  return (
    <Card className="shadow mb-4" style={{ borderRadius: 12 }}>
      <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div className="d-flex justify-content-between align-items-center">
          <CardTitle className="mb-0" style={{ color: '#32325d', fontSize: 15 }}>{icon} {title}</CardTitle>
          <span style={{ fontSize: 12, color: '#8898aa' }}>{data.length} attempts</span>
        </div>
      </CardHeader>
      <CardBody style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {[nameCol || 'Quiz', contextCol || 'Subject', 'Score', '✓', '✗', 'Time', 'Date', 'Level', ''].map((h, idx) => (
                <th key={h + idx} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
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
                  <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13, whiteSpace: 'nowrap' }}>{item[contextField || 'subject_name'] || '—'}</td>
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
                  <td style={{ padding: '12px 14px' }}>
                    <Button size="sm" color="info" outline style={{ fontSize: 11, padding: '2px 10px' }}
                      onClick={() => setReviewAttemptId(item.attempt_id)}>
                      Review
                    </Button>
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

// ─── Topic Analysis Table ─────────────────────────────────────────────────

function TopicAnalysisTable({ subjectId, subjectName, studentId, isTeacherView }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (data !== null) { setOpen(!open); return; }
    setLoading(true);
    try {
      const base = isTeacherView ? `/api/progress/student/${studentId}/topics/${subjectId}` : `/api/progress/topics/${subjectId}`;
      const res = await http.get(base);
      setData(res.data || []);
      setOpen(true);
    } catch { setData([]); setOpen(true); }
    setLoading(false);
  };

  const statusColor = (s) => {
    if (s === 'Strong') return { color: '#2dce89', bg: '#e3f9ee' };
    if (s === 'Good') return { color: '#5e72e4', bg: '#eef0fd' };
    if (s === 'Needs Work') return { color: '#f5365c', bg: '#fde8ec' };
    return { color: '#8898aa', bg: '#f0f4f8' };
  };

  return (
    <div style={{ marginTop: 14 }}>
      <Button size="sm" color="light" onClick={loadData} style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4' }}>
        {loading ? 'Loading...' : open ? '▲ Hide Topic Analysis' : '▼ Topic-wise Analysis'}
      </Button>
      {open && data && (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          {data.length === 0 ? (
            <p style={{ fontSize: 12, color: '#8898aa', margin: 8 }}>No topics available for this subject.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Topic', 'Questions', 'Correct', 'Incorrect', 'Accuracy', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(t => {
                  const sc = statusColor(t.status);
                  return (
                    <tr key={t.topic_id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#32325d' }}>{t.topic_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#525f7f' }}>{t.total_questions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#2dce89', fontWeight: 700 }}>{t.correct_answers}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#f5365c', fontWeight: 700 }}>{t.incorrect_answers}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: sc.color }}>
                        {t.accuracy_pct !== null ? `${t.accuracy_pct}%` : 'N/A'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Student Report (used by student view AND teacher's student detail view) ─

function StudentReport({ data, weekly, quizHistory, practiceHistory, studentId, isTeacherView }) {
  if (!data || data.length === 0) {
    return (
      <Card className="shadow" style={{ borderRadius: 12 }}>
        <CardBody className="text-center py-5">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p className="text-muted">No progress data yet. Complete quizzes and assignments to see stats here.</p>
        </CardBody>
      </Card>
    );
  }

  const totalQuizzes   = data.reduce((s, d) => s + d.quizzes_attempted, 0);
  const totalPractices = data.reduce((s, d) => s + (d.practices_attempted || 0), 0);
  const totalAssign    = data.reduce((s, d) => s + d.assignments_submitted, 0);
  const totalTimeMins  = data.reduce((s, d) => s + d.total_time_spent_mins, 0);
  const scoredSubjs    = data.filter(d => d.avg_score_pct !== null);
  const avgScore       = scoredSubjs.length > 0
    ? (scoredSubjs.reduce((s, d) => s + d.avg_score_pct, 0) / scoredSubjs.length).toFixed(1)
    : null;
  const overallPerf    = perfLabel(avgScore !== null ? parseFloat(avgScore) : null);

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
                  <StatChip icon="🎯" label="Practice"    value={totalPractices}           color="#fff" />
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

      {/* Activity chart with week/month toggle */}
      <ActivityChart data={weekly} studentId={studentId} isTeacherView={isTeacherView} />

      {/* Quiz History */}
      <HistoryTable data={quizHistory} title="Recent Quiz History" icon="📋" nameCol="Quiz" contextCol="Course" contextField="course_name" studentId={studentId} isTeacherView={isTeacherView} />

      {/* Practice History */}
      <HistoryTable data={practiceHistory} title="Recent Practice History" icon="🎯" nameCol="Practice" contextCol="Subject" contextField="subject_name" studentId={studentId} isTeacherView={isTeacherView} />

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
                        { l: 'Avg Score', v: subj.avg_score_pct !== null ? `${subj.avg_score_pct}%` : 'N/A', c: '#fb6340' },
                        { l: 'Best Score', v: subj.best_score_pct !== null ? `${subj.best_score_pct}%` : 'N/A', c: '#825ee4' },
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

                  {/* Practice stats */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      Practice
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { l: 'Attempted', v: subj.practices_attempted || 0,  c: '#2dce89' },
                        { l: 'Avg Score', v: subj.avg_practice_score_pct !== null ? `${subj.avg_practice_score_pct}%` : 'N/A', c: '#fb6340' },
                        { l: 'Best Score', v: subj.best_practice_score_pct !== null ? `${subj.best_practice_score_pct}%` : 'N/A', c: '#825ee4' },
                      ].map((item) => (
                        <div key={item.l} style={{ background: '#f0f4f8', borderRadius: 8, padding: '8px 10px', textAlign: 'center', flex: 1, minWidth: 60 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: item.c }}>{item.v}</div>
                          <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 700 }}>{item.l}</div>
                        </div>
                      ))}
                    </div>
                    <ScoreBar value={subj.avg_practice_score_pct  ?? 0} color="#2dce89" label="Avg Practice Score"  />
                    <ScoreBar value={subj.best_practice_score_pct ?? 0} color="#11cdef" label="Best Practice Score" />
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
                        { l: 'Avg Points', v: subj.avg_assignment_marks !== null ? subj.avg_assignment_marks : 'N/A', c: '#fb6340' },
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

                  {/* Topic Analysis */}
                  <TopicAnalysisTable
                    subjectId={subj.subject_id}
                    subjectName={subj.subject_name}
                    studentId={studentId}
                    isTeacherView={isTeacherView}
                  />
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>
    </>
  );
}

// ─── Student Detail View (for teacher / admin) ───────────────────────────────

function StudentDetailView({ studentId, studentName, onBack, backLabel }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      http.get(`/api/progress/student/${studentId}`),
      http.get(`/api/progress/student/${studentId}/weekly`).catch(() => ({ data: [] })),
      http.get(`/api/progress/student/${studentId}/quiz-history?type=test`).catch(() => ({ data: [] })),
      http.get(`/api/progress/student/${studentId}/quiz-history?type=practice`).catch(() => ({ data: [] })),
    ])
      .then(([progressRes, weeklyRes, quizRes, practiceRes]) => {
        setData(progressRes.data.data || []);
        setWeekly(weeklyRes.data || []);
        setQuizHistory(quizRes.data || []);
        setPracticeHistory(practiceRes.data || []);
      })
      .catch(() => setError('Failed to load student report.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  return (
    <>
      <Row className="mb-3">
        <Col>
          <div className="d-flex align-items-center" style={{ gap: 12 }}>
            <Button size="sm" color="secondary" onClick={onBack} style={{ fontWeight: 600 }}>
              ← {backLabel || 'Back to Class Report'}
            </Button>
            <h4 style={{ margin: 0, color: '#32325d' }}>📊 {studentName}'s Report</h4>
          </div>
        </Col>
      </Row>
      {loading && (
        <Card className="shadow" style={{ borderRadius: 12 }}>
          <CardBody className="text-center py-5">
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <p className="text-muted">Loading student report...</p>
          </CardBody>
        </Card>
      )}
      {error && <div className="alert alert-danger" style={{ borderRadius: 10 }}>{error}</div>}
      {!loading && !error && (
        <StudentReport
          data={data}
          weekly={weekly}
          quizHistory={quizHistory}
          practiceHistory={practiceHistory}
          studentId={studentId}
          isTeacherView={true}
        />
      )}
    </>
  );
}

// ─── Admin Report ─────────────────────────────────────────────────────────────

function AdminReport() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [viewingStudent, setViewingStudent] = useState(null);

  useEffect(() => {
    http.get('/api/admin/users?role=student&page=1&limit=200')
      .then(res => setStudents(res.data?.users || res.data?.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, []);

  if (viewingStudent) {
    return (
      <StudentDetailView
        studentId={viewingStudent.id}
        studentName={`${viewingStudent.first_name || ''} ${viewingStudent.last_name || ''}`.trim()}
        onBack={() => setViewingStudent(null)}
        backLabel="Back to Student List"
      />
    );
  }

  const filtered = search
    ? students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  return (
    <Row>
      <Col>
        <Card className="shadow" style={{ borderRadius: 12 }}>
          <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            <CardTitle className="mb-0" style={{ color: '#32325d' }}>📊 Student Reports</CardTitle>
            <p className="text-muted small mb-0 mt-1">Select a student to view their progress report</p>
          </CardHeader>
          <CardBody>
            <div style={{ marginBottom: 16, maxWidth: 400 }}>
              <Input
                type="text"
                placeholder="🔍 Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ borderRadius: 8, fontSize: 13 }}
              />
            </div>
            {loadingStudents ? (
              <div className="text-center py-4 text-muted">Loading students...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-4 text-muted">No students found</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {filtered.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setViewingStudent(s)}
                    style={{
                      background: '#fff', border: '1px solid #e9eef5', borderRadius: 10,
                      padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow .15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ fontWeight: 700, color: '#32325d', marginBottom: 4 }}>
                      {s.first_name} {s.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#8898aa' }}>{s.email}</div>
                    <div style={{ marginTop: 10 }}>
                      <Button size="sm" color="primary" outline style={{ fontSize: 11, padding: '3px 14px', fontWeight: 700 }}>
                        View Report →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </Col>
    </Row>
  );
}

// ─── Teacher Report ───────────────────────────────────────────────────────────

function TeacherReport({ data }) {
  const [expanded, setExpanded] = useState(null);
  const [searchTerms, setSearchTerms] = useState({});
  const [viewingStudent, setViewingStudent] = useState(null);

  if (viewingStudent) {
    return (
      <StudentDetailView
        studentId={viewingStudent.id}
        studentName={viewingStudent.name}
        onBack={() => setViewingStudent(null)}
      />
    );
  }

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
        const search     = (searchTerms[subj.subject_id] || '').toLowerCase();
        const filtered   = search
          ? subj.students.filter(s => s.student_name.toLowerCase().includes(search) || s.student_email.toLowerCase().includes(search))
          : subj.students;

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
              <CardBody style={{ padding: 0 }}>
                {subj.students.length === 0 ? (
                  <p className="text-muted text-center py-4">No enrolled students</p>
                ) : (
                  <>
                    {/* Search bar */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f4f8' }}>
                      <Input
                        type="text"
                        placeholder="🔍 Search students by name or email..."
                        value={searchTerms[subj.subject_id] || ''}
                        onChange={(e) => setSearchTerms({ ...searchTerms, [subj.subject_id]: e.target.value })}
                        style={{ borderRadius: 8, fontSize: 13, maxWidth: 400 }}
                      />
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            {['Student', 'Quizzes', 'Practice', 'Avg Score', 'Best', 'Assignments', 'Graded', 'Avg Points', 'Level', 'Last Active', ''].map(h => (
                              <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((s) => {
                            const sp = perfLabel(s.avg_score_pct);
                            return (
                              <tr key={s.student_id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontWeight: 600, color: '#32325d' }}>{s.student_name}</div>
                                  <div style={{ fontSize: 11, color: '#8898aa' }}>{s.student_email}</div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#525f7f' }}>{s.quizzes_attempted}</td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#2dce89', fontWeight: 700 }}>{s.practices_attempted || 0}</td>
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
                                <td style={{ padding: '12px' }}>
                                  <Button size="sm" color="primary" outline
                                    style={{ fontSize: 11, padding: '3px 12px', fontWeight: 700 }}
                                    onClick={() => setViewingStudent({ id: s.student_id, name: s.student_name })}>
                                    View
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={11} style={{ textAlign: 'center', padding: 20, color: '#8898aa' }}>
                                No students match the search criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
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
  const [loading,          setLoading]         = useState(true);
  const [role,             setRole]            = useState('');
  const [data,             setData]            = useState([]);
  const [weekly,           setWeekly]          = useState([]);
  const [quizHistory,      setQuizHistory]     = useState([]);
  const [practiceHistory,  setPracticeHistory]  = useState([]);
  const [error,            setError]           = useState('');

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
        http.get('/api/progress/quiz-history?type=test').catch(() => ({ data: [] })),
        http.get('/api/progress/quiz-history?type=practice').catch(() => ({ data: [] })),
      );
    }

    Promise.all(requests)
      .then(([progressRes, weeklyRes, quizRes, practiceRes]) => {
        setData(progressRes.data.data || []);
        if (weeklyRes)    setWeekly(weeklyRes.data || []);
        if (quizRes)      setQuizHistory(quizRes.data || []);
        if (practiceRes)  setPracticeHistory(practiceRes.data || []);
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
            <h2 style={{ color: '#fff', margin: 0 }}>
              {role === 'teacher' ? '📊 Class Report' : '📊 My Progress'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>
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
          <StudentReport
            data={data}
            weekly={weekly}
            quizHistory={quizHistory}
            practiceHistory={practiceHistory}
            studentId={null}
            isTeacherView={false}
          />
        )}
        {!loading && !error && role === 'teacher' && (
          <TeacherReport data={data} />
        )}
        {!loading && role === 'admin' && (
          <AdminReport />
        )}
      </Container>
    </>
  );
}
