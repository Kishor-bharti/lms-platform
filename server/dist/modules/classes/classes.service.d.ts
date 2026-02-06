import { Class, Session, Enrollment, StudentClass } from './classes.types';
export declare function createClass(title: string, subject: string, teacherId: number): Promise<Class>;
export declare function createSession(classId: string, title: string, scheduledAt: Date): Promise<Session>;
export declare function startSession(sessionId: string): Promise<Session>;
export declare function getTeacherClasses(teacherId: number): Promise<Class[]>;
export declare function getStudentEnrolledClasses(studentId: number): Promise<StudentClass[]>;
export declare function getSessionById(sessionId: string): Promise<Session | null>;
export declare function enrollStudent(classId: string, studentId: number): Promise<Enrollment>;
//# sourceMappingURL=classes.service.d.ts.map