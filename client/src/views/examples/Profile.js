import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, CardHeader, CardBody,
  Button, Form, FormGroup, Label, Input,
} from 'reactstrap';
import UserHeader from 'components/Headers/UserHeader.js';
import http from 'utils/http';

const ROLE_COLOR = { admin: '#f5365c', teacher: '#fb6340', student: '#5e72e4' };
const ROLE_BG    = { admin: '#fde8ec', teacher: '#fff0eb', student: '#eef0fd' };

export default function Profile() {
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');
  const [saveErr,  setSaveErr]  = useState('');

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' });

  const [pwForm,   setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg,    setPwMsg]    = useState('');
  const [pwErr,    setPwErr]    = useState('');

  useEffect(() => {
    http.get('/api/profile/me')
      .then((res) => {
        setProfile(res.data);
        setForm({ first_name: res.data.first_name, last_name: res.data.last_name, phone: res.data.phone || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setSaveMsg(''); setSaveErr('');
    try {
      const res = await http.patch('/api/profile/me', form);
      setProfile(res.data);
      setSaveMsg('Profile updated!');
      // Update localStorage name
      try {
        const user = JSON.parse(window.localStorage.getItem('user') || '{}');
        window.localStorage.setItem('user', JSON.stringify({ ...user, name: `${form.first_name} ${form.last_name}` }));
      } catch {}
    } catch (err) {
      setSaveErr(err?.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg(''); setPwErr('');
    if (!pwForm.current_password || !pwForm.new_password) { setPwErr('All fields required'); return; }
    if (pwForm.new_password !== pwForm.confirm) { setPwErr('Passwords do not match'); return; }
    if (pwForm.new_password.length < 6) { setPwErr('Minimum 6 characters'); return; }
    setPwSaving(true);
    try {
      await http.post('/api/profile/me/password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      });
      setPwMsg('Password changed!');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwErr(err?.response?.data?.error || 'Failed to change password');
    } finally { setPwSaving(false); }
  };

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?';

  if (loading) return (
    <>
      <UserHeader />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col><Card><CardBody className="text-center py-5">Loading...</CardBody></Card></Col></Row>
      </Container>
    </>
  );

  return (
    <>
      <UserHeader />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row>
          {/* Left column — Avatar + role info */}
          <Col xl="4" className="mb-5 mb-xl-0">
            <Card className="card-profile shadow" style={{ borderRadius: 16 }}>
              <Row className="justify-content-center">
                <Col lg="3">
                  <div className="card-profile-image">
                    <div style={{
                      width: 100, height: 100, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #5e72e4, #825ee4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 36, fontWeight: 900, color: '#fff',
                      margin: '-50px auto 0', boxShadow: '0 8px 24px rgba(94,114,228,.4)',
                      border: '4px solid #fff',
                    }}>
                      {initials}
                    </div>
                  </div>
                </Col>
              </Row>
              <CardHeader className="text-center border-0 pt-8 pt-md-4 pb-0 pb-md-4">
                <div className="d-flex justify-content-between" />
              </CardHeader>
              <CardBody className="pt-0 pt-md-4" style={{ textAlign: 'center', paddingBottom: 24 }}>
                <div className="text-center mt-4">
                  <h3 style={{ color: '#32325d', marginBottom: 4 }}>
                    {profile?.first_name} {profile?.last_name}
                  </h3>
                  <p className="text-muted" style={{ fontSize: 14, marginBottom: 12 }}>{profile?.email}</p>

                  {/* Role badges */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(profile?.roles || []).map((r) => (
                      <span key={r} style={{
                        padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: ROLE_BG[r] || '#f0f4f8',
                        color: ROLE_COLOR[r] || '#525f7f',
                        textTransform: 'capitalize',
                      }}>
                        {r}
                      </span>
                    ))}
                  </div>

                  {profile?.phone && (
                    <p className="text-muted" style={{ fontSize: 13 }}>📞 {profile.phone}</p>
                  )}

                  <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 16px', marginTop: 12, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Account info</div>
                    <div style={{ fontSize: 13, color: '#525f7f', marginBottom: 3 }}>
                      <strong>Status:</strong>{' '}
                      <span style={{ color: profile?.is_active ? '#2dce89' : '#f5365c', fontWeight: 700 }}>
                        {profile?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#525f7f', marginBottom: 3 }}>
                      <strong>Member since:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#525f7f' }}>
                      <strong>Last login:</strong> {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>

          {/* Right column — Edit forms */}
          <Col xl="8">
            {/* Edit profile */}
            <Card className="bg-secondary shadow" style={{ borderRadius: 16 }}>
              <CardHeader style={{ background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                <Row className="align-items-center">
                  <Col xs="8"><h3 className="mb-0">My Account</h3></Col>
                </Row>
              </CardHeader>
              <CardBody>
                <Form onSubmit={handleSave}>
                  <h6 className="heading-small text-muted mb-4">User information</h6>
                  <Row>
                    <Col lg="6">
                      <FormGroup>
                        <Label className="form-control-label">First name</Label>
                        <Input
                          className="form-control-alternative"
                          value={form.first_name}
                          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                          placeholder="First name"
                        />
                      </FormGroup>
                    </Col>
                    <Col lg="6">
                      <FormGroup>
                        <Label className="form-control-label">Last name</Label>
                        <Input
                          className="form-control-alternative"
                          value={form.last_name}
                          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                          placeholder="Last name"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col lg="6">
                      <FormGroup>
                        <Label className="form-control-label">Email address</Label>
                        <Input
                          className="form-control-alternative"
                          value={profile?.email || ''}
                          disabled
                          style={{ background: '#f8f9fa', cursor: 'not-allowed' }}
                        />
                        <small className="text-muted">Email cannot be changed</small>
                      </FormGroup>
                    </Col>
                    <Col lg="6">
                      <FormGroup>
                        <Label className="form-control-label">Phone</Label>
                        <Input
                          className="form-control-alternative"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  {saveMsg && <p className="text-success small">{saveMsg}</p>}
                  {saveErr && <p className="text-danger small">{saveErr}</p>}
                  <Button color="primary" style={{ borderRadius: 8 }} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Form>

                <hr className="my-4" />

                {/* Password change */}
                <Form onSubmit={handlePasswordChange}>
                  <h6 className="heading-small text-muted mb-4">Change Password</h6>
                  <Row>
                    <Col lg="4">
                      <FormGroup>
                        <Label className="form-control-label">Current Password</Label>
                        <Input
                          className="form-control-alternative"
                          type="password"
                          value={pwForm.current_password}
                          onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                          placeholder="Current password"
                        />
                      </FormGroup>
                    </Col>
                    <Col lg="4">
                      <FormGroup>
                        <Label className="form-control-label">New Password</Label>
                        <Input
                          className="form-control-alternative"
                          type="password"
                          value={pwForm.new_password}
                          onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                          placeholder="Min 6 characters"
                        />
                      </FormGroup>
                    </Col>
                    <Col lg="4">
                      <FormGroup>
                        <Label className="form-control-label">Confirm New Password</Label>
                        <Input
                          className="form-control-alternative"
                          type="password"
                          value={pwForm.confirm}
                          onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                          placeholder="Repeat new password"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  {pwMsg && <p className="text-success small">{pwMsg}</p>}
                  {pwErr && <p className="text-danger small">{pwErr}</p>}
                  <Button color="warning" style={{ borderRadius: 8 }} disabled={pwSaving}>
                    {pwSaving ? 'Changing...' : 'Change Password'}
                  </Button>
                </Form>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}
