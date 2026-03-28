import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, CardHeader, CardBody, CardTitle,
  Badge, Button, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label, Input,
} from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';
import { getTodayLocalDateKey, toTimetzFromLocal, withTimeZoneQuery } from 'utils/date';
import { TopicCardSkeleton } from 'components/Skeleton.js';

function statusBadge(status) {
  switch (status) {
    case 'LIVE':      return <Badge color="danger" className="live-blink">LIVE</Badge>;
    case 'TODAY':     return <Badge color="warning">TODAY</Badge>;
    case 'TOMORROW':  return <Badge color="info">TOMORROW</Badge>;
    case 'COMPLETED': return <Badge color="secondary">COMPLETED</Badge>;
    default:          return <Badge color="light">SCHEDULED</Badge>;
  }
}

export default function SubjectTeacher() {
  const { subjectId } = useParams();
  const navigate = useNavigate();

  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const userId = JSON.parse(window.localStorage.getItem('user') || '{}').id;

  const [tab,             setTab]             = useState('topics');
  const [subject,         setSubject]         = useState(null);
  const [sessions,        setSessions]        = useState([]);
  const [quizzes,         setQuizzes]         = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [startingSession, setStartingSession] = useState(null);
  const [actionError,     setActionError]     = useState('');
  const [deleteQuizModal,     setDeleteQuizModal]     = useState({ open: false, quiz: null });
  const [deleteSessionModal,  setDeleteSessionModal]  = useState({ open: false, session: null });
  const [deleteAssignModal,   setDeleteAssignModal]   = useState({ open: false, assign: null });
  const [deleteMatModal,      setDeleteMatModal]      = useState({ open: false, mat: null });

  // Assign content to students
  const [assignContentModal,  setAssignContentModal]  = useState({ open: false, type: '', item: null });
  const [assignContentIds,    setAssignContentIds]    = useState([]);   // selected student IDs
  const [assignContentSaving, setAssignContentSaving] = useState(false);
  const [assignContentError,  setAssignContentError]  = useState('');
  const [contentAssignments,  setContentAssignments]  = useState([]); // all assignments for this subject

  // Per-quiz write-permissions modal (admin: manage which teachers can edit a specific quiz)
  const [permissionsModal,     setPermissionsModal]     = useState({ open: false, item: null, type: '' });
  const [quizPermissions,      setQuizPermissions]      = useState([]); // teachers with per-quiz write
  const [quizPermissionsLoading, setQuizPermissionsLoading] = useState(false);
  const [permissionsSaving,    setPermissionsSaving]    = useState({}); // { [teacherId]: bool }

  // Assignment detail popup (Assigned By / Assigned To drill-down)
  const [detailModal, setDetailModal] = useState({ open: false, field: '', contentType: '', itemId: '', itemTitle: '' });

  // Session date navigation + filters (sessions tab)
  const [sessionDateStr,    setSessionDateStr]    = useState(getTodayLocalDateKey());
  const [sessStatusFilter,  setSessStatusFilter]  = useState('all');
  const [sessTopicFilter,   setSessTopicFilter]   = useState('all');
  const [sessTeacherFilter, setSessTeacherFilter] = useState('all'); // admin only

  // Reschedule modal (admin only)
  const [rescheduleModal,  setRescheduleModal]  = useState({ open: false, session: null });
  const [rescheduleForm,   setRescheduleForm]   = useState({ title: '', sessionDate: '', startTime: '', endTime: '', recurMode: 'this' });
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // Recurring delete scope modal (admin only)
  const [recurDeleteModal, setRecurDeleteModal] = useState({ open: false, session: null, scope: 'this' });
  const [recurDeleting,    setRecurDeleting]    = useState(false);

  // Schedule session modal
  const [scheduleOpen,    setScheduleOpen]    = useState(false);
  const [scheduleForm,    setScheduleForm]    = useState({
    teacherId: '', title: '', date: '', time: '', endTime: '', topicId: '', studentIds: [],
    isRecurring: false, recurPattern: 'weekly', recurDays: [], recurEndDate: '',
  });
  const [scheduling,      setScheduling]      = useState(false);
  const [scheduleError,   setScheduleError]   = useState('');
  const [schedulePreview, setSchedulePreview] = useState([]);

  // Assignment filters
  const [assignFilterTitle,    setAssignFilterTitle]    = useState('');
  const [assignFilterTopic,    setAssignFilterTopic]    = useState('all');
  const [assignFilterDuration, setAssignFilterDuration] = useState('all');
  const [assignFilterStatus,   setAssignFilterStatus]   = useState('all');
  const [assignFilterCreator,  setAssignFilterCreator]  = useState('all');
  const [assignFilterStudent,  setAssignFilterStudent]  = useState('all');
  const [assignFilterAssigned, setAssignFilterAssigned] = useState('all'); // 'all' | 'assigned' | 'not_assigned'

  // Create/Edit assignment modal
  const [assignOpen,      setAssignOpen]      = useState(false);
  const [assignForm,      setAssignForm]      = useState({ title: '', description: '', duration_days: '', max_marks: 100, attachment_url: '', topicId: '', assignedTo: '' });
  const [assignSaving,    setAssignSaving]    = useState(false);
  const [assignError,     setAssignError]     = useState('');
  const [assignUploading, setAssignUploading] = useState(false);
  const [assignFileName,  setAssignFileName]  = useState('');
  const assignFileRef = useRef(null);
  const [editingAssignment, setEditingAssignment] = useState(null);

  // Subject students + teachers (for 1-on-1 session / assignment targeting)
  const [subjectStudents,  setSubjectStudents]  = useState([]);
  const [subjectTeachers,  setSubjectTeachers]  = useState([]);

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Materials
  const [materials,    setMaterials]    = useState([]);
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [matForm,      setMatForm]      = useState({ title: '', description: '', material_type: 'link', file_url: '', topicId: '' });
  const [matSaving,    setMatSaving]    = useState(false);
  const [matError,     setMatError]     = useState('');

  // Preview modals
  const [previewAssign, setPreviewAssign] = useState(null);
  const [previewMat,    setPreviewMat]    = useState(null);

  // Submissions panel
  const [viewSubs,      setViewSubs]      = useState(null); // assignmentId
  const [viewSubsTitle, setViewSubsTitle] = useState('');
  const [submissions,   setSubmissions]   = useState([]);
  const [gradingId,     setGradingId]     = useState(null);
  const [gradeForm,     setGradeForm]     = useState({ marks: '', feedback: '', feedback_file_url: '' });
  const [gradeUploading, setGradeUploading] = useState(false);
  const [gradeFileName,  setGradeFileName]  = useState('');
  const gradeFileRef = useRef(null);

  // Topics
  const [topics,        setTopics]        = useState([]);
  const [topicModal,    setTopicModal]    = useState(false);
  const [editingTopic,  setEditingTopic]  = useState(null); // null = create, object = edit
  const [topicForm,     setTopicForm]     = useState({ name: '', description: '', order_index: 0 });
  const [topicSaving,   setTopicSaving]   = useState(false);
  const [topicError,    setTopicError]    = useState('');
  const [topicDeleting, setTopicDeleting] = useState(null);

  const errorCount = useRef(0);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => {
      if (errorCount.current >= 3) { clearInterval(iv); return; }
      fetchData();
    }, 60000);
    return () => clearInterval(iv);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recurrence preview
  useEffect(() => {
    if (!scheduleForm.isRecurring || !scheduleForm.date || !scheduleForm.recurEndDate) {
      setSchedulePreview([]); return;
    }
    const dates = [];
    const end   = new Date(scheduleForm.recurEndDate + 'T00:00:00Z');
    let   cur   = new Date(scheduleForm.date         + 'T00:00:00Z');
    const days  = scheduleForm.recurDays;
    while (cur <= end && dates.length < 60) {
      const dow = cur.getUTCDay();
      const iso = cur.toISOString().slice(0, 10);
      if (scheduleForm.recurPattern === 'daily' || days.length === 0 || days.includes(dow))
        dates.push(iso);
      cur = new Date(cur.getTime() + 86400000);
    }
    setSchedulePreview(dates);
  }, [scheduleForm.isRecurring, scheduleForm.date, scheduleForm.recurEndDate, scheduleForm.recurPattern, scheduleForm.recurDays]);

  const fetchData = async () => {
    try {
      const [sessRes, classRes, quizRes, assignRes, matRes, topicsRes, studentsRes, teachersRes, caRes] = await Promise.all([
        http.get(withTimeZoneQuery('/api/classes/my-sessions-v2')),
        http.get('/api/classes/my-classes-v2'),
        http.get(`/api/quizzes/subject/${subjectId}`),
        http.get(`/api/assignments/subject/${subjectId}`),
        http.get(`/api/materials/subject/${subjectId}`),
        http.get(`/api/subjects/${subjectId}/topics`),
        http.get(`/api/classes/subjects/${subjectId}/students`),
        http.get(`/api/classes/subjects/${subjectId}/teachers`),
        http.get(`/api/content-assignments/subject/${subjectId}`).catch(() => ({ data: [] })),
      ]);
      setSessions((sessRes.data || []).filter((s) => s.subject_id === subjectId));
      const found = (classRes.data || []).find((c) => c.id === subjectId);
      if (found) setSubject(found);
      setQuizzes(quizRes.data || []);
      setAssignments(assignRes.data || []);
      setMaterials(matRes.data || []);
      setTopics(topicsRes.data || []);
      setSubjectStudents(studentsRes.data || []);
      setSubjectTeachers(teachersRes.data || []);
      setContentAssignments(caRes.data || []);
      errorCount.current = 0;
    } catch (err) {
      console.error('[SubjectTeacher]', err);
      errorCount.current += 1;
      if (errorCount.current >= 3) {
        console.warn('[polling] Stopped after 3 consecutive errors');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (sessionId) => {
    setStartingSession(sessionId); setActionError('');
    try {
      const res = await http.post(`/api/classes/sessions/${sessionId}/start`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? res.data : s));
      const url = res.data?.start_url || res.data?.zoom_link;
      if (url) window.open(url, '_blank');
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Failed to start session');
    } finally { setStartingSession(null); }
  };

  const handleEnd = async (sessionId) => {
    setStartingSession(sessionId); setActionError('');
    try {
      const res = await http.post(`/api/classes/sessions/${sessionId}/complete`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? res.data : s));
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Failed to end session');
    } finally { setStartingSession(null); }
  };

  const handleSchedule = async (e) => {
    e.preventDefault(); setScheduleError('');
    if (!scheduleForm.title || !scheduleForm.date || !scheduleForm.time) {
      setScheduleError('Title, date, and start time are required'); return;
    }
    if (isAdmin && !scheduleForm.teacherId) { setScheduleError('Please select a teacher'); return; }
    setScheduling(true);
    try {
      if (isAdmin) {
        // Admin uses admin session endpoint with teacher selection
        await http.post('/api/admin/sessions', {
          subjectId,
          teacherId:    scheduleForm.teacherId,
          title:        scheduleForm.title,
          sessionDate:  scheduleForm.date,
          startTime:    toTimetzFromLocal(scheduleForm.date, scheduleForm.time),
          endTime:      scheduleForm.endTime ? toTimetzFromLocal(scheduleForm.date, scheduleForm.endTime) : undefined,
          topicId:      scheduleForm.topicId || undefined,
          studentIds:   scheduleForm.studentIds.length ? scheduleForm.studentIds : undefined,
          isRecurring:  scheduleForm.isRecurring,
          recurPattern: scheduleForm.recurPattern,
          recurDays:    scheduleForm.recurDays,
          recurEndDate: scheduleForm.recurEndDate || undefined,
        });
      } else {
        // Teacher creates session under their own ID
        await http.post('/api/classes/sessions/create', {
          subjectId,
          title:        scheduleForm.title,
          sessionDate:  scheduleForm.date,
          startTime:    toTimetzFromLocal(scheduleForm.date, scheduleForm.time),
          endTime:      scheduleForm.endTime ? toTimetzFromLocal(scheduleForm.date, scheduleForm.endTime) : undefined,
          topicId:      scheduleForm.topicId || undefined,
          studentIds:   scheduleForm.studentIds.length ? scheduleForm.studentIds : undefined,
          isRecurring:  scheduleForm.isRecurring,
          recurPattern: scheduleForm.recurPattern,
          recurDays:    scheduleForm.recurDays,
          recurEndDate: scheduleForm.recurEndDate || undefined,
        });
      }
      setScheduleOpen(false);
      setScheduleForm({ teacherId: '', title: '', date: '', time: '', endTime: '', topicId: '', studentIds: [], isRecurring: false, recurPattern: 'weekly', recurDays: [], recurEndDate: '' });
      fetchData();
    } catch (err) {
      setScheduleError(err?.response?.data?.error || 'Failed to schedule');
    } finally { setScheduling(false); }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault(); setMatError('');
    if (!matForm.title || !matForm.file_url) { setMatError('Title and URL are required'); return; }
    if (!matForm.topicId) { setMatError('Topic is required'); return; }
    setMatSaving(true);
    try {
      await http.post('/api/materials', { subjectId, ...matForm, topicId: matForm.topicId || undefined });
      setMatModalOpen(false);
      setMatForm({ title: '', description: '', material_type: 'link', file_url: '', topicId: '' });
      fetchData();
    } catch (err) {
      setMatError(err?.response?.data?.error || 'Failed to add material');
    } finally { setMatSaving(false); }
  };

  const handleDeleteMaterial = async () => {
    if (!deleteMatModal.mat) return;
    try { await http.delete(`/api/materials/${deleteMatModal.mat.id}`); setDeleteMatModal({ open: false, mat: null }); fetchData(); }
    catch (err) { alert(err?.response?.data?.error || 'Failed to delete material'); }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionModal.session) return;
    try {
      await http.delete(`/api/classes/sessions/${deleteSessionModal.session.id}`);
      setDeleteSessionModal({ open: false, session: null }); fetchData();
    } catch (err) { alert(err?.response?.data?.error || 'Failed to delete session'); }
  };

  const onDeleteSessionClick = (s) => {
    if (isAdmin && s.is_recurring && s.recurrence_id) {
      setRecurDeleteModal({ open: true, session: s, scope: 'this' });
    } else {
      setDeleteSessionModal({ open: true, session: s });
    }
  };

  const handleReschedule = async () => {
    const s = rescheduleModal.session;
    if (!s) return;
    setRescheduleSaving(true);
    try {
      const payload = {};
      if (rescheduleForm.title)       payload.title       = rescheduleForm.title;
      if (rescheduleForm.sessionDate) payload.sessionDate = rescheduleForm.sessionDate;
      if (rescheduleForm.startTime && rescheduleForm.sessionDate)
        payload.startTime = toTimetzFromLocal(rescheduleForm.sessionDate, rescheduleForm.startTime);
      if (rescheduleForm.endTime && rescheduleForm.sessionDate)
        payload.endTime = toTimetzFromLocal(rescheduleForm.sessionDate, rescheduleForm.endTime);
      if (s.is_recurring && s.recurrence_id && rescheduleForm.recurMode !== 'this') {
        payload.recurMode    = rescheduleForm.recurMode;
        payload.recurrenceId = s.recurrence_id;
        payload.originalDate = s.session_date;
      }
      await http.patch(`/api/admin/sessions/${s.id}`, payload);
      setRescheduleModal({ open: false, session: null });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to reschedule session');
    } finally { setRescheduleSaving(false); }
  };

  const handleRecurDelete = async () => {
    const { session, scope } = recurDeleteModal;
    if (!session) return;
    setRecurDeleting(true);
    try {
      const params = new URLSearchParams({ mode: scope });
      if (scope !== 'this' && session.recurrence_id) {
        params.set('recurrenceId', session.recurrence_id);
        params.set('sessionDate', session.session_date || '');
      }
      await http.delete(`/api/admin/sessions/${session.id}?${params}`);
      setRecurDeleteModal({ open: false, session: null, scope: 'this' });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete session');
    } finally { setRecurDeleting(false); }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignModal.assign) return;
    try {
      await http.delete(`/api/assignments/${deleteAssignModal.assign.id}`);
      setDeleteAssignModal({ open: false, assign: null }); fetchData();
    } catch (err) { alert(err?.response?.data?.error || 'Failed to delete assignment'); }
  };

  // Quiz creation is admin-only. Assignments/materials can be created by any allocated teacher.
  const teacherPermission = subject?.permission_level; // 'read' | 'write' | undefined
  const canCreateQuiz    = isAdmin;
  const canCreateContent = isAdmin || userRole === 'teacher'; // all teachers can create assignments/materials

  // Helper: count how many students have a content item assigned
  const assignedCount = (type, itemId) =>
    contentAssignments.filter(a => a.content_type === type && a.content_id === itemId).length;

  // Helper: count distinct assigners for a content item
  const assignedByCount = (type, itemId) =>
    new Set(contentAssignments.filter(a => a.content_type === type && a.content_id === itemId).map(a => a.assigned_by)).size;

  // Get all assignment rows for a detail popup
  const getItemAssignments = (type, itemId) =>
    contentAssignments.filter(a => a.content_type === type && a.content_id === itemId);

  // Open permissions modal for a quiz and fetch its current per-quiz write permissions
  const openPermissionsModal = async (item, type) => {
    setPermissionsModal({ open: true, item, type });
    setQuizPermissions([]);
    if (type === 'quiz') {
      setQuizPermissionsLoading(true);
      try {
        const res = await http.get(`/api/quizzes/${item.id}/permissions`);
        setQuizPermissions(res.data || []);
      } catch (err) { console.error('[quiz permissions]', err); }
      finally { setQuizPermissionsLoading(false); }
    }
  };

  const handleGrantQuizWrite = async (teacherId) => {
    if (!permissionsModal.item) return;
    setPermissionsSaving(prev => ({ ...prev, [teacherId]: 'grant' }));
    try {
      await http.post(`/api/quizzes/${permissionsModal.item.id}/permissions`, { teacherId });
      const res = await http.get(`/api/quizzes/${permissionsModal.item.id}/permissions`);
      setQuizPermissions(res.data || []);
      fetchData(); // refresh write_teacher_count in quiz list
    } catch (err) { console.error('[grant quiz write]', err); }
    finally { setPermissionsSaving(prev => ({ ...prev, [teacherId]: false })); }
  };

  const handleRevokeQuizWrite = async (teacherId) => {
    if (!permissionsModal.item) return;
    setPermissionsSaving(prev => ({ ...prev, [teacherId]: 'revoke' }));
    try {
      await http.delete(`/api/quizzes/${permissionsModal.item.id}/permissions/${teacherId}`);
      setQuizPermissions(prev => prev.filter(p => p.teacher_id !== teacherId));
      fetchData();
    } catch (err) { console.error('[revoke quiz write]', err); }
    finally { setPermissionsSaving(prev => ({ ...prev, [teacherId]: false })); }
  };

  const handleDeleteQuiz = async () => {
    if (!deleteQuizModal.quiz) return;
    try {
      await http.delete(`/api/quizzes/${deleteQuizModal.quiz.id}`);
      setDeleteQuizModal({ open: false, quiz: null });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete quiz');
    }
  };

  const toggleQuizPublish = async (quizId, current) => {
    try {
      await http.patch(`/api/quizzes/${quizId}/publish`, { is_published: !current });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAssignFileUpload = useCallback(async (file) => {
    if (!file) return;
    setAssignUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await http.post('/api/upload/assignment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAssignForm(f => ({ ...f, attachment_url: res.data.url }));
      setAssignFileName(res.data.name || file.name);
    } catch (err) {
      setAssignError(err?.response?.data?.error || 'File upload failed');
    } finally {
      setAssignUploading(false);
    }
  }, []);

  const handleCreateAssignment = async (e) => {
    e.preventDefault(); setAssignError('');
    if (!assignForm.title) { setAssignError('Title is required'); return; }
    if (!assignForm.topicId) { setAssignError('Topic is required'); return; }
    setAssignSaving(true);
    try {
      const payload = {
        subjectId,
        title: assignForm.title,
        description: assignForm.description,
        duration_days: assignForm.duration_days ? Number(assignForm.duration_days) : undefined,
        max_marks: Number(assignForm.max_marks),
        attachment_url: assignForm.attachment_url || undefined,
        topicId: assignForm.topicId || undefined,
        assignedTo: assignForm.assignedTo || undefined,
      };
      if (editingAssignment) {
        await http.put(`/api/assignments/${editingAssignment.id}`, payload);
      } else {
        await http.post('/api/assignments', payload);
      }
      setAssignOpen(false);
      setEditingAssignment(null);
      setAssignForm({ title: '', description: '', duration_days: '', max_marks: 100, attachment_url: '', topicId: '', assignedTo: '' });
      setAssignFileName('');
      fetchData();
    } catch (err) {
      setAssignError(err?.response?.data?.error || 'Failed to save assignment');
    } finally { setAssignSaving(false); }
  };

  const openEditAssignment = (a) => {
    setEditingAssignment(a);
    setAssignForm({
      title: a.title || '',
      description: a.description || '',
      duration_days: a.duration_days || '',
      max_marks: a.max_marks || 100,
      attachment_url: a.attachment_url || '',
      topicId: a.topic_id || '',
      assignedTo: a.assigned_to || '',
    });
    setAssignFileName(a.attachment_url ? a.attachment_url.split('/').pop() : '');
    setAssignError('');
    setAssignOpen(true);
  };

  const toggleAssignPublish = async (assignId, current) => {
    try {
      await http.patch(`/api/assignments/${assignId}/publish`, { is_published: !current });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const toggleMaterialPublish = async (matId, current) => {
    try {
      await http.patch(`/api/materials/${matId}/publish`, { is_published: !current });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const openAssignContentModal = (type, item) => {
    setAssignContentModal({ open: true, type, item });
    setAssignContentIds([]);
    setAssignContentError('');
  };

  const handleAssignContent = async () => {
    if (assignContentIds.length === 0) {
      setAssignContentError('Select at least one student'); return;
    }
    setAssignContentSaving(true); setAssignContentError('');
    try {
      await http.post('/api/content-assignments', {
        subjectId,
        contentType: assignContentModal.type,
        contentId:   assignContentModal.item.id,
        studentIds:  assignContentIds,
      });
      setAssignContentModal({ open: false, type: '', item: null });
      setAssignContentIds([]);
      fetchData();
    } catch (err) {
      setAssignContentError(err?.response?.data?.error || 'Failed to assign');
    } finally { setAssignContentSaving(false); }
  };

  const handleRevokeContentAssignment = async (assignmentId) => {
    try {
      await http.delete(`/api/content-assignments/${assignmentId}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const loadSubmissions = async (assignId, title) => {
    setViewSubs(assignId); setViewSubsTitle(title || ''); setGradingId(null);
    const res = await http.get(`/api/assignments/${assignId}/submissions`);
    setSubmissions(res.data || []);
  };

  const handleGrade = async (subId) => {
    try {
      await http.patch(`/api/assignments/submissions/${subId}/grade`, {
        marks_awarded: Number(gradeForm.marks), feedback: gradeForm.feedback,
        feedback_file_url: gradeForm.feedback_file_url || undefined,
      });
      setGradingId(null); setGradeForm({ marks: '', feedback: '', feedback_file_url: '' });
      setGradeFileName('');
      loadSubmissions(viewSubs);
    } catch (err) { console.error(err); }
  };

  const handleGradeFileUpload = useCallback(async (file) => {
    if (!file) return;
    setGradeUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await http.post('/api/upload/assignment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setGradeForm(f => ({ ...f, feedback_file_url: res.data.url }));
      setGradeFileName(res.data.name || file.name);
    } catch (err) {
      console.error('Upload failed', err);
    } finally { setGradeUploading(false); }
  }, []);

  // ---- Topics CRUD ----
  const openCreateTopic = () => {
    setEditingTopic(null);
    setTopicForm({ name: '', description: '', order_index: topics.length });
    setTopicError('');
    setTopicModal(true);
  };

  const openEditTopic = (topic) => {
    setEditingTopic(topic);
    setTopicForm({ name: topic.name, description: topic.description || '', order_index: topic.order_index });
    setTopicError('');
    setTopicModal(true);
  };

  const handleSaveTopic = async (e) => {
    e.preventDefault();
    setTopicError('');
    if (!topicForm.name.trim()) { setTopicError('Topic name is required'); return; }
    setTopicSaving(true);
    try {
      if (editingTopic) {
        await http.patch(`/api/subjects/${subjectId}/topics/${editingTopic.id}`, topicForm);
      } else {
        await http.post(`/api/subjects/${subjectId}/topics`, { ...topicForm, order_index: Number(topicForm.order_index) || 0 });
      }
      setTopicModal(false);
      fetchData();
    } catch (err) {
      setTopicError(err?.response?.data?.error || 'Failed to save topic');
    } finally {
      setTopicSaving(false);
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Delete this topic? Questions tagged to it will be untagged.')) return;
    setTopicDeleting(topicId);
    try {
      await http.delete(`/api/subjects/${subjectId}/topics/${topicId}`);
      fetchData();
    } catch (err) {
      console.error('[topic delete]', err);
    } finally {
      setTopicDeleting(null);
    }
  };

  const formatTimetz = (timetz) => {
    if (!timetz) return '';
    const [h, m] = timetz.slice(0, 5).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const canStartSession = (s) => {
    if (['COMPLETED', 'MISSED'].includes(s.status)) return false;
    return (new Date(s.scheduled_at) - Date.now()) / 60000 <= 5;
  };

  const navSessionDate = (offset) => {
    const [yr, mo, dy] = sessionDateStr.split('-').map(Number);
    const d = new Date(yr, mo - 1, dy + offset);
    setSessionDateStr(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };

  const sessionTeachers = isAdmin ? [...new Map(
    sessions.filter(s => s.teacher_id && s.teacher_name).map(s => [s.teacher_id, s.teacher_name])
  ).entries()] : [];

  const sessionDaySessions = sessions
    .filter(s => (s.session_date || s.scheduled_at?.slice(0, 10)) === sessionDateStr)
    .filter(s => sessStatusFilter  === 'all' || s.status    === sessStatusFilter)
    .filter(s => sessTopicFilter   === 'all' || s.topic_id  === sessTopicFilter)
    .filter(s => !isAdmin || sessTeacherFilter === 'all' || s.teacher_id === sessTeacherFilter)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const TABS = [
    { key: 'topics',      label: 'Topics',      count: topics.length },
    { key: 'sessions',    label: 'Sessions',     count: sessions.length },
    { key: 'quizzes',     label: 'Practice',     count: quizzes.length },
    { key: 'assignments', label: 'Assignments',  count: assignments.length },
    { key: 'materials',   label: 'Materials',    count: materials.length },
  ];

  if (loading) return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>
        <Row><Col><Card className="shadow" style={{ borderRadius: 14, border: 'none' }}><CardBody className="py-5"><TopicCardSkeleton count={6} /></CardBody></Card></Col></Row>
      </Container>
    </>
  );

  return (
    <>
      <Header />
      <Container className="mt--7" fluid style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30, paddingBottom: 30 }}>

        {/* Subject header */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow-lg" style={{ borderRadius: 16, overflow: 'hidden', border: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg, #32325d 0%, #44467a 100%)', padding: '24px 28px 20px' }}>
                <div className="d-flex align-items-start justify-content-between flex-wrap" style={{ gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <button onClick={() => navigate(-1)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                      ‹
                    </button>
                    <div>
                      <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>{subject?.title || 'Subject'}</h2>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                          {subject?.course_name}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: 'rgba(255,255,255,.9)', padding: '2px 10px', borderRadius: 6 }}>
                          {subject?.code}
                        </span>
                        {!isAdmin && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>
                            {teacherPermission === 'write' ? 'Write access' : 'Read-only'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="sm" style={{ borderRadius: 8, fontWeight: 600, background: '#2dce89', border: 'none', color: '#fff' }} onClick={() => setScheduleOpen(true)}>+ Session</Button>
                    {canCreateQuiz && (
                      <Button size="sm" style={{ borderRadius: 8, fontWeight: 600, background: '#5e72e4', border: 'none', color: '#fff' }}
                        onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                        + Practice
                      </Button>
                    )}
                    {canCreateContent && (
                      <>
                        <Button size="sm" style={{ borderRadius: 8, fontWeight: 600, background: '#fb6340', border: 'none', color: '#fff' }} onClick={() => { setEditingAssignment(null); setAssignForm({ title: '', description: '', duration_days: '', max_marks: 100, attachment_url: '', topicId: '', assignedTo: '' }); setAssignFileName(''); setAssignOpen(true); }}>+ Assignment</Button>
                        <Button size="sm" style={{ borderRadius: 8, fontWeight: 600, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', color: '#fff' }} onClick={() => setMatModalOpen(true)}>+ Material</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {actionError && <Row className="mb-2"><Col><div className="alert alert-danger py-2">{actionError}</div></Col></Row>}

        {/* Tab nav */}
        <Row className="mb-4">
          <Col>
            <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 11, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13, transition: 'all .15s ease',
                    background: isActive ? '#5e72e4' : 'transparent',
                    color: isActive ? '#fff' : '#525f7f',
                    boxShadow: isActive ? '0 4px 12px rgba(94,114,228,.35)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {t.label}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
                      background: isActive ? 'rgba(255,255,255,.2)' : '#f0f2f5',
                      color: isActive ? '#fff' : '#8898aa',
                    }}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </Col>
        </Row>

        {/* ---- TOPICS TAB ---- */}
        {tab === 'topics' && (
          <Row>
            <Col lg="8">
              <Card className="shadow" style={{ borderRadius: 14, border: 'none' }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#f0f4ff,#e8edff)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <CardTitle className="mb-0" style={{ color: '#32325d', fontSize: 16, fontWeight: 700 }}>Topics</CardTitle>
                      <small style={{ color: '#8898aa', fontSize: 12 }}>Organize content for students navigating this subject</small>
                    </div>
                    {isAdmin && (
                      <Button color="primary" size="sm" style={{ borderRadius: 8, fontWeight: 700 }} onClick={openCreateTopic}>
                        + Add Topic
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  {topics.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                      <p className="text-muted mb-3">No topics yet. {isAdmin ? 'Add topics so students can navigate this subject.' : 'Contact admin to add topics.'}</p>
                      {isAdmin && <Button color="primary" size="sm" style={{ borderRadius: 8 }} onClick={openCreateTopic}>Add First Topic</Button>}
                    </div>
                  ) : (
                    <div>
                      {topics.map((topic, idx) => (
                        <div key={topic.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                          borderBottom: idx < topics.length - 1 ? '1px solid #f0f4f8' : 'none',
                          background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                        }}>
                          {/* Order badge */}
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg,#5e72e4,#825ee4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: 13,
                          }}>
                            {idx + 1}
                          </div>
                          {/* Topic info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#32325d', fontSize: 14 }}>{topic.name}</div>
                            {topic.description && (
                              <div className="text-muted small mt-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {topic.description}
                              </div>
                            )}
                          </div>
                          {/* Actions - Admin only */}
                          {isAdmin && (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11, padding: '3px 12px' }}
                                onClick={() => openEditTopic(topic)}>
                                ✏️ Edit
                              </Button>
                              <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11, padding: '3px 12px' }}
                                disabled={topicDeleting === topic.id}
                                onClick={() => handleDeleteTopic(topic.id)}>
                                {topicDeleting === topic.id ? '...' : '🗑 Delete'}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Info box */}
              <div style={{ marginTop: 16, padding: '14px 18px', background: 'linear-gradient(135deg,#eef0fd,#e8ebff)', borderRadius: 12, border: 'none', boxShadow: '0 1px 4px rgba(94,114,228,.08)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, marginTop: 1 }}>💡</span>
                  <div style={{ fontSize: 12, color: '#525f7f', lineHeight: 1.6 }}>
                    <strong style={{ color: '#32325d' }}>How topics work:</strong> Students see the topic grid when they open this subject.
                    Each topic links to sessions, practice, assignments, and materials. Topics can also be tagged to quiz questions.
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        )}

        {/* ---- SESSIONS TAB ---- */}
        {tab === 'sessions' && (
          <Row>
            <Col className="mb-4">
              <Card className="shadow" style={{ borderRadius: 14, border: 'none' }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#eaf3ff,#dfe8ff)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  {/* Row 1: title + date nav */}
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10, marginBottom: 10 }}>
                    <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>Sessions</CardTitle>
                    <div className="d-flex align-items-center" style={{ gap: 6 }}>
                      <button onClick={() => navSessionDate(-1)}
                        style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ‹
                      </button>
                      <input type="date" value={sessionDateStr}
                        onChange={e => e.target.value && setSessionDateStr(e.target.value)}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 13 }} />
                      <button onClick={() => navSessionDate(1)}
                        style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ›
                      </button>
                      {sessionDateStr !== getTodayLocalDateKey() && (
                        <button onClick={() => setSessionDateStr(getTodayLocalDateKey())}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #5e72e4', background: 'transparent', color: '#5e72e4', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Today
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Row 2: filters */}
                  <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                    <select className="filter-select" value={sessStatusFilter} onChange={e => setSessStatusFilter(e.target.value)}>
                      <option value="all">All Status</option>
                      <option value="LIVE">Live</option>
                      <option value="TODAY">Today</option>
                      <option value="TOMORROW">Tomorrow</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="MISSED">Missed</option>
                    </select>
                    <select className="filter-select" value={sessTopicFilter} onChange={e => setSessTopicFilter(e.target.value)}>
                      <option value="all">All Topics</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {isAdmin && sessionTeachers.length > 0 && (
                      <select className="filter-select" value={sessTeacherFilter} onChange={e => setSessTeacherFilter(e.target.value)}>
                        <option value="all">All Teachers</option>
                        {sessionTeachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    )}
                    {(sessStatusFilter !== 'all' || sessTopicFilter !== 'all' || sessTeacherFilter !== 'all') && (
                      <button onClick={() => { setSessStatusFilter('all'); setSessTopicFilter('all'); setSessTeacherFilter('all'); }}
                        style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f5365c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardBody style={{ padding: '16px 20px' }}>
                  {sessionDaySessions.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                      <p className="text-muted">
                        No sessions on {new Date(sessionDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                      <Button color="success" size="sm" style={{ borderRadius: 8 }} onClick={() => setScheduleOpen(true)}>
                        + Schedule a Session
                      </Button>
                    </div>
                  ) : (
                    sessionDaySessions.map(s => {
                      const borderColor = { LIVE: '#f5365c', TODAY: '#fb6340', TOMORROW: '#11cdef', SCHEDULED: '#5e72e4', COMPLETED: '#8898aa', MISSED: '#fb6340' }[s.status] || '#5e72e4';
                      const startDisplay = s.start_time ? formatTimetz(s.start_time) : new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const endDisplay   = s.end_time ? formatTimetz(s.end_time) : null;
                      const isStartable  = canStartSession(s);
                      const isLive       = s.status === 'LIVE';
                      return (
                        <div key={s.id} className="mb-3 bg-white border rounded shadow-sm"
                          style={{ borderLeft: `4px solid ${borderColor}`, padding: '14px 16px' }}>
                          <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 10 }}>
                            {/* Left: session info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Title + badges */}
                              <div className="d-flex align-items-center flex-wrap" style={{ gap: 6, marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#32325d' }}>{s.title}</span>
                                {s.is_recurring && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#eef0fd', color: '#5e72e4', padding: '2px 7px', borderRadius: 10 }}>↺ RECURRING</span>
                                )}
                                {statusBadge(s.status)}
                              </div>
                              {/* Details */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 12, color: '#525f7f' }}>
                                {s.course_name && <span>📚 {s.course_name}</span>}
                                {s.class_title && <span>📋 {s.class_title}</span>}
                                {isAdmin && s.teacher_name && <span>👤 {s.teacher_name}</span>}
                                {s.topic_name && <span style={{ color: '#5e72e4', fontWeight: 600 }}>📌 {s.topic_name}</span>}
                                <span>⏰ {startDisplay}{endDisplay ? ` – ${endDisplay}` : ''}</span>
                                {s.target_count > 0
                                  ? <span>👥 {s.target_count} student{s.target_count !== 1 ? 's' : ''} targeted</span>
                                  : <span>👥 All enrolled students</span>}
                                {s.is_recurring && s.recur_until && (
                                  <span>📅 Until {new Date(s.recur_until + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                )}
                              </div>
                            </div>
                            {/* Right: action buttons */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              {isLive && s.zoom_link && (
                                <Button size="sm" color="danger" style={{ borderRadius: 8, fontWeight: 700 }}
                                  onClick={() => window.open(s.zoom_link, '_blank')}>
                                  Join Live
                                </Button>
                              )}
                              {!isLive && !['COMPLETED', 'MISSED'].includes(s.status) && (
                                <Button size="sm"
                                  color={isStartable ? 'success' : 'secondary'}
                                  disabled={!isStartable || startingSession === s.id}
                                  title={isStartable ? 'Start this session' : 'Available 5 min before start time'}
                                  style={{ borderRadius: 8, fontWeight: 700, opacity: isStartable ? 1 : 0.55, cursor: isStartable ? 'pointer' : 'not-allowed' }}
                                  onClick={() => { if (isStartable) handleStart(s.id); }}>
                                  {startingSession === s.id ? '...' : 'Start Session'}
                                </Button>
                              )}
                              {isLive && (
                                <Button size="sm" color="warning" style={{ borderRadius: 8, fontWeight: 700 }}
                                  disabled={startingSession === s.id}
                                  onClick={() => handleEnd(s.id)}>
                                  {startingSession === s.id ? '...' : 'End Session'}
                                </Button>
                              )}
                              {isAdmin && !['COMPLETED', 'MISSED'].includes(s.status) && (
                                <Button size="sm" color="info" outline style={{ borderRadius: 8, fontSize: 11 }}
                                  onClick={() => {
                                    setRescheduleModal({ open: true, session: s });
                                    setRescheduleForm({
                                      title:       s.title,
                                      sessionDate: s.session_date || s.scheduled_at?.slice(0, 10) || '',
                                      startTime:   s.start_time?.slice(0, 5) || '',
                                      endTime:     s.end_time?.slice(0, 5)   || '',
                                      recurMode:   'this',
                                    });
                                  }}>
                                  Reschedule
                                </Button>
                              )}
                              {isAdmin && (
                                <Button size="sm" color="danger" outline style={{ borderRadius: 8, fontSize: 11 }}
                                  onClick={() => onDeleteSessionClick(s)}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* ---- QUIZZES TAB ---- */}
        {tab === 'quizzes' && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 14, border: 'none' }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#f0ecff,#e8e0ff)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>Practice Sets</CardTitle>
                    {canCreateQuiz && (
                      <Button color="primary" size="sm" style={{ borderRadius: 8 }}
                        onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                        + Create Practice Set
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  {quizzes.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No practice sets yet{canCreateQuiz ? '' : ' — contact admin to create content'}</p>
                      {canCreateQuiz && (
                        <Button color="primary" size="sm"
                          onClick={() => navigate('/admin/quiz-builder', { state: { subjectId, subjectName: subject?.title } })}>
                          Create First Practice Set
                        </Button>
                      )}
                    </div>
                  ) : (
                    <table className="subject-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          {['Title', 'Topic', 'Type', 'Questions', 'Duration', 'Status', 'Assigned By', 'Assigned To', 'Actions'].map((h) => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((q) => {
                          const aTo  = assignedCount('quiz', q.id);
                          const aBy  = assignedByCount('quiz', q.id);
                          return (
                            <tr key={q.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>{q.title}</td>
                              <td style={{ padding: '12px 14px' }}>
                                {q.topic_name
                                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {q.topic_name}</span>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                  background: q.quiz_type === 'test' ? '#fde8ec' : '#e3f9fc',
                                  color: q.quiz_type === 'test' ? '#f5365c' : '#11cdef' }}>
                                  {q.quiz_type}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.question_count}</td>
                              <td style={{ padding: '12px 14px', color: '#525f7f' }}>{q.duration_minutes ? `${q.duration_minutes}m` : '∞'}</td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                  background: q.is_published ? '#d4edda' : '#fff3cd',
                                  color: q.is_published ? '#155724' : '#856404' }}>
                                  {q.is_published ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {aBy > 0
                                  ? <button type="button" onClick={() => setDetailModal({ open: true, field: 'by', contentType: 'quiz', itemId: q.id, itemTitle: q.title })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#5e72e4', fontWeight: 700, fontSize: 13 }}>
                                      {aBy} teacher{aBy !== 1 ? 's' : ''}
                                    </button>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {aTo > 0
                                  ? <button type="button" onClick={() => setDetailModal({ open: true, field: 'to', contentType: 'quiz', itemId: q.id, itemTitle: q.title })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2dce89', fontWeight: 700, fontSize: 13 }}>
                                      {aTo} student{aTo !== 1 ? 's' : ''}
                                    </button>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {/* Write-access badge: show how many teachers have per-quiz write (admin only) */}
                                  {isAdmin && q.write_teacher_count > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                      background: '#fff3cd', color: '#856404', cursor: 'pointer' }}
                                      title="Teachers with write access to this quiz"
                                      onClick={() => openPermissionsModal(q, 'quiz')}>
                                      ✏️ {q.write_teacher_count} writer{q.write_teacher_count !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {/* View as Student — always visible for staff */}
                                  <Button size="sm" color="light" outline style={{ borderRadius: 20, fontSize: 11 }}
                                    onClick={() => navigate(`/admin/quiz/${q.id}`, { state: { previewMode: true } })}>
                                    👁 Preview
                                  </Button>
                                  {/* Edit: admin always, teacher if can_edit (subject-level or per-quiz write) */}
                                  {q.can_edit && (
                                    <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => navigate('/admin/quiz-builder', {
                                        state: { subjectId, subjectName: subject?.title, editQuizId: q.id }
                                      })}>
                                      Edit
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color={q.is_published ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => toggleQuizPublish(q.id, q.is_published)}>
                                      {q.is_published ? 'Unpublish' : 'Publish'}
                                    </Button>
                                  )}
                                  {(isAdmin || userRole === 'teacher') && (
                                    <Button size="sm" color="primary" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openAssignContentModal('quiz', q)}>
                                      Assign
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color="secondary" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openPermissionsModal(q, 'quiz')}>
                                      Permissions
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => setDeleteQuizModal({ open: true, quiz: q })}>
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* ---- ASSIGNMENTS TAB ---- */}
        {tab === 'assignments' && (() => {
          const filteredAssigns = assignments.filter(a => {
            if (assignFilterTitle && !a.title.toLowerCase().includes(assignFilterTitle.toLowerCase())) return false;
            if (assignFilterTopic !== 'all' && a.topic_id !== assignFilterTopic) return false;
            if (assignFilterDuration !== 'all') {
              if (assignFilterDuration === 'none') { if (a.duration_days) return false; }
              else { if (String(a.duration_days) !== assignFilterDuration) return false; }
            }
            if (assignFilterStatus !== 'all') {
              if (assignFilterStatus === 'published' && !a.is_published) return false;
              if (assignFilterStatus === 'draft' && a.is_published) return false;
            }
            if (assignFilterCreator !== 'all' && a.created_by !== assignFilterCreator) return false;
            if (assignFilterStudent !== 'all') {
              const isAssignedToStudent = contentAssignments.some(
                ca => ca.content_type === 'assignment' && ca.content_id === a.id && ca.student_id === assignFilterStudent
              );
              if (!isAssignedToStudent) return false;
            }
            if (assignFilterAssigned !== 'all') {
              const hasAssignees = contentAssignments.some(
                ca => ca.content_type === 'assignment' && ca.content_id === a.id
              );
              if (assignFilterAssigned === 'assigned' && !hasAssignees) return false;
              if (assignFilterAssigned === 'not_assigned' && hasAssignees) return false;
            }
            return true;
          });
          return (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 14, border: 'none' }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#fff5ec,#ffe8d6)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center" style={{ gap: 10 }}>
                      <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>Assignments</CardTitle>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#5e72e4', color: '#fff' }}>
                        {filteredAssigns.length}{filteredAssigns.length !== assignments.length ? ` / ${assignments.length}` : ''}
                      </span>
                    </div>
                    {canCreateContent && (
                      <Button color="warning" size="sm" style={{ borderRadius: 8 }} onClick={() => { setEditingAssignment(null); setAssignForm({ title: '', description: '', duration_days: '', max_marks: 100, attachment_url: '', topicId: '', assignedTo: '' }); setAssignFileName(''); setAssignOpen(true); }}>
                        + Create Assignment
                      </Button>
                    )}
                  </div>
                  {assignments.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, padding: '10px 0 2px' }}>
                      <input
                        type="text" placeholder="Search title..."
                        className="filter-input"
                        value={assignFilterTitle} onChange={e => setAssignFilterTitle(e.target.value)}
                      />
                      <select className="filter-select" value={assignFilterTopic} onChange={e => setAssignFilterTopic(e.target.value)}>
                        <option value="all">All Topics</option>
                        {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select className="filter-select" value={assignFilterDuration} onChange={e => setAssignFilterDuration(e.target.value)}>
                        <option value="all">All Durations</option>
                        <option value="3">3 Days</option>
                        <option value="5">5 Days</option>
                        <option value="7">1 Week</option>
                        <option value="10">10 Days</option>
                        <option value="14">2 Weeks</option>
                        <option value="21">3 Weeks</option>
                        <option value="30">1 Month</option>
                        <option value="45">45 Days</option>
                        <option value="60">2 Months</option>
                        <option value="none">No Duration</option>
                      </select>
                      <select className="filter-select" value={assignFilterStatus} onChange={e => setAssignFilterStatus(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                      </select>
                      <select className="filter-select" value={assignFilterCreator} onChange={e => setAssignFilterCreator(e.target.value)}>
                        <option value="all">All Creators</option>
                        {[...new Map(assignments.filter(a => a.creator_name).map(a => [a.created_by, a.creator_name])).entries()].map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                      <select className="filter-select" value={assignFilterStudent} onChange={e => setAssignFilterStudent(e.target.value)}>
                        <option value="all">All Students</option>
                        {subjectStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                        ))}
                      </select>
                      <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #dee2e6' }}>
                        {[['all', 'All'], ['assigned', 'Assigned'], ['not_assigned', 'Not Assigned']].map(([val, label]) => (
                          <button key={val} onClick={() => setAssignFilterAssigned(val)}
                            style={{
                              padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                              background: assignFilterAssigned === val ? '#5e72e4' : '#fff',
                              color: assignFilterAssigned === val ? '#fff' : '#525f7f',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {(assignFilterTitle || assignFilterTopic !== 'all' || assignFilterDuration !== 'all' || assignFilterStatus !== 'all' || assignFilterCreator !== 'all' || assignFilterStudent !== 'all' || assignFilterAssigned !== 'all') && (
                        <button onClick={() => { setAssignFilterTitle(''); setAssignFilterTopic('all'); setAssignFilterDuration('all'); setAssignFilterStatus('all'); setAssignFilterCreator('all'); setAssignFilterStudent('all'); setAssignFilterAssigned('all'); }}
                          style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f5365c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'opacity .12s' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardBody>
                  {assignments.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No assignments yet.</p>
                      {canCreateContent && <Button color="warning" size="sm" onClick={() => { setEditingAssignment(null); setAssignForm({ title: '', description: '', duration_days: '', max_marks: 100, attachment_url: '', topicId: '', assignedTo: '' }); setAssignFileName(''); setAssignOpen(true); }}>Create First</Button>}
                    </div>
                  ) : filteredAssigns.length === 0 ? (
                    <p className="text-muted text-center py-3">No assignments match the filters.</p>
                  ) : (
                    <table className="subject-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          {['S.No', 'Title', 'Topic', 'Duration', 'Points', 'Status', 'Created By', 'Submissions', 'Assigned By', 'Assigned To', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssigns.map((a, idx) => {
                          const aTo = assignedCount('assignment', a.id);
                          const aBy = assignedByCount('assignment', a.id);
                          const durationLabel = a.duration_days
                            ? a.duration_days === 7 ? '1 Week'
                              : a.duration_days === 14 ? '2 Weeks'
                              : a.duration_days === 21 ? '3 Weeks'
                              : a.duration_days === 30 ? '1 Month'
                              : `${a.duration_days} Days`
                            : '—';
                          return (
                            <tr key={a.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 600, color: '#8898aa', fontSize: 12 }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '12px 14px', fontWeight: 600, color: '#32325d' }}>
                                {a.title}
                                {a.description && <div className="small text-muted mt-1">{a.description}</div>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {a.topic_name
                                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>{a.topic_name}</span>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 12, whiteSpace: 'nowrap' }}>
                                {durationLabel}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f' }}>{a.max_marks}</td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                  background: a.is_published ? '#d4edda' : '#fff3cd',
                                  color: a.is_published ? '#155724' : '#856404' }}>
                                  {a.is_published ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f', fontSize: 12 }}>
                                {a.creator_name || '—'}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#525f7f' }}>
                                <button type="button" onClick={() => loadSubmissions(a.id, a.title)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fb6340', fontWeight: 700, fontSize: 13 }}>
                                  {a.submission_count || 0}
                                </button>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {aBy > 0
                                  ? <button type="button" onClick={() => setDetailModal({ open: true, field: 'by', contentType: 'assignment', itemId: a.id, itemTitle: a.title })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#5e72e4', fontWeight: 700, fontSize: 13 }}>
                                      {aBy} teacher{aBy !== 1 ? 's' : ''}
                                    </button>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {aTo > 0
                                  ? <button type="button" onClick={() => setDetailModal({ open: true, field: 'to', contentType: 'assignment', itemId: a.id, itemTitle: a.title })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2dce89', fontWeight: 700, fontSize: 13 }}>
                                      {aTo} student{aTo !== 1 ? 's' : ''}
                                    </button>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11 }}
                                    onClick={() => setPreviewAssign(a)}>
                                    Preview
                                  </Button>
                                  {(isAdmin || (a.created_by === userId && (!a.is_published || teacherPermission === 'write'))) && (
                                    <Button size="sm" color="default" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openEditAssignment(a)}>
                                      Edit
                                    </Button>
                                  )}
                                  {(a.is_published || isAdmin || a.created_by === userId) && (
                                    <Button size="sm" color="primary" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openAssignContentModal('assignment', a)}>
                                      Assign
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color="secondary" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openPermissionsModal(a, 'assignment')}>
                                      Permissions
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color={a.is_published ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => toggleAssignPublish(a.id, a.is_published)}>
                                      {a.is_published ? 'Unpublish' : 'Publish'}
                                    </Button>
                                  )}
                                  {(isAdmin || (a.created_by === userId && !a.is_published)) && (
                                    <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => setDeleteAssignModal({ open: true, assign: a })}>
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardBody>
              </Card>

              {/* Submissions panel removed — moved to modal below */}
            </Col>
          </Row>
          );
        })()}

        {/* ---- MATERIALS TAB ---- */}
        {tab === 'materials' && (
          <Row>
            <Col>
              <Card className="shadow" style={{ borderRadius: 14, border: 'none' }}>
                <CardHeader style={{ background: 'linear-gradient(135deg,#e8fff0,#d6f5e0)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: '18px 22px' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <CardTitle className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#32325d' }}>Study Materials</CardTitle>
                    {canCreateContent && (
                      <Button color="secondary" size="sm" style={{ borderRadius: 8 }} onClick={() => setMatModalOpen(true)}>
                        + Add Material
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  {materials.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No materials yet. Add PDFs, videos, or links.</p>
                      {canCreateContent && <Button color="secondary" size="sm" onClick={() => setMatModalOpen(true)}>Add First Material</Button>}
                    </div>
                  ) : (
                    <table className="subject-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          {['Title', 'Type', 'Topic', 'Status', 'Assigned By', 'Assigned To', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map((m) => {
                          const typeIcon  = { pdf: '📄', video: '🎥', link: '🔗', doc: '📝', image: '🖼' }[m.material_type] || '📁';
                          const typeColor = { pdf: '#f5365c', video: '#825ee4', link: '#5e72e4', doc: '#fb6340', image: '#2dce89' }[m.material_type] || '#8898aa';
                          const mTo = assignedCount('material', m.id);
                          const mBy = assignedByCount('material', m.id);
                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <a href={m.file_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: '#32325d' }}>{m.title}</a>
                                {m.description && <div className="small text-muted mt-1">{m.description}</div>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontSize: 10, color: typeColor, fontWeight: 700, textTransform: 'uppercase', background: typeColor + '20', padding: '2px 8px', borderRadius: 10 }}>
                                  {typeIcon} {m.material_type}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {m.topic_name
                                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10 }}>📌 {m.topic_name}</span>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                  background: m.is_published ? '#d4edda' : '#fff3cd',
                                  color: m.is_published ? '#155724' : '#856404' }}>
                                  {m.is_published ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {mBy > 0
                                  ? <button type="button" onClick={() => setDetailModal({ open: true, field: 'by', contentType: 'material', itemId: m.id, itemTitle: m.title })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#5e72e4', fontWeight: 700, fontSize: 13 }}>
                                      {mBy} teacher{mBy !== 1 ? 's' : ''}
                                    </button>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {mTo > 0
                                  ? <button type="button" onClick={() => setDetailModal({ open: true, field: 'to', contentType: 'material', itemId: m.id, itemTitle: m.title })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2dce89', fontWeight: 700, fontSize: 13 }}>
                                      {mTo} student{mTo !== 1 ? 's' : ''}
                                    </button>
                                  : <span className="text-muted small">—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <Button size="sm" color="info" outline style={{ borderRadius: 20, fontSize: 11 }}
                                    onClick={() => setPreviewMat(m)}>
                                    Preview
                                  </Button>
                                  {(m.is_published || isAdmin || m.uploaded_by === userId) && (
                                    <Button size="sm" color="primary" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openAssignContentModal('material', m)}>
                                      Assign
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color="secondary" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => openPermissionsModal(m, 'material')}>
                                      Permissions
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="sm" color={m.is_published ? 'warning' : 'success'} outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => toggleMaterialPublish(m.id, m.is_published)}>
                                      {m.is_published ? 'Unpublish' : 'Publish'}
                                    </Button>
                                  )}
                                  {(isAdmin || (m.uploaded_by === userId && !m.is_published)) && (
                                    <Button size="sm" color="danger" outline style={{ borderRadius: 20, fontSize: 11 }}
                                      onClick={() => setDeleteMatModal({ open: true, mat: m })}>Remove</Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* Schedule Session Modal — upgraded with recurring + student checkboxes + teacher selector for admin */}
        <Modal isOpen={scheduleOpen} toggle={() => setScheduleOpen(false)} centered size="lg">
          <ModalHeader toggle={() => setScheduleOpen(false)}
            style={{ background: 'linear-gradient(135deg,#3b4a67,#6286c3)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            Schedule Session
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff', maxHeight: '75vh', overflowY: 'auto' }}>
            <Form onSubmit={handleSchedule}>
              {/* Teacher selector — admin only */}
              {isAdmin && (
                <FormGroup>
                  <Label><strong>Teacher *</strong></Label>
                  <Input type="select" value={scheduleForm.teacherId} onChange={e => setScheduleForm(f => ({ ...f, teacherId: e.target.value }))}>
                    <option value="">— Select teacher —</option>
                    {subjectTeachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </Input>
                </FormGroup>
              )}

              <FormGroup>
                <Label><strong>Title *</strong></Label>
                <Input value={scheduleForm.title} onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Algebra Basics" />
              </FormGroup>

              <Row form>
                <Col md={4}>
                  <FormGroup>
                    <Label><strong>Date *</strong></Label>
                    <Input type="date" value={scheduleForm.date} min={getTodayLocalDateKey()}
                      onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))} />
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label><strong>Start Time *</strong></Label>
                    <Input type="time" value={scheduleForm.time} onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))} />
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>End Time</Label>
                    <Input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm(f => ({ ...f, endTime: e.target.value }))} />
                  </FormGroup>
                </Col>
              </Row>

              <FormGroup>
                <Label>Topic</Label>
                <Input type="select" value={scheduleForm.topicId} onChange={e => setScheduleForm(f => ({ ...f, topicId: e.target.value }))}>
                  <option value="">— Select topic (optional) —</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Input>
              </FormGroup>

              {/* Student checkboxes */}
              {subjectStudents.length > 0 && (
                <FormGroup>
                  <Label>
                    <strong>Target Students</strong>{' '}
                    <span style={{ fontWeight: 400, color: '#8898aa', fontSize: 13 }}>(leave blank = all enrolled)</span>
                  </Label>
                  <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: 8, padding: 8, background: '#fff' }}>
                    {subjectStudents.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        <input type="checkbox" id={`ss-${s.id}`}
                          checked={scheduleForm.studentIds.includes(s.id)}
                          onChange={() => setScheduleForm(f => ({
                            ...f,
                            studentIds: f.studentIds.includes(s.id)
                              ? f.studentIds.filter(x => x !== s.id)
                              : [...f.studentIds, s.id],
                          }))} />
                        <label htmlFor={`ss-${s.id}`} style={{ margin: 0, cursor: 'pointer', fontSize: 13 }}>
                          {s.first_name} {s.last_name} <span style={{ color: '#8898aa' }}>({s.email})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </FormGroup>
              )}

              {/* Recurring toggle */}
              <FormGroup check className="mb-3">
                <Input type="checkbox" id="sf-recurring" checked={scheduleForm.isRecurring}
                  onChange={e => setScheduleForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                <Label check htmlFor="sf-recurring"><strong>Recurring session</strong></Label>
              </FormGroup>

              {scheduleForm.isRecurring && (
                <>
                  <FormGroup>
                    <Label>Repeat pattern</Label>
                    <div className="d-flex" style={{ gap: 16 }}>
                      {['daily', 'weekly'].map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="radio" name="sfPattern" value={p} checked={scheduleForm.recurPattern === p}
                            onChange={() => setScheduleForm(f => ({ ...f, recurPattern: p }))} />
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </label>
                      ))}
                    </div>
                  </FormGroup>

                  {scheduleForm.recurPattern === 'weekly' && (
                    <FormGroup>
                      <Label>Days of week <span style={{ color: '#8898aa', fontWeight: 400, fontSize: 13 }}>(blank = every day)</span></Label>
                      <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                        {DAY_LABELS.map((label, i) => (
                          <button key={i} type="button"
                            onClick={() => setScheduleForm(f => ({
                              ...f,
                              recurDays: f.recurDays.includes(i)
                                ? f.recurDays.filter(d => d !== i)
                                : [...f.recurDays, i],
                            }))}
                            style={{
                              width: 40, height: 40, borderRadius: 20, border: '2px solid',
                              borderColor: scheduleForm.recurDays.includes(i) ? '#5e72e4' : '#dee2e6',
                              background:  scheduleForm.recurDays.includes(i) ? '#5e72e4' : '#fff',
                              color:       scheduleForm.recurDays.includes(i) ? '#fff'    : '#525f7f',
                              fontWeight: 700, fontSize: 12, cursor: 'pointer',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </FormGroup>
                  )}

                  <FormGroup>
                    <Label><strong>Repeat until *</strong></Label>
                    <Input type="date" value={scheduleForm.recurEndDate}
                      onChange={e => setScheduleForm(f => ({ ...f, recurEndDate: e.target.value }))} />
                  </FormGroup>

                  {schedulePreview.length > 0 && (
                    <div style={{ background: '#eef0fd', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#5e72e4', marginBottom: 6 }}>
                        Preview — {schedulePreview.length} session{schedulePreview.length !== 1 ? 's' : ''} will be created:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto' }}>
                        {schedulePreview.map(d => (
                          <span key={d} style={{ background: '#fff', border: '1px solid #c5cae9', borderRadius: 8, padding: '2px 8px', fontSize: 12, color: '#3b4a67' }}>
                            {new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {scheduleError && <p className="text-danger small">{scheduleError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="success" disabled={scheduling} onClick={handleSchedule}>
              {scheduling ? 'Scheduling…' : scheduleForm.isRecurring && schedulePreview.length > 1 ? `Create ${schedulePreview.length} Sessions` : 'Schedule'}
            </Button>
            <Button color="link" onClick={() => setScheduleOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Submissions Modal */}
        <Modal isOpen={!!viewSubs} toggle={() => setViewSubs(null)} centered size="lg">
          <ModalHeader toggle={() => setViewSubs(null)}
            style={{ background: 'linear-gradient(135deg,#fb6340,#fbb140)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            Submissions {viewSubsTitle && <span style={{ fontWeight: 400, fontSize: 14 }}>— {viewSubsTitle}</span>}
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff', maxHeight: '70vh', overflowY: 'auto' }}>
            {submissions.length === 0 ? (
              <p className="text-muted text-center py-4">No submissions yet</p>
            ) : submissions.map((sub) => (
              <div key={sub.id} className="mb-3 p-3 bg-white border rounded" style={{ borderRadius: 10 }}>
                <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 8 }}>
                  <div>
                    <strong>{sub.student_name}</strong>
                    <div className="small text-muted">{sub.student_email}</div>
                    {sub.submitted_at && (
                      <div className="small text-muted">Submitted: {new Date(sub.submitted_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    )}
                    {sub.submission_url && (
                      <a href={sub.submission_url} target="_blank" rel="noreferrer" className="small" style={{ color: '#5e72e4' }}>View Submission</a>
                    )}
                    {sub.notes && <p className="small text-muted mt-1 mb-0">{sub.notes}</p>}
                    {sub.marks_awarded != null && (
                      <div className="small mt-1">
                        <strong>Points: {sub.marks_awarded}</strong>
                        {sub.feedback && <span className="text-muted ml-2">— {sub.feedback}</span>}
                      </div>
                    )}
                    {sub.feedback_file_url && (
                      <a href={sub.feedback_file_url} target="_blank" rel="noreferrer" className="small d-block mt-1" style={{ color: '#2dce89' }}>
                        View Feedback File
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {sub.is_late && (
                      <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>Late</span>
                    )}
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: sub.status === 'graded' ? '#d4edda' : '#fff3cd',
                      color: sub.status === 'graded' ? '#155724' : '#856404' }}>
                      {sub.status}
                    </span>
                    {sub.status === 'submitted' && (
                      <Button size="sm" color="success" outline style={{ borderRadius: 20, fontSize: 11 }}
                        onClick={() => { setGradingId(sub.id); setGradeForm({ marks: '', feedback: '', feedback_file_url: '' }); setGradeFileName(''); }}>
                        Grade
                      </Button>
                    )}
                  </div>
                </div>
                {gradingId === sub.id && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
                    <Row>
                      <Col md="4">
                        <FormGroup className="mb-2">
                          <Label className="small">Points Awarded</Label>
                          <Input type="number" bsSize="sm" value={gradeForm.marks}
                            onChange={(e) => setGradeForm({ ...gradeForm, marks: e.target.value })} />
                        </FormGroup>
                      </Col>
                      <Col md="8">
                        <FormGroup className="mb-2">
                          <Label className="small">Feedback</Label>
                          <Input bsSize="sm" value={gradeForm.feedback}
                            onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
                        </FormGroup>
                      </Col>
                    </Row>
                    <FormGroup className="mb-2">
                      <Label className="small">Feedback File <span className="text-muted">(optional — upload checked assignment)</span></Label>
                      <div>
                        <input type="file" ref={gradeFileRef} style={{ display: 'none' }}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                          onChange={e => e.target.files?.[0] && handleGradeFileUpload(e.target.files[0])} />
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <button type="button" onClick={() => gradeFileRef.current?.click()}
                            disabled={gradeUploading}
                            style={{ background: '#2dce89', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            {gradeUploading ? 'Uploading...' : 'Upload File'}
                          </button>
                          {gradeFileName && (
                            <span style={{ fontSize: 12, color: '#2dce89', fontWeight: 600 }}>{gradeFileName}</span>
                          )}
                        </div>
                      </div>
                    </FormGroup>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" color="success" style={{ borderRadius: 8 }} onClick={() => handleGrade(sub.id)}>Submit Grade</Button>
                      <Button size="sm" color="link" onClick={() => setGradingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="secondary" outline onClick={() => setViewSubs(null)}>Close</Button>
          </ModalFooter>
        </Modal>

        {/* Create/Edit Assignment Modal */}
        <Modal isOpen={assignOpen} toggle={() => { setAssignOpen(false); setEditingAssignment(null); }} centered>
          <ModalHeader toggle={() => { setAssignOpen(false); setEditingAssignment(null); }}>{editingAssignment ? 'Edit Assignment' : 'Create Assignment'}</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleCreateAssignment}>
              <FormGroup><Label>Title *</Label><Input value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })} placeholder="Assignment title" /></FormGroup>
              <FormGroup><Label>Description</Label><Input type="textarea" rows={2} value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} /></FormGroup>
              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label>Duration</Label>
                    <Input type="select" value={assignForm.duration_days} onChange={(e) => setAssignForm({ ...assignForm, duration_days: e.target.value })}>
                      <option value="">— No duration —</option>
                      <option value="3">3 Days</option>
                      <option value="5">5 Days</option>
                      <option value="7">1 Week</option>
                      <option value="10">10 Days</option>
                      <option value="14">2 Weeks</option>
                      <option value="21">3 Weeks</option>
                      <option value="30">1 Month</option>
                      <option value="45">45 Days</option>
                      <option value="60">2 Months</option>
                    </Input>
                    <small className="text-muted">Due date is auto-calculated when assigned to students</small>
                  </FormGroup>
                </Col>
                <Col md="6"><FormGroup><Label>Max Points</Label><Input type="number" value={assignForm.max_marks} onChange={(e) => setAssignForm({ ...assignForm, max_marks: e.target.value })} /></FormGroup></Col>
              </Row>
              <FormGroup>
                <Label>Attachment File</Label>
                <div>
                  <input type="file" ref={assignFileRef} style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                    onChange={e => e.target.files?.[0] && handleAssignFileUpload(e.target.files[0])} />
                  <div className="d-flex align-items-center" style={{ gap: 10 }}>
                    <button type="button" onClick={() => assignFileRef.current?.click()}
                      disabled={assignUploading}
                      style={{ background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      {assignUploading ? 'Uploading…' : '📎 Upload File'}
                    </button>
                    {assignFileName && (
                      <span style={{ fontSize: 13, color: '#2dce89', fontWeight: 600 }}>✓ {assignFileName}</span>
                    )}
                  </div>
                  <small className="text-muted mt-1 d-block">PDF, Word, Excel, image (max 10 MB)</small>
                </div>
              </FormGroup>
              <FormGroup>
                <Label>Topic <span className="text-danger">*</span></Label>
                <Input type="select" value={assignForm.topicId} onChange={(e) => setAssignForm({ ...assignForm, topicId: e.target.value })}>
                  <option value="">— Select topic —</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Input>
              </FormGroup>
              <FormGroup>
                <Label>Assign To <span className="text-muted small">(leave empty = all enrolled students)</span></Label>
                <Input type="select" value={assignForm.assignedTo} onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })}>
                  <option value="">— All students —</option>
                  {subjectStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </Input>
              </FormGroup>
              {assignError && <p className="text-danger small">{assignError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="warning" disabled={assignSaving} onClick={handleCreateAssignment}>{assignSaving ? 'Saving...' : editingAssignment ? 'Update Assignment' : 'Create Assignment'}</Button>
            <Button color="link" onClick={() => { setAssignOpen(false); setEditingAssignment(null); }}>Cancel</Button>
          </ModalFooter>
        </Modal>

      {/* Topic Create / Edit Modal */}
        <Modal isOpen={topicModal} toggle={() => setTopicModal(false)} centered>
          <ModalHeader toggle={() => setTopicModal(false)}>
            {editingTopic ? 'Edit Topic' : 'Add New Topic'}
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSaveTopic}>
              <FormGroup>
                <Label>Topic Name *</Label>
                <Input
                  value={topicForm.name}
                  onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                  placeholder="e.g. Algebra — Quadratic Equations"
                  autoFocus
                />
              </FormGroup>
              <FormGroup>
                <Label>Description <span className="text-muted small">(optional)</span></Label>
                <Input
                  type="textarea"
                  rows={2}
                  value={topicForm.description}
                  onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                  placeholder="Brief description of this topic..."
                />
              </FormGroup>
              <FormGroup>
                <Label>Order / Position</Label>
                <Input
                  type="number"
                  min={0}
                  value={topicForm.order_index}
                  onChange={(e) => setTopicForm({ ...topicForm, order_index: Number(e.target.value) })}
                  style={{ maxWidth: 100 }}
                />
                <small className="text-muted">Lower number = appears first (0 = top)</small>
              </FormGroup>
              {topicError && <p className="text-danger small mb-0">{topicError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" disabled={topicSaving} onClick={handleSaveTopic} style={{ borderRadius: 8, fontWeight: 700 }}>
              {topicSaving ? 'Saving...' : editingTopic ? 'Save Changes' : 'Add Topic'}
            </Button>
            <Button color="link" onClick={() => setTopicModal(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

      {/* Add Material Modal */}
        <Modal isOpen={matModalOpen} toggle={() => setMatModalOpen(false)} centered>
          <ModalHeader toggle={() => setMatModalOpen(false)}>Add Study Material</ModalHeader>
          <ModalBody>
            <Form onSubmit={handleAddMaterial}>
              <FormGroup><Label>Title *</Label><Input value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} placeholder="e.g. Chapter 3 Notes" /></FormGroup>
              <FormGroup><Label>Type</Label>
                <Input type="select" value={matForm.material_type} onChange={(e) => setMatForm({ ...matForm, material_type: e.target.value })}>
                  <option value="link">Link</option>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="doc">Document</option>
                  <option value="image">Image</option>
                </Input>
              </FormGroup>
              <FormGroup><Label>URL *</Label><Input value={matForm.file_url} onChange={(e) => setMatForm({ ...matForm, file_url: e.target.value })} placeholder="https://..." /></FormGroup>
              <FormGroup><Label>Description</Label><Input type="textarea" rows={2} value={matForm.description} onChange={(e) => setMatForm({ ...matForm, description: e.target.value })} placeholder="Optional..." /></FormGroup>
              <FormGroup>
                <Label>Topic <span className="text-danger">*</span></Label>
                <Input type="select" value={matForm.topicId} onChange={(e) => setMatForm({ ...matForm, topicId: e.target.value })}>
                  <option value="">— Select topic —</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Input>
              </FormGroup>
              {matError && <p className="text-danger small">{matError}</p>}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" disabled={matSaving} onClick={handleAddMaterial}>{matSaving ? 'Adding...' : 'Add Material'}</Button>
            <Button color="link" onClick={() => setMatModalOpen(false)}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Quiz Confirmation Modal */}
        <Modal isOpen={deleteQuizModal.open} toggle={() => setDeleteQuizModal({ open: false, quiz: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteQuizModal({ open: false, quiz: null })}>
            Confirm Delete
          </ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Are you sure you want to delete <strong>{deleteQuizModal.quiz?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteQuiz}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteQuizModal({ open: false, quiz: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Session Confirmation Modal */}
        <Modal isOpen={deleteSessionModal.open} toggle={() => setDeleteSessionModal({ open: false, session: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteSessionModal({ open: false, session: null })}>Confirm Delete Session</ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Delete session <strong>{deleteSessionModal.session?.title}</strong>?</p>
            <p className="text-muted small">This will mark the session as cancelled.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteSession}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteSessionModal({ open: false, session: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Reschedule Session Modal — Admin only */}
        <Modal isOpen={rescheduleModal.open} toggle={() => setRescheduleModal({ open: false, session: null })} centered>
          <ModalHeader toggle={() => setRescheduleModal({ open: false, session: null })}>Reschedule Session</ModalHeader>
          <ModalBody>
            <Form>
              <FormGroup>
                <Label><strong>Title</strong></Label>
                <Input value={rescheduleForm.title} onChange={e => setRescheduleForm(f => ({ ...f, title: e.target.value }))} />
              </FormGroup>
              <Row form>
                <Col md={4}>
                  <FormGroup>
                    <Label>Date</Label>
                    <Input type="date" value={rescheduleForm.sessionDate} onChange={e => setRescheduleForm(f => ({ ...f, sessionDate: e.target.value }))} />
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>Start Time</Label>
                    <Input type="time" value={rescheduleForm.startTime} onChange={e => setRescheduleForm(f => ({ ...f, startTime: e.target.value }))} />
                  </FormGroup>
                </Col>
                <Col md={4}>
                  <FormGroup>
                    <Label>End Time</Label>
                    <Input type="time" value={rescheduleForm.endTime} onChange={e => setRescheduleForm(f => ({ ...f, endTime: e.target.value }))} />
                  </FormGroup>
                </Col>
              </Row>
              {rescheduleModal.session?.is_recurring && rescheduleModal.session?.recurrence_id && (
                <FormGroup>
                  <Label><strong>Apply to</strong></Label>
                  {[{ value: 'this', label: 'This event only' }, { value: 'this_and_following', label: 'This and following events' }, { value: 'all', label: 'All events in series' }].map(opt => (
                    <div key={opt.value} style={{ marginBottom: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="radio" name="rescheduleRecurMode" value={opt.value}
                          checked={rescheduleForm.recurMode === opt.value}
                          onChange={() => setRescheduleForm(f => ({ ...f, recurMode: opt.value }))} />
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </FormGroup>
              )}
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button color="info" disabled={rescheduleSaving} onClick={handleReschedule}>
              {rescheduleSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button color="link" onClick={() => setRescheduleModal({ open: false, session: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Recurring Delete Scope Modal — Admin only */}
        <Modal isOpen={recurDeleteModal.open} toggle={() => setRecurDeleteModal({ open: false, session: null, scope: 'this' })} centered size="sm">
          <ModalHeader toggle={() => setRecurDeleteModal({ open: false, session: null, scope: 'this' })}>Delete Recurring Session</ModalHeader>
          <ModalBody>
            <p>Delete <strong>{recurDeleteModal.session?.title}</strong>?</p>
            {[{ value: 'this', label: 'This event only' }, { value: 'this_and_following', label: 'This and following events' }, { value: 'all', label: 'All events in series' }].map(opt => (
              <div key={opt.value} style={{ marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="recurDeleteScope" value={opt.value}
                    checked={recurDeleteModal.scope === opt.value}
                    onChange={() => setRecurDeleteModal(m => ({ ...m, scope: opt.value }))} />
                  {opt.label}
                </label>
              </div>
            ))}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" disabled={recurDeleting} onClick={handleRecurDelete}>
              {recurDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <Button color="secondary" outline onClick={() => setRecurDeleteModal({ open: false, session: null, scope: 'this' })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Assignment Confirmation Modal */}
        <Modal isOpen={deleteAssignModal.open} toggle={() => setDeleteAssignModal({ open: false, assign: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteAssignModal({ open: false, assign: null })}>Confirm Delete Assignment</ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Delete assignment <strong>{deleteAssignModal.assign?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteAssignment}>Yes, Delete</Button>
            <Button color="secondary" outline onClick={() => setDeleteAssignModal({ open: false, assign: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Delete Material Confirmation Modal */}
        <Modal isOpen={deleteMatModal.open} toggle={() => setDeleteMatModal({ open: false, mat: null })} centered size="sm">
          <ModalHeader toggle={() => setDeleteMatModal({ open: false, mat: null })}>Confirm Remove Material</ModalHeader>
          <ModalBody className="text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p>Remove <strong>{deleteMatModal.mat?.title}</strong>?</p>
            <p className="text-muted small">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter className="justify-content-center">
            <Button color="danger" onClick={handleDeleteMaterial}>Yes, Remove</Button>
            <Button color="secondary" outline onClick={() => setDeleteMatModal({ open: false, mat: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Preview Assignment Modal */}
        <Modal isOpen={Boolean(previewAssign)} toggle={() => setPreviewAssign(null)} centered>
          <ModalHeader toggle={() => setPreviewAssign(null)}
            style={{ background: 'linear-gradient(135deg,#3b4a67,#5e72e4)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            Assignment Preview
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff' }}>
            {previewAssign && (
              <div>
                <h5 style={{ color: '#32325d', marginBottom: 8 }}>{previewAssign.title}</h5>
                {previewAssign.topic_name && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10, display: 'inline-block', marginBottom: 12 }}>
                    📌 {previewAssign.topic_name}
                  </span>
                )}
                {previewAssign.description && (
                  <p style={{ color: '#525f7f', marginBottom: 14, whiteSpace: 'pre-wrap' }}>{previewAssign.description}</p>
                )}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Duration</div>
                    <div style={{ color: '#32325d', fontWeight: 600 }}>{
                      previewAssign.duration_days
                        ? previewAssign.duration_days === 7 ? '1 Week'
                          : previewAssign.duration_days === 14 ? '2 Weeks'
                          : previewAssign.duration_days === 21 ? '3 Weeks'
                          : previewAssign.duration_days === 30 ? '1 Month'
                          : `${previewAssign.duration_days} Days`
                        : '—'
                    }</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Max Marks</div>
                    <div style={{ color: '#32325d', fontWeight: 600 }}>{previewAssign.max_marks}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Status</div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: previewAssign.is_published ? '#d4edda' : '#fff3cd',
                      color: previewAssign.is_published ? '#155724' : '#856404' }}>
                      {previewAssign.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {previewAssign.creator_name && (
                    <div>
                      <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Created By</div>
                      <div style={{ color: '#32325d', fontWeight: 600 }}>{previewAssign.creator_name}</div>
                    </div>
                  )}
                </div>
                {previewAssign.attachment_url && (
                  <a href={previewAssign.attachment_url} target="_blank" rel="noreferrer"
                    style={{ color: '#5e72e4', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    📎 View Attachment
                  </a>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="secondary" outline onClick={() => setPreviewAssign(null)}>Close</Button>
          </ModalFooter>
        </Modal>

        {/* Preview Material Modal */}
        <Modal isOpen={Boolean(previewMat)} toggle={() => setPreviewMat(null)} centered>
          <ModalHeader toggle={() => setPreviewMat(null)}
            style={{ background: 'linear-gradient(135deg,#3b4a67,#5e72e4)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            Material Preview
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff' }}>
            {previewMat && (
              <div>
                <h5 style={{ color: '#32325d', marginBottom: 8 }}>{previewMat.title}</h5>
                {previewMat.topic_name && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#5e72e4', background: '#eef0fd', padding: '2px 8px', borderRadius: 10, display: 'inline-block', marginBottom: 12 }}>
                    📌 {previewMat.topic_name}
                  </span>
                )}
                {previewMat.description && (
                  <p style={{ color: '#525f7f', marginBottom: 14 }}>{previewMat.description}</p>
                )}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Type</div>
                    <div style={{ color: '#32325d', fontWeight: 600 }}>{previewMat.material_type?.toUpperCase()}</div>
                  </div>
                  {previewMat.file_size_kb && (
                    <div>
                      <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Size</div>
                      <div style={{ color: '#32325d', fontWeight: 600 }}>{(previewMat.file_size_kb / 1024).toFixed(1)} MB</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Status</div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: previewMat.is_published ? '#d4edda' : '#fff3cd',
                      color: previewMat.is_published ? '#155724' : '#856404' }}>
                      {previewMat.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {previewMat.uploader_name && (
                    <div>
                      <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Uploaded By</div>
                      <div style={{ color: '#32325d', fontWeight: 600 }}>{previewMat.uploader_name}</div>
                    </div>
                  )}
                </div>
                <a href={previewMat.file_url} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#5e72e4', color: '#fff', padding: '8px 18px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
                  🔗 Open Material
                </a>
              </div>
            )}
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="secondary" outline onClick={() => setPreviewMat(null)}>Close</Button>
          </ModalFooter>
        </Modal>

        {/* Assign Content to Students Modal */}
        <Modal isOpen={assignContentModal.open} toggle={() => setAssignContentModal({ open: false, type: '', item: null })} centered>
          <ModalHeader toggle={() => setAssignContentModal({ open: false, type: '', item: null })}
            style={{ background: 'linear-gradient(135deg,#3b4a67,#5e72e4)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            Assign to Students
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff' }}>
            {assignContentModal.item && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#eef0fd', borderRadius: 10, border: '1px solid #d1d8f8' }}>
                <div style={{ fontSize: 12, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{assignContentModal.type}</div>
                <div style={{ fontWeight: 700, color: '#32325d' }}>{assignContentModal.item.title}</div>
              </div>
            )}
            <div style={{ marginBottom: 10, fontWeight: 600, color: '#525f7f', fontSize: 13 }}>
              Select students to assign this content:
              <span style={{ fontWeight: 400, color: '#8898aa', fontSize: 11, marginLeft: 6 }}>
                {isAdmin ? '(all enrolled students)' : '(your assigned students)'}
              </span>
            </div>
            {subjectStudents.length === 0 ? (
              <p className="text-muted small text-center py-3">
                {isAdmin ? 'No students enrolled in this subject.' : 'No students are assigned to you for this subject.'}
              </p>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: 8, padding: 8, background: '#fff' }}>
                <div style={{ marginBottom: 8 }}>
                  <button type="button" onClick={() => setAssignContentIds(subjectStudents.map(s => s.id))}
                    style={{ fontSize: 11, color: '#5e72e4', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700, marginRight: 12 }}>
                    Select All
                  </button>
                  <button type="button" onClick={() => setAssignContentIds([])}
                    style={{ fontSize: 11, color: '#8898aa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}>
                    Clear
                  </button>
                </div>
                {subjectStudents.map(s => {
                  const alreadyAssigned = contentAssignments.some(
                    a => a.content_type === assignContentModal.type && a.content_id === assignContentModal.item?.id && a.student_id === s.id
                  );
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f4f8' }}>
                      <input type="checkbox" id={`ca-${s.id}`}
                        checked={assignContentIds.includes(s.id) || alreadyAssigned}
                        disabled={alreadyAssigned}
                        onChange={() => {
                          if (alreadyAssigned) return;
                          setAssignContentIds(prev =>
                            prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                          );
                        }} />
                      <label htmlFor={`ca-${s.id}`} style={{ margin: 0, cursor: alreadyAssigned ? 'default' : 'pointer', fontSize: 13, flex: 1 }}>
                        {s.first_name} {s.last_name}
                        <span style={{ color: '#8898aa', marginLeft: 6 }}>({s.email})</span>
                      </label>
                      {alreadyAssigned && (() => {
                        const ca = contentAssignments.find(
                          a => a.content_type === assignContentModal.type && a.content_id === assignContentModal.item?.id && a.student_id === s.id
                        );
                        return ca ? (
                          <button type="button" onClick={() => handleRevokeContentAssignment(ca.id)}
                            style={{ fontSize: 10, color: '#f5365c', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            title="Revoke assignment">
                            Revoke
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: '#2dce89', fontWeight: 700 }}>Assigned</span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
            {assignContentError && <p className="text-danger small mt-2 mb-0">{assignContentError}</p>}
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="primary" disabled={assignContentSaving || assignContentIds.length === 0}
              onClick={handleAssignContent}>
              {assignContentSaving ? 'Assigning...' : `Assign to ${assignContentIds.length} student${assignContentIds.length !== 1 ? 's' : ''}`}
            </Button>
            <Button color="link" onClick={() => setAssignContentModal({ open: false, type: '', item: null })}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* ---- Quiz Write Permissions Modal (Admin only) ---- */}
        <Modal isOpen={permissionsModal.open} toggle={() => setPermissionsModal({ open: false, item: null, type: '' })} centered size="lg">
          <ModalHeader toggle={() => setPermissionsModal({ open: false, item: null, type: '' })}
            style={{ background: 'linear-gradient(135deg,#3b4a67,#6286c3)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            Quiz Write Permissions
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff' }}>
            {permissionsModal.item && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: '#eef0fd', borderRadius: 10, border: '1px solid #d1d8f8' }}>
                <div style={{ fontSize: 11, color: '#8898aa', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Quiz</div>
                <div style={{ fontWeight: 700, color: '#32325d', fontSize: 15 }}>{permissionsModal.item.title}</div>
                <div style={{ fontSize: 12, color: '#8898aa', marginTop: 2 }}>
                  Status: <strong style={{ color: permissionsModal.item.is_published ? '#155724' : '#856404' }}>
                    {permissionsModal.item.is_published ? 'Published' : 'Draft (unpublished)'}
                  </strong>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff8e1', borderRadius: 10, fontSize: 13, color: '#856404' }}>
              <strong>How this works:</strong> Grant write access so a teacher can see this quiz (even unpublished) and add questions. Their edits save as draft. When the quiz is complete, <strong>revoke all write access</strong> before publishing so the quiz locks down for teachers.
            </div>

            {subjectTeachers.length === 0 ? (
              <p className="text-muted text-center py-3">No teachers allocated to this subject yet.</p>
            ) : quizPermissionsLoading ? (
              <p className="text-muted text-center py-3">Loading...</p>
            ) : (
              <table className="subject-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {['Teacher', 'Subject Access', 'Quiz Write Access', 'Granted At', 'Action'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjectTeachers.map(t => {
                    const quizPerm = quizPermissions.find(p => p.teacher_id === t.id);
                    const hasQuizWrite = Boolean(quizPerm);
                    const saving = permissionsSaving[t.id];
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#32325d' }}>{t.first_name} {t.last_name}</div>
                          <div style={{ fontSize: 11, color: '#8898aa' }}>{t.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: t.permission_level === 'write' ? '#d4edda' : '#e9ecef',
                            color: t.permission_level === 'write' ? '#155724' : '#525f7f' }}>
                            {t.permission_level === 'write' ? '✏️ Write (all)' : '👁 Read-only'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {t.permission_level === 'write' ? (
                            <span style={{ fontSize: 12, color: '#5e72e4', fontStyle: 'italic' }}>Inherited (subject write)</span>
                          ) : hasQuizWrite ? (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                              ✏️ Write (this quiz)
                            </span>
                          ) : (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f0f4f8', color: '#8898aa' }}>
                              No access
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#8898aa' }}>
                          {quizPerm ? new Date(quizPerm.granted_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {t.permission_level === 'write' ? (
                            <span style={{ fontSize: 11, color: '#8898aa', fontStyle: 'italic' }}>Via subject</span>
                          ) : hasQuizWrite ? (
                            <Button size="sm" color="warning" outline style={{ borderRadius: 20, fontSize: 11 }}
                              disabled={Boolean(saving)}
                              onClick={() => handleRevokeQuizWrite(t.id)}>
                              {saving === 'revoke' ? '...' : 'Revoke Write'}
                            </Button>
                          ) : (
                            <Button size="sm" color="success" outline style={{ borderRadius: 20, fontSize: 11 }}
                              disabled={Boolean(saving)}
                              onClick={() => handleGrantQuizWrite(t.id)}>
                              {saving === 'grant' ? '...' : 'Grant Write'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="secondary" outline onClick={() => setPermissionsModal({ open: false, item: null, type: '' })}>Close</Button>
          </ModalFooter>
        </Modal>

        {/* ---- Assignment Detail Modal (Assigned By / Assigned To drill-down) ---- */}
        <Modal isOpen={detailModal.open} toggle={() => setDetailModal({ open: false, field: '', contentType: '', itemId: '', itemTitle: '' })} centered>
          <ModalHeader toggle={() => setDetailModal({ open: false, field: '', contentType: '', itemId: '', itemTitle: '' })}
            style={{ background: detailModal.field === 'by' ? 'linear-gradient(135deg,#3b4a67,#5e72e4)' : 'linear-gradient(135deg,#1a7a49,#2dce89)', color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            {detailModal.field === 'by' ? 'Assigned By — Teachers' : 'Assigned To — Students'}
          </ModalHeader>
          <ModalBody style={{ background: '#f8fbff' }}>
            {detailModal.itemTitle && (
              <div style={{ marginBottom: 14, padding: '8px 12px', background: '#eef0fd', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#32325d' }}>
                {detailModal.contentType}: {detailModal.itemTitle}
              </div>
            )}
            {(() => {
              const rows = getItemAssignments(detailModal.contentType, detailModal.itemId);
              if (rows.length === 0) return <p className="text-muted text-center py-3">No assignments found.</p>;

              if (detailModal.field === 'by') {
                // Group by assigner
                const byTeacher = {};
                rows.forEach(r => {
                  if (!byTeacher[r.assigned_by]) byTeacher[r.assigned_by] = { name: r.assigner_name, count: 0, latestAt: r.assigned_at };
                  byTeacher[r.assigned_by].count += 1;
                  if (r.assigned_at > byTeacher[r.assigned_by].latestAt) byTeacher[r.assigned_by].latestAt = r.assigned_at;
                });
                return (
                  <table className="subject-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Teacher', 'Students Assigned', 'Last Assignment Date'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(byTeacher).map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#32325d' }}>{t.name}</td>
                          <td style={{ padding: '10px 12px', color: '#525f7f' }}>{t.count}</td>
                          <td style={{ padding: '10px 12px', color: '#8898aa', fontSize: 12 }}>{new Date(t.latestAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              } else {
                // List each student
                const isAssignmentType = detailModal.contentType === 'assignment';
                return (
                  <table className="subject-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Student', 'Email', 'Assigned By', 'Assigned At', ...(isAssignmentType ? ['Due Date'] : [])].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#8898aa', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#32325d' }}>{r.student_name}</td>
                          <td style={{ padding: '10px 12px', color: '#8898aa', fontSize: 12 }}>{r.student_email}</td>
                          <td style={{ padding: '10px 12px', color: '#525f7f' }}>{r.assigner_name}</td>
                          <td style={{ padding: '10px 12px', color: '#8898aa', fontSize: 12 }}>{new Date(r.assigned_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                          {isAssignmentType && (
                            <td style={{ padding: '10px 12px', color: r.due_date ? '#f5365c' : '#8898aa', fontSize: 12, fontWeight: r.due_date ? 600 : 400 }}>
                              {r.due_date ? new Date(r.due_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }
            })()}
          </ModalBody>
          <ModalFooter style={{ background: '#f8fbff' }}>
            <Button color="secondary" outline onClick={() => setDetailModal({ open: false, field: '', contentType: '', itemId: '', itemTitle: '' })}>Close</Button>
          </ModalFooter>
        </Modal>

      </Container>
      <style>{`
        @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .live-blink { animation: liveBlink 1s infinite; }
        .subject-table tbody tr { transition: background .12s ease; }
        .subject-table tbody tr:hover { background: #f7f9fc !important; }
        .subject-table th { border-bottom: 2px solid #e9ecef; }
        .filter-select { padding: 6px 12px; border-radius: 8px; border: 1px solid #dee2e6; font-size: 12px; background: #fff; color: #525f7f; cursor: pointer; transition: border-color .15s; }
        .filter-select:focus { border-color: #5e72e4; outline: none; }
        .filter-input { padding: 6px 12px; border-radius: 8px; border: 1px solid #dee2e6; font-size: 12px; background: #fff; color: #525f7f; width: 160px; transition: border-color .15s; }
        .filter-input:focus { border-color: #5e72e4; outline: none; }
      `}</style>
    </>
  );
}
