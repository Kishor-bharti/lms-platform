import { Button, Container, Row, Col } from "reactstrap";

const UserHeader = () => {
  const user = (() => {
    try {
      const raw = window.localStorage.getItem("user") || "";
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();
  const firstName = user.firstName || user.first_name || "";
  const lastName  = user.lastName  || user.last_name  || "";
  const name = firstName || lastName
    ? `${firstName} ${lastName}`.trim()
    : (typeof user.name === "string" ? user.name : "");
  const role = user.activeRole || user.role || "";
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "";
  return (
    <>
      <div
        className="header pb-8 pt-5 pt-lg-8 d-flex align-items-center"
        style={{
          minHeight: "600px",
          backgroundImage:
            "url(" + require("../../assets/img/theme/profile-cover.jpg") + ")",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        {/* Mask */}
        <span className="mask bg-gradient-default opacity-8" />
        {/* Header container */}
        <Container className="d-flex align-items-center" fluid>
          <Row>
            <Col lg="7" md="10">
              <h1 className="display-2 text-white">{`Hi, ${name}`}</h1>
              <p className="text-white mt-0 mb-5">{roleDisplay}</p>
              <Button
                color="info"
                href="#pablo"
                onClick={(e) => e.preventDefault()}
              >
                Edit profile
              </Button>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
};

export default UserHeader;
