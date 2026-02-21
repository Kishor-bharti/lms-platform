import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button, Badge,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import { useNavigate, useParams } from 'react-router-dom';
import http from 'utils/http';

export default function QuizTaker() {
  const { quizId } = useParams();
  const navigate   = useNavigate();

  const [phase,     setPhase]     = useState('loading'); // loading | intro | taking | submitting | result
  const [quiz,      setQuiz]      = useState(null);
  const [attempts,  setAttempts]  = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [answers,   setAnswers]   = useState({});   // { questionId: selectedOptionId }
  const [current,   setCurrent]   = useState(0);    // current question index
  const [timeLeft,  setTimeLeft]  = useState(0);    // seconds remaining
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');
  const startedAt  = useRef(null);
  const timerRef   = useRef(null);

  useEffect(() => {
    fetchQuiz();
    return () => clearInterval(timerRef.current);
  }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchQuiz = async () => {
    try {
      const [quizRes, attemptsRes] = await Promise.all([
        http.get(`/api/quizzes/${quizId}`),
        http.get(`/api/quizzes/${quizId}/attempts`),
      ]);
      setQuiz(quizRes.data);
      setAttempts(attemptsRes.data || []);
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
      setCurrent(0);
      const secs = (quiz.duration_minutes || 30) * 60;
      setTimeLeft(secs);
      startedAt.current = Date.now();
      setPhase('taking');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to start quiz');
      setPhase('intro');
    }
  };

  // Timer countdown
  useEffect(() => {
    if (phase !== 'taking') return;
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
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    clearInterval(timerRef.current);
    setPhase('submitting');
    const timeTaken = startedAt.current
      ? Math.floor((Date.now() - startedAt.current) / 1000)
      : 0;

    const answersPayload = Object.entries(answers).map(([question_id, selected_option_id]) => ({
      question_id,
      selected_option_id: selected_option_id || null,
    }));

    try {
      await http.post(`/api/quizzes/attempts/${attemptId}/submit`, {
        answers: answersPayload,
        timeTakenSeconds: timeTaken,
      });
      const resultRes = await http.get(`/api/quizzes/attempts/${attemptId}/result`);
      setResult(resultRes.data);
      setPhase('result');
    } catch (err) {
      setError('Failed to submit. Please try again.');
      setPhase('taking');
    }
  }, [answers, attemptId]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---- Loading / Error ----
  if (phase === 'loading') {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
          <Row><Col><Card><CardBody className="text-center py-5"><p>Loading...</p></CardBody></Card></Col></Row>
        </Container>
      </>
    );
  }

  if (phase === 'error') {
    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
          <Row><Col><Card><CardBody className="text-center py-5">
            <p className="text-danger">{error}</p>
            <Button color="primary" onClick={() => navigate(-1)}>Go Back</Button>
          </CardBody></Card></Col></Row>
        </Container>
      </>
    );
  }

  // ---- Intro screen ----
  if (phase === 'intro') {
    const submittedAttempts = attempts.filter((a) => a.status === 'submitted');
    const bestScore = submittedAttempts.length
      ? Math.max(...submittedAttempts.map((a) => Number(a.score_pct || 0)))
      : null;
    const maxReached = quiz?.max_attempts && attempts.length >= quiz.max_attempts;

    return (
      <>
        <Header />
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
                      { icon: '⏱', label: 'Duration',     value: `${quiz?.duration_minutes} minutes` },
                      { icon: '❓', label: 'Questions',    value: quiz?.question_count },
                      { icon: '✅', label: 'Passing Score', value: quiz?.passing_score ? `${quiz.passing_score}%` : 'N/A' },
                      { icon: '🔄', label: 'Attempts',     value: `${attempts.length} / ${quiz?.max_attempts ?? 'Unlimited'}` },
                    ].map((item) => (
                      <div key={item.label} style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.icon} {item.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#32325d', marginTop: 2 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Previous attempts */}
                  {submittedAttempts.length > 0 && (
                    <div style={{ background: '#f0f4f8', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#32325d' }}>Previous Attempts</p>
                      {submittedAttempts.map((a) => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#525f7f', padding: '3px 0' }}>
                          <span>Attempt #{a.attempt_number}</span>
                          <span style={{ fontWeight: 700, color: a.is_passed ? '#2dce89' : '#f5365c' }}>
                            {Number(a.score_pct || 0).toFixed(1)}% {a.is_passed ? 'Passed' : 'Failed'}
                          </span>
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
                    <Button
                      color="primary"
                      disabled={maxReached}
                      style={{ borderRadius: 8, padding: '10px 28px', fontWeight: 700 }}
                      onClick={startQuiz}
                    >
                      {maxReached ? 'No Attempts Left' : submittedAttempts.length ? 'Retake Quiz' : 'Start Quiz'}
                    </Button>
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
    const danger   = timeLeft <= 60;

    return (
      <>
        <Header />
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge color="light" style={{ fontWeight: 600 }}>
                        {q?.difficulty}
                      </Badge>
                      <Badge color="info">{q?.marks} {q?.marks === 1 ? 'mark' : 'marks'}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardBody style={{ padding: 24 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#32325d', lineHeight: 1.6, marginBottom: 24 }}>
                    {q?.question_text}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {q?.options?.map((opt) => {
                      const selected = answers[q.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 18px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                            border: `2px solid ${selected ? '#5e72e4' : '#e9ecef'}`,
                            background: selected ? '#eef0fd' : '#fff',
                            transition: 'all 0.15s ease', fontWeight: selected ? 700 : 400,
                          }}
                        >
                          <span style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0,
                            background: selected ? '#5e72e4' : '#f0f4f8',
                            color: selected ? '#fff' : '#525f7f', fontSize: 14,
                          }}>
                            {opt.option_label}
                          </span>
                          <span style={{ color: '#32325d' }}>{opt.option_text}</span>
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
                        disabled={phase === 'submitting'} onClick={() => handleSubmit(false)}>
                        {phase === 'submitting' ? 'Submitting...' : 'Submit Quiz'}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Col>

            {/* Sidebar: timer + question nav */}
            <Col lg="4">
              {/* Timer */}
              <Card className="shadow mb-3" style={{ borderRadius: 12, border: `2px solid ${danger ? '#f5365c' : '#e9ecef'}` }}>
                <CardBody className="text-center" style={{ padding: '16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Time Remaining</div>
                  <div style={{ fontSize: 42, fontWeight: 800, color: danger ? '#f5365c' : '#32325d', fontFamily: 'monospace' }}>
                    {formatTime(timeLeft)}
                  </div>
                  {danger && <div style={{ color: '#f5365c', fontSize: 12, fontWeight: 700 }}>Hurry up!</div>}
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
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrent(idx)}
                          style={{
                            padding: '6px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                            border: `2px solid ${isCurrent ? '#5e72e4' : isAnswered ? '#2dce89' : '#e9ecef'}`,
                            background: isCurrent ? '#5e72e4' : isAnswered ? '#eafaf1' : '#fff',
                            color: isCurrent ? '#fff' : '#32325d',
                          }}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    color="success" style={{ borderRadius: 8, marginTop: 14, width: '100%', fontWeight: 700 }}
                    disabled={phase === 'submitting'} onClick={() => handleSubmit(false)}>
                    {phase === 'submitting' ? 'Submitting...' : 'Submit Quiz'}
                  </Button>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </>
    );
  }

  // ---- Result screen ----
  if (phase === 'result' && result) {
    const { attempt, answers: reviewAnswers } = result;
    const scorePct    = Number(attempt.score_pct || 0).toFixed(1);
    const isPassed    = attempt.is_passed;
    const timeTaken   = attempt.time_taken_seconds;
    const mins        = Math.floor(timeTaken / 60);
    const secs        = timeTaken % 60;

    return (
      <>
        <Header />
        <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
          <Row className="justify-content-center mb-4">
            <Col lg="8">
              {/* Score card */}
              <Card className="shadow" style={{ borderRadius: 16, textAlign: 'center', overflow: 'hidden' }}>
                <div style={{ background: isPassed ? 'linear-gradient(135deg, #2dce89, #26af74)' : 'linear-gradient(135deg, #f5365c, #d42b51)', padding: '36px 24px' }}>
                  <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{scorePct}%</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: 8 }}>
                    {isPassed ? 'Passed!' : 'Not Passed'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
                    {Number(attempt.marks_obtained).toFixed(1)} / {Number(attempt.total_marks).toFixed(1)} marks
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

          {/* Review answers */}
          <Row className="justify-content-center">
            <Col lg="8">
              <h4 style={{ color: '#32325d', marginBottom: 16 }}>Review Answers</h4>
              {reviewAnswers?.map((a, idx) => (
                <Card key={a.question_id} className="shadow mb-3" style={{ borderRadius: 12, borderLeft: `4px solid ${a.is_correct ? '#2dce89' : '#f5365c'}` }}>
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <p style={{ fontWeight: 600, color: '#32325d', margin: 0, flex: 1, lineHeight: 1.5 }}>
                        {idx + 1}. {a.question_text}
                      </p>
                      <Badge color={a.is_correct ? 'success' : 'danger'} style={{ marginLeft: 12, flexShrink: 0 }}>
                        {a.is_correct ? `+${Number(a.marks_awarded).toFixed(1)}` : '0'} marks
                      </Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ background: a.is_correct ? '#eafaf1' : '#fde8ec', border: `1px solid ${a.is_correct ? '#2dce89' : '#f5365c'}`, borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                        <span style={{ fontWeight: 700 }}>Your answer: </span>
                        {a.selected_label ? `${a.selected_label}. ${a.selected_text}` : 'Not answered'}
                      </div>
                      {!a.is_correct && (
                        <div style={{ background: '#eafaf1', border: '1px solid #2dce89', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>Correct: </span>
                          {a.correct_label}. {a.correct_text}
                        </div>
                      )}
                    </div>
                    {a.explanation && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff8e6', borderRadius: 8, fontSize: 13, color: '#525f7f' }}>
                        <span style={{ fontWeight: 700 }}>Explanation: </span>{a.explanation}
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
