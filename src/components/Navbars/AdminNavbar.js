import { Link } from "react-router-dom";
// reactstrap components
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
} from "reactstrap";

const AdminNavbar = (props) => {
  return (
    <>
      <Navbar className="navbar-top navbar-dark" expand="md" id="navbar-main">
        <Container className="d-flex flex-column flex-md-row align-items-center" fluid>
          <Link
            className="h4 mb-0 text-white text-uppercase"
            to="/"
          >
            {props.brandText}
          </Link>

          <div className="d-flex align-items-center ml-md-auto mt-2 mt-md-0 w-100 w-md-auto justify-content-between justify-content-md-end">
            <Form className="navbar-search navbar-search-dark form-inline d-none d-md-flex mr-3">
              <FormGroup className="mb-0">
                <InputGroup className="input-group-alternative">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>
                      <i className="fas fa-search" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input placeholder="Search" type="text" />
                </InputGroup>
              </FormGroup>
            </Form>

            <Nav className="align-items-center" navbar>
              <div className="profile-widget d-flex align-items-center">
                <span className="avatar avatar-sm rounded-circle">
                  <img
                    alt="..."
                    src={require("../../assets/img/theme/team-4-800x800.jpg")}
                  />
                </span>
                <span className="ml-2 mb-0 text-sm font-weight-bold text-white d-none d-sm-inline">
                  Kishor Bharti
                </span>
              </div>
            </Nav>
          </div>
        </Container>
      </Navbar>
      <style>{`
        /* Responsive tweaks for the single profile widget */
        @media (max-width: 765px), (max-height: 780px) {
          #navbar-main .profile-widget {
            margin-left: 0;
            margin-right: auto;
          }
        }
      `}</style>
    </>
  );
};

export default AdminNavbar;
