import { Link, useNavigate } from "react-router-dom";
import {
  Form,
  FormGroup,
  InputGroupAddon,
  InputGroupText,
  Input,
  InputGroup,
  Navbar,
  Container,
  Nav,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Media,
} from "reactstrap";

const AdminNavbar = (props) => {
  const navigate = useNavigate();
  const userName = (() => {
    try {
      const raw = window.localStorage.getItem("user") || "";
      const u = raw ? JSON.parse(raw) : {};
      if (u.firstName || u.lastName) return `${u.firstName || ""} ${u.lastName || ""}`.trim();
      if (u.first_name || u.last_name) return `${u.first_name || ""} ${u.last_name || ""}`.trim();
      return typeof u.name === "string" ? u.name : "";
    } catch {
      return "";
    }
  })();
  const initials = userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?';
  const handleLogout = (e) => {
    if (e) e.preventDefault();
    try {
      window.localStorage.removeItem("accessToken");
      window.localStorage.removeItem("refreshToken");
      window.localStorage.removeItem("role");
      window.localStorage.removeItem("user");
    } catch {}
    navigate("/auth/login");
  };
  return (
    <>
      <Navbar className="navbar-top navbar-dark navbar-modern" expand="md" id="navbar-main">
        <Container className="d-flex flex-column flex-md-row align-items-center" fluid>
          <Link className="navbar-brand-text" to="/">
            <i className="ni ni-planet mr-2" style={{ fontSize: 16 }} />
            {props.brandText}
          </Link>

          <div className="d-flex align-items-center ml-md-auto mt-2 mt-md-0 w-100 w-md-auto justify-content-between justify-content-md-end">
            <Form className="navbar-search navbar-search-dark form-inline d-none d-md-flex mr-3">
              <FormGroup className="mb-0">
                <InputGroup className="navbar-search-group">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText className="search-icon-wrapper">
                      <i className="fas fa-search" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input placeholder="Search anything..." type="text" className="search-input" />
                </InputGroup>
              </FormGroup>
            </Form>

            <Nav className="align-items-center" navbar>
              <UncontrolledDropdown nav>
                <DropdownToggle className="pr-0 nav-profile-toggle" nav>
                  <Media className="align-items-center">
                    <span className="avatar-gradient">
                      {initials}
                    </span>
                    <Media className="ml-2 d-none d-lg-block">
                      <span className="mb-0 text-sm font-weight-bold text-white">
                        {userName}
                      </span>
                    </Media>
                    <i className="ni ni-bold-down ml-1 d-none d-lg-inline text-white" style={{ fontSize: 10, opacity: 0.7 }} />
                  </Media>
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-modern" right>
                  <div className="dropdown-header-gradient">
                    <div style={{ fontWeight: 800, fontSize: 14 }}>👋 Welcome back!</div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{userName}</div>
                  </div>
                  <DropdownItem to="/admin/profile" tag={Link} className="dropdown-item-modern">
                    <i className="ni ni-single-02" />
                    <span>My profile</span>
                  </DropdownItem>
                  <DropdownItem href="#" className="dropdown-item-modern">
                    <i className="ni ni-settings-gear-65" />
                    <span>Settings</span>
                  </DropdownItem>
                  <DropdownItem href="#" className="dropdown-item-modern">
                    <i className="ni ni-calendar-grid-58" />
                    <span>Activity</span>
                  </DropdownItem>
                  <DropdownItem divider />
                  <DropdownItem to="/admin/logout" tag={Link} onClick={handleLogout} className="dropdown-item-modern logout-item">
                    <i className="ni ni-user-run" />
                    <span>Logout</span>
                  </DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </Nav>
          </div>
        </Container>
      </Navbar>
      <style>{`
        .navbar-modern {
          background: linear-gradient(135deg, #1a1f36 0%, #283593 50%, #1565c0 100%) !important;
          backdrop-filter: blur(20px);
          box-shadow: 0 4px 24px rgba(26, 31, 54, 0.3);
          border: none !important;
          padding: 0.65rem 0 !important;
        }
        .navbar-brand-text {
          font-size: 1rem;
          font-weight: 800;
          color: #fff !important;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          text-decoration: none;
          transition: all 0.3s ease;
        }
        .navbar-brand-text:hover {
          color: rgba(255,255,255,0.8) !important;
          transform: translateY(-1px);
          text-decoration: none;
        }
        .navbar-search-group {
          background: rgba(255,255,255,0.1) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 12px !important;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .navbar-search-group:focus-within {
          background: rgba(255,255,255,0.18) !important;
          border-color: rgba(255,255,255,0.3) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.1) !important;
        }
        .search-icon-wrapper {
          background: transparent !important;
          border: none !important;
          color: rgba(255,255,255,0.6) !important;
        }
        .search-input {
          background: transparent !important;
          border: none !important;
          color: #fff !important;
          font-size: 13px !important;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.5) !important; }
        .avatar-gradient {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          border: 2px solid rgba(255,255,255,0.3);
          transition: all 0.3s ease;
        }
        .nav-profile-toggle:hover .avatar-gradient {
          transform: scale(1.1);
          border-color: rgba(255,255,255,0.6);
          box-shadow: 0 4px 12px rgba(94,114,228,0.4);
        }
        .dropdown-menu-modern {
          border: none !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05) !important;
          padding: 0 !important;
          overflow: hidden;
          animation: dropdownFadeIn 0.25s ease !important;
          min-width: 220px;
        }
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dropdown-header-gradient {
          background: linear-gradient(135deg, #5e72e4 0%, #825ee4 100%);
          color: #fff;
          padding: 16px 20px;
        }
        .dropdown-item-modern {
          padding: 10px 20px !important;
          font-size: 14px;
          transition: all 0.2s ease !important;
        }
        .dropdown-item-modern:hover {
          background: linear-gradient(135deg, rgba(94,114,228,0.08), rgba(94,114,228,0.04)) !important;
          transform: translateX(4px);
        }
        .dropdown-item-modern i { margin-right: 10px; color: #5e72e4; }
        .logout-item:hover { background: rgba(245,54,92,0.08) !important; }
        .logout-item i { color: #f5365c !important; }
      `}</style>
    </>
  );
};

export default AdminNavbar;
