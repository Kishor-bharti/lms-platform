import { Request, Response } from 'express';
import * as adminService from './admin.service';
import logger from '../../config/logger';

export async function getStats(req: Request, res: Response) {
  try {
    const stats = await adminService.getStats();
    return res.json(stats);
  } catch (err) {
    logger.error('[admin] getStats:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const role   = req.query.role   as string | undefined;
    const active = req.query.active as string | undefined;
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await adminService.getUsers(role, page, limit, active);
    return res.json(result);
  } catch (err) {
    logger.error('[admin] getUsers:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { email, password, first_name, last_name, phone, description, role } = req.body;
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'email, password, first_name, last_name, role are required' });
    }
    const user = await adminService.createUser({
      email, password, first_name, last_name, phone, description, role, adminId
    });
    return res.status(201).json(user);
  } catch (err: any) {
    logger.error('[admin] createUser:', err);
    if (err.message?.includes('duplicate') || err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: err.message || 'Failed to create user' });
  }
}

export async function toggleUserActive(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }
    // Prevent deactivating the super admin
    const isSuper = await adminService.isSuperAdmin(userId);
    if (isSuper && !is_active) {
      return res.status(403).json({ error: 'Super admin cannot be deactivated' });
    }
    await adminService.toggleUserActive(userId, is_active);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] toggleActive:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function assignRole(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.user!.id;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!role) return res.status(400).json({ error: 'role is required' });
    await adminService.assignRole(userId, role, adminId);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[admin] assignRole:', err);
    return res.status(500).json({ error: err.message || 'Failed to assign role' });
  }
}

export async function removeRole(req: Request, res: Response) {
  try {
    const { userId, roleName } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!roleName) {
      return res.status(400).json({ error: 'roleName is required' });
    }
    await adminService.removeRole(userId, roleName);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] removeRole:', err);
    return res.status(500).json({ error: 'Failed to remove role' });
  }
}

export async function getCourses(req: Request, res: Response) {
  try {
    const courses = await adminService.getCourses();
    return res.json(courses);
  } catch (err) {
    logger.error('[admin] getCourses:', err);
    return res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

export async function createCourse(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { name, code, description } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name and code are required' });
    const course = await adminService.createCourse({ name, code, description, adminId });
    return res.status(201).json(course);
  } catch (err: any) {
    logger.error('[admin] createCourse:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Course name/code already exists' });
    return res.status(500).json({ error: 'Failed to create course' });
  }
}

export async function updateCourse(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const { name, code, description, is_active } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    const course = await adminService.updateCourse(courseId, { name, code, description, is_active });
    return res.json(course);
  } catch (err: any) {
    logger.error('[admin] updateCourse:', err);
    if (err.message === 'COURSE_NOT_FOUND') return res.status(404).json({ error: 'Course not found' });
    if (err.message === 'NOTHING_TO_UPDATE') return res.status(400).json({ error: 'No fields to update' });
    return res.status(500).json({ error: 'Failed to update course' });
  }
}

export async function hardDeleteCourse(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { courseId } = req.params;
    const { password } = req.body;

    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    if (!password) return res.status(400).json({ error: 'Admin password is required for confirmation' });

    const isSuper = await adminService.isSuperAdmin(adminId);
    if (!isSuper) return res.status(403).json({ error: 'Only super admin can permanently delete courses' });

    const valid = await adminService.verifyAdminPassword(adminId, password);
    if (!valid) return res.status(401).json({ error: 'Incorrect admin password' });

    const result = await adminService.hardDeleteCourse(courseId);
    return res.json({ success: true, deletedFiles: result.deletedFiles });
  } catch (err: any) {
    if (err.message === 'COURSE_NOT_FOUND') return res.status(404).json({ error: 'Course not found' });
    logger.error('[admin] hardDeleteCourse:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete course' });
  }
}

export async function getSubjects(req: Request, res: Response) {
  try {
    const courseId = req.query.courseId as string | undefined;
    const subjects = await adminService.getSubjects(courseId);
    return res.json(subjects);
  } catch (err) {
    logger.error('[admin] getSubjects:', err);
    return res.status(500).json({ error: 'Failed to fetch subjects' });
  }
}

export async function createSubject(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { course_id, name, code, description } = req.body;
    if (!course_id || !name || !code) {
      return res.status(400).json({ error: 'course_id, name, code are required' });
    }
    const subject = await adminService.createSubject({ course_id, name, code, description, adminId });
    return res.status(201).json(subject);
  } catch (err: any) {
    logger.error('[admin] createSubject:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Subject code already exists in this course' });
    return res.status(500).json({ error: 'Failed to create subject' });
  }
}

export async function assignTeacher(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const { teacherId } = req.body;
    const adminId = req.user!.id;
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    await adminService.assignTeacher(subjectId, teacherId, adminId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] assignTeacher:', err);
    return res.status(500).json({ error: 'Failed to assign teacher' });
  }
}

export async function removeTeacher(req: Request, res: Response) {
  try {
    const { subjectId, teacherId } = req.params;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId is required' });
    }
    await adminService.removeTeacher(subjectId, teacherId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] removeTeacher:', err);
    return res.status(500).json({ error: 'Failed to remove teacher' });
  }
}

export async function setTeacherPermission(req: Request, res: Response) {
  try {
    const { subjectId, teacherId } = req.params;
    const { permission_level } = req.body;
    if (!subjectId || !teacherId) {
      return res.status(400).json({ error: 'subjectId and teacherId are required' });
    }
    if (!permission_level) {
      return res.status(400).json({ error: 'permission_level is required' });
    }
    await adminService.setTeacherPermission(subjectId, teacherId, permission_level);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'INVALID_PERMISSION_LEVEL') {
      return res.status(400).json({ error: 'permission_level must be read or write' });
    }
    if (err.message === 'TEACHER_NOT_ASSIGNED') {
      return res.status(404).json({ error: 'Teacher is not assigned to this subject' });
    }
    logger.error('[admin] setTeacherPermission:', err);
    return res.status(500).json({ error: 'Failed to update permission' });
  }
}

export async function enrollStudent(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const { studentId } = req.body;
    const adminId = req.user!.id;
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    await adminService.enrollStudent(subjectId, studentId, adminId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] enrollStudent:', err);
    return res.status(500).json({ error: 'Failed to enroll student' });
  }
}

export async function unenrollStudent(req: Request, res: Response) {
  try {
    const { subjectId, studentId } = req.params;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    await adminService.unenrollStudent(subjectId, studentId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] unenrollStudent:', err);
    return res.status(500).json({ error: 'Failed to unenroll student' });
  }
}

export async function getEnrolledStudents(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    const students = await adminService.getEnrolledStudents(subjectId);
    return res.json(students);
  } catch (err) {
    logger.error('[admin] getEnrolledStudents:', err);
    return res.status(500).json({ error: 'Failed to fetch enrolled students' });
  }
}

export async function updateSubject(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const { course_id, name, code, description } = req.body;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    await adminService.updateSubject(subjectId, { course_id, name, code, description });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[admin] updateSubject:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Subject code already exists' });
    return res.status(500).json({ error: 'Failed to update subject' });
  }
}

export async function deleteSubject(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    await adminService.deleteSubject(subjectId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] deleteSubject:', err);
    return res.status(500).json({ error: 'Failed to delete subject' });
  }
}

// ── Teacher-Student Allocations ──────────────────────────────────────────────

export async function getSubjectAllocations(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    const allocations = await adminService.getSubjectAllocations(subjectId);
    return res.json(allocations);
  } catch (err) {
    logger.error('[admin] getSubjectAllocations:', err);
    return res.status(500).json({ error: 'Failed to fetch allocations' });
  }
}

export async function assignStudentToTeacher(req: Request, res: Response) {
  try {
    const { subjectId, teacherId } = req.params;
    const { studentId } = req.body;
    const adminId = req.user!.id;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    await adminService.assignStudentToTeacher(subjectId!, teacherId!, studentId, adminId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] assignStudentToTeacher:', err);
    return res.status(500).json({ error: 'Failed to assign student' });
  }
}

export async function removeStudentFromTeacher(req: Request, res: Response) {
  try {
    const { subjectId, teacherId, studentId } = req.params;
    await adminService.removeStudentFromTeacher(subjectId!, teacherId!, studentId!);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[admin] removeStudentFromTeacher:', err);
    return res.status(500).json({ error: 'Failed to remove student allocation' });
  }
}

export async function getAdminOverview(req: Request, res: Response) {
  try {
    const data = await adminService.getAdminDashboardOverview();
    return res.json(data);
  } catch (err) {
    logger.error('[admin] getAdminOverview:', err);
    return res.status(500).json({ error: 'Failed to fetch overview' });
  }
}

export async function getAllSessions(req: Request, res: Response) {
  try {
    const validDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
    const str = (k: string) => (req.query[k] as string) || undefined;
    const filters: adminService.AdminSessionFilters = {};
    const d = validDate(req.query.date as string);
    if (d)            filters.date      = d;
    if (str('courseId'))  filters.courseId  = str('courseId')!;
    if (str('subjectId')) filters.subjectId = str('subjectId')!;
    if (str('teacherId')) filters.teacherId = str('teacherId')!;
    if (str('studentId')) filters.studentId = str('studentId')!;
    if (str('status'))    filters.status    = str('status')!;
    const sessions = await adminService.getAllSessionsAdmin(filters);
    return res.json(sessions);
  } catch (err) {
    logger.error('[admin] getAllSessions:', err);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

export async function createSession(req: Request, res: Response) {
  try {
    const {
      teacherId, subjectId, title, sessionDate, startTime, endTime,
      topicId, studentIds,
      isRecurring, recurPattern, recurDays, recurEndDate,
    } = req.body;

    if (!teacherId || !subjectId || !title || !sessionDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'teacherId, subjectId, title, sessionDate, startTime, endTime are required' });
    }

    const result = await adminService.createAdminSession({
      teacherId, subjectId, title, sessionDate, startTime, endTime,
      topicId, studentIds,
      isRecurring, recurPattern, recurDays, recurEndDate,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    logger.error('[admin] createSession:', err);
    return res.status(500).json({ error: err.message || 'Failed to create session' });
  }
}

export async function updateSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const { title, sessionDate, startTime, endTime, topicId, recurMode, recurrenceId, originalDate } = req.body;
    const validMode = (m: string) => m === 'this' || m === 'this_and_following' || m === 'all';

    if (recurMode && validMode(recurMode) && recurrenceId && originalDate && recurMode !== 'this') {
      await adminService.updateRecurringSession(sessionId, recurrenceId, recurMode, originalDate,
        { title, sessionDate, startTime, endTime, topicId });
    } else {
      await adminService.updateAdminSession(sessionId, { title, sessionDate, startTime, endTime, topicId });
    }
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[admin] updateSession:', err);
    return res.status(500).json({ error: 'Failed to update session' });
  }
}

export async function deleteSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const mode         = req.query.mode         as string | undefined;
    const recurrenceId = req.query.recurrenceId as string | undefined;
    const sessionDate  = req.query.sessionDate  as string | undefined;

    if ((mode === 'this_and_following' || mode === 'all') && recurrenceId) {
      await adminService.deleteRecurringSession(
        sessionId, recurrenceId, mode, sessionDate ?? '');
    } else {
      await adminService.deleteAdminSession(sessionId);
    }
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[admin] deleteSession:', err);
    return res.status(500).json({ error: 'Failed to delete session' });
  }
}

export async function bulkDeleteSessions(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    await adminService.bulkDeleteSessions(ids);
    return res.json({ success: true, deleted: ids.length });
  } catch (err: any) {
    logger.error('[admin] bulkDeleteSessions:', err);
    return res.status(500).json({ error: 'Failed to delete sessions' });
  }
}

// ============================================================
// Super Admin — User Detail, Password, Hard Delete
// ============================================================

export async function getUserDetail(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const user = await adminService.getUserDetail(userId);
    return res.json(user);
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    logger.error('[admin] getUserDetail:', err);
    return res.status(500).json({ error: 'Failed to fetch user detail' });
  }
}

export async function verifyAdminPassword(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password is required' });

    // Only super admin can use this endpoint
    const isSuper = await adminService.isSuperAdmin(adminId);
    if (!isSuper) return res.status(403).json({ error: 'Only super admin can perform this action' });

    const valid = await adminService.verifyAdminPassword(adminId, password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    return res.json({ verified: true });
  } catch (err) {
    logger.error('[admin] verifyAdminPassword:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
}

export async function resetUserPassword(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { userId } = req.params;
    const { password, new_password } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!password) return res.status(400).json({ error: 'Admin password is required' });
    if (!new_password) return res.status(400).json({ error: 'new_password is required' });

    // Only super admin
    const isSuper = await adminService.isSuperAdmin(adminId);
    if (!isSuper) return res.status(403).json({ error: 'Only super admin can reset passwords' });

    // Verify super admin password first
    const valid = await adminService.verifyAdminPassword(adminId, password);
    if (!valid) return res.status(401).json({ error: 'Incorrect admin password' });

    // Cannot reset super admin's own password through this endpoint
    const targetIsSuper = await adminService.isSuperAdmin(userId);
    if (targetIsSuper) return res.status(403).json({ error: 'Use profile to change your own password' });

    await adminService.resetUserPassword(userId, new_password);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'TOO_SHORT') return res.status(400).json({ error: 'Password must be at least 6 characters' });
    logger.error('[admin] resetUserPassword:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

export async function hardDeleteUser(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { userId } = req.params;
    const { password } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!password) return res.status(400).json({ error: 'Admin password is required for confirmation' });

    // Only super admin
    const isSuper = await adminService.isSuperAdmin(adminId);
    if (!isSuper) return res.status(403).json({ error: 'Only super admin can permanently delete users' });

    // Verify super admin password
    const valid = await adminService.verifyAdminPassword(adminId, password);
    if (!valid) return res.status(401).json({ error: 'Incorrect admin password' });

    const result = await adminService.hardDeleteUser(userId, adminId);
    return res.json({ success: true, deletedFiles: result.deletedFiles });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    if (err.message === 'CANNOT_DELETE_SUPER_ADMIN') return res.status(403).json({ error: 'Cannot delete the super admin' });
    logger.error('[admin] hardDeleteUser:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
}
