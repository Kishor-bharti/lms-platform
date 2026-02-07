import { Class, Session, Enrollment, StudentClass } from './classes.types';
export declare function createClass(title: string, subject: string, teacherId: number): Promise<Class>;
export declare function createSession(classId: string, title: string, scheduledAt: Date): Promise<Session>;
export declare function startSession(sessionId: string): Promise<Session>;
export declare function getTeacherClasses(teacherId: number): Promise<Class[]>;
export declare function getStudentEnrolledClasses(studentId: number): Promise<StudentClass[]>;
export declare function getSessionById(sessionId: string): Promise<Session | null>;
export declare function enrollStudent(classId: string, studentId: number): Promise<Enrollment>;
export interface ClassWithTeacher {
    id: string;
    title: string;
    subject: string | null;
    teacher_id: string;
    teacher_name: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}
export interface SessionWithDetails {
    id: string;
    class_id: string;
    class_title: string;
    title: string | null;
    zoom_link: string | null;
    scheduled_at: string;
    status: string;
}
export declare function getMyClasses(userId: string, role: string): Promise<ClassWithTeacher[]>;
export declare function getTeacherClassesV2(teacherId: string): Promise<ClassWithTeacher[]>;
export declare function getEnrolledClassesV2(studentId: string): Promise<ClassWithTeacher[]>;
export declare function getMySessionsV2(userId: string, role: string): Promise<SessionWithDetails[]>;
export declare function getSessionsByTeacherV2(teacherId: string): Promise<SessionWithDetails[]>;
export declare function getSessionsByStudentV2(studentId: string): Promise<SessionWithDetails[]>;
//# sourceMappingURL=classes.service.d.ts.map