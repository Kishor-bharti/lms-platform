// reactstrap components
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
import { apiUrl } from "../../utils/api";

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const validate = () => {
    const e = email.trim();
    const p = password.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!selectedRole) return "Select a role";
    if (!emailRegex.test(e)) return "Invalid email";
    if (p.length < 3) return "Invalid password";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) { setError(v); return; }
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });
      if (!res.ok) {
        let msg = "Invalid credentials";
        try {
          const errData = await res.json();
          if (errData && typeof errData.message === "string") msg = errData.message;
        } catch {}
        setError(msg);
        return;
      }
      const data = await res.json();
      const role = data?.user?.role;
      const selected = selectedRole === "student" ? "STUDENT" : "TEACHER";
      if (role !== selected) {
        setError(selected === "TEACHER" ? "*You are not a teacher, please login as a student" : "*You are not a student, please login as a teacher");
        return;
      }
      window.localStorage.setItem("token", data.token);
      window.localStorage.setItem("role", role);
      try { window.localStorage.setItem("user", JSON.stringify(data.user)); } catch {}
      navigate("/admin/index", { replace: true });
    } catch {
      setError("Server error");
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
                href="#pablo"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedRole("student");
                }}
                style={selectedRole === "student" ? { 
                  boxShadow: "0 0 20px rgba(67, 103, 228, 0.8)",
                  transform: "scale(1.05)"
                } : {}}
              >
                <span className="btn-inner--icon">
                  <i className="ni ni-single-02" />
                </span>
                <span className="btn-inner--text">Student</span>
              </Button>
              <Button
                className={`btn-neutral btn-icon ${selectedRole === "teacher" ? "active" : ""}`}
                color={selectedRole === "teacher" ? "success" : "default"}
                href="#pablo"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedRole("teacher");
                }}
                style={selectedRole === "teacher" ? { 
                  boxShadow: "0 0 20px rgba(39, 174, 96, 0.8)",
                  transform: "scale(1.05)"
                } : {}}
              >
                <span className="btn-inner--icon">
                  <i className="ni ni-briefcase-24" />
                </span>
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
                    <InputGroupText>
                      <i className="ni ni-email-83" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input
                    placeholder="Email"
                    type="email"
                    autoComplete="new-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>
              <FormGroup>
                <InputGroup className="input-group-alternative">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>
                      <i className="ni ni-lock-circle-open" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input
                    placeholder="Password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>
              <div className="custom-control custom-control-alternative custom-checkbox">
                <input
                  className="custom-control-input"
                  id=" customCheckLogin"
                  type="checkbox"
                />
                <label
                  className="custom-control-label"
                  htmlFor=" customCheckLogin"
                >
                  <span className="text-muted">Remember me</span>
                </label>
              </div>
              {error ? (
                <div className="mt-2">
                  <small className="text-danger">{error}</small>
                </div>
              ) : null}
              <div className="text-center">
                <Button className="my-4" color="primary" type="submit">
                  Sign in
                </Button>
              </div>
            </Form>
          </CardBody>
        </Card>
      </Col>
    </>
  );
};

export default Login;
