import { Container } from "reactstrap";

const Header = () => {
  return (
    <>
      <div className="header custom-gradient pb-8 pt-5 pt-md-8">
        <Container fluid>
          {/* Header content */}
        </Container>
      </div>
      <style>{`
        .custom-gradient {
          background: linear-gradient(135deg, #1f3c88 0%, #3a5ba0 50%, #2d9cdb 100%);
        }
      `}</style>
    </>
  );
};

export default Header;
