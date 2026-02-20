import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

export default function AdminSubjects() {
  const [subjects,    setSubjects]    = useState([]);
  const [courses,     setCourses]     = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [courseFilter, setCourseFilter] = useState('all');

  // Create subject modal
  const [createOpen,  setCreateOpen]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');
  const [form, setForm] = useState({ course_id: '', name: '', code: '', description: '' });

  // Assign teacher modal
  const [teacherModal, setTeacherModal] = useState({ open: false, subject: null });
  const [selectedTeacher, setSelectedTeacher] = useState('');

  // Enroll student modal
  const [enrollModal,   setEnrollModal]   = useState({ open: false, subject: null });
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [subRes, courseRes, teacherRes, studentRes] = await Promise.all([
        http.get('/api/admin/subjects'),
        http.get('/api/admin/courses'),
        http.get('/api/admin/users?role=teacher'),
        http.get('/api/admin/users?role=student'),
      ]);
      setSubjects(subRes.data || []);
      setCourses(courseRes.data || []);
      setTeachers(teacherRes.data || []);
      setStudents(studentRes.data || []);
    } catch (err) {
      console.error('[AdminSubjects]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.course_id || !form.name || !form.code) {
      setFormError('Course, name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      await http.post('/api/admin/subjects', form);
      setCreateOpen(false);
      setForm({ course_id: '', name: '', code: '', description: '' });
      fetchAll();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Failed to create subject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacher) return;
    try {
      await http.post(`/api/admin/subjects/${teacherModal.subject.id}/teachers`, { teacherId: selectedTeacher });
      setTeacherModal({ open: false, subject: null });
      setSelectedTeacher('');
      fetchAll();
    } catch (err) {
      console.error('[assignTeacher]', err);
    }
  };

  const handleRemoveTeacher = async (subjectId, teacherId) => {
    try {
      await http.delete(`/api/admin/subjects/${subjectId}/teachers/${teacherId}`);
      fetchAll();
    } catch (err) {
      console.error('[removeTeacher]', err);
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent) return;
    try {
      await http.post(`/api/admin/subjects/${enrollModal.subject.id}/enrollments`, { studentId: selectedStudent });
      setEnrollModal({ open: false, subject: null });
      setSelectedStudent('');
      fetchAll();
    } catch (err) {
      console.error('[enrollStudent]', err);
    }
  };

  const filtered = courseFilter === 'all'
    ? subjects
    : subjects.filter((s) => s.course_id === courseFilter);

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row>
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                  <CardTitle className="mb-0">Subject Management</CardTitle>
                  <div className="d-flex align-items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {/* Course filter */}
                    <Input type="select" bsSize="sm" style={{ borderRadius: 8, width: 180 }}
                      value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                      <option value="all">All Courses</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Input>
                    <Button color="success" size="sm" style={{ borderRadius: 8 }}
                      onClick={() => setCreateOpen(true)}>
                      + New Subject
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto' }}>
                {loading ? (
                  <p className="text-center text-muted py-4">Loading...</p>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-5">
                    <p className="text-muted">No subjects yet</p>
                    <Button color="success" onClick={() => setCreateOpen(true)}>Create First Subject</Button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Subject', 'Course', 'Teachers', 'Students', 'Actions'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#32325d' }}>{s.name}</div>
                            <Badge color="light" style={{ fontSize: 10 }}>{s.code}</Badge>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#525f7f' }}>{s.course_name}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              {(s.teacher_names || []).map((name, i) => (
                                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fff3e0', color: '#e65100', borderRadius: 20, padding: '2px 8px', fontSize: 12 }}>
                                  {name}
                                  <button
                                    onClick={() => handleRemoveTeacher(s.id, s.teacher_ids[i])}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e65100', padding: 0, lineHeight: 1, fontSize: 14, fontWeight: 700 }}
                                    title="Remove teacher"
                                  >x</button>
                                </span>
                              ))}
                              <button
                                onClick={() => { setTeacherModal({ open: true, subject: s }); setSelectedTeacher(''); }}
                                style={{ background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                              >+ Assign</button>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: '#32325d' }}>{s.enrolled_count}</span>
                              <button
                                onClick={() => { setEnrollModal({ open: true, subject: s }); setSelectedStudent(''); }}
                                style={{ background: '#2dce89', color: '#fff', border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                              >+ Enroll</button>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: s.is_active ? '#d4edda' : '#f8d7da',
                              color: s.is_active ? '#155724' : '#721c24',
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            }}>
                              {s.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Create Subject Modal */}
        <Modal isOpen={createOpen} toggle={() => setCreateOpen(false)} centered>
          <ModalHeader toggle={() => setCreateOpen(false)}>Create New Subject</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleCreate}>
              <FormGroup>
                <Label>Course *</Label>
                <Input type="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
                  <option value="">Select course...</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Input>
              </FormGroup>
              <Row>
                <Col md="8">
                  <FormGroup>
                    <Label>Subject Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SAT Math" />
                  </FormGroup>
                </Col>
                <Col md="4">
                  <FormGroup>
                    <Label>Code *</Label>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAT-MATH" />
                  </FormGroup>
                </Col>
              </Row>
              <FormGroup>
                <Label>Description</Label>
                <Input type="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional..." />
              </FormGroup>
              {formError && <p className="text-danger small">{formError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={submitting} onClick={handleCreate}>
              {submitting ? 'Creating...' : 'Create Subject'}
            </Button>
            <Button color="link" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Assign Teacher Modal */}
        <Modal isOpen={teacherModal.open} toggle={() => setTeacherModal({ open: false, subject: null })} centered>
          <ModalHeader toggle={() => setTeacherModal({ open: false, subject: null })}>
            Assign Teacher — {teacherModal.subject?.name}
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label>Select Teacher</Label>
              <Input type="select" value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                <option value="">Select teacher...</option>
                {teachers
                  .filter((t) => !(teacherModal.subject?.teacher_ids || []).includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.email})</option>
                  ))}
              </Input>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" disabled={!selectedTeacher} onClick={handleAssignTeacher}>Assign</Button>
            <Button color="link" onClick={() => setTeacherModal({ open: false, subject: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Enroll Student Modal */}
        <Modal isOpen={enrollModal.open} toggle={() => setEnrollModal({ open: false, subject: null })} centered>
          <ModalHeader toggle={() => setEnrollModal({ open: false, subject: null })}>
            Enroll Student — {enrollModal.subject?.name}
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label>Select Student</Label>
              <Input type="select" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                <option value="">Select student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</option>
                ))}
              </Input>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={!selectedStudent} onClick={handleEnrollStudent}>Enroll</Button>
            <Button color="link" onClick={() => setEnrollModal({ open: false, subject: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
