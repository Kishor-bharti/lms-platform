import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Button, FormGroup, Label, Input, Spinner,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import LatexRenderer from 'components/LatexRenderer.js';
import { useNavigate, useLocation } from 'react-router-dom';
import http from 'utils/http';

const BLANK_OPTION = (label) => ({ label, text: '', is_correct: false });
const BLANK_QUESTION = (idx) => ({
  question_text: '',
  explanation: '',
  difficulty: 'medium',
  marks: 1,
  order_index: idx,
  image_url: '',
  topic_id: '',
  options: ['A', 'B', 'C', 'D'].map(BLANK_OPTION),
});

export default function QuizBuilder() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const subjectId = location.state?.subjectId;
  const subjectName = location.state?.subjectName;

  const [meta, setMeta] = useState({
    title: '',
    quiz_type: 'practice',
    description: '',
    duration_minutes: 30,
    passing_score: 60,
    max_attempts: 3,
  });
  const [questions, setQuestions] = useState([BLANK_QUESTION(0)]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [topics,    setTopics]    = useState([]);
  const [uploading, setUploading] = useState(null); // qi of uploading question
  const fileInputRefs = useRef({});

  useEffect(() => {
    if (!subjectId) return;
    http.get(`/api/subjects/${subjectId}/topics`)
      .then(res => setTopics(res.data || []))
      .catch(() => {});
  }, [subjectId]);

  const handleImageUpload = async (qi, file) => {
    if (!file) return;
    setUploading(qi);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await http.post('/api/upload/quiz-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateQuestion(qi, 'image_url', res.data.url);
    } catch (err) {
      setError(`Image upload failed for Q${qi + 1}`);
    } finally {
      setUploading(null);
    }
  };

  const updateQuestion = (qi, field, value) => {
    setQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, [field]: value } : q));
  };

  const updateOption = (qi, oi, field, value) => {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qi) return q;
      const opts = q.options.map((o, j) => {
        if (j !== oi) return field === 'is_correct' ? { ...o, is_correct: false } : o;
        return { ...o, [field]: value };
      });
      return { ...q, options: opts };
    }));
  };

  const addQuestion = () => setQuestions((prev) => [...prev, BLANK_QUESTION(prev.length)]);

  const removeQuestion = (qi) => setQuestions((prev) => prev.filter((_, i) => i !== qi));

  const handleSave = async (publish) => {
    setError('');
    if (!meta.title) { setError('Quiz title is required'); return; }
    if (!subjectId)  { setError('No subject selected — go back and try again'); return; }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) { setError(`Question ${i + 1} is missing text`); return; }
      const hasCorrect = q.options.some((o) => o.is_correct);
      if (!hasCorrect) { setError(`Question ${i + 1} has no correct answer selected`); return; }
    }

    setSaving(true);
    try {
      const res = await http.post('/api/quizzes', {
        subjectId,
        ...meta,
        duration_minutes: Number(meta.duration_minutes),
        passing_score: Number(meta.passing_score),
        max_attempts: Number(meta.max_attempts),
        questions,
      });

      if (publish) {
        await http.patch(`/api/quizzes/${res.data.id}/publish`, { is_published: true });
      }

      navigate(-1);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 40 }}>

        {/* Header bar */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardBody style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#32325d' }}>Create Quiz</h3>
                  {subjectName && <small className="text-muted">for {subjectName}</small>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button color="secondary" outline style={{ borderRadius: 8 }} onClick={() => navigate(-1)}>Cancel</Button>
                  <Button color="primary"  style={{ borderRadius: 8 }} disabled={saving} onClick={() => handleSave(false)}>
                    {saving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button color="success" style={{ borderRadius: 8 }} disabled={saving} onClick={() => handleSave(true)}>
                    {saving ? 'Publishing...' : 'Save & Publish'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {error && (
          <Row className="mb-3">
            <Col><div className="alert alert-danger py-2">{error}</div></Col>
          </Row>
        )}

        {/* Quiz meta */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <CardTitle className="mb-0">Quiz Settings</CardTitle>
              </CardHeader>
              <CardBody>
                <Row>
                  <Col md="6">
                    <FormGroup>
                      <Label>Quiz Title *</Label>
                      <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="e.g. Algebra Practice Test" />
                    </FormGroup>
                  </Col>
                  <Col md="3">
                    <FormGroup>
                      <Label>Type</Label>
                      <Input type="select" value={meta.quiz_type} onChange={(e) => setMeta({ ...meta, quiz_type: e.target.value })}>
                        <option value="practice">Practice</option>
                        <option value="test">Test</option>
                      </Input>
                    </FormGroup>
                  </Col>
                  <Col md="3">
                    <FormGroup>
                      <Label>Duration (mins)</Label>
                      <Input type="number" min={5} value={meta.duration_minutes} onChange={(e) => setMeta({ ...meta, duration_minutes: e.target.value })} />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md="4">
                    <FormGroup>
                      <Label>Passing Score (%)</Label>
                      <Input type="number" min={0} max={100} value={meta.passing_score} onChange={(e) => setMeta({ ...meta, passing_score: e.target.value })} />
                    </FormGroup>
                  </Col>
                  <Col md="4">
                    <FormGroup>
                      <Label>Max Attempts</Label>
                      <Input type="number" min={1} value={meta.max_attempts} onChange={(e) => setMeta({ ...meta, max_attempts: e.target.value })} />
                    </FormGroup>
                  </Col>
                  <Col md="4">
                    <FormGroup>
                      <Label>Description</Label>
                      <Input type="textarea" rows={1} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Optional..." />
                    </FormGroup>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Questions */}
        {questions.map((q, qi) => (
          <Row key={qi} className="mb-3">
            <Col>
              <Card className="shadow" style={{ borderRadius: 12, borderLeft: '4px solid #5e72e4' }}>
                <CardHeader style={{ background: '#f8f9fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <span style={{ fontWeight: 700, color: '#32325d' }}>Question {qi + 1}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Input type="select" bsSize="sm" value={q.difficulty} style={{ width: 110 }}
                        onChange={(e) => updateQuestion(qi, 'difficulty', e.target.value)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </Input>
                      <Input type="number" bsSize="sm" value={q.marks} min={0.5} step={0.5} style={{ width: 70 }}
                        onChange={(e) => updateQuestion(qi, 'marks', Number(e.target.value))}
                        title="Marks" />
                      {questions.length > 1 && (
                        <Button size="sm" color="danger" outline style={{ borderRadius: 20, padding: '2px 10px' }}
                          onClick={() => removeQuestion(qi)}>Remove</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  <FormGroup>
                    <Label style={{ fontSize: 12, color: '#8898aa' }}>
                      Question Text <span style={{ fontWeight: 400 }}>(use $...$ for inline math, $$...$$ for block math)</span>
                    </Label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Input
                        type="textarea"
                        rows={4}
                        placeholder="Enter question text..."
                        value={q.question_text}
                        onChange={(e) => updateQuestion(qi, 'question_text', e.target.value)}
                        style={{ fontWeight: 500 }}
                      />
                      <div style={{
                        border: '1px solid #e9ecef', borderRadius: 6, padding: 12,
                        minHeight: 100, background: '#fafbfc', overflow: 'auto',
                      }}>
                        <LatexRenderer text={q.question_text || 'Preview will appear here...'} style={{ color: q.question_text ? '#32325d' : '#adb5bd' }} />
                      </div>
                    </div>
                  </FormGroup>

                  {/* Image upload */}
                  <div style={{ marginBottom: 12 }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      ref={el => fileInputRefs.current[qi] = el}
                      onChange={(e) => { handleImageUpload(qi, e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button size="sm" color="info" outline style={{ borderRadius: 6 }}
                        disabled={uploading === qi}
                        onClick={() => fileInputRefs.current[qi]?.click()}>
                        {uploading === qi ? <><Spinner size="sm" /> Uploading...</> : '📷 Add Image'}
                      </Button>
                      {q.image_url && (
                        <Button size="sm" color="danger" outline style={{ borderRadius: 6 }}
                          onClick={() => updateQuestion(qi, 'image_url', '')}>
                          Remove Image
                        </Button>
                      )}
                    </div>
                    {q.image_url && (
                      <img src={q.image_url} alt="Question" style={{ maxWidth: '100%', maxHeight: 250, borderRadius: 8, marginTop: 8, border: '1px solid #e9ecef', objectFit: 'contain', display: 'block' }} />
                    )}
                  </div>

                  {/* Topic selector */}
                  {topics.length > 0 && (
                    <FormGroup style={{ marginBottom: 12 }}>
                      <Label style={{ fontSize: 12, color: '#8898aa' }}>Topic</Label>
                      <Input type="select" bsSize="sm" value={q.topic_id}
                        onChange={(e) => updateQuestion(qi, 'topic_id', e.target.value)}
                        style={{ maxWidth: 300 }}>
                        <option value="">-- No topic --</option>
                        {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </Input>
                    </FormGroup>
                  )}

                  {/* Options */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {q.options.map((opt, oi) => (
                      <div key={oi} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: opt.is_correct ? '#eafaf1' : '#f8f9fa',
                        border: `2px solid ${opt.is_correct ? '#2dce89' : '#e9ecef'}`,
                        borderRadius: 8, padding: '8px 12px',
                      }}>
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={opt.is_correct}
                          onChange={() => updateOption(qi, oi, 'is_correct', true)}
                          style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                          title="Mark as correct answer"
                        />
                        <span style={{ fontWeight: 700, color: '#5e72e4', minWidth: 20 }}>{opt.label}.</span>
                        <Input
                          bsSize="sm"
                          value={opt.text}
                          placeholder={`Option ${opt.label}...`}
                          onChange={(e) => updateOption(qi, oi, 'text', e.target.value)}
                          style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }}
                        />
                      </div>
                    ))}
                  </div>

                  <FormGroup className="mb-0">
                    <Input
                      bsSize="sm"
                      placeholder="Explanation (shown after attempt)..."
                      value={q.explanation}
                      onChange={(e) => updateQuestion(qi, 'explanation', e.target.value)}
                    />
                  </FormGroup>
                </CardBody>
              </Card>
            </Col>
          </Row>
        ))}

        {/* Add question */}
        <Row>
          <Col className="text-center">
            <Button color="primary" outline style={{ borderRadius: 20, padding: '8px 24px' }} onClick={addQuestion}>
              + Add Question
            </Button>
          </Col>
        </Row>
      </Container>
    </>
  );
}
