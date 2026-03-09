import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardBody, CardTitle, Table, Badge, Button, Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import http from "utils/http";

const BATCH_SIZE = 4;

export default function UpcomingClasses() {
  const [allSessions, setAllSessions] = useState([]);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const errorCount = useRef(0);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      if (errorCount.current >= 3) {
        clearInterval(interval);
        return;
      }
      fetchSessions();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await http.get('/api/classes/my-sessions-v2');
      const data = Array.isArray(response?.data) ? response.data : [];

      // Filter out completed sessions — dashboard should show upcoming only
      // Sort ascending by scheduled_at so nearest-upcoming is first
      const upcoming = data
        .filter((s) => s.status !== 'COMPLETED')
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

      setAllSessions(upcoming);
      errorCount.current = 0;
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setAllSessions([]);
      errorCount.current += 1;
      if (errorCount.current >= 3) {
        console.warn('[polling] Stopped after 3 consecutive errors');
      }
    }
  };

  const sessions = allSessions.slice(0, visibleCount);

  const openDetails = (session) => { setCurrent(session); setOpen(true); };
  const closeDetails = () => setOpen(false);

  const getStatusColor = (status) => {
    switch(status) {
      case 'LIVE':
        return "danger";
      case 'TODAY':
        return "info";
      case 'TOMORROW':
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="shadow-lg upcoming-modern" style={{ borderRadius: 16, background: "#fff" }}>
      <CardHeader className="border-0 upcoming-header">
        <div className="d-flex align-items-center">
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #11cdef, #1171ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ni ni-calendar-grid-58" style={{ color: '#fff', fontSize: 16 }} />
          </span>
          <CardTitle className="mb-0 ml-3" style={{ fontWeight: 800, color: '#1a1f36' }}>Upcoming Sessions</CardTitle>
        </div>
      </CardHeader>
      <CardBody style={{ paddingTop: 0 }}>
        <div className="table-responsive">
          <Table className="align-items-center table-flush mb-0">
            <thead className="thead-light">
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Class</th>
                <th scope="col">Date & Time</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-3"><span className="text-muted">No upcoming sessions</span></td></tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id}>
                    <th scope="row" style={{ fontWeight: 700, color: "#3b4a67" }}>{session.title || 'Untitled'}</th>
                    <td>{session.class_title}</td>
                    <td>{new Date(session.scheduled_at).toLocaleString()}</td>
                    <td>
                      <Badge
                        color={getStatusColor(session.status)}
                        style={{
                          borderRadius: 12,
                          padding: "4px 8px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 700,
                        }}
                      >
                        {session.status === 'LIVE' && (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              background: "#dc3545",
                              display: "inline-block",
                            }}
                          />
                        )}
                        <span className={session.status === 'LIVE' ? 'live-blink' : ''}>{session.status}</span>
                      </Badge>
                    </td>
                    <td className="text-right">
                      {session.status === 'LIVE' && (
                        <Button size="sm" style={{ background: "#28a745", color: "#fff", borderRadius: 20, padding: "6px 12px", marginRight: 8 }} onClick={() => window.open(session.zoom_link, '_blank')}>
                          Join
                        </Button>
                      )}
                      {session.status === 'COMPLETED' && (
                        <Button size="sm" style={{ background: "#f0f0f0", color: "#333", borderRadius: 20, padding: "6px 12px", marginRight: 8 }}>
                          Replay
                        </Button>
                      )}
                      <Button size="sm" style={{ background: "#212529", color: "#fff", borderRadius: 20, padding: "6px 12px" }} onClick={() => openDetails(session)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
        {allSessions.length > BATCH_SIZE && (
          <div className="d-flex justify-content-center align-items-center mt-3" style={{ gap: 8 }}>
            {visibleCount < allSessions.length && (
              <Button
                size="sm"
                color="primary"
                outline
                style={{ borderRadius: 20, padding: '6px 20px', fontWeight: 600 }}
                onClick={() => setVisibleCount((c) => Math.min(c + BATCH_SIZE, allSessions.length))}
              >
                Show More ({Math.min(BATCH_SIZE, allSessions.length - visibleCount)} more)
              </Button>
            )}
            {visibleCount > BATCH_SIZE && (
              <Button
                size="sm"
                color="secondary"
                outline
                style={{ borderRadius: 20, padding: '6px 20px', fontWeight: 600 }}
                onClick={() => setVisibleCount(BATCH_SIZE)}
              >
                Show Less
              </Button>
            )}
            <span className="text-muted small">Showing {Math.min(visibleCount, allSessions.length)} of {allSessions.length}</span>
          </div>
        )}
        <Modal isOpen={open} toggle={closeDetails} centered className="details-modal">
          <ModalHeader
            toggle={closeDetails}
            style={{
              background: "linear-gradient(135deg, #3b4a67 0%, #6286c3 100%)",
              color: "#fff",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            }}
          >
            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ni ni-single-copy-04" style={{ color: "#fff" }} />
              </span>
              <span style={{ fontWeight: 700 }}>Session Details</span>
            </div>
          </ModalHeader>
          <ModalBody style={{ background: "#f8fbff" }}>
            {current && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#2c3e50" }}>{current.title || 'Untitled Session'}</div>
                <div className="chips" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e9eef5", borderRadius: 10, padding: "8px 10px" }}>
                    <i className="ni ni-book-bookmark" style={{ color: "#6286c3" }} />
                    <span style={{ color: "#6b778c" }}>Class:</span>
                    <span style={{ fontWeight: 600, color: "#1f2937" }}>{current.class_title}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e9eef5", borderRadius: 10, padding: "8px 10px" }}>
                    <i className="ni ni-calendar-grid-58" style={{ color: "#6286c3" }} />
                    <span style={{ color: "#6b778c" }}>Date:</span>
                    <span style={{ fontWeight: 600, color: "#1f2937" }}>{new Date(current.scheduled_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e9eef5", borderRadius: 10, padding: "8px 10px" }}>
                    <i className="ni ni-watch-time" style={{ color: "#6286c3" }} />
                    <span style={{ color: "#6b778c" }}>Time:</span>
                    <span style={{ fontWeight: 600, color: "#1f2937" }}>{new Date(current.scheduled_at).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e9eef5", borderRadius: 10, padding: "8px 10px" }}>
                  <Badge
                    color={getStatusColor(current.status)}
                    style={{
                      borderRadius: 12,
                      padding: "4px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 700,
                    }}
                  >
                    {current.status === 'LIVE' && (
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: "#dc3545", display: "inline-block" }} />
                    )}
                    <span className={current.status === 'LIVE' ? 'live-blink' : ''}>{current.status}</span>
                  </Badge>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter style={{ background: "#f8fbff" }}>
            {current?.status === 'LIVE' && (
              <Button style={{ background: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)", border: "none", boxShadow: "0 6px 16px rgba(46, 204, 113, .35)", borderRadius: 22, padding: "8px 16px" }} onClick={() => window.open(current.zoom_link, '_blank')}>Join Now</Button>
            )}
            {current?.status === 'COMPLETED' && (
              <Button style={{ background: "#f0f0f0", border: "none", borderRadius: 22, padding: "8px 16px", color: "#333" }}>Replay</Button>
            )}
            {current?.status !== 'LIVE' && current?.status !== 'COMPLETED' && (
              <Button style={{ background: "#adb5bd", border: "none", borderRadius: 22, padding: "8px 16px" }} disabled>Join Soon</Button>
            )}
            <Button color="link" onClick={closeDetails} style={{ color: "#3b4a67" }}>Close</Button>
          </ModalFooter>
        </Modal>
      </CardBody>
      <style>{`
        .upcoming-modern { box-shadow: 0 10px 40px rgba(0,0,0,0.06) !important; overflow: hidden; }
        .upcoming-header { background: linear-gradient(135deg, #f8faff 0%, #fff 100%); padding: 20px 24px !important; }
        .thead-light th { color: #8898aa !important; font-weight: 700 !important; letter-spacing: .5px; font-size: 11px; text-transform: uppercase; }
        .upcoming-modern tbody tr { transition: all 0.3s ease; }
        .upcoming-modern tbody tr:hover { background: #f8faff; }
        .details-modal .modal-content { border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.18); border: none; }
        @keyframes liveBlink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        .live-blink { animation: liveBlink 1s infinite; }
        @media (max-width: 767.98px) {
          .upcoming-modern { border-radius: 12px !important; }
          .upcoming-modern .card-header { padding: .75rem 1rem !important; }
          .table-responsive { overflow-x: auto; }
          table { font-size: .9rem; }
          .chips { grid-template-columns: 1fr; }
        }
      `}</style>
    </Card>
  );
}
