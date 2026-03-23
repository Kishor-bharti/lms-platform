import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, Button, Badge,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import LatexRenderer from 'components/LatexRenderer.js';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { PageCardSkeleton } from 'components/Skeleton.js';
import http from 'utils/http';
import { API_BASE } from 'utils/api';

export default function QuizTaker() {
  const { quizId } = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const previewMode = Boolean(location.state?.previewMode);

  const [phase,     setPhase]     = useState('loading'); // loading | intro | taking | submitting | result
  const [quiz,      setQuiz]      = useState(null);
  const [attempts,  setAttempts]  = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [answers,   setAnswers]   = useState({});   // { questionId: selectedOptionId }
  const [current,   setCurrent]   = useState(0);    // current question index
  const [timeLeft,  setTimeLeft]  = useState(0);    // seconds remaining
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');
  const [elapsed,          setElapsed]          = useState(0);           // seconds elapsed (practice count-up)
  const [partialResultData, setPartialResultData] = useState(null);       // scoring data from partial save
  const [lockedAnswers,     setLockedAnswers]     = useState(new Set());   // question IDs locked after resume
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const startedAt  = useRef(null);
  const timerRef   = useRef(null);
  const answersRef = useRef({});                                           // always-fresh answers for timer callback
  const attemptIdRef  = useRef(null);                                      // stale-closure-safe refs for beforeunload
  const currentRef    = useRef(0);
  const phaseRef      = useRef('loading');
  const quizTypeRef   = useRef(null);

  useEffect(() => {
    fetchQuiz();
    return () => clearInterval(timerRef.current);
  }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep answersRef in sync so timer callbacks always see the latest answers
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Keep stale-closure-safe refs in sync
  useEffect(() => { attemptIdRef.current = attemptId; }, [attemptId]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { quizTypeRef.current = quiz?.quiz_type ?? null; }, [quiz]);

  // Auto partial-save for practice quiz on page refresh / tab close
  useEffect(() => {
    const handler = () => {
      if (phaseRef.current !== 'taking' || quizTypeRef.current !== 'practice' || !attemptIdRef.current) return;
      const answersPayload = Object.entries(answersRef.current).map(([question_id, selected_option_id]) => ({
        question_id,
        selected_option_id: selected_option_id || null,
      }));
      const token = localStorage.getItem('accessToken');
      fetch(`${API_BASE}/api/quizzes/attempts/${attemptIdRef.current}/partial-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answers: answersPayload, lastQuestionIndex: currentRef.current }),
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist test answers to localStorage on every change — enables page-refresh recovery
  useEffect(() => {
    if (phase !== 'taking' || quiz?.quiz_type !== 'test' || !attemptId) return;
    localStorage.setItem(`quiz_test_${quizId}`, JSON.stringify({
      attemptId, startedAtMs: startedAt.current, answers,
    }));
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchQuiz = async () => {
    try {
      // In preview mode, skip fetching attempts (staff preview — no attempt needed)
      const [quizRes, attemptsRes] = await Promise.all([
        http.get(`/api/quizzes/${quizId}`),
        previewMode ? Promise.resolve({ data: [] }) : http.get(`/api/quizzes/${quizId}/attempts`),
      ]);
      setQuiz(quizRes.data);
      setAttempts(attemptsRes.data || []);

      if (previewMode) {
        setPhase('preview');
        return;
      }

      // Restore in-progress test attempt from localStorage after page refresh
      if (quizRes.data?.quiz_type === 'test') {
        const stored = localStorage.getItem(`quiz_test_${quizId}`);
        const inProgress = (attemptsRes.data || []).find((a) => a.status === 'in_progress');
        if (stored && inProgress) {
          try {
            const { attemptId: storedId, startedAtMs, answers: savedAnswers } = JSON.parse(stored);
            if (storedId === inProgress.id) {
              const elapsedSecs = Math.floor((Date.now() - startedAtMs) / 1000);
              const remaining   = Math.max(0, (quizRes.data.duration_minutes * 60) - elapsedSecs);
              if (remaining > 0) {
                setAttemptId(storedId);
                setAnswers(savedAnswers || {});
                answersRef.current = savedAnswers || {};
                setLockedAnswers(new Set());
                setCurrent(0);
                setTimeLeft(remaining);
                startedAt.current = startedAtMs;
                setPhase('taking');
                return; // skip going to intro
              }
            }
          } catch (_) {}
        }
      }

      setPhase('intro');
    } catch (err) {
      setError('Failed to load quiz');
      setPhase('error');
    }
  };

  const startQuiz = async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await http.post(`/api/quizzes/${quizId}/attempts`);
      setAttemptId(res.data.attemptId);
      setAnswers({});
      answersRef.current = {};
      setLockedAnswers(new Set());
      setCurrent(0);
      if (quiz.quiz_type === 'test') {
        const secs = (quiz.duration_minutes || 30) * 60;
        setTimeLeft(secs);
      } else {
        setElapsed(0);
      }
      startedAt.current = Date.now();
      if (quiz.quiz_type === 'test') {
        localStorage.setItem(`quiz_test_${quizId}`, JSON.stringify({
          attemptId: res.data.attemptId,
          startedAtMs: startedAt.current,
          answers: {},
        }));
      }
      setPhase('taking');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to start quiz');
      setPhase('intro');
    }
  };

  // Timer countdown (test only)
  useEffect(() => {
    if (phase !== 'taking' || quiz?.quiz_type !== 'test') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, quiz?.quiz_type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed count-up (practice only)
  useEffect(() => {
    if (phase !== 'taking' || quiz?.quiz_type !== 'practice') return;
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, quiz?.quiz_type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    clearInterval(timerRef.current);
    setShowConfirmSubmit(false);
    setPhase('submitting');
    const timeTaken = startedAt.current
      ? Math.floor((Date.now() - startedAt.current) / 1000)
      : 0;

    const answersPayload = Object.entries(answersRef.current).map(([question_id, selected_option_id]) => ({
      question_id,
      selected_option_id: selected_option_id || null,
    }));

    try {
      await http.post(`/api/quizzes/attempts/${attemptId}/submit`, {
        answers: answersPayload,
        timeTakenSeconds: timeTaken,
      });
      const resultRes = await http.get(`/api/quizzes/attempts/${attemptId}/result`);
      localStorage.removeItem(`quiz_test_${quizId}`);
      setResult(resultRes.data);
      setPhase('result');
    } catch (err) {
      setError('Failed to submit. Please try again.');
      setPhase('taking');
    }
  }, [attemptId, quizId]);

  const handleResume = async (resumeAttemptId) => {
    setError('');
    setPhase('loading');
    try {
      const res = await http.get(`/api/quizzes/attempts/${resumeAttemptId}/resume`);
      const saved = res.data.savedAnswers || {};
      setAttemptId(res.data.attemptId);
      setAnswers(saved);
      answersRef.current = saved;
      setLockedAnswers(new Set(Object.keys(saved)));
      setCurrent(res.data.lastQuestionIndex || 0);
      setElapsed(0);
      startedAt.current = Date.now();
      setPhase('taking');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to resume practice');
      setPhase('intro');
    }
  };

  const handleSaveProgress = async () => {
    clearInterval(timerRef.current);
    setShowConfirmSubmit(false);
    setPhase('submitting');
    const answersPayload = Object.entries(answersRef.current).map(([question_id, selected_option_id]) => ({
      question_id,
      selected_option_id: selected_option_id || null,
    }));
    try {
      const res = await http.post(`/api/quizzes/attempts/${attemptId}/partial-submit`, {
        answers: answersPayload,
        lastQuestionIndex: current,
      });
      setPartialResultData(res.data);
      setPhase('partial-result');
    } catch (err) {
      setError('Failed to save progress. Please try again.');
      setPhase('taking');
    }
  };

  const handleViewResult = async (reviewAttemptId) => {
    setPhase('loading');
    try {
      const res = await http.get(`/api/quizzes/attempts/${reviewAttemptId}/result`);
      setResult(res.data);
      setPhase('result');
    } catch (err) {
      setError('Failed to load result. Please try again.');
      setPhase('intro');
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---- Loading / Error ----
  if (phase === 'loading') {
    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
          <PageCardSkeleton />
        </Container>
      </>
    );
  }

  if (phase === 'error') {
    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
          <Row><Col><Card><CardBody className="text-center py-5">
            <p className="text-danger">{error}</p>
            <Button color="primary" onClick={() => navigate(-1)}>Go Back</Button>
          </CardBody></Card></Col></Row>
        </Container>
      </>
    );
  }

  // ---- Staff Preview Mode ----
  if (phase === 'preview') {
    const questions = quiz?.questions || [];
    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 40 }}>
          {/* Preview banner */}
          <Row className="mb-3">
            <Col>
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 10, padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#856404', fontSize: 14 }}>👁 Staff Preview</span>
                  <span style={{ color: '#856404', fontSize: 13, marginLeft: 10 }}>
                    Viewing <strong>{quiz?.title}</strong> as a student would see it. Correct answers are highlighted.
                    {!quiz?.is_published && <span style={{ marginLeft: 8, background: '#f8d7da', color: '#721c24', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>UNPUBLISHED</span>}
                  </span>
                </div>
                <Button color="warning" size="sm" style={{ borderRadius: 8, fontWeight: 700 }} onClick={() => navigate(-1)}>
                  ✕ Exit Preview
                </Button>
              </div>
            </Col>
          </Row>

          {/* Quiz info card */}
          <Row className="mb-4">
            <Col>
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: 'linear-gradient(135deg, #5e72e4 0%, #825ee4 100%)', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: '16px 20px' }}>
                  <h3 style={{ color: '#fff', margin: 0 }}>{quiz?.title}</h3>
                  {quiz?.description && <p style={{ color: 'rgba(255,255,255,0.8)', margin: '4px 0 0', fontSize: 13 }}>{quiz.description}</p>}
                </CardHeader>
                <CardBody style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '14px 20px' }}>
                  {[
                    { icon: '❓', label: 'Questions', value: questions.length },
                    { icon: '⏱', label: 'Duration',  value: quiz?.quiz_type === 'practice' ? 'No Timer' : `${quiz?.duration_minutes} min` },
                    { icon: '📝', label: 'Type',      value: quiz?.quiz_type === 'practice' ? 'Practice' : 'Test' },
                    { icon: '🔄', label: 'Attempts',  value: quiz?.max_attempts },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 20 }}>{item.icon}</div>
                      <div style={{ fontSize: 12, color: '#8898aa' }}>{item.label}</div>
                      <div style={{ fontWeight: 700, color: '#32325d' }}>{item.value}</div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Questions */}
          {questions.map((q, qi) => (
            <Row key={q.id} className="mb-3">
              <Col>
                <Card className="shadow" style={{ borderRadius: 12 }}>
                  <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: '10px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: '#32325d' }}>Q{qi + 1}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {q.topic_name && (
                          <Badge color="light" style={{ color: '#5e72e4', border: '1px solid #d1d8f8', fontSize: 10 }}>📌 {q.topic_name}</Badge>
                        )}
                        <Badge color={q.difficulty === 'easy' ? 'success' : q.difficulty === 'hard' ? 'danger' : 'warning'} style={{ fontSize: 10 }}>
                          {q.difficulty}
                        </Badge>
                        <Badge color="light" style={{ fontSize: 10, color: '#525f7f' }}>{q.marks} pt{q.marks !== 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#32325d', marginBottom: 12 }}>
                      <LatexRenderer text={q.question_text} />
                    </div>
                    {q.image_url && (
                      <img src={q.image_url} alt="Question" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, marginBottom: 12, objectFit: 'contain', display: 'block', border: '1px solid #e9ecef' }} />
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: q.explanation ? 14 : 0 }}>
                      {(q.options || []).map((opt) => (
                        <div key={opt.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 8,
                          background: opt.is_correct ? '#eafaf1' : '#f8f9fa',
                          border: `2px solid ${opt.is_correct ? '#2dce89' : '#e9ecef'}`,
                        }}>
                          <span style={{ fontWeight: 700, color: opt.is_correct ? '#2dce89' : '#5e72e4', minWidth: 22, fontSize: 13 }}>
                            {opt.option_label}.
                          </span>
                          {opt.option_image_url ? (
                            <img src={opt.option_image_url} alt={opt.option_label} style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: 13, color: '#32325d', fontWeight: opt.is_correct ? 600 : 400 }}>
                              <LatexRenderer text={opt.option_text || ''} />
                            </span>
                          )}
                          {opt.is_correct && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div style={{ marginTop: 8, padding: '10px 14px', background: '#eef0fd', borderRadius: 8, borderLeft: '3px solid #5e72e4' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', marginBottom: 4, textTransform: 'uppercase' }}>Explanation</div>
                        <div style={{ fontSize: 13, color: '#32325d' }}>
                          <LatexRenderer text={q.explanation} />
                        </div>
                        {q.explanation_image_url && (
                          <img src={q.explanation_image_url} alt="Explanation" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 6, marginTop: 8, objectFit: 'contain', display: 'block' }} />
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Col>
            </Row>
          ))}

          <Row>
            <Col className="text-center">
              <Button color="warning" style={{ borderRadius: 10, fontWeight: 700, padding: '10px 32px' }} onClick={() => navigate(-1)}>
                ✕ Exit Preview
              </Button>
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  // ---- Intro screen ----
  if (phase === 'intro') {
    const submittedAttempts = attempts.filter((a) => a.status === 'submitted');
    const partialAttempt    = attempts.find((a) => a.status === 'partial');
    const bestScore = submittedAttempts.length
      ? Math.max(...submittedAttempts.map((a) => Number(a.score_pct || 0)))
      : null;
    const maxReached = !partialAttempt && quiz?.max_attempts && attempts.filter(a => a.status !== 'partial').length >= quiz.max_attempts;

    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
          <Row className="justify-content-center">
            <Col lg="7">
              <Card className="shadow" style={{ borderRadius: 16 }}>
                <CardHeader style={{ background: 'linear-gradient(135deg, #5e72e4 0%, #825ee4 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '24px 28px' }}>
                  <h2 style={{ color: '#fff', margin: 0 }}>{quiz?.title}</h2>
                  <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, marginTop: 4 }}>{quiz?.description}</p>
                </CardHeader>
                <CardBody style={{ padding: 28 }}>
                  {/* Quiz info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    {[
                      { icon: '⏱', label: 'Duration',  value: quiz?.quiz_type === 'practice' ? 'No Timer' : `${quiz?.duration_minutes} mins` },
                      { icon: '❓', label: 'Questions', value: quiz?.question_count },
                      { icon: '📝', label: 'Type',      value: quiz?.quiz_type === 'practice' ? 'Practice' : 'Test' },
                      { icon: '🔄', label: 'Attempts',  value: `${submittedAttempts.length} / ${quiz?.max_attempts ?? '∞'}` },
                    ].map((item) => (
                      <div key={item.label} style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.icon} {item.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#32325d', marginTop: 2 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Partial attempt resume banner */}
                  {partialAttempt && (
                    <div style={{ background: '#fff8e6', border: '1px solid #f6c23e', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                      <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#856404' }}>📂 You have a saved practice session</p>
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#856404' }}>{partialAttempt.answered_count || 0} questions answered and saved. Resume where you left off?</p>
                      <Button size="sm" color="warning" style={{ borderRadius: 8, fontWeight: 700 }} onClick={() => handleResume(partialAttempt.id)}>
                        ▶ Resume Practice
                      </Button>
                    </div>
                  )}

                  {/* Previous attempts */}
                  {submittedAttempts.length > 0 && (
                    <div style={{ background: '#f0f4f8', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#32325d' }}>Previous Attempts</p>
                      {submittedAttempts.map((a) => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#525f7f', padding: '4px 0' }}>
                          <span>Attempt #{a.attempt_number}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 700, color: '#32325d' }}>
                              {Number(a.score_pct || 0).toFixed(1)}%
                            </span>
                            <Button size="sm" color="info" outline style={{ borderRadius: 6, padding: '2px 10px', fontSize: 11 }}
                              onClick={() => handleViewResult(a.id)}>
                              Review
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 8, fontWeight: 700, color: '#32325d', fontSize: 13 }}>
                        Best: {bestScore?.toFixed(1)}%
                      </div>
                    </div>
                  )}

                  {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Button color="secondary" outline style={{ borderRadius: 8 }} onClick={() => navigate(-1)}>Back</Button>
                    {!partialAttempt && (
                      <Button
                        color="primary"
                        disabled={maxReached}
                        style={{ borderRadius: 8, padding: '10px 28px', fontWeight: 700 }}
                        onClick={startQuiz}
                      >
                        {maxReached ? 'No Attempts Left' : submittedAttempts.length ? 'Start New Attempt' : 'Start Quiz'}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  // ---- Quiz-taking screen ----
  if (phase === 'taking' || phase === 'submitting') {
    const q = quiz?.questions?.[current];
    const answered = Object.keys(answers).length;
    const total    = quiz?.questions?.length ?? 0;
    const pct      = total > 0 ? Math.round((answered / total) * 100) : 0;
    const danger   = quiz?.quiz_type === 'test' && timeLeft <= 300;
    const isLocked = lockedAnswers.has(q?.id);

    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
          <Row>
            {/* Main question */}
            <Col lg="8" className="mb-4">
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <span style={{ fontWeight: 700, color: '#32325d' }}>
                      Question {current + 1} <span style={{ color: '#8898aa', fontWeight: 400 }}>of {total}</span>
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {isLocked && <Badge color="secondary" style={{ fontWeight: 600 }}>🔒 Saved</Badge>}
                      {q?.topic_name && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {q.topic_name}</span>
                      )}
                      <Badge
                        color={q?.difficulty === 'easy' ? 'success' : q?.difficulty === 'hard' ? 'danger' : 'warning'}
                        style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {q?.difficulty}
                      </Badge>
                      <Badge color="info">{q?.marks} {q?.marks === 1 ? 'point' : 'points'}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardBody style={{ padding: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#32325d', lineHeight: 1.6, marginBottom: q?.image_url ? 16 : 24 }}>
                    <LatexRenderer text={q?.question_text || ''} />
                  </div>
                  {q?.image_url && (
                    <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 150, maxHeight: 350 }}>
                      <img src={q.image_url} alt="Question" style={{
                        maxWidth: '100%', maxHeight: '100%', borderRadius: 8,
                        objectFit: 'contain'
                      }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {q?.options?.map((opt) => {
                      const selected = answers[q.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          disabled={isLocked}
                          onClick={() => {
                            if (isLocked) return;
                            setAnswers((prev) => {
                              const next = { ...prev };
                              if (next[q.id] === opt.id) { delete next[q.id]; } else { next[q.id] = opt.id; }
                              return next;
                            });
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 18px', borderRadius: 10, cursor: isLocked ? 'default' : 'pointer', textAlign: 'left',
                            border: `2px solid ${selected ? (isLocked ? '#8898aa' : '#5e72e4') : '#e9ecef'}`,
                            background: selected ? (isLocked ? '#f0f4f8' : '#eef0fd') : '#fff',
                            transition: 'all 0.15s ease', fontWeight: selected ? 700 : 400,
                            opacity: isLocked ? 0.8 : 1,
                          }}
                        >
                          <span style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0,
                            background: selected ? (isLocked ? '#8898aa' : '#5e72e4') : '#f0f4f8',
                            color: selected ? '#fff' : '#525f7f', fontSize: 14,
                          }}>
                            {opt.option_label}
                          </span>
                          {opt.option_image_url ? (
                            <img src={opt.option_image_url} alt={`Option ${opt.option_label}`} style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 6, objectFit: 'contain' }} />
                          ) : (
                            <span style={{ color: '#32325d' }}><LatexRenderer text={opt.option_text || ''} /></span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                    <Button color="secondary" outline style={{ borderRadius: 8 }} disabled={current === 0}
                      onClick={() => setCurrent((c) => c - 1)}>Previous</Button>
                    {current < total - 1 ? (
                      <Button color="primary" style={{ borderRadius: 8 }} onClick={() => setCurrent((c) => c + 1)}>Next</Button>
                    ) : (
                      <Button color="success" style={{ borderRadius: 8, fontWeight: 700 }}
                        disabled={phase === 'submitting'}
                        onClick={() => setShowConfirmSubmit(true)}>
                        Submit Quiz
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Col>

            {/* Sidebar: timer + question nav */}
            <Col lg="4">
              {/* Timer */}
              <Card className="shadow mb-3" style={{ borderRadius: 12, border: `2px solid ${quiz?.quiz_type === 'test' && danger ? '#f5365c' : quiz?.quiz_type === 'practice' ? '#5e72e4' : '#e9ecef'}` }}>
                <CardBody className="text-center" style={{ padding: '16px' }}>
                  {quiz?.quiz_type === 'test' ? (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Time Remaining</div>
                      <div style={{ fontSize: 42, fontWeight: 800, color: danger ? '#f5365c' : '#32325d', fontFamily: 'monospace' }}>
                        {formatTime(timeLeft)}
                      </div>
                      {danger && <div style={{ color: '#f5365c', fontSize: 12, fontWeight: 700 }}>Hurry up!</div>}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Time Elapsed</div>
                      <div style={{ fontSize: 42, fontWeight: 800, color: '#5e72e4', fontFamily: 'monospace' }}>
                        {formatTime(elapsed)}
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>

              {/* Progress */}
              <Card className="shadow mb-3" style={{ borderRadius: 12 }}>
                <CardBody style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#8898aa', fontWeight: 700 }}>Answered</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#32325d' }}>{answered}/{total}</span>
                  </div>
                  <div style={{ height: 8, background: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#2dce89', borderRadius: 4, transition: 'width 0.3s ease' }} />
                  </div>
                </CardBody>
              </Card>

              {/* Question navigator */}
              <Card className="shadow" style={{ borderRadius: 12 }}>
                <CardBody style={{ padding: '16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Questions</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {quiz?.questions?.map((qItem, idx) => {
                      const isAnswered = !!answers[qItem.id];
                      const isCurrent  = idx === current;
                      const isLocked_  = lockedAnswers.has(qItem.id);
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrent(idx)}
                          style={{
                            padding: '6px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                            border: `2px solid ${isCurrent ? '#5e72e4' : isLocked_ ? '#8898aa' : isAnswered ? '#2dce89' : '#e9ecef'}`,
                            background: isCurrent ? '#5e72e4' : isLocked_ ? '#f0f4f8' : isAnswered ? '#eafaf1' : '#fff',
                            color: isCurrent ? '#fff' : '#32325d',
                          }}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                  {quiz?.quiz_type === 'practice' && (
                    <Button
                      color="warning" outline style={{ borderRadius: 8, marginTop: 10, width: '100%', fontWeight: 700 }}
                      disabled={phase === 'submitting'} onClick={handleSaveProgress}>
                      {phase === 'submitting' ? 'Saving...' : '💾 Save & Continue Later'}
                    </Button>
                  )}
                  {!showConfirmSubmit ? (
                    <Button
                      color="success" style={{ borderRadius: 8, marginTop: 8, width: '100%', fontWeight: 700 }}
                      disabled={phase === 'submitting'}
                      onClick={() => setShowConfirmSubmit(true)}>
                      Submit Quiz
                    </Button>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ background: '#fff8e6', border: '1px solid #f6c23e', borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 12, color: '#856404', fontWeight: 600, textAlign: 'center' }}>
                        ⚠️ Once submitted, answers cannot be changed.
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button color="danger" style={{ flex: 1, borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                          disabled={phase === 'submitting'}
                          onClick={() => handleSubmit(false)}>
                          {phase === 'submitting' ? 'Submitting...' : 'Yes, Submit'}
                        </Button>
                        <Button color="secondary" outline style={{ flex: 1, borderRadius: 8, fontSize: 13 }}
                          onClick={() => setShowConfirmSubmit(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  // ---- Partial-result screen (saved progress + answer review) ----
  if (phase === 'partial-result' && partialResultData) {
    const { answeredCount, correctCount, marksObtained, partialTotalMarks, scorePct, reviewAnswers } = partialResultData;
    const incorrectCount = answeredCount - correctCount;
    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
          <Row className="justify-content-center mb-4">
            <Col lg="8">
              <Card className="shadow" style={{ borderRadius: 16, textAlign: 'center', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #5e72e4, #825ee4)', padding: '32px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>💾</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Progress Saved!</div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                    {answeredCount} questions answered — {Number(scorePct).toFixed(1)}% running score
                  </div>
                </div>
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 28, padding: '16px 0', flexWrap: 'wrap' }}>
                    {[{ label: 'Answered', value: answeredCount, color: '#32325d' },
                      { label: 'Correct',  value: correctCount,   color: '#2dce89' },
                      { label: 'Incorrect', value: incorrectCount, color: '#f5365c' },
                      { label: 'Score',    value: `${Number(marksObtained).toFixed(1)}/${Number(partialTotalMarks).toFixed(1)}`, color: '#32325d' },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                    <Button color="primary" style={{ borderRadius: 8 }} onClick={() => { setPhase('loading'); fetchQuiz(); }}>Continue Practice</Button>
                    <Button color="secondary" outline style={{ borderRadius: 8 }} onClick={() => navigate(-1)}>Back to Subject</Button>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Row className="justify-content-center">
            <Col lg="8">
              <h4 style={{ color: '#32325d', marginBottom: 16 }}>Your Answers So Far</h4>
              {reviewAnswers?.map((a, idx) => (
                <Card key={a.question_id} className="shadow mb-3" style={{ borderRadius: 12, borderLeft: `4px solid ${a.is_correct ? '#2dce89' : '#f5365c'}` }}>
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div style={{ fontWeight: 600, color: '#32325d', margin: 0, flex: 1, lineHeight: 1.5 }}>
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
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ background: a.is_correct ? '#eafaf1' : '#fde8ec', border: `1px solid ${a.is_correct ? '#2dce89' : '#f5365c'}`, borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                        <span style={{ fontWeight: 700 }}>Your answer: </span>
                        {a.selected_label ? (
                          <>
                            <span>{a.selected_label}. </span>
                            {a.selected_image_url
                              ? <img src={a.selected_image_url} alt={`Option ${a.selected_label}`} style={{ maxHeight: 80, maxWidth: 160, borderRadius: 6, objectFit: 'contain', verticalAlign: 'middle', marginLeft: 4 }} />
                              : <LatexRenderer text={a.selected_text || ''} />}
                          </>
                        ) : 'Not answered'}
                      </div>
                      {!a.is_correct && (
                        <div style={{ background: '#eafaf1', border: '1px solid #2dce89', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>Correct: </span>
                          <span>{a.correct_label}. </span>
                          {a.correct_image_url
                            ? <img src={a.correct_image_url} alt={`Option ${a.correct_label}`} style={{ maxHeight: 80, maxWidth: 160, borderRadius: 6, objectFit: 'contain', verticalAlign: 'middle', marginLeft: 4 }} />
                            : <LatexRenderer text={a.correct_text || ''} />}
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
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  // ---- Result screen ----
  if (phase === 'result' && result) {
    const { attempt, answers: reviewAnswers } = result;
    const scorePct  = Number(attempt.score_pct || 0).toFixed(1);
    const timeTaken = attempt.time_taken_seconds;
    const mins        = Math.floor(timeTaken / 60);
    const secs        = timeTaken % 60;

    return (
      <>
        <Header hideSubtitle />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
          <Row className="justify-content-center mb-4">
            <Col lg="8">
              {/* Score card */}
              <Card className="shadow" style={{ borderRadius: 16, textAlign: 'center', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #5e72e4, #825ee4)', padding: '36px 24px' }}>
                <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{scorePct}%</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>
                    {Number(attempt.marks_obtained).toFixed(1)} / {Number(attempt.total_marks).toFixed(1)} points
                  </div>
                </div>
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 32, padding: '16px 0' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase' }}>Time Taken</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#32325d' }}>{mins}m {secs}s</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase' }}>Correct</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#32325d' }}>
                        {reviewAnswers?.filter((a) => a.is_correct).length} / {reviewAnswers?.length}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                    <Button color="primary" style={{ borderRadius: 8 }} onClick={startQuiz}>Retake</Button>
                    <Button color="secondary" outline style={{ borderRadius: 8 }} onClick={() => navigate(-1)}>Back to Subject</Button>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Topic breakdown */}
          {reviewAnswers && (() => {
            const topicMap = {};
            for (const a of reviewAnswers) {
              const key = a.topic_name || 'Uncategorised';
              if (!topicMap[key]) topicMap[key] = { correct: 0, wrong: 0, total: 0 };
              topicMap[key].total += 1;
              if (a.is_correct) topicMap[key].correct += 1;
              else topicMap[key].wrong += 1;
            }
            const topics = Object.entries(topicMap);
            if (topics.length === 0) return null;
            return (
              <Row className="justify-content-center mb-4">
                <Col lg="8">
                  <Card className="shadow" style={{ borderRadius: 16 }}>
                    <CardBody>
                      <h5 style={{ color: '#32325d', marginBottom: 16, fontWeight: 700 }}>Topic-wise Breakdown</h5>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {topics.map(([topicName, stats]) => {
                          const pct = Math.round((stats.correct / stats.total) * 100);
                          return (
                            <div key={topicName} style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 600, color: '#32325d', fontSize: 14 }}>{topicName}</span>
                                <span style={{ fontSize: 13, color: '#525f7f' }}>{stats.correct}/{stats.total} correct</span>
                              </div>
                              <div style={{ background: '#dee2e6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? '#2dce89' : pct >= 40 ? '#fb6340' : '#f5365c', borderRadius: 6, transition: 'width 0.4s' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>
            );
          })()}

          {/* Review answers */}
          <Row className="justify-content-center">
            <Col lg="8">
              <h4 style={{ color: '#32325d', marginBottom: 16 }}>Review Answers</h4>
              {reviewAnswers?.map((a, idx) => (
                <Card key={a.question_id} className="shadow mb-3" style={{ borderRadius: 12, borderLeft: `4px solid ${a.is_correct ? '#2dce89' : '#f5365c'}` }}>
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div style={{ fontWeight: 600, color: '#32325d', margin: 0, flex: 1, lineHeight: 1.5 }}>
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
                        {a.selected_label ? (
                          <>
                            <span>{a.selected_label}. </span>
                            {a.selected_image_url
                              ? <img src={a.selected_image_url} alt={`Option ${a.selected_label}`} style={{ maxHeight: 80, maxWidth: 160, borderRadius: 6, objectFit: 'contain', verticalAlign: 'middle', marginLeft: 4 }} />
                              : <LatexRenderer text={a.selected_text || ''} />}
                          </>
                        ) : 'Not answered'}
                      </div>
                      {!a.is_correct && (
                        <div style={{ background: '#eafaf1', border: '1px solid #2dce89', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>Correct: </span>
                          <span>{a.correct_label}. </span>
                          {a.correct_image_url
                            ? <img src={a.correct_image_url} alt={`Option ${a.correct_label}`} style={{ maxHeight: 80, maxWidth: 160, borderRadius: 6, objectFit: 'contain', verticalAlign: 'middle', marginLeft: 4 }} />
                            : <LatexRenderer text={a.correct_text || ''} />}
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
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  return null;
}
