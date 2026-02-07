import { Request, Response } from 'express';
export declare function createClass(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createSession(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function startSession(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getTeacherClasses(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getStudentClasses(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getSessionById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMyClasses(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMySessionsV2(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=classes.controller.d.ts.map