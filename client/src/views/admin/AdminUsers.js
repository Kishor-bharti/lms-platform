import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardHeader, CardBody, CardTitle, Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { TableSkeleton } from 'components/Skeleton.js';

const ROLE_COLORS = { admin: 'danger', teacher: 'warning', student: 'info' };

function getCurrentUser() {
  try { return JSON.parse(window.localStorage.getItem('user') || '{}'); } catch { return {}; }
}

export default function AdminUsers() {
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [roleFilter,   setRoleFilter]   = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState('');
  const [emailError,   setEmailError]   = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '', description: '', role: 'student' });
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);

  // Detail modal state
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailUser,    setDetailUser]    = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit user modal (super admin only)
  const [editUserOpen,       setEditUserOpen]       = useState(false);
  const [editUserTarget,     setEditUserTarget]     = useState(null);
  const [editUserForm,       setEditUserForm]       = useState({ first_name: '', last_name: '', phone: '', email: '', description: '' });
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);
  const [editUserError,      setEditUserError]      = useState('');

  // Password management state (super admin only)
  const [pwModalOpen,  setPwModalOpen]  = useState(false);
  const [pwTarget,     setPwTarget]     = useState(null);
  const [pwForm,       setPwForm]       = useState({ admin_password: '', new_password: '', confirm: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError,      setPwError]      = useState('');
  const [pwSuccess,    setPwSuccess]    = useState('');

  // Hard delete state
  const [deleteOpen,       setDeleteOpen]       = useState(false);
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [deletePassword,   setDeletePassword]   = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError,      setDeleteError]      = useState('');

  const currentUser = getCurrentUser();
  const isSuperAdmin = currentUser.isSuperAdmin === true;

  useEffect(() => { setPage(1); }, [roleFilter, activeFilter]);
  useEffect(() => { fetchUsers(); }, [roleFilter, activeFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (activeFilter !== 'all') params.set('active', activeFilter);
      const res = await http.get(`/api/admin/users?${params.toString()}`);
      setUsers(res.data.users || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('[AdminUsers]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (val) => {
    setForm(f => ({ ...f, email: val }));
    if (/[A-Z]/.test(val)) {
      setEmailError('Email must be in lowercase only');
    } else {
      setEmailError('');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      setFormError('All fields except phone and description are required');
      return;
    }
    if (emailError) {
      setFormError('Please fix the email error before submitting');
      return;
    }
    setSubmitting(true);
    try {
      await http.post('/api/admin/users', { ...form, email: form.email.toLowerCase() });
      setModalOpen(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', description: '', role: 'student' });
      setEmailError('');
      setShowPw(false);
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

  // ── Detail modal ──────────────────────────────────────────────
  const openDetail = async (userId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const res = await http.get(`/api/admin/users/${userId}/detail`);
      setDetailUser(res.data);
    } catch (err) {
      console.error('[getUserDetail]', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Edit user (super admin only) ──────────────────────────────
  const openEditUser = (user) => {
    setEditUserTarget(user);
    setEditUserForm({
      first_name:  user.first_name  || '',
      last_name:   user.last_name   || '',
      phone:       user.phone       || '',
      email:       user.email       || '',
      description: user.description || '',
    });
    setEditUserError('');
    setDetailOpen(false);
    setEditUserOpen(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditUserError('');
    if (!editUserForm.first_name || !editUserForm.last_name) {
      setEditUserError('First name and last name are required');
      return;
    }
    setEditUserSubmitting(true);
    try {
      await http.patch(`/api/admin/users/${editUserTarget.id}`, editUserForm);
      setEditUserOpen(false);
      fetchUsers();
    } catch (err) {
      setEditUserError(err?.response?.data?.error || 'Failed to update user');
    } finally {
      setEditUserSubmitting(false);
    }
  };

  // ── Password reset (super admin only) ─────────────────────────
  const openPwReset = (user) => {
    setPwTarget(user);
    setPwForm({ admin_password: '', new_password: '', confirm: '' });
    setPwError('');
    setPwSuccess('');
    setPwModalOpen(true);
  };

  const handlePwReset = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (!pwForm.admin_password) { setPwError('Your admin password is required'); return; }
    if (!pwForm.new_password) { setPwError('New password is required'); return; }
    if (pwForm.new_password.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Passwords do not match'); return; }

    setPwSubmitting(true);
    try {
      await http.post(`/api/admin/users/${pwTarget.id}/reset-password`, {
        password: pwForm.admin_password,
        new_password: pwForm.new_password,
      });
      setPwSuccess('Password has been reset successfully!');
      setPwForm({ admin_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwError(err?.response?.data?.error || 'Failed to reset password');
    } finally {
      setPwSubmitting(false);
    }
  };

  // ── Hard delete (super admin only) ────────────────────────────
  const openHardDelete = (user) => {
    setDeleteTarget(user);
    setDeletePassword('');
    setDeleteError('');
    setDeleteOpen(true);
  };

  const handleHardDelete = async () => {
    setDeleteError('');
    if (!deletePassword) { setDeleteError('Your admin password is required'); return; }
    setDeleteSubmitting(true);
    try {
      await http.delete(`/api/admin/users/${deleteTarget.id}/hard-delete`, {
        data: { password: deletePassword }
      });
      setDeleteOpen(false);
      setDetailOpen(false);
      fetchUsers();
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filtered = users.filter((u) => {
    const name = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';

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
                    <input
                      placeholder="Search users..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, width: 200 }}
                    />
                    {['all', 'admin', 'teacher', 'student'].map((r) => (
                      <Button key={r} size="sm" color="primary" outline={roleFilter !== r}
                        onClick={() => setRoleFilter(r)} style={{ borderRadius: 20, textTransform: 'capitalize' }}>
                        {r}
                      </Button>
                    ))}
                    <span style={{ width: 1, background: '#dee2e6', alignSelf: 'stretch', display: 'inline-block', margin: '0 4px' }} />
                    {[{ key: 'all', label: 'All Status' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive' }].map(({ key, label }) => (
                      <Button key={key} size="sm" color={key === 'inactive' ? 'danger' : 'success'} outline={activeFilter !== key}
                        onClick={() => setActiveFilter(key)} style={{ borderRadius: 20 }}>
                        {label}
                      </Button>
                    ))}
                    <Button color="success" size="sm" style={{ borderRadius: 8 }} onClick={() => { setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', description: '', role: 'student' }); setEmailError(''); setShowPw(false); setFormError(''); setModalOpen(true); }}>
                      + New User
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody style={{ overflowX: 'auto' }}>
                {filtered.length === 0 && !loading ? (
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
                    {loading ? <TableSkeleton cols={6} rows={7} /> : <tbody>
                      {filtered.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>
                            {u.first_name} {u.last_name}
                            {u.is_super_admin && (
                              <span style={{ marginLeft: 6, fontSize: 10, background: '#f5365c', color: '#fff', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>SUPER</span>
                            )}
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
                            <span style={{ background: u.is_active ? '#d4edda' : '#f8d7da', color: u.is_active ? '#155724' : '#721c24', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#8898aa', fontSize: 12 }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-US') : 'Never'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 12 }} onClick={() => openDetail(u.id)}>
                                Detail
                              </Button>
                              {!u.is_super_admin && (
                                <Button size="sm" color={u.is_active ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 12 }} onClick={() => toggleActive(u.id, u.is_active)}>
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                              )}
                              {isSuperAdmin && !u.is_super_admin && (
                                <Button size="sm" color="danger" style={{ borderRadius: 20, fontSize: 12 }} onClick={() => openHardDelete(u)}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>}
                  </table>
                )}
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">Showing {users.length} of {total} users</small>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                    <span style={{ padding: '4px 12px' }}>Page {page} of {totalPages}</span>
                    <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* ─── Create User Modal ─────────────────────────────────── */}
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
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="email@example.com"
                  style={{ borderColor: emailError ? '#f5365c' : undefined, boxShadow: emailError ? '0 0 0 0.2rem rgba(245,54,92,0.2)' : undefined }}
                />
                {emailError && (
                  <div style={{ color: '#f5365c', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                    ⚠ {emailError}
                  </div>
                )}
              </FormGroup>
              <FormGroup>
                <Label>Password *</Label>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 characters"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8898aa', fontSize: 16, padding: 0, lineHeight: 1 }}
                    tabIndex={-1}
                    title={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
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
              <FormGroup>
                <Label>Description</Label>
                <Input type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description about the user (optional)" rows={2} />
              </FormGroup>
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

        {/* ─── User Detail Modal ─────────────────────────────────── */}
        <Modal isOpen={detailOpen} toggle={() => setDetailOpen(false)} centered size="lg">
          <ModalHeader toggle={() => setDetailOpen(false)}>User Details</ModalHeader>
          <ModalBody>
            {detailLoading ? (
              <div className="text-center py-4">
                <div style={{ width: 32, height: 32, margin: '0 auto', border: '3px solid #eef2f7', borderTopColor: '#5e72e4', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <p className="mt-2 text-muted">Loading user details...</p>
              </div>
            ) : detailUser ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #5e72e4, #825ee4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 22, boxShadow: '0 4px 14px rgba(94,114,228,0.3)' }}>
                    {(detailUser.first_name?.[0] ?? '')}{(detailUser.last_name?.[0] ?? '')}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800, color: '#1a1f36' }}>
                      {detailUser.first_name} {detailUser.last_name}
                      {detailUser.is_super_admin && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: '#f5365c', color: '#fff', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>SUPER ADMIN</span>
                      )}
                    </h4>
                    <span style={{ color: '#8898aa', fontSize: 14 }}>{detailUser.email}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <InfoItem label="User ID" value={detailUser.id} mono />
                  <InfoItem label="Phone" value={detailUser.phone || 'Not set'} />
                  <InfoItem label="Status" value={<span style={{ color: detailUser.is_active ? '#2dce89' : '#f5365c', fontWeight: 700 }}>{detailUser.is_active ? 'Active' : 'Inactive'}</span>} />
                  <InfoItem label="Roles" value={
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(detailUser.roles || []).map((r) => (
                        <Badge key={r} color={ROLE_COLORS[r] || 'secondary'} style={{ textTransform: 'capitalize', fontSize: 11 }}>{r}</Badge>
                      ))}
                    </div>
                  } />
                  <InfoItem label="Created At" value={formatDate(detailUser.created_at)} />
                  <InfoItem label="Last Updated" value={formatDate(detailUser.updated_at)} />
                  <InfoItem label="Last Login" value={formatDate(detailUser.last_login_at)} />
                </div>

                {detailUser.description && (
                  <div style={{ background: '#f8faff', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase' }}>Description</span>
                    <p style={{ margin: '6px 0 0', color: '#525f7f', fontSize: 14 }}>{detailUser.description}</p>
                  </div>
                )}

                {isSuperAdmin && !detailUser.is_super_admin && (
                  <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button size="sm" color="info" style={{ borderRadius: 8 }}
                      onClick={() => openEditUser(detailUser)}>
                      <i className="ni ni-settings mr-1" /> Edit User
                    </Button>
                    <Button size="sm" color="warning" style={{ borderRadius: 8 }}
                      onClick={() => { setDetailOpen(false); openPwReset(detailUser); }}>
                      <i className="ni ni-key-25 mr-1" /> Reset Password
                    </Button>
                    <Button size="sm" color="danger" style={{ borderRadius: 8 }}
                      onClick={() => { setDetailOpen(false); openHardDelete(detailUser); }}>
                      <i className="ni ni-fat-remove mr-1" /> Hard Delete User
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted py-4">User not found</p>
            )}
          </ModalBody>
        </Modal>

        {/* ─── Edit User Modal (Super Admin only) ───────────────── */}
        <Modal isOpen={editUserOpen} toggle={() => setEditUserOpen(false)} centered>
          <ModalHeader toggle={() => setEditUserOpen(false)} style={{ background: '#eaf3ff' }}>
            Edit User — {editUserTarget?.first_name} {editUserTarget?.last_name}
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleEditUser}>
              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label>First Name *</Label>
                    <Input value={editUserForm.first_name} onChange={(e) => setEditUserForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                  </FormGroup>
                </Col>
                <Col md="6">
                  <FormGroup>
                    <Label>Last Name *</Label>
                    <Input value={editUserForm.last_name} onChange={(e) => setEditUserForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                  </FormGroup>
                </Col>
              </Row>
              <FormGroup>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm(f => ({ ...f, email: e.target.value.toLowerCase() }))}
                  placeholder="email@example.com"
                />
                <div style={{ fontSize: 11, color: '#8898aa', marginTop: 3 }}>Email is auto-lowercased.</div>
              </FormGroup>
              <FormGroup>
                <Label>Phone</Label>
                <Input value={editUserForm.phone} onChange={(e) => setEditUserForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </FormGroup>
              <FormGroup>
                <Label>Description</Label>
                <Input type="textarea" rows={3} value={editUserForm.description} onChange={(e) => setEditUserForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description about the user (optional)" />
              </FormGroup>
              {editUserError && <p className="text-danger small">{editUserError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="info" disabled={editUserSubmitting} onClick={handleEditUser}>
              {editUserSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button color="link" onClick={() => setEditUserOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* ─── Reset Password Modal (Super Admin only) ───────────── */}
        <Modal isOpen={pwModalOpen} toggle={() => setPwModalOpen(false)} centered>
          <ModalHeader toggle={() => setPwModalOpen(false)}>
            Reset Password for {pwTarget?.first_name} {pwTarget?.last_name}
          </ModalHeader>
          <ModalBody>
            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <strong>Security:</strong> You must confirm your own admin password before resetting this user's password.
            </div>
            <Form onSubmit={handlePwReset}>
              <FormGroup>
                <Label style={{ fontWeight: 700 }}>Your Admin Password *</Label>
                <Input type="password" value={pwForm.admin_password}
                  onChange={(e) => setPwForm({ ...pwForm, admin_password: e.target.value })}
                  placeholder="Enter YOUR password to confirm" />
              </FormGroup>
              <hr />
              <FormGroup>
                <Label style={{ fontWeight: 700 }}>New Password for User *</Label>
                <Input type="password" value={pwForm.new_password}
                  onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                  placeholder="Min 6 characters" />
              </FormGroup>
              <FormGroup>
                <Label style={{ fontWeight: 700 }}>Confirm New Password *</Label>
                <Input type="password" value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  placeholder="Repeat new password" />
              </FormGroup>
              {pwError   && <div style={{ background: '#fde8ec', border: '1px solid #f8c4cf', borderRadius: 8, padding: '8px 12px', color: '#f5365c', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{pwError}</div>}
              {pwSuccess && <div style={{ background: '#e8fbf0', border: '1px solid #b8f0d3', borderRadius: 8, padding: '8px 12px', color: '#2dce89', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{pwSuccess}</div>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="warning" disabled={pwSubmitting} onClick={handlePwReset}>
              {pwSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
            <Button color="link" onClick={() => setPwModalOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* ─── Hard Delete Confirmation Modal (Super Admin only) ──── */}
        <Modal isOpen={deleteOpen} toggle={() => setDeleteOpen(false)} centered>
          <ModalHeader toggle={() => setDeleteOpen(false)} style={{ background: '#fde8ec' }}>
            <span style={{ color: '#f5365c' }}>Permanently Delete User</span>
          </ModalHeader>
          <ModalBody>
            <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
              <strong>WARNING:</strong> This action is irreversible. All data associated with{' '}
              <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> ({deleteTarget?.email}) will be permanently deleted.
              {deleteTarget?.roles?.includes('teacher') && (
                <div style={{ marginTop: 8 }}>
                  <strong>Note for teachers:</strong> Published course content will be preserved. Only unpublished items, sessions, and file uploads will be removed.
                </div>
              )}
              {deleteTarget?.roles?.includes('student') && (
                <div style={{ marginTop: 8 }}>
                  <strong>Note for students:</strong> All quiz attempts, submissions, uploads, enrollment data, and progress records will be permanently deleted.
                </div>
              )}
            </div>
            <FormGroup>
              <Label style={{ fontWeight: 700 }}>Confirm Your Admin Password *</Label>
              <Input type="password" value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter YOUR admin password to confirm deletion" />
            </FormGroup>
            {deleteError && <div style={{ background: '#fde8ec', border: '1px solid #f8c4cf', borderRadius: 8, padding: '8px 12px', color: '#f5365c', fontWeight: 600, fontSize: 13 }}>{deleteError}</div>}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" disabled={deleteSubmitting} onClick={handleHardDelete}>
              {deleteSubmitting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
            <Button color="link" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </Container>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function InfoItem({ label, value, mono }) {
  return (
    <div style={{ background: '#f8faff', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#32325d', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  );
}
