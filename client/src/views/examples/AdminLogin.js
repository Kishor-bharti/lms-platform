import {
  FormGroup, Form,
  Input, InputGroupAddon, InputGroupText, InputGroup, Col,
} from "reactstrap";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../utils/http";

const AdminLogin = () => {
  const [isLoading,    setIsLoading]    = useState(false);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await http.post("/api/auth/login", {
        email:    email.trim(),
        password: password.trim(),
        loginAs:  "admin",
      });
      const data = res?.data;

      window.localStorage.setItem("accessToken",  data.accessToken);
      window.localStorage.setItem("refreshToken", data.refreshToken);
      window.localStorage.setItem("role",         data.user.activeRole);
      try { window.localStorage.setItem("user", JSON.stringify(data.user)); } catch {}

      navigate("/admin/index", { replace: true });

    } catch (err) {
      const serverError = err?.response?.data?.error;
      if (err?.response?.status === 403) {
        setError("You are not authorised as an administrator");
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
        <div className="al-card">

          {/* Header */}
          <div className="al-card-header">
            <div className="al-shield-wrap">
              <div className="al-shield-orbit" />
              <div className="al-shield-ring">
                <svg className="al-shield-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
            </div>
            <h2 className="al-card-title">Administrator Portal</h2>
            <p className="al-card-subtitle">Restricted access · Credentials required</p>
          </div>

          {/* Body */}
          <div className="al-card-body">
            <Form role="form" onSubmit={handleLogin}>

              <FormGroup className="al-field">
                <label className="al-label">Email Address</label>
                <InputGroup className="al-input-group">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText className="al-input-icon">
                      <i className="ni ni-email-83" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input
                    className="al-input"
                    placeholder="admin@10xaccel.com"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>

              <FormGroup className="al-field">
                <label className="al-label">Password</label>
                <InputGroup className="al-input-group">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText className="al-input-icon">
                      <i className="ni ni-lock-circle-open" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input
                    className="al-input"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <InputGroupAddon addonType="append">
                    <InputGroupText
                      className="al-input-icon"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ cursor: 'pointer' }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={showPassword ? 'ni ni-glasses-2' : 'fa fa-eye-slash'} style={{ fontSize: 14 }} />
                    </InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </FormGroup>

              {error && (
                <div className="al-error">
                  <i className="ni ni-fat-remove" style={{ marginRight: 7, fontSize: 14 }} />
                  {error}
                </div>
              )}

              <button className="al-submit" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <><span className="al-spinner" /> Authenticating...</>
                ) : (
                  <>
                    <i className="ni ni-key-25" style={{ marginRight: 8 }} />
                    Sign in as Administrator
                  </>
                )}
              </button>

            </Form>

            <div className="al-security-note">
              <i className="ni ni-shield-check" style={{ marginRight: 6, fontSize: 11 }} />
              All activities are monitored and logged
            </div>
          </div>
        </div>

        <div className="al-switch-link">
          Not an admin?{" "}
          <a href="/auth/login">Student / Teacher login →</a>
        </div>
      </Col>

      <style>{`
        .al-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          overflow: hidden;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset;
          animation: alIn 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes alIn {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── header ── */
        .al-card-header {
          padding: 36px 36px 28px;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: linear-gradient(160deg, rgba(201,21,21,0.18) 0%, rgba(0,0,0,0) 60%);
        }
        .al-shield-wrap {
          position: relative;
          width: 64px; height: 64px;
          margin: 0 auto 16px;
          cursor: default;
        }
        .al-shield-orbit {
          position: absolute; inset: -8px;
          border-radius: 50%;
          border: 1.5px dashed rgba(201,21,21,0.4);
          animation: alOrbit 6s linear infinite;
        }
        .al-shield-orbit::before {
          content: '';
          position: absolute;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #ff6b6b;
          top: -3px; left: 50%; transform: translateX(-50%);
          box-shadow: 0 0 8px #ff6b6b;
        }
        @keyframes alOrbit { to { transform: rotate(360deg); } }
        .al-shield-ring {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: rgba(201,21,21,0.15);
          border: 1.5px solid rgba(201,21,21,0.35);
          display: flex; align-items: center; justify-content: center;
          color: #ff6b6b;
          box-shadow: 0 0 24px rgba(201,21,21,0.2);
          animation: alShieldPulse 3s ease-in-out infinite;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        @keyframes alShieldPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(201,21,21,0.2); }
          50%       { box-shadow: 0 0 36px rgba(201,21,21,0.45), 0 0 60px rgba(201,21,21,0.15); }
        }
        .al-shield-svg {
          animation: alShieldBob 3s ease-in-out infinite;
          transition: transform 0.3s ease;
        }
        @keyframes alShieldBob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-2px); }
        }
        .al-shield-wrap:hover .al-shield-ring {
          transform: scale(1.12);
          box-shadow: 0 0 48px rgba(201,21,21,0.6), 0 0 80px rgba(201,21,21,0.2);
          background: rgba(201,21,21,0.28);
        }
        .al-shield-wrap:hover .al-shield-svg {
          transform: scale(1.15) translateY(-1px);
          filter: drop-shadow(0 0 6px rgba(255,107,107,0.8));
        }
        .al-shield-wrap:hover .al-shield-orbit {
          animation-duration: 1.5s;
          border-color: rgba(201,21,21,0.7);
        }
        .al-card-title {
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 6px;
          letter-spacing: -0.2px;
        }
        .al-card-subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 12.5px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin: 0;
        }

        /* ── body ── */
        .al-card-body {
          padding: 28px 36px 32px;
        }
        .al-field {
          margin-bottom: 18px !important;
        }
        .al-label {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: rgba(255,255,255,0.5) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.7px !important;
          margin-bottom: 8px !important;
          display: block !important;
        }
        .al-input-group {
          background: rgba(255,255,255,0.06) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          overflow: hidden !important;
          transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
          box-shadow: none !important;
        }
        .al-input-group:focus-within {
          border-color: rgba(201,21,21,0.55) !important;
          box-shadow: 0 0 0 3px rgba(201,21,21,0.12) !important;
        }
        .al-input-icon {
          background: transparent !important;
          border: none !important;
          color: rgba(255,255,255,0.35) !important;
        }
        .al-input {
          background: transparent !important;
          border: none !important;
          color: #fff !important;
          font-size: 14px !important;
          font-weight: 500 !important;
        }
        .al-input::placeholder {
          color: rgba(255,255,255,0.25) !important;
        }

        /* error */
        .al-error {
          background: rgba(201,21,21,0.12);
          border: 1px solid rgba(201,21,21,0.3);
          border-radius: 10px;
          padding: 10px 14px;
          color: #ff8080;
          font-size: 13px;
          font-weight: 600;
          margin: 4px 0 16px;
          display: flex; align-items: center;
        }

        /* submit */
        .al-submit {
          width: 100%;
          padding: 13px 20px;
          margin-top: 8px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #e21e1e 0%, #c91515 100%);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          box-shadow: 0 6px 20px rgba(201,21,21,0.4);
          transition: all 0.25s ease;
          letter-spacing: 0.1px;
        }
        .al-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(201,21,21,0.5);
        }
        .al-submit:active:not(:disabled) { transform: translateY(0); }
        .al-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        .al-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: alSpin 0.6s linear infinite;
          display: inline-block;
        }
        @keyframes alSpin { to { transform: rotate(360deg); } }

        .al-security-note {
          text-align: center;
          margin-top: 20px;
          font-size: 11.5px;
          color: rgba(255,255,255,0.25);
          font-weight: 500;
        }
        .al-switch-link {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }
        .al-switch-link a {
          color: #ffd600;
          font-weight: 700;
          text-decoration: none;
        }
        .al-switch-link a:hover { text-decoration: underline; }
      `}</style>
    </>
  );
};

export default AdminLogin;
