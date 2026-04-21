import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { CourseCardSkeleton } from 'components/Skeleton.js';

function getCurrentUser() {
  try { return JSON.parse(window.localStorage.getItem('user') || '{}'); } catch { return {}; }
}

export default function AdminCourses() {
  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  // Edit modal state (super admin only)
  const [editOpen,       setEditOpen]       = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);
  const [editForm,       setEditForm]       = useState({ name: '', code: '', description: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError,      setEditError]      = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const currentUser = getCurrentUser();
  const isSuperAdmin = currentUser.isSuperAdmin === true;

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

  const openEdit = (course) => {
    setEditTarget(course);
    setEditForm({ name: course.name, code: course.code, description: course.description || '' });
    setEditError('');
    setEditOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (!editForm.name || !editForm.code) {
      setEditError('Name and code are required');
      return;
    }
    setEditSubmitting(true);
    try {
      await http.patch(`/api/admin/courses/${editTarget.id}`, editForm);
      setEditOpen(false);
      fetchCourses();
    } catch (err) {
      setEditError(err?.response?.data?.error || 'Failed to update course');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openHardDelete = (course) => {
    setDeleteTarget(course);
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeleteError('');
    setDeleteOpen(true);
  };

  const handleHardDelete = async () => {
    setDeleteError('');
    const normalized = (deleteConfirmText || '').trim().toLowerCase();
    if (normalized !== 'yes i want to delete' && normalized !== 'yes i want to proceed') {
      setDeleteError('Type exactly: "Yes I want to delete" or "Yes I want to proceed"');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Your super admin password is required');
      return;
    }

    setDeleteSubmitting(true);
    try {
      await http.delete(`/api/admin/courses/${deleteTarget.id}/hard-delete`, {
        data: { password: deletePassword },
        timeout: 60000,
      });
      setDeleteOpen(false);
      fetchCourses();
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Failed to hard delete course');
    } finally {
      setDeleteSubmitting(false);
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
                  <CourseCardSkeleton count={6} />
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className="ni ni-collection" style={{ color: '#5e72e4', fontSize: 14 }} />
                            <span style={{ fontSize: 13, color: '#525f7f', fontWeight: 600 }}>
                              {c.subject_count} {c.subject_count === 1 ? 'subject' : 'subjects'}
                            </span>
                          </div>
                          {isSuperAdmin && (
                            <div className="mt-3" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <Button color="info" size="sm" style={{ borderRadius: 8 }} onClick={() => openEdit(c)}>
                                ✏️ Edit
                              </Button>
                              <Button color="danger" size="sm" style={{ borderRadius: 8 }} onClick={() => openHardDelete(c)}>
                                Hard Delete
                              </Button>
                            </div>
                          )}
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

        {/* Edit Course Modal (super admin only) */}
        <Modal isOpen={editOpen} toggle={() => setEditOpen(false)} centered>
          <ModalHeader toggle={() => setEditOpen(false)}
            style={{ background: '#eaf3ff' }}>
            Edit Course — {editTarget?.name}
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleEdit}>
              <FormGroup>
                <Label>Course Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. SAT Prep"
                />
              </FormGroup>
              <FormGroup>
                <Label>Course Code *</Label>
                <Input
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAT"
                />
              </FormGroup>
              <FormGroup>
                <Label>Description</Label>
                <Input
                  type="textarea"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </FormGroup>
              <FormGroup>
                <Label>Status</Label>
                <Input
                  type="select"
                  value={editForm.is_active === false ? 'inactive' : 'active'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Input>
              </FormGroup>
              {editError && <p className="text-danger small mt-2">{editError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="info" disabled={editSubmitting} onClick={handleEdit}>
              {editSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button color="link" onClick={() => setEditOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Hard Delete Course Modal */}
        <Modal isOpen={deleteOpen} toggle={() => setDeleteOpen(false)} centered>
          <ModalHeader toggle={() => setDeleteOpen(false)} style={{ background: '#fde8ec' }}>
            <span style={{ color: '#f5365c' }}>Permanently Delete Course</span>
          </ModalHeader>
          <ModalBody>
            <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
              <strong>WARNING:</strong> This action is irreversible.
              <div style={{ marginTop: 8 }}>
                If you hard delete <strong>{deleteTarget?.name}</strong>, all linked data will be permanently removed:
                <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
                  <li>Subjects and topics</li>
                  <li>Quizzes, questions, options and practice/test sets</li>
                  <li>Published and unpublished assignments + submissions</li>
                  <li>Published and unpublished materials</li>
                  <li>Student uploads and feedback files</li>
                  <li>Teacher/student allocations and enrollments</li>
                  <li>Sessions and related recurrence links</li>
                </ul>
              </div>
            </div>

            <FormGroup>
              <Label style={{ fontWeight: 700 }}>
                Type <strong>Yes I want to delete</strong> or <strong>Yes I want to proceed</strong>
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Yes I want to delete"
              />
            </FormGroup>

            <FormGroup>
              <Label style={{ fontWeight: 700 }}>Confirm Super Admin Password *</Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your super admin password"
              />
            </FormGroup>

            {deleteError && (
              <div style={{ background: '#fde8ec', border: '1px solid #f8c4cf', borderRadius: 8, padding: '8px 12px', color: '#f5365c', fontWeight: 600, fontSize: 13 }}>
                {deleteError}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" disabled={deleteSubmitting} onClick={handleHardDelete}>
              {deleteSubmitting ? 'Deleting...' : 'Yes I want to delete'}
            </Button>
            <Button color="link" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
