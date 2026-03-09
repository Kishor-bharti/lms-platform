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
  explanation_image_url: '',
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
  const subjectId   = location.state?.subjectId;
  const subjectName = location.state?.subjectName;
  const editQuizId  = location.state?.editQuizId; // present only in edit mode
  const courseId     = location.state?.courseId;
  const courseName  = location.state?.courseName;
  const isCourseQuiz = location.state?.isCourseQuiz;

  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const isAdmin  = userRole === 'admin';

  const [meta, setMeta] = useState({
    title: '',
    quiz_type: isCourseQuiz ? 'test' : 'practice',
    description: '',
    duration_minutes: 60,
    max_attempts: 1,
    topicId: '',
  });
  const [questions, setQuestions] = useState([BLANK_QUESTION(0)]);
  const [saving,    setSaving]    = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [error,     setError]     = useState('');
  const [topics,    setTopics]    = useState([]);
  const [uploading, setUploading] = useState(null); // qi of uploading question (question image)
  const [uploadingExpl, setUploadingExpl] = useState(null); // qi of uploading explanation image
  const fileInputRefs = useRef({});
  const explImageRefs = useRef({});

  useEffect(() => {
    if (!subjectId) return;
    http.get(`/api/subjects/${subjectId}/topics`)
      .then(res => setTopics(res.data || []))
      .catch(() => {});
  }, [subjectId]);

  useEffect(() => {
    if (!isCourseQuiz || !courseId) return;
    http.get(`/api/courses/${courseId}/topics`)
      .then(res => setTopics(res.data || []))
      .catch(() => {});
  }, [courseId, isCourseQuiz]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing quiz when in edit mode
  useEffect(() => {
    if (!editQuizId) return;
    setLoadingQuiz(true);
    http.get(`/api/quizzes/${editQuizId}`)
      .then(res => {
        const q = res.data;
        setMeta({
          title:            q.title,
          quiz_type:        q.quiz_type,
          description:      q.description || '',
          duration_minutes: q.duration_minutes || 60,
          max_attempts:     q.max_attempts || 1,
          topicId:          q.topic_id || '',
        });
        setQuestions(
          (q.questions || []).map((qItem, idx) => ({
            question_text: qItem.question_text,
            explanation:   qItem.explanation || '',
            explanation_image_url: qItem.explanation_image_url || '',
            difficulty:    qItem.difficulty || 'medium',
            marks:         qItem.marks || 1,
            order_index:   qItem.order_index ?? idx,
            image_url:     qItem.image_url || '',
            topic_id:      qItem.topic_id  || '',
            options: (qItem.options || []).map(o => ({
              label:      o.option_label,
              text:       o.option_text,
              is_correct: Boolean(o.is_correct),
            })),
          }))
        );
      })
      .catch(() => setError('Failed to load quiz for editing'))
      .finally(() => setLoadingQuiz(false));
  }, [editQuizId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageUpload = async (qi, file) => {
    if (!file) return;
    
    // Validate file size (2MB = 2097152 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`Image too large for Q${qi + 1}: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 2MB`);
      return;
    }
    
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

  const handleExplanationImageUpload = async (qi, file) => {
    if (!file) return;
    
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`Explanation image too large for Q${qi + 1}: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 2MB`);
      return;
    }
    
    setUploadingExpl(qi);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await http.post('/api/upload/quiz-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateQuestion(qi, 'explanation_image_url', res.data.url);
    } catch (err) {
      setError(`Explanation image upload failed for Q${qi + 1}`);
    } finally {
      setUploadingExpl(null);
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
    if (!subjectId && !editQuizId && !isCourseQuiz) { setError('No subject selected — go back and try again'); return; }
    if (topics.length === 0) {
      setError(isCourseQuiz
        ? 'No topics available — add topics to the subjects in this course before creating test sets'
        : 'No topics yet — add topics to this subject before creating practice sets');
      return;
    }
    if (!isCourseQuiz && subjectId && !meta.topicId) {
      setError('Topic is required — select which topic this practice set covers'); return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) { setError(`Question ${i + 1} is missing text`); return; }
      const hasCorrect = q.options.some((o) => o.is_correct);
      if (!hasCorrect) { setError(`Question ${i + 1} has no correct answer selected`); return; }
      if (!q.topic_id) {
        setError(`Question ${i + 1}: topic is required`); return;
      }
    }

    setSaving(true);
    try {
      let savedId;
      if (editQuizId) {
        // Edit mode — PUT to update existing quiz
        const res = await http.put(`/api/quizzes/${editQuizId}`, {
          title: meta.title,
          quiz_type: meta.quiz_type,
          description: meta.description,
          duration_minutes: meta.quiz_type === 'practice' ? 0 : Number(meta.duration_minutes),
          max_attempts: Number(meta.max_attempts) || 1,
          topicId: meta.topicId || undefined,
          questions,
        });
        savedId = res.data.id;
        // Teachers: auto-unpublish after edit — admin must review before re-publishing
        if (!isAdmin) {
          await http.patch(`/api/quizzes/${savedId}/publish`, { is_published: false });
        }
      } else {
        // Create mode — POST
        const payload = {
          title: meta.title,
          quiz_type: meta.quiz_type,
          description: meta.description,
          duration_minutes: meta.quiz_type === 'practice' ? 0 : Number(meta.duration_minutes),
          max_attempts: Number(meta.max_attempts) || 1,
          topicId: meta.topicId || undefined,
          questions,
        };
        if (isCourseQuiz && courseId) {
          payload.courseId = courseId;
        } else {
          payload.subjectId = subjectId;
        }
        const res = await http.post('/api/quizzes', payload);
        savedId = res.data.id;
      }

      if (publish) {
        await http.patch(`/api/quizzes/${savedId}/publish`, { is_published: true });
      }

      navigate(-1);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  if (loadingQuiz) return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col><div className="text-center py-5"><p>Loading quiz...</p></div></Col></Row>
      </Container>
    </>
  );

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
                  <h3 style={{ margin: 0, color: '#32325d' }}>
                    {editQuizId
                      ? (meta.quiz_type === 'test' ? 'Edit Test Set' : 'Edit Practice Set')
                      : isCourseQuiz ? 'Create Test Set' : 'Create Practice Set'}
                  </h3>
                  {subjectName && <small className="text-muted">for {subjectName}</small>}
                  {isCourseQuiz && courseName && <small className="text-muted">for {courseName}</small>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button color="secondary" outline style={{ borderRadius: 8 }} onClick={() => navigate(-1)}>Cancel</Button>
                  <Button color="primary"  style={{ borderRadius: 8 }} disabled={saving} onClick={() => handleSave(false)}>
                    {saving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  {isAdmin && (
                    <Button color="success" style={{ borderRadius: 8 }} disabled={saving} onClick={() => handleSave(true)}>
                      {saving ? 'Publishing...' : 'Save & Publish'}
                    </Button>
                  )}
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
                <CardTitle className="mb-0">{isCourseQuiz ? 'Test Settings' : 'Practice Settings'}</CardTitle>
              </CardHeader>
              <CardBody>
                <Row>
                  <Col md="9">
                    <FormGroup>
                      <Label>Quiz Title *</Label>
                      <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="e.g. Algebra Practice Test" />
                    </FormGroup>
                  </Col>
                  <Col md="3">
                    {meta.quiz_type === 'test' ? (
                      <FormGroup>
                        <Label>Duration (mins)</Label>
                        <Input type="number" min={5} value={meta.duration_minutes} onChange={(e) => setMeta({ ...meta, duration_minutes: e.target.value })} />
                      </FormGroup>
                    ) : (
                      <FormGroup>
                        <Label>Duration</Label>
                        <div className="alert alert-info py-2 mb-0" style={{ fontSize: 12, borderRadius: 6 }}>⏱ No timer (practice)</div>
                      </FormGroup>
                    )}
                  </Col>
                </Row>
                <Row>
                  <Col md="4">
                    <FormGroup>
                      <Label>Max Attempts</Label>
                      <Input type="number" min={1} value={meta.max_attempts} onChange={(e) => setMeta({ ...meta, max_attempts: e.target.value })} />
                    </FormGroup>
                  </Col>
                  <Col md={subjectId && !isCourseQuiz ? '4' : '8'}>
                    <FormGroup>
                      <Label>Description</Label>
                      <Input type="textarea" rows={1} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Optional..." />
                    </FormGroup>
                  </Col>
                  {subjectId && !isCourseQuiz && (
                    <Col md="4">
                      <FormGroup>
                        <Label>Topic <span className="text-danger">*</span></Label>
                        {topics.length === 0 ? (
                          <div className="alert alert-warning py-2 mb-0" style={{ fontSize: 12, borderRadius: 6 }}>
                            ⚠️ No topics yet — add topics to this subject first
                          </div>
                        ) : (
                          <Input type="select" value={meta.topicId} onChange={(e) => setMeta({ ...meta, topicId: e.target.value })}>
                            <option value="">— Select topic —</option>
                            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </Input>
                        )}
                      </FormGroup>
                    </Col>
                  )}
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
                        title="Points" />
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
                      <small style={{ color: '#8898aa' }}>Max 2MB</small>
                      {q.image_url && (
                        <Button size="sm" color="danger" outline style={{ borderRadius: 6 }}
                          onClick={() => updateQuestion(qi, 'image_url', '')}>
                          Remove Image
                        </Button>
                      )}
                    </div>
                    {q.image_url && (
                      <img src={q.image_url} alt="Question" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 8, border: '1px solid #e9ecef', objectFit: 'contain', display: 'block' }} />
                    )}
                  </div>

                  {/* Topic selector */}
                  <FormGroup style={{ marginBottom: 12 }}>
                    <Label style={{ fontSize: 12, color: '#8898aa' }}>
                      Topic <span className="text-danger">*</span>
                    </Label>
                    {topics.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#fb6340', padding: '4px 0' }}>
                        ⚠️ No topics available — {isCourseQuiz ? 'add topics to the subjects in this course' : 'add topics to this subject'} first
                      </div>
                    ) : (
                      <Input type="select" bsSize="sm" value={q.topic_id}
                        onChange={(e) => updateQuestion(qi, 'topic_id', e.target.value)}
                        style={{ maxWidth: 320 }}>
                        <option value="">— Select topic —</option>
                        {topics.map(t => (
                          <option key={t.id} value={t.id}>
                            {isCourseQuiz && t.subject_name ? `${t.subject_name} — ${t.name}` : t.name}
                          </option>
                        ))}
                      </Input>
                    )}
                  </FormGroup>

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

                  {/* Explanation section */}
                  <FormGroup className="mb-0">
                    <Label style={{ fontSize: 12, color: '#8898aa' }}>Explanation (shown after attempt)</Label>
                    <textarea
                      className="form-control form-control-sm"
                      placeholder="Explanation (shown after attempt — supports $LaTeX$)..."
                      value={q.explanation}
                      onChange={(e) => {
                        updateQuestion(qi, 'explanation', e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      rows={1}
                      style={{ resize: 'none', overflow: 'hidden', minHeight: 34 }}
                    />
                    
                    {/* Explanation image upload */}
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        ref={el => explImageRefs.current[qi] = el}
                        onChange={(e) => { handleExplanationImageUpload(qi, e.target.files?.[0]); e.target.value = ''; }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Button size="sm" color="secondary" outline style={{ borderRadius: 6, fontSize: 11 }}
                          disabled={uploadingExpl === qi}
                          onClick={() => explImageRefs.current[qi]?.click()}>
                          {uploadingExpl === qi ? <><Spinner size="sm" /> Uploading...</> : '📷 Add Explanation Image'}
                        </Button>
                        <small style={{ color: '#8898aa' }}>Max 2MB</small>
                        {q.explanation_image_url && (
                          <Button size="sm" color="danger" outline style={{ borderRadius: 6, fontSize: 11 }}
                            onClick={() => updateQuestion(qi, 'explanation_image_url', '')}>
                            Remove
                          </Button>
                        )}
                      </div>
                      {q.explanation_image_url && (
                        <img src={q.explanation_image_url} alt="Explanation" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8, marginTop: 8, border: '1px solid #e9ecef', objectFit: 'contain', display: 'block' }} />
                      )}
                    </div>
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
