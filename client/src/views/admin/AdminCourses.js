import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

export default function AdminCourses() {
  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, course: null });

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await http.get('/api/admin/courses');
      setCourses(res.data || []);
    } catch (err) {
      console.error('[AdminCourses]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.code) {
      setFormError('Name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      await http.post('/api/admin/courses', form);
      setModalOpen(false);
      setForm({ name: '', code: '', description: '' });
      fetchCourses();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.course) return;
    try {
      await http.delete(`/api/admin/courses/${deleteModal.course.id}`);
      setDeleteModal({ open: false, course: null });
      fetchCourses();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete course');
    }
  };

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row>
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="d-flex justify-content-between align-items-center">
                  <CardTitle className="mb-0">Course Management</CardTitle>
                  <Button color="success" size="sm" style={{ borderRadius: 8 }} onClick={() => setModalOpen(true)}>
                    + New Course
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                {loading ? (
                  <p className="text-center text-muted py-4">Loading...</p>
                ) : courses.length === 0 ? (
                  <div className="text-center py-5">
                    <p className="text-muted">No courses yet</p>
                    <Button color="success" onClick={() => setModalOpen(true)}>Create First Course</Button>
                  </div>
                ) : (
                  <Row>
                    {courses.map((c) => (
                      <Col key={c.id} lg="4" md="6" className="mb-4">
                        <div style={{
                          background: '#fff',
                          borderRadius: 12,
                          border: '1px solid #e9ecef',
                          borderLeft: '4px solid #5e72e4',
                          padding: 20,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                        }}>
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <h5 style={{ color: '#32325d', marginBottom: 2 }}>{c.name}</h5>
                              <Badge color="light" style={{ fontSize: 11, fontWeight: 700 }}>{c.code}</Badge>
                            </div>
                            <span style={{
                              background: c.is_active ? '#d4edda' : '#f8d7da',
                              color: c.is_active ? '#155724' : '#721c24',
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            }}>
                              {c.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {c.description && (
                            <p style={{ color: '#8898aa', fontSize: 13, marginBottom: 12 }}>{c.description}</p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <i className="ni ni-collection" style={{ color: '#5e72e4', fontSize: 14 }} />
                            <span style={{ fontSize: 13, color: '#525f7f', fontWeight: 600 }}>
                              {c.subject_count} {c.subject_count === 1 ? 'subject' : 'subjects'}
                            </span>
                          </div>
                          <div style={{ marginTop: 14 }}>
                            <Button
                              color="danger"
                              outline
                              size="sm"
                              style={{ borderRadius: 8, fontWeight: 700, width: '100%' }}
                              onClick={() => setDeleteModal({ open: true, course: c })}
                            >
                              🗑️ Delete Course
                            </Button>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Create Course Modal */}
        <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered>
          <ModalHeader toggle={() => setModalOpen(false)}>Create New Course</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleCreate}>
              <FormGroup>
                <Label>Course Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. SAT Prep"
                />
              </FormGroup>
              <FormGroup>
                <Label>Course Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAT"
                />
              </FormGroup>
              <FormGroup>
                <Label>Description</Label>
                <Input
                  type="textarea"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </FormGroup>
              {formError && <p className="text-danger small mt-2">{formError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={submitting} onClick={handleCreate}>
              {submitting ? 'Creating...' : 'Create Course'}
            </Button>
            <Button color="link" onClick={() => setModalOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={deleteModal.open} toggle={() => setDeleteModal({ open: false, course: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteModal({ open: false, course: null })}>
            Confirm Delete
          </ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Are you sure you want to permanently delete <strong>{deleteModal.course?.name}</strong>?</p>
            <p className="text-muted small">This will delete all associated subjects, enrollments, quizzes, and sessions. This action <strong>cannot be undone</strong>.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDelete}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteModal({ open: false, course: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
