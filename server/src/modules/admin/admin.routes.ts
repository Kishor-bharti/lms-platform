import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';
import * as adminController from './admin.controller';

const router = Router();

router.use(authMiddleware);
router.use(rbacMiddleware(['admin']));

// Stats
router.get('/stats', adminController.getStats);

// Users
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:userId/active', adminController.toggleUserActive);
router.post('/users/:userId/roles', adminController.assignRole);
router.delete('/users/:userId/roles/:roleName', adminController.removeRole);

// Courses
router.get('/courses', adminController.getCourses);
router.post('/courses', adminController.createCourse);

// Subjects
router.get('/subjects', adminController.getSubjects);
router.post('/subjects', adminController.createSubject);
router.put('/subjects/:subjectId', adminController.updateSubject);
router.delete('/subjects/:subjectId', adminController.deleteSubject);
router.post('/subjects/:subjectId/teachers', adminController.assignTeacher);
router.delete('/subjects/:subjectId/teachers/:teacherId', adminController.removeTeacher);
router.get('/subjects/:subjectId/enrollments', adminController.getEnrolledStudents);
router.post('/subjects/:subjectId/enrollments', adminController.enrollStudent);
router.delete('/subjects/:subjectId/enrollments/:studentId', adminController.unenrollStudent);

// Sessions — admin CRUD + A5 join
router.get('/sessions',              adminController.getAllSessions);
router.post('/sessions',             adminController.createSession);
router.patch('/sessions/:sessionId', adminController.updateSession);
router.delete('/sessions/:sessionId', adminController.deleteSession);

export default router;
