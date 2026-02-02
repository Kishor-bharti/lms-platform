import {
  Button,
  Card,
  CardBody,
  FormGroup,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
} from "reactstrap";
import { useState } from "react";

const AdminLogin = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <>
      <div className="admin-login-wrapper">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <Card className="shadow-lg border-0">
              {/* Admin Header */}
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
                  {/* Email Field */}
                  <FormGroup className="mb-3">
                    <label className="form-control-label mb-2">
                      <small className="font-weight-bold">Email Address</small>
                    </label>
                    <InputGroup className="input-group-alternative">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                          <i className="ni ni-email-83" />
                        </InputGroupText>
                      </InputGroupAddon>
                      <Input
                        placeholder="admin@example.com"
                        type="email"
                        autoComplete="new-email"
                        required
                      />
                    </InputGroup>
                  </FormGroup>

                  {/* Password Field */}
                  <FormGroup className="mb-3">
                    <label className="form-control-label mb-2">
                      <small className="font-weight-bold">Password</small>
                    </label>
                    <InputGroup className="input-group-alternative">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                          <i className="ni ni-lock-circle-open" />
                        </InputGroupText>
                      </InputGroupAddon>
                      <Input
                        placeholder="Enter your password"
                        type="password"
                        autoComplete="new-password"
                        required
                      />
                    </InputGroup>
                  </FormGroup>

                  {/* Two-Factor Authentication Option */}
                  <FormGroup className="mb-3">
                    <div className="custom-control custom-control-alternative custom-checkbox">
                      <input
                        className="custom-control-input"
                        id="customCheckAdmin"
                        type="checkbox"
                      />
                      <label
                        className="custom-control-label"
                        htmlFor="customCheckAdmin"
                      >
                        <span className="text-muted" style={{ fontSize: "14px" }}>
                          Require 2-Factor Authentication
                        </span>
                      </label>
                    </div>
                  </FormGroup>

                  {/* Login Button */}
                  <div className="text-center mb-3">
                    <Button
                      className="btn-block"
                      color="danger"
                      type="submit"
                      disabled={isLoading}
                      style={{
                        padding: "12px",
                        fontSize: "16px",
                        fontWeight: "600",
                        transition: "all 0.3s ease",
                        boxShadow: isLoading ? "0 0 30px rgba(226, 46, 36, 0.5)" : "none"
                      }}
                    >
                      {isLoading ? (
                        <>
                          <i className="ni ni-settings-gear-65 spinning" style={{ marginRight: "8px" }} />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <i className="ni ni-key-25" style={{ marginRight: "8px" }} />
                          Sign In as Administrator
                        </>
                      )}
                    </Button>
                  </div>
                </Form>

                {/* Security Notice */}
                <div
                  className="alert alert-info border-0 py-2 px-3 text-center"
                  role="alert"
                  style={{ fontSize: "12px", backgroundColor: "#f0f3ff", marginBottom: "0" }}
                >
                  <i className="ni ni-shield-check mr-2" />
                  <small>This is a restricted access area. All activities are logged.</small>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Footer Info */}
          <div className="text-center mt-3">
            <small className="text-light">
              © 2026 Learning Management System. Admin Portal.
            </small>
          </div>
        </div>
      </div>

      <style>{`
        .admin-login-wrapper {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .admin-login-container {
          width: 100%;
          max-width: 450px;
          margin: 0 auto;
        }

        .admin-header {
          border-radius: 8px 8px 0 0;
          background: linear-gradient(135deg, #e21e1e 0%, #c91515 100%) !important;
        }

        .admin-icon {
          display: inline-block;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .admin-login-card {
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .admin-login-wrapper .btn-block {
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          width: 100%;
        }

        .admin-login-wrapper .btn-block:hover:not(:disabled) {
          box-shadow: 0 8px 25px rgba(226, 46, 36, 0.4) !important;
          transform: translateY(-2px);
        }

        .admin-login-wrapper .btn-block:disabled {
          opacity: 0.9;
          cursor: not-allowed;
        }

        .spinning {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default AdminLogin;
