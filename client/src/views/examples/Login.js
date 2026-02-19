import {
  Button,
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
        loginAs: selectedRole,   // "student" | "teacher"
      });
      const data = res?.data;

      // Persist tokens + user
      window.localStorage.setItem("accessToken",  data.accessToken);
      window.localStorage.setItem("refreshToken", data.refreshToken);
      window.localStorage.setItem("role",         data.user.activeRole);
      try { window.localStorage.setItem("user", JSON.stringify(data.user)); } catch {}

      // BUG 1 FIX: redirect based on activeRole from API, not hardcoded
      const destination = ROLE_REDIRECT[data.user.activeRole] ?? "/admin/index";
      navigate(destination, { replace: true });

    } catch (err) {
      // BUG 2 FIX: set error state — never redirect on failure
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
        <Card className="bg-secondary shadow border-0">
          <CardHeader className="bg-transparent pb-5">
            <div className="text-muted text-center mt-2 mb-3">
              <small>Select your role</small>
            </div>
            <div className="btn-wrapper text-center">
              <Button
                className={`btn-neutral btn-icon ${selectedRole === "student" ? "active" : ""}`}
                color={selectedRole === "student" ? "primary" : "default"}
                onClick={(e) => { e.preventDefault(); setSelectedRole("student"); setError(""); }}
                style={selectedRole === "student" ? { boxShadow: "0 0 20px rgba(67,103,228,0.8)", transform: "scale(1.05)" } : {}}
              >
                <span className="btn-inner--icon"><i className="ni ni-single-02" /></span>
                <span className="btn-inner--text">Student</span>
              </Button>
              <Button
                className={`btn-neutral btn-icon ${selectedRole === "teacher" ? "active" : ""}`}
                color={selectedRole === "teacher" ? "success" : "default"}
                onClick={(e) => { e.preventDefault(); setSelectedRole("teacher"); setError(""); }}
                style={selectedRole === "teacher" ? { boxShadow: "0 0 20px rgba(39,174,96,0.8)", transform: "scale(1.05)" } : {}}
              >
                <span className="btn-inner--icon"><i className="ni ni-briefcase-24" /></span>
                <span className="btn-inner--text">Teacher</span>
              </Button>
            </div>
          </CardHeader>
          <CardBody className="px-lg-5 py-lg-5">
            <div className="text-center text-muted mb-4">
              <small>Enter your login credentials</small>
            </div>
            <Form role="form" onSubmit={handleSubmit}>
              <FormGroup className="mb-3">
                <InputGroup className="input-group-alternative">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText><i className="ni ni-email-83" /></InputGroupText>
                  </InputGroupAddon>
                  <Input
                    placeholder="Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>
              <FormGroup>
                <InputGroup className="input-group-alternative">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText><i className="ni ni-lock-circle-open" /></InputGroupText>
                  </InputGroupAddon>
                  <Input
                    placeholder="Password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>

              {/* BUG 2 FIX: inline error, NO redirect on failure */}
              {error && (
                <div className="mt-2 mb-2">
                  <small className="text-danger font-weight-bold">⚠ {error}</small>
                </div>
              )}

              <div className="text-center">
                <Button className="my-4" color="primary" type="submit" disabled={isLoading}>
                  {isLoading ? "Signing in..." : `Sign in as ${selectedRole ?? "..."}`}
                </Button>
              </div>
            </Form>
          </CardBody>
        </Card>
        <div className="text-center mt-3">
          <small className="text-light">
            Admin?{" "}
            <a href="/auth/admin-login" className="text-warning font-weight-bold">
              Administrator login →
            </a>
          </small>
        </div>
      </Col>
    </>
  );
};

export default Login;
