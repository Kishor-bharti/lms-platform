import { Request, Response } from 'express';
import * as adminService from './admin.service';

export async function getStats(req: Request, res: Response) {
  try {
    const stats = await adminService.getStats();
    return res.json(stats);
  } catch (err) {
    console.error('[admin] getStats:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const role = req.query.role as string | undefined;
    const users = await adminService.getUsers(role);
    return res.json(users);
  } catch (err) {
    console.error('[admin] getUsers:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const adminId = req.user!.id;
    const { email, password, first_name, last_name, phone, role } = req.body;
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'email, password, first_name, last_name, role are required' });
    }
    const user = await adminService.createUser({
      email, password, first_name, last_name, phone, role, adminId
    });
    return res.status(201).json(user);
  } catch (err: any) {
    console.error('[admin] createUser:', err);
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
    await adminService.toggleUserActive(userId, is_active);
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin] toggleActive:', err);
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
    console.error('[admin] assignRole:', err);
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
    console.error('[admin] removeRole:', err);
    return res.status(500).json({ error: 'Failed to remove role' });
  }
}

export async function getCourses(req: Request, res: Response) {
  try {
    const courses = await adminService.getCourses();
    return res.json(courses);
  } catch (err) {
    console.error('[admin] getCourses:', err);
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
    console.error('[admin] createCourse:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Course name/code already exists' });
    return res.status(500).json({ error: 'Failed to create course' });
  }
}

export async function getSubjects(req: Request, res: Response) {
  try {
    const courseId = req.query.courseId as string | undefined;
    const subjects = await adminService.getSubjects(courseId);
    return res.json(subjects);
  } catch (err) {
    console.error('[admin] getSubjects:', err);
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
    console.error('[admin] createSubject:', err);
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
    console.error('[admin] assignTeacher:', err);
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
    console.error('[admin] removeTeacher:', err);
    return res.status(500).json({ error: 'Failed to remove teacher' });
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
    console.error('[admin] enrollStudent:', err);
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
    console.error('[admin] unenrollStudent:', err);
    return res.status(500).json({ error: 'Failed to unenroll student' });
  }
}

export async function getAllSessions(req: Request, res: Response) {
  try {
    const sessions = await adminService.getAllSessionsAdmin();
    return res.json(sessions);
  } catch (err) {
    console.error('[admin] getAllSessions:', err);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}
