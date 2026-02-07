"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClass = createClass;
exports.createSession = createSession;
exports.startSession = startSession;
exports.getTeacherClasses = getTeacherClasses;
exports.getStudentClasses = getStudentClasses;
exports.getSessionById = getSessionById;
exports.getMyClasses = getMyClasses;
exports.getMySessionsV2 = getMySessionsV2;
exports.startSessionById = startSessionById;
const classesService = __importStar(require("./classes.service"));
async function createClass(req, res) {
    try {
        const { title, subject } = req.body;
        const userId = req.user?.id;
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ message: 'Title is required and must be a string' });
        }
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const newClass = await classesService.createClass(title, subject || '', userId);
        res.status(201).json(newClass);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create class' });
    }
}
async function createSession(req, res) {
    try {
        const { classId, title, scheduledAt } = req.body;
        if (!classId || typeof classId !== 'string') {
            return res.status(400).json({ message: 'classId is required and must be a string' });
        }
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ message: 'title is required and must be a string' });
        }
        if (!scheduledAt || typeof scheduledAt !== 'string') {
            return res.status(400).json({ message: 'scheduledAt is required and must be a string' });
        }
        const session = await classesService.createSession(classId, title, new Date(scheduledAt));
        res.status(201).json(session);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create session' });
    }
}
async function startSession(req, res) {
    try {
        const { sessionId } = req.body;
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ message: 'sessionId is required and must be a string' });
        }
        const session = await classesService.startSession(sessionId);
        res.json(session);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to start session' });
    }
}
async function getTeacherClasses(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const classes = await classesService.getTeacherClasses(userId);
        res.json(classes);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch classes' });
    }
}
async function getStudentClasses(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const classes = await classesService.getStudentEnrolledClasses(userId);
        res.json(classes);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch classes' });
    }
}
async function getSessionById(req, res) {
    try {
        const { sessionId } = req.params;
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ message: 'sessionId is required and must be a string' });
        }
        const session = await classesService.getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.json(session);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch session' });
    }
}
// New data-driven API handlers
async function getMyClasses(req, res) {
    try {
        const userId = req.user?.id?.toString();
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const classes = await classesService.getMyClasses(userId, userRole);
        res.json(classes);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch classes' });
    }
}
async function getMySessionsV2(req, res) {
    try {
        const userId = req.user?.id?.toString();
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const sessions = await classesService.getMySessionsV2(userId, userRole);
        res.json(sessions);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch sessions' });
    }
}
async function startSessionById(req, res) {
    try {
        const { sessionId } = req.params;
        const userRole = req.user?.role;
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        if (userRole !== 'TEACHER') {
            return res.status(403).json({ message: 'Only teachers can start sessions' });
        }
        const session = await classesService.startSessionById(sessionId);
        res.json(session);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to start session' });
    }
}
//# sourceMappingURL=classes.controller.js.map