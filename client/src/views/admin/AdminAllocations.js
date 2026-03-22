import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container, Row, Col, Card, CardBody,
  Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

/* ── helpers ─────────────────────────────────────────────────── */
function initials(name = '') {
  return name.split(' ').map(p => p[0] || '').join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#5e72e4', '#2dce89', '#11cdef', '#fb6340', '#f5365c',
  '#825ee4', '#ffd600', '#32325d',
];
function avatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── component ───────────────────────────────────────────────── */
export default function AdminAllocations() {
  const [courses,         setCourses]         = useState([]);
  const [subjects,        setSubjects]        = useState([]);
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [allocations,     setAllocations]     = useState([]);   // TeacherAllocation[]
  const [enrolledStudents,setEnrolledStudents]= useState([]);   // active enrolled students
  const [loading,         setLoading]         = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  // Add student modal
  const [addModal,          setAddModal]          = useState({ open: false, teacherId: '', teacherName: '' });
  const [studentSearch,      setStudentSearch]      = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [assigning,          setAssigning]          = useState(false);
  const [assignError,        setAssignError]        = useState('');

  // Remove confirm modal
  const [removeModal, setRemoveModal] = useState({ open: false, teacherId: '', teacherName: '', studentId: '', studentName: '' });
  const [removing,    setRemoving]    = useState(false);

  // Permission level toggle
  const [permissionSaving, setPermissionSaving] = useState(null); // teacherId while saving

  /* fetch courses + all subjects once */
  useEffect(() => {
    setSubjectsLoading(true);
    Promise.all([
      http.get('/api/admin/courses').catch(() => ({ data: [] })),
      http.get('/api/admin/subjects').catch(() => ({ data: [] })),
    ]).then(([cRes, sRes]) => {
      setCourses(cRes.data || []);
      setSubjects(sRes.data || []);
    }).finally(() => setSubjectsLoading(false));
  }, []);

  /* fetch allocations + enrollments when subject changes */
  const loadSubjectData = useCallback(async (subjectId) => {
    if (!subjectId) { setAllocations([]); setEnrolledStudents([]); return; }
    setLoading(true);
    try {
      const [allocRes, enrollRes] = await Promise.all([
        http.get(`/api/admin/subjects/${subjectId}/allocations`),
        http.get(`/api/admin/subjects/${subjectId}/enrollments`),
      ]);
      setAllocations(allocRes.data || []);
      setEnrolledStudents(enrollRes.data || []);
    } catch (err) {
      console.error('[AdminAllocations]', err);
      setAllocations([]);
      setEnrolledStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubjectData(selectedSubject);
  }, [selectedSubject, loadSubjectData]);

  /* filter subjects by selected course */
  const filteredSubjects = useMemo(() =>
    selectedCourse
      ? subjects.filter(s => s.course_id === selectedCourse)
      : subjects,
  [subjects, selectedCourse]);

  /* when course changes, reset subject */
  const handleCourseChange = (e) => {
    setSelectedCourse(e.target.value);
    setSelectedSubject('');
  };

  /* open add-student modal for a teacher */
  const openAddModal = (teacherId, teacherName) => {
    setAddModal({ open: true, teacherId, teacherName });
    setStudentSearch('');
    setSelectedStudentIds(new Set());
    setAssignError('');
  };

  /* students available to assign: enrolled but not yet allocated to this teacher */
  const availableStudents = useMemo(() => {
    if (!addModal.open) return [];
    const teacher = allocations.find(a => a.teacher_id === addModal.teacherId);
    const allocatedIds = new Set((teacher?.students || []).map(s => s.student_id));
    return enrolledStudents
      .filter(s => !allocatedIds.has(s.id))
      .filter(s => {
        if (!studentSearch) return true;
        const q = studentSearch.toLowerCase();
        return (
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
        );
      });
  }, [addModal, allocations, enrolledStudents, studentSearch]);

  const toggleStudent = (id) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedStudentIds.size === 0) { setAssignError('Please select at least one student'); return; }
    setAssigning(true);
    setAssignError('');
    try {
      await Promise.all(
        [...selectedStudentIds].map(studentId =>
          http.post(
            `/api/admin/subjects/${selectedSubject}/teachers/${addModal.teacherId}/students`,
            { studentId }
          )
        )
      );
      setAddModal({ open: false, teacherId: '', teacherName: '' });
      loadSubjectData(selectedSubject);
    } catch (err) {
      setAssignError(err?.response?.data?.error || 'Failed to assign students');
    } finally {
      setAssigning(false);
    }
  };

  const openRemoveModal = (teacherId, teacherName, studentId, studentName) => {
    setRemoveModal({ open: true, teacherId, teacherName, studentId, studentName });
  };

  const togglePermission = async (teacherId, currentLevel) => {
    const newLevel = currentLevel === 'write' ? 'read' : 'write';
    setPermissionSaving(teacherId);
    try {
      await http.patch(`/api/admin/subjects/${selectedSubject}/teachers/${teacherId}/permission`, { permissionLevel: newLevel });
      setAllocations(prev => prev.map(a => a.teacher_id === teacherId ? { ...a, permission_level: newLevel } : a));
    } catch (err) {
      console.error('[togglePermission]', err);
    } finally {
      setPermissionSaving(null);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await http.delete(
        `/api/admin/subjects/${selectedSubject}/teachers/${removeModal.teacherId}/students/${removeModal.studentId}`
      );
      setRemoveModal({ open: false, teacherId: '', teacherName: '', studentId: '', studentName: '' });
      loadSubjectData(selectedSubject);
    } catch (err) {
      console.error('[removeAllocation]', err);
    } finally {
      setRemoving(false);
    }
  };

  /* selected subject info */
  const subjectInfo = useMemo(
    () => subjects.find(s => s.id === selectedSubject) || null,
    [subjects, selectedSubject]
  );

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ minHeight: '100vh', paddingBottom: 40 }}>

        {/* ── Page Header ── */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div style={{
                background: 'linear-gradient(135deg, #1a1f36 0%, #252d5a 50%, #1e3a8a 100%)',
                padding: '24px 28px',
              }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
                  <div>
                    <h2 className="mb-1" style={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem' }}>
                      Teacher Allocations
                    </h2>
                    <p className="mb-0" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                      Assign specific students to teachers within each subject. Teachers start with no students allocated.
                    </p>
                  </div>
                  {subjectInfo && (
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 16px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Viewing
                      </div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{subjectInfo.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{subjectInfo.course_name}</div>
                    </div>
                  )}
                </div>

                {/* Filter row */}
                <div className="d-flex flex-wrap mt-4" style={{ gap: 12 }}>
                  <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
                      Course
                    </label>
                    <select
                      value={selectedCourse}
                      onChange={handleCourseChange}
                      disabled={subjectsLoading}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none',
                        background: 'rgba(255,255,255,0.12)', color: '#fff',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="" style={{ background: '#252d5a' }}>All Courses</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id} style={{ background: '#252d5a' }}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: '1 1 260px', minWidth: 200 }}>
                    <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
                      Subject *
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={e => setSelectedSubject(e.target.value)}
                      disabled={subjectsLoading}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none',
                        background: selectedSubject ? 'rgba(94,114,228,0.4)' : 'rgba(255,255,255,0.12)',
                        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
                      }}
                    >
                      <option value="" style={{ background: '#252d5a' }}>— Select a subject —</option>
                      {filteredSubjects.map(s => (
                        <option key={s.id} value={s.id} style={{ background: '#252d5a' }}>
                          {s.name} ({s.course_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── Main content ── */}
        {!selectedSubject ? (
          <Row>
            <Col>
              <div style={{
                background: '#fff', borderRadius: 16, padding: '48px 32px',
                textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>👆</div>
                <h4 style={{ fontWeight: 700, color: '#32325d' }}>Select a Subject to Begin</h4>
                <p style={{ color: '#8898aa', maxWidth: 400, margin: '0 auto', fontSize: 14 }}>
                  Choose a course and subject above to view and manage which teacher is responsible for which student.
                </p>
              </div>
            </Col>
          </Row>
        ) : loading ? (
          <Row>
            {[1, 2, 3].map(i => (
              <Col lg="4" md="6" key={i} className="mb-4">
                <div style={{ background: '#fff', borderRadius: 16, height: 200, animation: 'pulse 1.5s ease infinite', opacity: 0.6 }} />
              </Col>
            ))}
          </Row>
        ) : allocations.length === 0 ? (
          <Row>
            <Col>
              <div style={{
                background: '#fff', borderRadius: 16, padding: '48px 32px',
                textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🏫</div>
                <h4 style={{ fontWeight: 700, color: '#32325d' }}>No Teachers Assigned Yet</h4>
                <p style={{ color: '#8898aa', maxWidth: 420, margin: '0 auto 20px', fontSize: 14 }}>
                  No teachers are assigned to <strong>{subjectInfo?.name}</strong> yet.
                  Go to <strong>Subjects</strong> to assign teachers first, then come back to allocate students.
                </p>
              </div>
            </Col>
          </Row>
        ) : (
          <>
            {/* Summary bar */}
            <Row className="mb-3">
              <Col>
                <div className="d-flex align-items-center flex-wrap" style={{ gap: 16 }}>
                  <span style={{ fontWeight: 700, color: '#32325d', fontSize: 15 }}>
                    {allocations.length} teacher{allocations.length !== 1 ? 's' : ''} assigned
                  </span>
                  <span style={{ color: '#8898aa', fontSize: 13 }}>
                    {enrolledStudents.length} student{enrolledStudents.length !== 1 ? 's' : ''} enrolled in this subject
                  </span>
                  <Badge style={{ background: '#eef0fd', color: '#5e72e4', fontWeight: 700, padding: '4px 10px', borderRadius: 10 }}>
                    {allocations.reduce((sum, a) => sum + a.students.length, 0)} total allocations
                  </Badge>
                </div>
              </Col>
            </Row>

            {/* Teacher cards */}
            <Row>
              {allocations.map(teacher => {
                const color = avatarColor(teacher.teacher_name);
                const allocated = teacher.students.length;
                const unallocated = enrolledStudents.length - allocated;
                return (
                  <Col lg="4" md="6" key={teacher.teacher_id} className="mb-4">
                    <Card className="shadow" style={{ borderRadius: 16, overflow: 'hidden', height: '100%' }}>
                      {/* Card header */}
                      <div style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`, padding: '18px 20px', borderBottom: '1px solid #f0f4f8' }}>
                        <div className="d-flex align-items-center" style={{ gap: 12 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: color, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 16, flexShrink: 0,
                          }}>
                            {initials(teacher.teacher_name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#1a1f36', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {teacher.teacher_name}
                            </div>
                            <div style={{ color: '#8898aa', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {teacher.teacher_email}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 20, color, lineHeight: 1 }}>{allocated}</div>
                            <div style={{ fontSize: 10, color: '#8898aa', fontWeight: 600 }}>allocated</div>
                            <div style={{ marginTop: 4 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                                background: teacher.permission_level === 'write' ? '#d4edda' : '#fff3cd',
                                color: teacher.permission_level === 'write' ? '#155724' : '#856404',
                              }}>
                                {teacher.permission_level === 'write' ? 'Write' : 'Read-only'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <CardBody style={{ padding: '16px 20px' }}>
                        {/* Progress bar */}
                        {enrolledStudents.length > 0 && (
                          <div className="mb-3">
                            <div className="d-flex justify-content-between mb-1">
                              <span style={{ fontSize: 11, color: '#8898aa', fontWeight: 600 }}>Coverage</span>
                              <span style={{ fontSize: 11, color: '#8898aa', fontWeight: 600 }}>
                                {allocated}/{enrolledStudents.length} enrolled students
                              </span>
                            </div>
                            <div style={{ height: 6, background: '#f0f4f8', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 3,
                                background: `linear-gradient(90deg, ${color}, ${color}99)`,
                                width: `${Math.min(100, (allocated / enrolledStudents.length) * 100)}%`,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                          </div>
                        )}

                        {/* Allocated students */}
                        <div style={{ minHeight: 60 }}>
                          {teacher.students.length === 0 ? (
                            <div style={{
                              background: '#f8faff', borderRadius: 10, padding: '14px',
                              textAlign: 'center', border: '1px dashed #dee2e6',
                            }}>
                              <p style={{ color: '#adb5bd', fontSize: 13, margin: 0 }}>
                                No students allocated yet
                              </p>
                              {unallocated > 0 && (
                                <p style={{ color: '#8898aa', fontSize: 11, margin: '4px 0 0' }}>
                                  {unallocated} enrolled student{unallocated !== 1 ? 's' : ''} available to assign
                                </p>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {teacher.students.map(s => (
                                <span
                                  key={s.student_id}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    background: '#f0f4f8', borderRadius: 20,
                                    padding: '4px 10px', fontSize: 12, fontWeight: 600,
                                    color: '#32325d', border: '1px solid #e9ecef',
                                  }}
                                >
                                  {s.student_name}
                                  <button
                                    onClick={() => openRemoveModal(
                                      teacher.teacher_id, teacher.teacher_name,
                                      s.student_id, s.student_name
                                    )}
                                    style={{
                                      background: 'none', border: 'none', padding: 0,
                                      cursor: 'pointer', color: '#f5365c',
                                      fontSize: 14, lineHeight: 1, fontWeight: 700,
                                      display: 'flex', alignItems: 'center',
                                    }}
                                    title={`Remove ${s.student_name}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions: Assign + Permission toggle */}
                        <div className="mt-3 d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
                          <Button
                            size="sm"
                            onClick={() => openAddModal(teacher.teacher_id, teacher.teacher_name)}
                            disabled={unallocated === 0}
                            style={{
                              borderRadius: 20, fontWeight: 700, fontSize: 12,
                              background: color, color: '#fff', border: 'none',
                              padding: '6px 16px', boxShadow: `0 4px 10px ${color}44`,
                            }}
                          >
                            + Assign Student
                          </Button>
                          <Button
                            size="sm"
                            outline
                            color={teacher.permission_level === 'write' ? 'warning' : 'success'}
                            disabled={permissionSaving === teacher.teacher_id}
                            onClick={() => togglePermission(teacher.teacher_id, teacher.permission_level)}
                            style={{ borderRadius: 20, fontWeight: 700, fontSize: 11, padding: '4px 12px' }}
                            title={teacher.permission_level === 'write' ? 'Revoke write access' : 'Grant write access'}
                          >
                            {permissionSaving === teacher.teacher_id
                              ? '...'
                              : teacher.permission_level === 'write' ? 'Make Read-only' : 'Grant Write'}
                          </Button>
                          {unallocated > 0 && (
                            <span style={{ fontSize: 11, color: '#8898aa' }}>
                              {unallocated} available
                            </span>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </>
        )}
      </Container>

      {/* ── Assign Student Modal ── */}
      <Modal isOpen={addModal.open} toggle={() => setAddModal({ open: false, teacherId: '', teacherName: '' })} centered>
        <ModalHeader
          toggle={() => setAddModal({ open: false, teacherId: '', teacherName: '' })}
          style={{ background: 'linear-gradient(135deg,#3b4a67,#6286c3)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
        >
          Assign Student
        </ModalHeader>
        <ModalBody style={{ background: '#f8fbff' }}>
          <p style={{ color: '#525f7f', fontSize: 13, marginBottom: 14 }}>
            Allocating to <strong>{addModal.teacherName}</strong> in <strong>{subjectInfo?.name}</strong>
          </p>

          <FormGroup>
            <Label style={{ fontWeight: 700, fontSize: 13 }}>Search student</Label>
            <Input
              placeholder="Name or email…"
              value={studentSearch}
              onChange={e => { setStudentSearch(e.target.value); setSelectedStudentIds(new Set()); }}
              style={{ borderRadius: 8, fontSize: 13 }}
              autoFocus
            />
          </FormGroup>

          {availableStudents.length > 1 && (
            <div
              onClick={() => {
                const allIds = new Set(availableStudents.map(s => s.id));
                const allSelected = availableStudents.every(s => selectedStudentIds.has(s.id));
                setSelectedStudentIds(allSelected ? new Set() : allIds);
              }}
              style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #e9ecef', background: '#f8faff', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <input
                type="checkbox"
                readOnly
                checked={availableStudents.every(s => selectedStudentIds.has(s.id))}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#525f7f' }}>
                Select all ({availableStudents.length})
              </span>
            </div>
          )}

          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: 10, background: '#fff' }}>
            {availableStudents.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#adb5bd', fontSize: 13 }}>
                {studentSearch ? 'No students match your search' : 'All enrolled students are already allocated to this teacher'}
              </div>
            ) : (
              availableStudents.map(s => {
                const checked = selectedStudentIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid #f0f4f8',
                      background: checked ? '#eef0fd' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div className="d-flex align-items-center" style={{ gap: 10 }}>
                      <input type="checkbox" readOnly checked={checked} style={{ cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: avatarColor(`${s.first_name} ${s.last_name}`),
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 12,
                      }}>
                        {initials(`${s.first_name} ${s.last_name}`)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#32325d', fontSize: 13 }}>
                          {s.first_name} {s.last_name}
                        </div>
                        <div style={{ color: '#8898aa', fontSize: 11 }}>{s.email}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {assignError && <p className="text-danger small mt-2 mb-0">{assignError}</p>}
        </ModalBody>
        <ModalFooter style={{ background: '#f8fbff' }}>
          <Button
            color="primary"
            disabled={selectedStudentIds.size === 0 || assigning}
            onClick={handleAssign}
            style={{ borderRadius: 20, fontWeight: 700 }}
          >
            {assigning
              ? 'Assigning…'
              : selectedStudentIds.size > 0
                ? `Assign ${selectedStudentIds.size} Student${selectedStudentIds.size > 1 ? 's' : ''}`
                : 'Assign Student'}
          </Button>
          <Button color="link" onClick={() => setAddModal({ open: false, teacherId: '', teacherName: '' })}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Remove Confirm Modal ── */}
      <Modal isOpen={removeModal.open} toggle={() => setRemoveModal({ ...removeModal, open: false })} centered size="sm">
        <ModalHeader toggle={() => setRemoveModal({ ...removeModal, open: false })}>
          Remove Allocation
        </ModalHeader>
        <ModalBody className="text-center">
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontWeight: 600, color: '#32325d', marginBottom: 6 }}>
            Remove <strong>{removeModal.studentName}</strong>
          </p>
          <p style={{ color: '#8898aa', fontSize: 13, marginBottom: 0 }}>
            from <strong>{removeModal.teacherName}</strong>'s allocation in <strong>{subjectInfo?.name}</strong>?
          </p>
        </ModalBody>
        <ModalFooter className="justify-content-center">
          <Button color="danger" disabled={removing} onClick={handleRemove}>
            {removing ? 'Removing…' : 'Yes, Remove'}
          </Button>
          <Button color="secondary" outline onClick={() => setRemoveModal({ ...removeModal, open: false })}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
