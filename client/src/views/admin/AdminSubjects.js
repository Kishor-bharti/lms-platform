import React, { useState, useEffect, useMemo } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input, Table
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

export default function AdminSubjects() {
  const [subjects,    setSubjects]    = useState([]);
  const [courses,     setCourses]     = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState('');
  const [courseFilter, setCourseFilter] = useState('all');

  // Create/Edit subject modal
  const [subjectModal, setSubjectModal] = useState({ open: false, editing: null });
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');
  const [form, setForm] = useState({ course_id: '', name: '', code: '', description: '' });

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({ open: false, type: '', item: null, subjectId: null });

  // Assign teacher modal
  const [teacherModal, setTeacherModal] = useState({ open: false, subject: null });
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');

  // Enroll student modal
  const [enrollModal,   setEnrollModal]   = useState({ open: false, subject: null });
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // View enrolled students modal
  const [viewStudentsModal, setViewStudentsModal] = useState({ open: false, subject: null });
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [enrolledSearch, setEnrolledSearch] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const [subRes, courseRes, teacherRes, studentRes] = await Promise.all([
        http.get('/api/admin/subjects').catch(() => ({ data: [] })),
        http.get('/api/admin/courses').catch(() => ({ data: [] })),
        http.get('/api/admin/users?role=teacher&limit=500').catch(() => ({ data: { users: [] } })),
        http.get('/api/admin/users?role=student&limit=1000').catch(() => ({ data: { users: [] } })),
      ]);
      setSubjects(subRes.data || []);
      setCourses(courseRes.data || []);
      setTeachers(teacherRes.data?.users || []);
      setStudents(studentRes.data?.users || []);
    } catch (err) {
      console.error('[AdminSubjects]', err);
      setFetchError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch enrolled students for a subject
  const fetchEnrolledStudents = async (subjectId) => {
    setEnrolledLoading(true);
    try {
      const res = await http.get(`/api/admin/subjects/${subjectId}/enrollments`);
      setEnrolledStudents(res.data || []);
    } catch (err) {
      console.error('[fetchEnrolled]', err);
      setEnrolledStudents([]);
    } finally {
      setEnrolledLoading(false);
    }
  };

  // Open view students modal
  const openViewStudents = (subject) => {
    setViewStudentsModal({ open: true, subject });
    setEnrolledSearch('');
    fetchEnrolledStudents(subject.id);
  };

  // Create or Update subject
  const handleSaveSubject = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.course_id || !form.name || !form.code) {
      setFormError('Course, name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      if (subjectModal.editing) {
        await http.put(`/api/admin/subjects/${subjectModal.editing.id}`, form);
      } else {
        await http.post('/api/admin/subjects', form);
      }
      setSubjectModal({ open: false, editing: null });
      setForm({ course_id: '', name: '', code: '', description: '' });
      fetchAll();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Failed to save subject');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit modal
  const openEditSubject = (subject) => {
    setForm({
      course_id: subject.course_id,
      name: subject.name,
      code: subject.code,
      description: subject.description || ''
    });
    setFormError('');
    setSubjectModal({ open: true, editing: subject });
  };

  // Confirm delete
  const confirmDelete = (type, item, subjectId = null) => {
    setDeleteModal({ open: true, type, item, subjectId });
  };

  const handleConfirmDelete = async () => {
    const { type, item, subjectId } = deleteModal;
    try {
      if (type === 'subject') {
        await http.delete(`/api/admin/subjects/${item.id}`);
      } else if (type === 'teacher') {
        await http.delete(`/api/admin/subjects/${subjectId}/teachers/${item.id}`);
      } else if (type === 'student') {
        await http.delete(`/api/admin/subjects/${subjectId}/enrollments/${item.id}`);
      }
      setDeleteModal({ open: false, type: '', item: null, subjectId: null });
      fetchAll();
      // Refresh enrolled students if viewing
      if (viewStudentsModal.open && viewStudentsModal.subject) {
        fetchEnrolledStudents(viewStudentsModal.subject.id);
      }
    } catch (err) {
      console.error('[delete]', err);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacher) return;
    try {
      await http.post(`/api/admin/subjects/${teacherModal.subject.id}/teachers`, { teacherId: selectedTeacher });
      setTeacherModal({ open: false, subject: null });
      setSelectedTeacher('');
      setTeacherSearch('');
      fetchAll();
    } catch (err) {
      console.error('[assignTeacher]', err);
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent) return;
    try {
      await http.post(`/api/admin/subjects/${enrollModal.subject.id}/enrollments`, { studentId: selectedStudent });
      setEnrollModal({ open: false, subject: null });
      setSelectedStudent('');
      setStudentSearch('');
      fetchAll();
    } catch (err) {
      console.error('[enrollStudent]', err);
    }
  };

  // Filter teachers: not already assigned + search
  const filteredTeachers = useMemo(() => {
    if (!teacherModal.subject) return [];
    const assignedIds = teacherModal.subject.teacher_ids || [];
    return teachers
      .filter(t => !assignedIds.includes(t.id))
      .filter(t => {
        if (!teacherSearch) return true;
        const search = teacherSearch.toLowerCase();
        return t.first_name.toLowerCase().includes(search) ||
               t.last_name.toLowerCase().includes(search) ||
               t.email.toLowerCase().includes(search);
      });
  }, [teachers, teacherModal.subject, teacherSearch]);

  // Filter students: not already enrolled + search
  const filteredStudents = useMemo(() => {
    if (!enrollModal.subject) return [];
    const enrolledIds = enrollModal.subject.enrolled_ids || [];
    return students
      .filter(s => !enrolledIds.includes(s.id))
      .filter(s => {
        if (!studentSearch) return true;
        const search = studentSearch.toLowerCase();
        return s.first_name.toLowerCase().includes(search) ||
               s.last_name.toLowerCase().includes(search) ||
               s.email.toLowerCase().includes(search);
      });
  }, [students, enrollModal.subject, studentSearch]);

  // Filter enrolled students by search
  const filteredEnrolled = useMemo(() => {
    if (!enrolledSearch) return enrolledStudents;
    const search = enrolledSearch.toLowerCase();
    return enrolledStudents.filter(s =>
      s.first_name?.toLowerCase().includes(search) ||
      s.last_name?.toLowerCase().includes(search) ||
      s.email?.toLowerCase().includes(search)
    );
  }, [enrolledStudents, enrolledSearch]);

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
                    <Input type="select" bsSize="sm" style={{ borderRadius: 8, width: 180 }}
                      value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                      <option value="all">All Courses</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Input>
                    <Button color="success" size="sm" style={{ borderRadius: 8 }}
                      onClick={() => { setForm({ course_id: '', name: '', code: '', description: '' }); setFormError(''); setSubjectModal({ open: true, editing: null }); }}>
                      + New Subject
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto' }}>
                {fetchError ? (
                  <div className="text-center py-5">
                    <p className="text-danger mb-3">{fetchError}</p>
                    <Button color="primary" onClick={fetchAll}>Retry</Button>
                  </div>
                ) : loading ? (
                  <p className="text-center text-muted py-4">Loading...</p>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-5">
                    <p className="text-muted">No subjects yet</p>
                    <Button color="success" onClick={() => { setForm({ course_id: '', name: '', code: '', description: '' }); setSubjectModal({ open: true, editing: null }); }}>Create First Subject</Button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Subject', 'Course', 'Teachers', 'Students', 'Status', 'Actions'].map((h) => (
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', maxWidth: 300 }}>
                              {(s.teacher_names || []).slice(0, 3).map((name, i) => (
                                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fff3e0', color: '#e65100', borderRadius: 20, padding: '2px 8px', fontSize: 12 }}>
                                  {name}
                                  <button
                                    onClick={() => confirmDelete('teacher', { id: s.teacher_ids[i], name }, s.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e65100', padding: 0, lineHeight: 1, fontSize: 14, fontWeight: 700 }}
                                    title="Remove teacher"
                                  >×</button>
                                </span>
                              ))}
                              {(s.teacher_names || []).length > 3 && (
                                <span style={{ fontSize: 11, color: '#8898aa' }}>+{s.teacher_names.length - 3} more</span>
                              )}
                              <button
                                onClick={() => { setTeacherModal({ open: true, subject: s }); setSelectedTeacher(''); setTeacherSearch(''); }}
                                style={{ background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                              >+ Assign</button>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={() => openViewStudents(s)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#5e72e4', textDecoration: 'underline', fontSize: 14 }}
                                title="View enrolled students"
                              >{s.enrolled_count}</button>
                              <button
                                onClick={() => { setEnrollModal({ open: true, subject: s }); setSelectedStudent(''); setStudentSearch(''); }}
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
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button size="sm" color="info" outline style={{ borderRadius: 6, padding: '4px 10px', fontSize: 11 }}
                                onClick={() => openEditSubject(s)}>Edit</Button>
                              <Button size="sm" color="danger" outline style={{ borderRadius: 6, padding: '4px 10px', fontSize: 11 }}
                                onClick={() => confirmDelete('subject', s)}>Delete</Button>
                            </div>
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

        {/* Create/Edit Subject Modal */}
        <Modal isOpen={subjectModal.open} toggle={() => setSubjectModal({ open: false, editing: null })} centered>
          <ModalHeader toggle={() => setSubjectModal({ open: false, editing: null })}>
            {subjectModal.editing ? 'Edit Subject' : 'Create New Subject'}
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSaveSubject}>
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
            <Button color="success" disabled={submitting} onClick={handleSaveSubject}>
              {submitting ? 'Saving...' : subjectModal.editing ? 'Update Subject' : 'Create Subject'}
            </Button>
            <Button color="link" onClick={() => setSubjectModal({ open: false, editing: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={deleteModal.open} toggle={() => setDeleteModal({ open: false, type: '', item: null, subjectId: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteModal({ open: false, type: '', item: null, subjectId: null })}>
            Confirm Delete
          </ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Are you sure you want to {deleteModal.type === 'student' ? 'remove' : 'delete'} <strong>{deleteModal.item?.name || (deleteModal.item?.first_name + ' ' + deleteModal.item?.last_name)}</strong>?</p>
            {deleteModal.type === 'subject' && (
              <p className="text-muted small">This will remove all teachers and student enrollments from this subject.</p>
            )}
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleConfirmDelete}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteModal({ open: false, type: '', item: null, subjectId: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Assign Teacher Modal */}
        <Modal isOpen={teacherModal.open} toggle={() => setTeacherModal({ open: false, subject: null })} centered>
          <ModalHeader toggle={() => setTeacherModal({ open: false, subject: null })}>
            Assign Teacher — {teacherModal.subject?.name}
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label>Search Teacher</Label>
              <Input
                placeholder="Search by name or email..."
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                style={{ marginBottom: 10 }}
              />
            </FormGroup>
            <FormGroup>
              <Label>Select Teacher</Label>
              {filteredTeachers.length === 0 ? (
                <p className="text-muted small">No teachers available to assign</p>
              ) : filteredTeachers.length > 20 ? (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: 8, padding: 8 }}>
                  {filteredTeachers.slice(0, 50).map((t) => (
                    <div key={t.id}
                      onClick={() => setSelectedTeacher(t.id)}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
                        background: selectedTeacher === t.id ? '#e8f4fd' : 'transparent',
                        border: selectedTeacher === t.id ? '1px solid #5e72e4' : '1px solid transparent',
                        marginBottom: 4
                      }}>
                      <div style={{ fontWeight: 600 }}>{t.first_name} {t.last_name}</div>
                      <div style={{ fontSize: 11, color: '#8898aa' }}>{t.email}</div>
                    </div>
                  ))}
                  {filteredTeachers.length > 50 && (
                    <p className="text-muted small text-center mt-2">Showing 50 of {filteredTeachers.length}. Use search to find more.</p>
                  )}
                </div>
              ) : (
                <Input type="select" value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                  <option value="">Select teacher...</option>
                  {filteredTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.email})</option>
                  ))}
                </Input>
              )}
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
              <Label>Search Student</Label>
              <Input
                placeholder="Search by name or email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ marginBottom: 10 }}
              />
            </FormGroup>
            <FormGroup>
              <Label>Select Student</Label>
              {filteredStudents.length === 0 ? (
                <p className="text-muted small">No students available to enroll</p>
              ) : filteredStudents.length > 20 ? (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: 8, padding: 8 }}>
                  {filteredStudents.slice(0, 50).map((s) => (
                    <div key={s.id}
                      onClick={() => setSelectedStudent(s.id)}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
                        background: selectedStudent === s.id ? '#d4edda' : 'transparent',
                        border: selectedStudent === s.id ? '1px solid #2dce89' : '1px solid transparent',
                        marginBottom: 4
                      }}>
                      <div style={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</div>
                      <div style={{ fontSize: 11, color: '#8898aa' }}>{s.email}</div>
                    </div>
                  ))}
                  {filteredStudents.length > 50 && (
                    <p className="text-muted small text-center mt-2">Showing 50 of {filteredStudents.length}. Use search to find more.</p>
                  )}
                </div>
              ) : (
                <Input type="select" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                  <option value="">Select student...</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</option>
                  ))}
                </Input>
              )}
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={!selectedStudent} onClick={handleEnrollStudent}>Enroll</Button>
            <Button color="link" onClick={() => setEnrollModal({ open: false, subject: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* View Enrolled Students Modal */}
        <Modal isOpen={viewStudentsModal.open} toggle={() => setViewStudentsModal({ open: false, subject: null })} centered size="lg">
          <ModalHeader toggle={() => setViewStudentsModal({ open: false, subject: null })}>
            Enrolled Students — {viewStudentsModal.subject?.name}
          </ModalHeader>
          <ModalBody>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Input
                placeholder="Search students..."
                value={enrolledSearch}
                onChange={(e) => setEnrolledSearch(e.target.value)}
                style={{ maxWidth: 300 }}
              />
              <Badge color="primary" style={{ fontSize: 14, padding: '8px 16px' }}>
                {enrolledStudents.length} enrolled
              </Badge>
            </div>
            {enrolledLoading ? (
              <p className="text-center text-muted py-4">Loading...</p>
            ) : filteredEnrolled.length === 0 ? (
              <p className="text-center text-muted py-4">
                {enrolledSearch ? 'No students match your search' : 'No students enrolled yet'}
              </p>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <Table responsive hover size="sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Enrolled At</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnrolled.map((student) => (
                      <tr key={student.id}>
                        <td style={{ fontWeight: 600 }}>{student.first_name} {student.last_name}</td>
                        <td>{student.email}</td>
                        <td>{student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : '-'}</td>
                        <td>
                          <Badge color={student.status === 'active' ? 'success' : 'warning'}>
                            {student.status}
                          </Badge>
                        </td>
                        <td>
                          <Button size="sm" color="danger" outline style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => confirmDelete('student', student, viewStudentsModal.subject.id)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="success" size="sm"
              onClick={() => { setViewStudentsModal({ open: false, subject: null }); setEnrollModal({ open: true, subject: viewStudentsModal.subject }); setStudentSearch(''); setSelectedStudent(''); }}>
              + Enroll More
            </Button>
            <Button color="secondary" outline onClick={() => setViewStudentsModal({ open: false, subject: null })}>Close</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
