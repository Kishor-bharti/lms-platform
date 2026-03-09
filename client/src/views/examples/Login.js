import {
  Card,
  CardHeader,
  CardBody,
  FormGroup,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  Col,
} from "reactstrap";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../utils/http";

const ROLE_REDIRECT = {
  admin:   "/admin/index",
  teacher: "/admin/index",
  student: "/admin/index",
};

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState("");
  const [isLoading,    setIsLoading]    = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const e = email.trim();
    const p = password.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!selectedRole)       return "Please select a role";
    if (!emailRegex.test(e)) return "Invalid email";
    if (p.length < 3)        return "Invalid password";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) { setError(v); return; }

    setIsLoading(true);
    try {
      const res = await http.post("/api/auth/login", {
        email:   email.trim(),
        password: password.trim(),
        loginAs: selectedRole,
      });
      const data = res?.data;

      window.localStorage.setItem("accessToken",  data.accessToken);
      window.localStorage.setItem("refreshToken", data.refreshToken);
      window.localStorage.setItem("role",         data.user.activeRole);
      try { window.localStorage.setItem("user", JSON.stringify(data.user)); } catch {}

      const destination = ROLE_REDIRECT[data.user.activeRole] ?? "/admin/index";
      navigate(destination, { replace: true });

    } catch (err) {
      const serverError = err?.response?.data?.error;
      if (err?.response?.status === 403) {
        setError(serverError ?? "Access denied for this role");
      } else if (err?.response?.status === 401) {
        setError("Invalid credentials");
      } else if (typeof serverError === "string") {
        setError(serverError);
      } else {
        setError("Server error — please try again");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Col lg="5" md="7">
        <Card className="login-card-modern">
          <CardHeader className="login-card-header">
            <div className="text-center mt-2 mb-3">
              <p className="login-role-label">I am a...</p>
            </div>
            <div className="d-flex justify-content-center" style={{ gap: 16 }}>
              {[{ role: 'student', icon: 'ni-hat-3', label: 'Student', gradient: 'linear-gradient(135deg, #5e72e4, #825ee4)' },
                { role: 'teacher', icon: 'ni-briefcase-24', label: 'Teacher', gradient: 'linear-gradient(135deg, #2dce89, #21b876)' }].map(r => (
                <button
                  key={r.role}
                  type="button"
                  className={`login-role-btn ${selectedRole === r.role ? 'login-role-active' : ''}`}
                  onClick={() => { setSelectedRole(r.role); setError(''); }}
                  style={selectedRole === r.role ? { background: r.gradient, color: '#fff', borderColor: 'transparent', boxShadow: `0 8px 25px ${r.role === 'student' ? 'rgba(94,114,228,0.4)' : 'rgba(45,206,137,0.4)'}` } : {}}
                >
                  <i className={`ni ${r.icon}`} style={{ fontSize: 22, marginBottom: 4 }} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="px-lg-5 py-lg-5">
            <div className="text-center mb-4">
              <p className="login-form-label">Sign in with your credentials</p>
            </div>
            <Form role="form" onSubmit={handleSubmit}>
              <FormGroup className="mb-3">
                <InputGroup className="login-input-group">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText className="login-input-icon"><i className="ni ni-email-83" /></InputGroupText>
                  </InputGroupAddon>
                  <Input
                    className="login-input"
                    placeholder="Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>
              <FormGroup>
                <InputGroup className="login-input-group">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText className="login-input-icon"><i className="ni ni-lock-circle-open" /></InputGroupText>
                  </InputGroupAddon>
                  <Input
                    className="login-input"
                    placeholder="Password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>

              {error && (
                <div className="login-error-msg">
                  <i className="ni ni-fat-remove" style={{ marginRight: 6 }} />
                  {error}
                </div>
              )}

              <div className="text-center">
                <button className="login-submit-btn" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <><span className="login-spinner" /> Signing in...</>
                  ) : (
                    `Sign in as ${selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : '...'}`
                  )}
                </button>
              </div>
            </Form>
          </CardBody>
        </Card>
        <div className="text-center mt-3">
          <small style={{ color: 'rgba(255,255,255,0.6)' }}>
            Admin?{" "}
            <a href="/auth/admin-login" style={{ color: '#ffd600', fontWeight: 700 }}>
              Administrator login →
            </a>
          </small>
        </div>
      </Col>
      <style>{`
        .login-card-modern {
          background: rgba(255,255,255,0.06) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 20px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
          overflow: hidden;
          animation: loginCardIn 0.6s ease;
        }
        @keyframes loginCardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-card-header {
          background: transparent !important;
          border-bottom: 1px solid rgba(255,255,255,0.08) !important;
          padding: 24px 24px 20px !important;
        }
        .login-role-label {
          color: rgba(255,255,255,0.7);
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0;
        }
        .login-role-btn {
          display: flex; flex-direction: column; align-items: center;
          width: 120px; padding: 16px 12px;
          border-radius: 14px;
          border: 2px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          font-weight: 700; font-size: 14px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .login-role-btn:hover {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.1);
          transform: translateY(-2px);
        }
        .login-role-active {
          transform: translateY(-3px) scale(1.03) !important;
        }
        .login-form-label {
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          margin-bottom: 0;
        }
        .login-input-group {
          background: rgba(255,255,255,0.08) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: none !important;
        }
        .login-input-group:focus-within {
          border-color: rgba(94,114,228,0.6) !important;
          background: rgba(255,255,255,0.12) !important;
          box-shadow: 0 0 0 3px rgba(94,114,228,0.15) !important;
        }
        .login-input-icon {
          background: transparent !important;
          border: none !important;
          color: rgba(255,255,255,0.5) !important;
        }
        .login-input {
          background: transparent !important;
          border: none !important;
          color: #fff !important;
          font-size: 15px !important;
        }
        .login-input::placeholder {
          color: rgba(255,255,255,0.35) !important;
        }
        .login-error-msg {
          background: rgba(245,54,92,0.12);
          border: 1px solid rgba(245,54,92,0.3);
          border-radius: 10px;
          padding: 10px 14px;
          color: #ff6b8a;
          font-size: 13px;
          font-weight: 600;
          margin: 8px 0 12px;
          display: flex; align-items: center;
        }
        .login-submit-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%);
          color: #fff;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 6px 20px rgba(94,114,228,0.35);
          margin-top: 8px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(94,114,228,0.5);
        }
        .login-submit-btn:disabled {
          opacity: 0.7; cursor: not-allowed;
        }
        .login-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default Login;
