import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

const ROLE_COLORS = { admin: 'danger', teacher: 'warning', student: 'info' };

export default function AdminUsers() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [search,      setSearch]      = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '', role: 'student' });

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await http.get(`/api/admin/users${roleFilter !== 'all' ? `?role=${roleFilter}` : ''}`);
      setUsers(res.data || []);
    } catch (err) {
      console.error('[AdminUsers]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      setFormError('All fields except phone are required');
      return;
    }
    setSubmitting(true);
    try {
      await http.post('/api/admin/users', form);
      setModalOpen(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', role: 'student' });
      fetchUsers();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (userId, isActive) => {
    try {
      await http.patch(`/api/admin/users/${userId}/active`, { is_active: !isActive });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !isActive } : u));
    } catch (err) {
      console.error('[toggleActive]', err);
    }
  };

  const filtered = users.filter((u) => {
    const name = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row>
          <Col>
            <Card className="shadow" style={{ borderRadius: 12 }}>
              <CardHeader style={{ background: '#eaf3ff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                  <CardTitle className="mb-0">User Management</CardTitle>
                  <div className="d-flex align-items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {/* Search */}
                    <input
                      placeholder="Search users..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, width: 200 }}
                    />
                    {/* Role filter tabs */}
                    {['all', 'admin', 'teacher', 'student'].map((r) => (
                      <Button key={r} size="sm" color="primary" outline={roleFilter !== r}
                        onClick={() => setRoleFilter(r)} style={{ borderRadius: 20, textTransform: 'capitalize' }}>
                        {r}
                      </Button>
                    ))}
                    <Button color="success" size="sm" style={{ borderRadius: 8 }} onClick={() => setModalOpen(true)}>
                      + New User
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto' }}>
                {loading ? (
                  <p className="text-center text-muted py-4">Loading...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-center text-muted py-4">No users found</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Name', 'Email', 'Roles', 'Status', 'Last Login', 'Actions'].map((h) => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>
                            {u.first_name} {u.last_name}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 13 }}>{u.email}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(u.roles || []).map((r) => (
                                <Badge key={r} color={ROLE_COLORS[r] || 'secondary'} style={{ textTransform: 'capitalize', fontSize: 11 }}>{r}</Badge>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: u.is_active ? '#d4edda' : '#f8d7da',
                              color: u.is_active ? '#155724' : '#721c24',
                              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700
                            }}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#8898aa', fontSize: 12 }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <Button size="sm" color={u.is_active ? 'warning' : 'success'} outline
                              style={{ borderRadius: 20, fontSize: 12 }}
                              onClick={() => toggleActive(u.id, u.is_active)}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
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

        {/* Create User Modal */}
        <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered>
          <ModalHeader toggle={() => setModalOpen(false)}>Create New User</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleCreate}>
              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label>First Name *</Label>
                    <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="First name" />
                  </FormGroup>
                </Col>
                <Col md="6">
                  <FormGroup>
                    <Label>Last Name *</Label>
                    <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" />
                  </FormGroup>
                </Col>
              </Row>
              <FormGroup>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </FormGroup>
              <FormGroup>
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
              </FormGroup>
              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                  </FormGroup>
                </Col>
                <Col md="6">
                  <FormGroup>
                    <Label>Role *</Label>
                    <Input type="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </Input>
                  </FormGroup>
                </Col>
              </Row>
              {formError && <p className="text-danger small">{formError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="success" disabled={submitting} onClick={handleCreate}>
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
            <Button color="link" onClick={() => setModalOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </>
  );
}
