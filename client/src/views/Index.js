import Header from "components/Headers/Header.js";
import UpcomingClasses from "components/Dashboard/UpcomingClasses";
import CalendarWidget from "components/Dashboard/CalendarWidget";
import {
  Container,
  Row,
  Col,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
} from "reactstrap";

const Index = (props) => {
  return (
    <>
      <Header />
      {/* Page content */}
      <Container className="mt--7" fluid style={{ background: "linear-gradient(180deg, #eef2f7 0%, #e3eaf4 100%)", minHeight: "100vh", paddingTop: "30px", paddingBottom: "30px" }}>
        <Row>
          <Col lg="8" className="mb-4">
            <div className="dash-card-animate" style={{ animationDelay: '0.1s' }}>
              <UpcomingClasses />
            </div>
          </Col>
          <Col lg="4" className="mb-4">
            <div className="dash-card-animate" style={{ animationDelay: '0.2s' }}>
              <CalendarWidget />
            </div>
          </Col>
        </Row>
        <Row>
          <Col lg="12">
            <div className="dash-card-animate" style={{ animationDelay: '0.3s' }}>
              <Card className="shadow-lg mb-4 announcement-card">
                <CardHeader className="border-0 announcement-header">
                  <div className="d-flex align-items-center">
                    <span className="header-icon-badge" style={{ background: 'linear-gradient(135deg, #5e72e4, #825ee4)' }}>
                      <i className="ni ni-notification-70" style={{ color: '#fff', fontSize: 16 }} />
                    </span>
                    <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>Announcements</CardTitle>
                  </div>
                </CardHeader>
                <CardBody>
                  {[
                    { icon: '📝', title: 'Mid-term Exams Schedule', text: 'Mid-term exams will begin from March 15th. Please check your individual class schedules for specific dates and times.', color: '#5e72e4', bg: '#eef0fd' },
                    { icon: '✅', title: 'Assignment Submission Deadline', text: 'All assignments for this week must be submitted by Friday, January 31st before 5:00 PM.', color: '#2dce89', bg: '#e8fbf0' },
                    { icon: '📚', title: 'Campus Library Hours Update', text: 'The main library will be closed on weekends for maintenance. Extended hours available on weekdays.', color: '#fb6340', bg: '#fff0eb' },
                  ].map((a, i) => (
                    <div key={i} className="announcement-item" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                      <div className="announcement-icon" style={{ background: a.bg }}>
                        <span style={{ fontSize: 20 }}>{a.icon}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h6 style={{ fontWeight: 700, color: a.color, marginBottom: 4 }}>{a.title}</h6>
                        <p className="text-sm" style={{ color: '#525f7f', margin: 0 }}>{a.text}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </Col>
        </Row>
        <Row>
          <Col lg="12">
            <div className="dash-card-animate" style={{ animationDelay: '0.4s' }}>
              <Card className="shadow-lg activity-card">
                <CardHeader className="border-0 activity-header">
                  <div className="d-flex align-items-center">
                    <span className="header-icon-badge" style={{ background: 'linear-gradient(135deg, #11cdef, #1171ef)' }}>
                      <i className="ni ni-bullet-list-67" style={{ color: '#fff', fontSize: 16 }} />
                    </span>
                    <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>Recent Activity</CardTitle>
                  </div>
                </CardHeader>
                <Table className="align-items-center table-flush mb-0 activity-table" responsive>
                  <thead>
                    <tr>
                      <th scope="col">Activity</th>
                      <th scope="col">Course</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { activity: 'Assignment Submitted', course: 'Mathematics 101', date: 'Jan 25, 2026', icon: '📝' },
                      { activity: 'Quiz Completed', course: 'English Literature', date: 'Jan 24, 2026', icon: '✅' },
                      { activity: 'Lecture Notes Uploaded', course: 'Physics Lab', date: 'Jan 23, 2026', icon: '📄' },
                      { activity: 'Grade Posted', course: 'Chemistry Advanced', date: 'Jan 22, 2026', icon: '🌟' },
                    ].map((r, i) => (
                      <tr key={i} className="activity-row">
                        <th scope="row">
                          <span className="activity-emoji">{r.icon}</span>
                          {r.activity}
                        </th>
                        <td>{r.course}</td>
                        <td style={{ color: '#8898aa' }}>{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
      <style>{`
        .dash-card-animate {
          animation: dashCardIn 0.5s ease both;
        }
        @keyframes dashCardIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .header-icon-badge {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .announcement-card {
          border-radius: 16px !important;
          border: none !important;
          overflow: hidden;
        }
        .announcement-header {
          background: linear-gradient(135deg, #f8faff 0%, #fff 100%);
          padding: 20px 24px !important;
        }
        .announcement-item {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 16px; border-radius: 12px;
          transition: all 0.3s ease;
          margin-bottom: 8px;
        }
        .announcement-item:hover {
          background: #f8faff;
          transform: translateX(6px);
        }
        .announcement-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .activity-card {
          border-radius: 16px !important;
          border: none !important;
          overflow: hidden;
        }
        .activity-header {
          background: linear-gradient(135deg, #f8faff 0%, #fff 100%);
          padding: 20px 24px !important;
        }
        .activity-table thead th {
          background: #f8faff !important;
          color: #8898aa;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          border-top: none !important;
          padding: 12px 16px !important;
        }
        .activity-row {
          transition: all 0.3s ease;
        }
        .activity-row:hover {
          background: #f8faff;
        }
        .activity-row th, .activity-row td {
          padding: 14px 16px !important;
          font-size: 14px;
          vertical-align: middle;
        }
        .activity-row th {
          font-weight: 600;
          color: #32325d;
        }
        .activity-emoji {
          margin-right: 8px;
        }
      `}</style>
    </>
  );
};

export default Index;
