import {
  Button, Card, CardBody, FormGroup, Form,
  Input, InputGroupAddon, InputGroupText, InputGroup,
} from "reactstrap";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../utils/http";

const AdminLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await http.post("/api/auth/login", {
        email:    email.trim(),
        password: password.trim(),
        loginAs:  "admin",          // hardcoded — admin portal only
      });
      const data = res?.data;

      // Persist tokens + user
      window.localStorage.setItem("accessToken",  data.accessToken);
      window.localStorage.setItem("refreshToken", data.refreshToken);
      window.localStorage.setItem("role",         data.user.activeRole);
      try { window.localStorage.setItem("user", JSON.stringify(data.user)); } catch {}

      // BUG 1 FIX: always redirect to admin dashboard on success
      navigate("/admin/index", { replace: true });

    } catch (err) {
      // BUG 2 FIX: stay on page, show error inline — NEVER redirect
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
      <div className="admin-login-wrapper">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <Card className="shadow-lg border-0">
              <div className="admin-header bg-gradient-danger py-4 text-center">
                <div className="mb-3">
                  <i className="ni ni-circle-08 admin-icon" style={{ fontSize: "48px", color: "white" }} />
                </div>
                <h2 className="text-white mb-2">Administrator Access</h2>
                <p className="text-light" style={{ fontSize: "14px", marginBottom: "0" }}>
                  Secure Login Portal
                </p>
              </div>

              <CardBody className="px-lg-5 py-lg-4">
                <Form role="form" onSubmit={handleLogin}>
                  <FormGroup className="mb-3">
                    <label className="form-control-label mb-2">
                      <small className="font-weight-bold">Email Address</small>
                    </label>
                    <InputGroup className="input-group-alternative">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText><i className="ni ni-email-83" /></InputGroupText>
                      </InputGroupAddon>
                      <Input
                        placeholder="admin@10xaccel.com"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-3">
                    <label className="form-control-label mb-2">
                      <small className="font-weight-bold">Password</small>
                    </label>
                    <InputGroup className="input-group-alternative">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText><i className="ni ni-lock-circle-open" /></InputGroupText>
                      </InputGroupAddon>
                      <Input
                        placeholder="Enter your password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </InputGroup>
                  </FormGroup>

                  {/* BUG 2 FIX: inline error — NO redirect on failure */}
                  {error && (
                    <div className="mt-2 mb-2 text-center">
                      <small className="text-danger font-weight-bold">⚠ {error}</small>
                    </div>
                  )}

                  <div className="text-center mb-3">
                    <Button
                      className="btn-block"
                      color="danger"
                      type="submit"
                      disabled={isLoading}
                      style={{ padding: "12px", fontSize: "16px", fontWeight: "600", width: "100%" }}
                    >
                      {isLoading ? (
                        <><i className="ni ni-settings-gear-65 spinning" style={{ marginRight: "8px" }} />Authenticating...</>
                      ) : (
                        <><i className="ni ni-key-25" style={{ marginRight: "8px" }} />Sign In as Administrator</>
                      )}
                    </Button>
                  </div>
                </Form>

                <div className="alert alert-info border-0 py-2 px-3 text-center" role="alert"
                  style={{ fontSize: "12px", backgroundColor: "#f0f3ff", marginBottom: "0" }}>
                  <i className="ni ni-shield-check mr-2" />
                  <small>Restricted area. All activities are logged.</small>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="text-center mt-3">
            <small className="text-light">
              Not an admin?{" "}
              <a href="/auth/login" className="text-warning font-weight-bold">Student / Teacher login →</a>
            </small>
          </div>
        </div>
      </div>

      <style>{`
        .admin-login-wrapper { background: linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .admin-login-container { width:100%; max-width:450px; margin:0 auto; }
        .admin-header { border-radius:8px 8px 0 0; background:linear-gradient(135deg,#e21e1e 0%,#c91515 100%) !important; }
        .admin-icon { display:inline-block; animation:float 3s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-10px); } }
        .admin-login-card { animation:slideUp 0.5s ease-out; }
        @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        .spinning { display:inline-block; animation:spin 1s linear infinite; }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </>
  );
};

export default AdminLogin;
