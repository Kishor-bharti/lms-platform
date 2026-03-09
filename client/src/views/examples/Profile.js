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
      try {
        const user = JSON.parse(window.localStorage.getItem('user') || '{}');
        window.localStorage.setItem('user', JSON.stringify({ ...user, firstName: form.first_name, lastName: form.last_name }));
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
      <Container className="mt--7" fluid style={{ background: 'linear-gradient(180deg, #eef2f7 0%, #e3eaf4 100%)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col><Card className="profile-card-modern"><CardBody className="text-center py-5" style={{ color: '#525f7f' }}>
          <div className="profile-loading-spinner" />
          <p className="mt-3" style={{ fontWeight: 600 }}>Loading profile...</p>
        </CardBody></Card></Col></Row>
      </Container>
      <style>{profileStyles}</style>
    </>
  );

  return (
    <>
      <UserHeader />
      <Container className="mt--7" fluid style={{ background: 'linear-gradient(180deg, #eef2f7 0%, #e3eaf4 100%)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row>
          {/* Left column — Avatar + role info */}
          <Col xl="4" className="mb-5 mb-xl-0">
            <div className="profile-animate" style={{ animationDelay: '0.1s' }}>
              <Card className="profile-card-modern">
                <div className="profile-card-top-gradient" />
                <CardBody style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 24 }}>
                  <div className="profile-avatar-wrapper">
                    <div className="profile-avatar">
                      {initials}
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="profile-name">
                      {profile?.first_name} {profile?.last_name}
                    </h3>
                    <p className="profile-email">{profile?.email}</p>

                    {/* Role badges */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, marginTop: 12 }}>
                      {(profile?.roles || []).map((r) => (
                        <span key={r} className="profile-role-badge" style={{
                          background: ROLE_BG[r] || '#f0f4f8',
                          color: ROLE_COLOR[r] || '#525f7f',
                        }}>
                          {r}
                        </span>
                      ))}
                    </div>

                    {profile?.phone && (
                      <p className="profile-phone">📞 {profile.phone}</p>
                    )}

                    <div className="profile-info-card">
                      <div className="profile-info-label">Account info</div>
                      <div className="profile-info-row">
                        <strong>Status:</strong>{' '}
                        <span style={{ color: profile?.is_active ? '#2dce89' : '#f5365c', fontWeight: 700 }}>
                          {profile?.is_active ? '● Active' : '● Inactive'}
                        </span>
                      </div>
                      <div className="profile-info-row">
                        <strong>Member since:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                      </div>
                      <div className="profile-info-row">
                        <strong>Last login:</strong> {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Col>

          {/* Right column — Edit forms */}
          <Col xl="8">
            <div className="profile-animate" style={{ animationDelay: '0.2s' }}>
              <Card className="profile-card-modern">
                <CardHeader className="profile-form-header">
                  <Row className="align-items-center">
                    <Col xs="8">
                      <h3 className="mb-0" style={{ fontWeight: 800, color: '#1a1f36' }}>
                        <i className="ni ni-single-02 mr-2" style={{ color: '#5e72e4' }} />
                        My Account
                      </h3>
                    </Col>
                  </Row>
                </CardHeader>
                <CardBody>
                  <Form onSubmit={handleSave}>
                    <h6 className="profile-section-label">User information</h6>
                    <Row>
                      <Col lg="6">
                        <FormGroup>
                          <Label className="profile-field-label">First name</Label>
                          <Input
                            className="profile-input"
                            value={form.first_name}
                            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                            placeholder="First name"
                          />
                        </FormGroup>
                      </Col>
                      <Col lg="6">
                        <FormGroup>
                          <Label className="profile-field-label">Last name</Label>
                          <Input
                            className="profile-input"
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
                          <Label className="profile-field-label">Email address</Label>
                          <Input
                            className="profile-input"
                            value={profile?.email || ''}
                            disabled
                            style={{ background: '#f1f3f9', cursor: 'not-allowed', opacity: 0.7 }}
                          />
                          <small style={{ color: '#8898aa', fontSize: 11 }}>Email cannot be changed</small>
                        </FormGroup>
                      </Col>
                      <Col lg="6">
                        <FormGroup>
                          <Label className="profile-field-label">Phone</Label>
                          <Input
                            className="profile-input"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    {saveMsg && <div className="profile-success-msg"><i className="ni ni-check-bold mr-2" />{saveMsg}</div>}
                    {saveErr && <div className="profile-error-msg"><i className="ni ni-fat-remove mr-2" />{saveErr}</div>}
                    <button className="profile-save-btn" type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </Form>

                  <hr style={{ margin: '28px 0', borderColor: '#eef2f7' }} />

                  {/* Password change */}
                  <Form onSubmit={handlePasswordChange}>
                    <h6 className="profile-section-label">Change Password</h6>
                    <Row>
                      <Col lg="4">
                        <FormGroup>
                          <Label className="profile-field-label">Current Password</Label>
                          <Input
                            className="profile-input"
                            type="password"
                            value={pwForm.current_password}
                            onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                            placeholder="Current password"
                          />
                        </FormGroup>
                      </Col>
                      <Col lg="4">
                        <FormGroup>
                          <Label className="profile-field-label">New Password</Label>
                          <Input
                            className="profile-input"
                            type="password"
                            value={pwForm.new_password}
                            onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                            placeholder="Min 6 characters"
                          />
                        </FormGroup>
                      </Col>
                      <Col lg="4">
                        <FormGroup>
                          <Label className="profile-field-label">Confirm New Password</Label>
                          <Input
                            className="profile-input"
                            type="password"
                            value={pwForm.confirm}
                            onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                            placeholder="Repeat new password"
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    {pwMsg && <div className="profile-success-msg"><i className="ni ni-check-bold mr-2" />{pwMsg}</div>}
                    {pwErr && <div className="profile-error-msg"><i className="ni ni-fat-remove mr-2" />{pwErr}</div>}
                    <button className="profile-pw-btn" type="submit" disabled={pwSaving}>
                      {pwSaving ? 'Changing...' : 'Change Password'}
                    </button>
                  </Form>
                </CardBody>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
      <style>{profileStyles}</style>
    </>
  );
}

const profileStyles = `
  .profile-animate {
    animation: profileFadeIn 0.5s ease both;
  }
  @keyframes profileFadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .profile-card-modern {
    border-radius: 20px !important;
    border: none !important;
    box-shadow: 0 10px 40px rgba(0,0,0,0.06) !important;
    overflow: hidden;
    position: relative;
  }
  .profile-card-top-gradient {
    height: 80px;
    background: linear-gradient(135deg, #5e72e4 0%, #825ee4 50%, #1565c0 100%);
  }
  .profile-avatar-wrapper {
    margin-top: -50px;
    display: flex; justify-content: center;
  }
  .profile-avatar {
    width: 100px; height: 100px; border-radius: 50%;
    background: linear-gradient(135deg, #5e72e4, #825ee4);
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 900; color: #fff;
    box-shadow: 0 8px 24px rgba(94,114,228,0.4);
    border: 4px solid #fff;
  }
  .profile-name {
    color: #1a1f36; font-weight: 800; margin-bottom: 2px;
  }
  .profile-email {
    color: #8898aa; font-size: 14px; margin-bottom: 0;
  }
  .profile-phone {
    color: #525f7f; font-size: 13px; margin-bottom: 0;
  }
  .profile-role-badge {
    padding: 4px 16px; border-radius: 20px;
    font-size: 12px; font-weight: 700;
    text-transform: capitalize;
    letter-spacing: 0.3px;
  }
  .profile-info-card {
    background: linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%);
    border-radius: 14px; padding: 14px 18px; margin-top: 16px;
    text-align: left;
  }
  .profile-info-label {
    font-size: 11px; font-weight: 700; color: #8898aa;
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
  }
  .profile-info-row {
    font-size: 13px; color: #525f7f; margin-bottom: 4px;
  }
  .profile-form-header {
    background: linear-gradient(135deg, #f8faff 0%, #fff 100%) !important;
    border-bottom: 1px solid #eef2f7 !important;
    padding: 20px 24px !important;
    border-radius: 20px 20px 0 0 !important;
  }
  .profile-section-label {
    font-size: 12px; font-weight: 700; color: #5e72e4;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;
  }
  .profile-field-label {
    font-size: 13px; font-weight: 700; color: #525f7f;
    margin-bottom: 6px;
  }
  .profile-input {
    border: 2px solid #eef2f7 !important;
    border-radius: 12px !important;
    padding: 10px 14px !important;
    font-size: 14px !important;
    transition: all 0.3s ease !important;
    background: #fff !important;
  }
  .profile-input:focus {
    border-color: #5e72e4 !important;
    box-shadow: 0 0 0 3px rgba(94,114,228,0.12) !important;
  }
  .profile-save-btn {
    background: linear-gradient(135deg, #5e72e4, #825ee4) !important;
    border: none; padding: 10px 28px; border-radius: 12px;
    color: #fff; font-weight: 700; font-size: 14px;
    cursor: pointer; transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(94,114,228,0.3);
  }
  .profile-save-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(94,114,228,0.4);
  }
  .profile-pw-btn {
    background: linear-gradient(135deg, #fb6340, #fbb140) !important;
    border: none; padding: 10px 28px; border-radius: 12px;
    color: #fff; font-weight: 700; font-size: 14px;
    cursor: pointer; transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(251,99,64,0.3);
  }
  .profile-pw-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(251,99,64,0.4);
  }
  .profile-success-msg {
    background: #e8fbf0; border: 1px solid #b8f0d3; border-radius: 10px;
    padding: 10px 14px; color: #2dce89; font-weight: 600;
    font-size: 13px; margin-bottom: 12px;
  }
  .profile-error-msg {
    background: #fde8ec; border: 1px solid #f8c4cf; border-radius: 10px;
    padding: 10px 14px; color: #f5365c; font-weight: 600;
    font-size: 13px; margin-bottom: 12px;
  }
  .profile-loading-spinner {
    width: 36px; height: 36px; margin: 0 auto;
    border: 3px solid #eef2f7; border-top-color: #5e72e4;
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
