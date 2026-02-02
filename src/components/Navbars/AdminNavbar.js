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
        <Container fluid>
          <Link
            className="h4 mb-0 text-white text-uppercase d-none d-lg-inline-block"
            to="/"
          >
            {props.brandText}
          </Link>
          <Form className="navbar-search navbar-search-dark form-inline mr-3 d-none d-md-flex ml-lg-auto">
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
          <Nav className="ml-auto align-items-center" navbar>
            <div className="align-items-center media">
              <span className="avatar avatar-sm rounded-circle">
                <img
                  alt="..."
                  src={require("../../assets/img/theme/team-4-800x800.jpg")}
                />
              </span>
              <div className="ml-2 d-none d-lg-block media">
                <span className="mb-0 text-sm font-weight-bold text-white">
                  Kishor Bharti
                </span>
              </div>
            </div>
          </Nav>
        </Container>
      </Navbar>
    </>
  );
};

export default AdminNavbar;
