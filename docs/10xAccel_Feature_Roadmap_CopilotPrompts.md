# 10xAccel LMS — Complete Feature Roadmap & Copilot Prompt Pack
> Based on codebase audit of 10xAccel-main as of Feb 2026.
> Work phases IN ORDER. Never skip. Never combine.

---

## PHASE MAP

| # | What | Key Files Touched | Risk |
|---|------|-------------------|------|
| **P1** | App rename + Topics system + Sidebar Quiz node | `index.html`, `Sidebar.js`, schema, new topics module | LOW |
| **P2** | LaTeX rendering + Image upload in Quiz Builder/Taker | `QuizBuilder.js`, `QuizTaker.js`, new `LatexRenderer.js`, new upload module | MEDIUM |
| **P3** | Quiz overhaul — no passing score, timer split, practice resume | `QuizBuilder.js`, `QuizTaker.js`, `quiz.service.ts`, `quiz.routes.ts`, schema | HIGH |
| **P4** | Course-level Quiz (Test Sets) + Subject Topics navigation | `Sidebar.js`, `SubjectStudent.js`, schema, new `CourseQuiz.js` | HIGH |
| **P5** | Edit / Delete for courses, subjects, sessions, quizzes | Admin pages, `SubjectTeacher.js`, backend services + routes | MEDIUM |
| **P6** | Resources page overhaul — enrolled subjects with deep links | `Resources.js`, `courses.service.ts` | MEDIUM |
| **P7** | Reports — practice scores, remove pass rate | `Report.js`, `progress.service.ts` | LOW |
| **P8** | Difficulty color indicators in QuizTaker | `QuizTaker.js` only | LOW |

---
---

# ═══ PHASE 1 — App Rename + Topics System + Sidebar Quiz Node ═══

## Context
- App title currently says "10xAccel" in browser tab
- No topics table exists in the schema yet
- Sidebar renders `course.subjects.map(...)` — needs a "Quiz" node appended at the bottom of each course's subject list
- This phase adds zero breaking changes

---

## COPILOT PROMPT — PHASE 1

```
You are working on the 10xAccel LMS project. The codebase is a Node.js/TypeScript
backend (Express + PostgreSQL via pg Pool) and a React frontend (Create React App,
Reactstrap, React Router v6). Do NOT touch auth files, db.ts, or env.ts.
Work through these tasks in order:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — App title rename
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/public/index.html
Change: <title>...</title>  →  <title>10xAccel</title>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — Schema: topics table
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/sql/schema.sql
Add this block AFTER the subjects table definition (around line 64):

  CREATE TABLE topics (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id  UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    order_index SMALLINT     NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by  UUID         NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (subject_id, name)
  );
  CREATE INDEX idx_topics_subject ON topics(subject_id);
  CREATE TRIGGER trg_updated_at_topics
    BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

Also add topic_id to the questions table (after the `set_id` line, ~line 116):
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,

And add index after the existing idx_questions_set line:
  CREATE INDEX idx_questions_topic ON questions(topic_id);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — Backend: Topics API module
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create 3 new files:

FILE: server/src/modules/topics/topics.service.ts
---
import { query } from '../../config/db';

export async function getTopicsBySubject(subjectId: string) {
  return query<any>(`
    SELECT id, subject_id, name, description, order_index, is_active, created_at
    FROM topics
    WHERE subject_id = $1 AND is_active = true
    ORDER BY order_index, name
  `, [subjectId]);
}

export async function createTopic(data: {
  subject_id: string; name: string; description?: string;
  order_index?: number; created_by: string;
}) {
  const rows = await query<any>(`
    INSERT INTO topics (subject_id, name, description, order_index, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, subject_id, name, description, order_index, is_active, created_at
  `, [data.subject_id, data.name, data.description ?? null,
      data.order_index ?? 0, data.created_by]);
  return rows[0];
}

export async function updateTopic(id: string, data: {
  name?: string; description?: string; order_index?: number;
}) {
  const rows = await query<any>(`
    UPDATE topics SET
      name        = COALESCE($2, name),
      description = COALESCE($3, description),
      order_index = COALESCE($4, order_index),
      updated_at  = now()
    WHERE id = $1
    RETURNING id, subject_id, name, description, order_index, is_active
  `, [id, data.name ?? null, data.description ?? null, data.order_index ?? null]);
  return rows[0];
}

export async function softDeleteTopic(id: string) {
  await query(`UPDATE topics SET is_active = false, updated_at = now() WHERE id = $1`, [id]);
}
---

FILE: server/src/modules/topics/topics.controller.ts
---
import { Request, Response } from 'express';
import * as svc from './topics.service';

export async function getTopics(req: Request, res: Response) {
  try {
    const data = await svc.getTopicsBySubject(req.params.subjectId);
    return res.json(data);
  } catch (err) {
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to fetch topics' });
  }
}

export async function createTopic(req: Request, res: Response) {
  try {
    const { name, description, order_index } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const topic = await svc.createTopic({
      subject_id: req.params.subjectId,
      name, description, order_index,
      created_by: req.user!.id,
    });
    return res.status(201).json(topic);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Topic name already exists in this subject' });
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to create topic' });
  }
}

export async function updateTopic(req: Request, res: Response) {
  try {
    const topic = await svc.updateTopic(req.params.topicId, req.body);
    return res.json(topic);
  } catch (err) {
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to update topic' });
  }
}

export async function deleteTopic(req: Request, res: Response) {
  try {
    await svc.softDeleteTopic(req.params.topicId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to delete topic' });
  }
}
---

FILE: server/src/modules/topics/topics.routes.ts
---
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as ctrl from './topics.controller';

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.get('/',            ctrl.getTopics);
router.post('/',           ctrl.createTopic);
router.patch('/:topicId',  ctrl.updateTopic);
router.delete('/:topicId', ctrl.deleteTopic);
export default router;
---

FILE: server/src/app.ts
In the imports block, add:
  import topicsRouter from './modules/topics/topics.routes';

In the routes block (after progressRouter line), add:
  app.use('/api/subjects/:subjectId/topics', topicsRouter);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — Sidebar: Add Quiz node under each course
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/components/Sidebar/Sidebar.js

In the createCourseLinks() function, find the subject list rendering block:
  {course.subjects.map((subject) => (
    <NavItem key={subject.id}>
      ...
    </NavItem>
  ))}

AFTER that map closes (but still inside the isOpen && !mini conditional div),
add this Quiz node:

  <NavItem key={`quiz-${course.id}`}>
    <NavLink
      to={`/admin/course-quiz/${course.id}`}
      tag={NavLinkRRD}
      onClick={closeCollapse}
      title={`${course.name} — Test Sets`}
      style={{ padding: '6px 12px', fontSize: '13px' }}
    >
      <i className="ni ni-paper-diploma"
         style={{ fontSize: '9px', color: '#5e72e4', marginRight: '8px' }} />
      <span style={{ color: '#5e72e4', fontWeight: 700 }}>Quiz</span>
    </NavLink>
  </NavItem>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 5 — Add route and placeholder page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/routes.js
Add import at top:
  import CourseQuiz from 'views/quiz/CourseQuiz.js';

Add route entry in the routes array (hidden: true):
  {
    path: '/course-quiz/:courseId',
    name: 'Course Quiz',
    icon: 'ni ni-paper-diploma text-primary',
    component: CourseQuiz,
    layout: '/admin',
    hidden: true,
  },

FILE: client/src/views/quiz/CourseQuiz.js  (new file — placeholder)
---
import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Card, CardBody } from 'reactstrap';
import Header from 'components/Headers/Header.js';

export default function CourseQuiz() {
  const { courseId } = useParams();
  return (
    <>
      <Header />
      <Container className="mt--7" fluid
        style={{ backgroundColor: 'rgb(196,214,226)', minHeight: '100vh', paddingTop: 30 }}>
        <Row><Col>
          <Card className="shadow" style={{ borderRadius: 12 }}>
            <CardBody className="text-center py-5">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h4>Course Test Sets</h4>
              <p className="text-muted">Test Sets will appear here in Phase 4.</p>
              <p className="text-muted small">Course ID: {courseId}</p>
            </CardBody>
          </Card>
        </Col></Row>
      </Container>
    </>
  );
}
---
```

## SQL to run in Supabase after Phase 1 deploys:
```sql
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  order_index SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, name)
);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
```

## Phase 1 Test Checklist
```
✅ Browser tab says "10xAccel"
✅ GET /api/subjects/:id/topics returns [] for new subject
✅ POST /api/subjects/:id/topics creates a topic (as admin/teacher)
✅ Sidebar: expanding a course shows subjects THEN a blue "Quiz" item at bottom
✅ Clicking "Quiz" navigates to /admin/course-quiz/:courseId (shows placeholder)
✅ All existing pages still load (subjects, sessions, quizzes, assignments)
```

---
---

# ═══ PHASE 2 — LaTeX Rendering + Image Upload ═══

## Context
- Questions use plain text; need KaTeX math rendering
- `questions` table already has `image_url TEXT` column (line 117 of schema)
- Need Supabase Storage bucket + server-side upload endpoint
- `QuizBuilder.js` needs split-panel live preview
- `QuizTaker.js` needs to render LaTeX and show images

---

## COPILOT PROMPT — PHASE 2

```
Continuing 10xAccel LMS. Phase 2: LaTeX and image upload.
The questions table already has an image_url TEXT column.
The backend uses Express + pg Pool. Frontend is React (CRA).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — Install KaTeX on client
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In client/ directory:
  npm install katex

In client/src/index.js, add at the top:
  import 'katex/dist/katex.min.css';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — LatexRenderer component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create file: client/src/components/LatexRenderer.js

This component receives a `text` prop (string) and renders it with math.
Rules:
- $$...$$ → display (block) math via katex.renderToString(expr, {displayMode:true, throwOnError:false})
- $...$ (not $$) → inline math via katex.renderToString(expr, {throwOnError:false})
- Plain text rendered as-is in <span>
- If KaTeX throws, show the raw expr in a red span
- Use dangerouslySetInnerHTML for KaTeX HTML output
- Accept optional `style` prop

Algorithm: split text by $$...$$ first (block), then split remaining text by $...$ (inline).
Build array of {type:'block'|'inline'|'plain', content:string} parts, render each.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — Upload server module
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Install in server/:
  npm install multer @supabase/supabase-js
  npm install --save-dev @types/multer

Add to server/src/config/env.ts inside the `env` object:
  SUPABASE_URL_PUBLIC:  process.env.SUPABASE_URL_PUBLIC  || '',
  SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY    || '',

Create file: server/src/modules/upload/upload.controller.ts
---
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

export async function uploadQuizImage(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'Only jpg/png/gif/webp allowed' });

    const supabase = createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY);
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `quiz-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('quiz-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from('quiz-images').getPublicUrl(filename);
    return res.json({ url: data.publicUrl });
  } catch (err) {
    console.error('[upload:quiz-image]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
---

Create file: server/src/modules/upload/upload.routes.ts
---
import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadQuizImage } from './upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const router = Router();
router.use(authMiddleware);
router.post('/quiz-image', upload.single('image'), uploadQuizImage);
export default router;
---

In server/src/app.ts:
  Add import:  import uploadRouter from './modules/upload/upload.routes';
  Add route:   app.use('/api/upload', uploadRouter);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — Update QuizBuilder.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/quiz/QuizBuilder.js

1. Add import at top:
   import LatexRenderer from 'components/LatexRenderer.js';

2. Update BLANK_QUESTION to include image_url and topic_id:
   const BLANK_QUESTION = (idx) => ({
     question_text: '', explanation: '', difficulty: 'medium',
     marks: 1, order_index: idx, image_url: '', topic_id: '',
     options: ['A','B','C','D'].map(BLANK_OPTION),
   });

3. Add state for topics at the top of the component:
   const [topics, setTopics] = useState([]);
   
   Add useEffect to fetch topics when subjectId is available:
   useEffect(() => {
     if (!subjectId) return;
     http.get(`/api/subjects/${subjectId}/topics`)
       .then(res => setTopics(res.data || []))
       .catch(() => {});
   }, [subjectId]);

4. In the question card's CardBody, REPLACE the single question_text Input with:
   a) A label: "Question Text (use $...$ for inline math, $$...$$ for block math)"
   b) A 2-column grid (CSS grid, 50%/50%):
      LEFT: <Input type="textarea" rows={4} value={q.question_text} onChange=... />
      RIGHT: A preview div with border, same height, padding 12px:
               <LatexRenderer text={q.question_text || 'Preview will appear here...'} />
   c) Below the grid: image upload row:
      - "Add Image" button that triggers hidden <input type="file" accept="image/*">
      - On file select: POST to /api/upload/quiz-image with FormData
        Use axios (http) with Content-Type: multipart/form-data header
        On success: updateQuestion(qi, 'image_url', responseUrl)
        Show loading spinner while uploading
      - If q.image_url exists: show <img src={q.image_url} style={{maxWidth:'100%', borderRadius:8, marginTop:8}} />
        and an "Remove Image" button that sets image_url to ''
   d) Below image: Topic tag selector (only if topics.length > 0):
      <Input type="select" value={q.topic_id} onChange={e => updateQuestion(qi, 'topic_id', e.target.value)}>
        <option value="">-- No topic --</option>
        {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Input>

5. In the handleSave function, include image_url and topic_id in each question payload.
   The server quiz.service.ts INSERT into questions should also save topic_id
   (add topic_id column to the INSERT — see note below about quiz.service.ts update).

6. Update quiz.service.ts: In the createQuiz function's question INSERT statement:
   Change:
     INSERT INTO questions (quiz_id, question_text, explanation, difficulty, marks, order_index, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
   To:
     INSERT INTO questions (quiz_id, question_text, image_url, explanation, difficulty, marks, order_index, topic_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   And update the parameter array accordingly:
     [quiz.id, q.question_text, q.image_url ?? null, q.explanation ?? null,
      q.difficulty, q.marks, q.order_index, q.topic_id ?? null, data.createdBy]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 5 — Update QuizTaker.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/quiz/QuizTaker.js

1. Add import:
   import LatexRenderer from 'components/LatexRenderer.js';

2. In the "taking" phase, find the question text paragraph:
   <p style={{ fontSize: 16, fontWeight: 600, color: '#32325d', lineHeight: 1.6, marginBottom: 24 }}>
     {q?.question_text}
   </p>
   
   Replace with:
   <div style={{ fontSize: 16, fontWeight: 600, color: '#32325d', lineHeight: 1.6, marginBottom: q?.image_url ? 16 : 24 }}>
     <LatexRenderer text={q?.question_text || ''} />
   </div>
   {q?.image_url && (
     <img src={q.image_url} alt="Question" style={{
       maxWidth: '100%', borderRadius: 10, marginBottom: 20,
       border: '1px solid #e9ecef', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
     }} />
   )}

3. In each option button, find: {opt.option_text}
   Replace with: <LatexRenderer text={opt.option_text || ''} />

4. In the "result" phase answer review, find the question text:
   {idx + 1}. {a.question_text}
   Replace with:
   <span>{idx + 1}. </span><LatexRenderer text={a.question_text || ''} />
   
   Also add image display in review:
   {a.image_url && <img src={a.image_url} alt="" style={{maxWidth:'100%', borderRadius:8, margin:'8px 0'}} />}
   
   Also update: getQuizWithQuestions() in quiz.service.ts — add image_url to the
   SELECT in questionRows query:
     SELECT id, question_text, image_url, explanation, difficulty, marks, order_index
   And include image_url in the returned question object.
   
   Also update: getAttemptResult() answer rows query — add q.image_url to the SELECT
   and return it in the answers array.
```

## Supabase Setup for Phase 2:
```
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: quiz-images
4. Toggle "Public bucket" ON
5. Save

Add to Render environment variables:
  SUPABASE_URL_PUBLIC  = https://[your-project-ref].supabase.co
  SUPABASE_ANON_KEY    = [your anon key from Supabase Settings > API]
```

## Phase 2 Test Checklist
```
✅ npm run build passes with katex installed
✅ QuizBuilder: typing $x^2 + 1$ shows rendered math in preview
✅ QuizBuilder: typing $$\frac{a}{b}$$ shows block math
✅ QuizBuilder: image upload button works, image appears in question card
✅ QuizBuilder: image URL saved to DB (check questions table in Supabase)
✅ QuizTaker: question text renders LaTeX correctly
✅ QuizTaker: question image shows between text and options
✅ QuizTaker: option text renders LaTeX correctly
✅ Result screen: question text and images shown in review
```

---
---

# ═══ PHASE 3 — Quiz Overhaul ═══

## Context
Existing QuizBuilder has: passing_score, max_attempts=3, duration always shown.
Existing QuizTaker has: countdown timer always on, no save/resume, hardcoded pass/fail display.

Changes needed:
- Remove passing_score everywhere
- max_attempts default → 1
- Test type: countdown timer from duration_minutes
- Practice type: stopwatch counting UP, no duration field, Save & Continue button
- Practice resume: if partial attempt exists, show "Resume" on intro screen
- After resume: load saved answers, continue from last saved question index
- schema: add `last_question_index` and 'partial' to quiz_attempts status

---

## SQL to run before Phase 3 deploys:
```sql
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS last_question_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_status_check
  CHECK (status IN ('in_progress','partial','submitted','timed_out','abandoned'));
```

---

## COPILOT PROMPT — PHASE 3

```
Continuing 10xAccel LMS. Phase 3: Quiz system overhaul.
Run the SQL migration above first, then make these code changes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — QuizBuilder.js: settings cleanup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/quiz/QuizBuilder.js

1. Change initial meta state:
   FROM: { title:'', quiz_type:'practice', description:'', duration_minutes:30, passing_score:60, max_attempts:3 }
   TO:   { title:'', quiz_type:'practice', description:'', duration_minutes:60, max_attempts:1 }

2. In the "Quiz Settings" CardBody, REMOVE the passing_score FormGroup entirely.

3. For duration_minutes field: wrap it in a conditional — only show when quiz_type === 'test':
   {meta.quiz_type === 'test' && (
     <Col md="3">
       <FormGroup>
         <Label>Duration (minutes) *</Label>
         <Input type="number" min={5} max={300} value={meta.duration_minutes}
           onChange={(e) => setMeta({ ...meta, duration_minutes: Number(e.target.value) })} />
       </FormGroup>
     </Col>
   )}
   {meta.quiz_type === 'practice' && (
     <Col md="3">
       <div className="alert alert-info py-2 mb-0" style={{fontSize:13, borderRadius:8}}>
         ⏱ Practice uses a count-up stopwatch.<br/>Students can save progress and resume later.
       </div>
     </Col>
   )}

4. In handleSave, update the POST payload:
   - Remove passing_score from the payload
   - For practice type, send duration_minutes: 0 (or omit)
   - max_attempts: Number(meta.max_attempts) || 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — quiz.routes.ts: validation schema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/src/modules/quiz/quiz.routes.ts

Update createQuizSchema:
  duration_minutes: z.number().int().min(0).max(300).default(0),
  max_attempts:     z.number().int().min(1).max(10).optional().default(1),
  // Remove passing_score from the schema entirely

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — quiz.service.ts: partial submit function
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/src/modules/quiz/quiz.service.ts

Add this new function after startAttempt():

export async function partialSubmitPractice(data: {
  attemptId: string;
  studentId: string;
  answers: Array<{ question_id: string; selected_option_id: string | null }>;
  lastQuestionIndex: number;
}): Promise<{ saved: number; correct: number; incorrect: number; unanswered: number; score_pct: number; marks_obtained: number; total_marks: number }> {
  return withTransaction(async (client) => {
    // Verify attempt belongs to this student and is practice type
    const attemptRows = await queryWithClient<any>(client, `
      SELECT qa.id, qa.status, q.quiz_type, q.id as quiz_id
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = $1 AND qa.student_id = $2
    `, [data.attemptId, data.studentId]);
    
    if (!attemptRows[0]) throw new Error('Attempt not found');
    if (attemptRows[0].quiz_type !== 'practice') throw new Error('Only practice quizzes support partial save');
    if (attemptRows[0].status === 'submitted') throw new Error('Attempt already submitted');

    let correct = 0, incorrect = 0, marksObtained = 0, totalMarks = 0;

    for (const ans of data.answers) {
      if (!ans.selected_option_id) continue;
      
      const optRows = await queryWithClient<any>(client, `
        SELECT o.is_correct, o.question_id,
               q.marks, q.marks AS question_marks
        FROM options o
        JOIN questions q ON q.id = o.question_id
        WHERE o.id = $1
      `, [ans.selected_option_id]);
      
      if (!optRows[0]) continue;
      const isCorrect = optRows[0].is_correct;
      const marks = Number(optRows[0].marks);
      const awarded = isCorrect ? marks : 0;
      totalMarks += marks;
      if (isCorrect) { correct++; marksObtained += awarded; }
      else { incorrect++; }

      await queryWithClient(client, `
        INSERT INTO attempt_answers
          (attempt_id, question_id, selected_option_id, is_correct, marks_awarded, answered_at)
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (attempt_id, question_id) DO UPDATE SET
          selected_option_id = $3, is_correct = $4, marks_awarded = $5, answered_at = now()
      `, [data.attemptId, ans.question_id, ans.selected_option_id, isCorrect, awarded]);
    }

    const scorePct = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;

    await queryWithClient(client, `
      UPDATE quiz_attempts SET
        status = 'partial',
        last_question_index = $2,
        marks_obtained = $3,
        total_marks = $4,
        score_pct = $5,
        updated_at = now()
      WHERE id = $1
    `, [data.attemptId, data.lastQuestionIndex, marksObtained, totalMarks, scorePct]);

    const saved = data.answers.filter(a => a.selected_option_id).length;
    const unanswered = data.answers.length - saved;
    return { saved, correct, incorrect, unanswered, score_pct: scorePct, marks_obtained: marksObtained, total_marks: totalMarks };
  });
}

Also add resumePractice function:

export async function resumePractice(attemptId: string, studentId: string) {
  const attemptRows = await query<any>(`
    SELECT qa.*, q.quiz_type
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.id = $1 AND qa.student_id = $2 AND qa.status = 'partial'
  `, [attemptId, studentId]);
  
  if (!attemptRows[0]) throw new Error('Partial attempt not found');
  
  const savedAnswers = await query<any>(`
    SELECT question_id, selected_option_id, is_correct, marks_awarded
    FROM attempt_answers
    WHERE attempt_id = $1
  `, [attemptId]);
  
  return {
    attempt: attemptRows[0],
    savedAnswers,
  };
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — quiz.routes.ts: new endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/src/modules/quiz/quiz.routes.ts

Add after the existing submit route:
  router.post('/attempts/:attemptId/partial-submit', quizController.partialSubmitPractice);
  router.get('/attempts/:attemptId/resume',          quizController.resumePractice);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 5 — quiz.controller.ts: new handlers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/src/modules/quiz/quiz.controller.ts

Add:
export async function partialSubmitPractice(req: Request, res: Response) {
  try {
    const { answers, lastQuestionIndex } = req.body;
    const result = await quizService.partialSubmitPractice({
      attemptId: req.params.attemptId,
      studentId: req.user!.id,
      answers,
      lastQuestionIndex: lastQuestionIndex ?? 0,
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[quiz:partial-submit]', err);
    return res.status(400).json({ error: err.message || 'Failed to save progress' });
  }
}

export async function resumePractice(req: Request, res: Response) {
  try {
    const data = await quizService.resumePractice(req.params.attemptId, req.user!.id);
    return res.json(data);
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'No partial attempt found' });
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 6 — QuizTaker.js: full timer + practice overhaul
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/quiz/QuizTaker.js

Make these targeted changes:

1. Add new state:
   const [elapsed, setElapsed] = useState(0);   // practice stopwatch (seconds up)
   const [partialResult, setPartialResult] = useState(null); // after save-progress

2. In fetchQuiz(), after loading the quiz and attempts, also check for partial attempt:
   const partialAttempt = (attemptsRes.data || []).find(a => a.status === 'partial');
   Store it: setAttempts(...) — make sure partial attempts are included in the list.

3. In the intro screen, add a "Resume Practice" button when there's a partial attempt:
   Find: const maxReached = ...
   Add after: const partialAttempt = attempts.find(a => a.status === 'partial');
   
   Add "Resume" button in the button row:
   {partialAttempt && (
     <Button color="warning" style={{ borderRadius:8, padding:'10px 28px', fontWeight:700 }}
       onClick={() => handleResume(partialAttempt.id)}>
       Resume Practice ({partialAttempt.last_question_index || 0} answered)
     </Button>
   )}

4. Add handleResume function:
   const handleResume = async (resumeAttemptId) => {
     setError('');
     setPhase('loading');
     try {
       const res = await http.get(`/api/quizzes/attempts/${resumeAttemptId}/resume`);
       const { attempt, savedAnswers } = res.data;
       setAttemptId(resumeAttemptId);
       // Restore saved answers into the answers state
       const restored = {};
       savedAnswers.forEach(sa => { restored[sa.question_id] = sa.selected_option_id; });
       setAnswers(restored);
       const resumeFrom = attempt.last_question_index || 0;
       setCurrent(resumeFrom);
       setElapsed(0); // reset stopwatch
       startedAt.current = Date.now();
       setPhase('taking');
     } catch (err) {
       setError(err?.response?.data?.error || 'Failed to resume');
       setPhase('intro');
     }
   };

5. Replace the entire timer useEffect block with split logic:
   useEffect(() => {
     if (phase !== 'taking') return;
     
     if (quiz?.quiz_type === 'test') {
       // COUNTDOWN for tests
       timerRef.current = setInterval(() => {
         setTimeLeft(t => {
           if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
           return t - 1;
         });
       }, 1000);
     } else {
       // COUNT-UP for practice
       timerRef.current = setInterval(() => {
         setElapsed(t => t + 1);
       }, 1000);
     }
     return () => clearInterval(timerRef.current);
   }, [phase, quiz?.quiz_type]);

6. In startQuiz(), update timer initialization:
   if (quiz.quiz_type === 'test') {
     const secs = (quiz.duration_minutes || 60) * 60;
     setTimeLeft(secs);
   } else {
     setElapsed(0);
   }

7. In the taking phase timer card, replace content with:
   {quiz?.quiz_type === 'test' ? (
     <CardBody className="text-center" style={{padding:'16px'}}>
       <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
         Time Remaining
       </div>
       <div style={{fontSize:42,fontWeight:800,color:timeLeft<=300?'#f5365c':'#32325d',fontFamily:'monospace'}}>
         {formatTime(timeLeft)}
       </div>
       {timeLeft <= 300 && <div style={{color:'#f5365c',fontSize:12,fontWeight:700}}>⚠ Hurry up!</div>}
     </CardBody>
   ) : (
     <CardBody className="text-center" style={{padding:'16px'}}>
       <div style={{fontSize:11,fontWeight:700,color:'#8898aa',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
         Time Elapsed
       </div>
       <div style={{fontSize:42,fontWeight:800,color:'#5e72e4',fontFamily:'monospace'}}>
         {formatTime(elapsed)}
       </div>
     </CardBody>
   )}

8. For practice type, ADD a "Save Progress" button in the sidebar (below the submit button):
   {quiz?.quiz_type === 'practice' && (
     <Button color="warning" outline style={{borderRadius:8,marginTop:8,width:'100%',fontWeight:700}}
       disabled={phase==='submitting'} onClick={handleSaveProgress}>
       💾 Save & Continue Later
     </Button>
   )}

9. Add handleSaveProgress function:
   const handleSaveProgress = async () => {
     setPhase('submitting');
     const timeTaken = startedAt.current ? Math.floor((Date.now() - startedAt.current)/1000) : 0;
     const answersPayload = Object.entries(answers).map(([question_id, selected_option_id]) => ({
       question_id, selected_option_id: selected_option_id || null
     }));
     try {
       const res = await http.post(`/api/quizzes/attempts/${attemptId}/partial-submit`, {
         answers: answersPayload,
         lastQuestionIndex: current,
       });
       setPartialResult(res.data);
       setPhase('partial-result');
     } catch (err) {
       setError('Failed to save progress');
       setPhase('taking');
     }
   };

10. Add a 'partial-result' phase render block (before the return null at the end):
    if (phase === 'partial-result' && partialResult) {
      return (
        <>
          <Header />
          <Container className="mt--7" fluid style={{backgroundColor:'rgb(196,214,226)',minHeight:'100vh',paddingTop:30,paddingBottom:30}}>
            <Row className="justify-content-center">
              <Col lg="6">
                <Card className="shadow" style={{borderRadius:16,overflow:'hidden'}}>
                  <div style={{background:'linear-gradient(135deg,#fb6340,#f5365c)',padding:'28px 24px',textAlign:'center'}}>
                    <div style={{fontSize:48,fontWeight:900,color:'#fff'}}>💾</div>
                    <h3 style={{color:'#fff',marginTop:8}}>Progress Saved!</h3>
                  </div>
                  <CardBody style={{padding:28}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
                      {[
                        {label:'Answered', value:partialResult.saved, color:'#5e72e4'},
                        {label:'Correct',  value:partialResult.correct,  color:'#2dce89'},
                        {label:'Wrong',    value:partialResult.incorrect, color:'#f5365c'},
                      ].map(item => (
                        <div key={item.label} style={{background:'#f8f9fa',borderRadius:10,padding:'12px',textAlign:'center'}}>
                          <div style={{fontSize:24,fontWeight:900,color:item.color}}>{item.value}</div>
                          <div style={{fontSize:11,color:'#8898aa',fontWeight:700,textTransform:'uppercase'}}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:'#eef0fd',borderRadius:10,padding:'12px 16px',marginBottom:20,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#8898aa',fontWeight:700,textTransform:'uppercase'}}>Running Score</div>
                      <div style={{fontSize:28,fontWeight:900,color:'#5e72e4'}}>
                        {Number(partialResult.score_pct||0).toFixed(1)}%
                      </div>
                      <div style={{fontSize:12,color:'#525f7f'}}>
                        {Number(partialResult.marks_obtained||0).toFixed(1)} / {Number(partialResult.total_marks||0).toFixed(1)} marks
                      </div>
                    </div>
                    <p className="text-muted text-center small">
                      Come back and click "Resume Practice" to continue from question {(current||0)+1}.
                    </p>
                    <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                      <Button color="primary" style={{borderRadius:8}} onClick={() => navigate(-1)}>
                        Back to Subject
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          </Container>
        </>
      );
    }

11. In the intro screen, update the quiz info grid to hide "Passing Score" and
    show duration only for test type:
    Replace the 4-item info grid with:
    const infoItems = [
      { icon:'❓', label:'Questions',   value: quiz?.question_count },
      { icon:'🔄', label:'Attempts',    value: `${attempts.filter(a=>a.status==='submitted').length} / ${quiz?.max_attempts ?? '1'}` },
    ];
    if (quiz?.quiz_type === 'test') {
      infoItems.unshift({ icon:'⏱', label:'Duration', value: `${quiz?.duration_minutes} minutes` });
    } else {
      infoItems.unshift({ icon:'⏱', label:'Timer', value: 'Count-up stopwatch' });
    }

12. In the result screen, remove isPassed/pass/fail display:
    Remove the "Passed!" / "Not Passed" text.
    Change gradient to always use: 'linear-gradient(135deg, #5e72e4, #825ee4)'
    Show score percentage and marks obtained/total only.
```

## Phase 3 Test Checklist
```
✅ QuizBuilder: no passing_score field anywhere
✅ QuizBuilder: max_attempts defaults to 1
✅ QuizBuilder: test type shows duration field
✅ QuizBuilder: practice type shows info box, hides duration
✅ QuizTaker test: countdown from duration_minutes, goes red at 5min, auto-submits at 0
✅ QuizTaker practice: stopwatch counts 00:00 → up
✅ QuizTaker practice: "Save & Continue Later" button visible
✅ Clicking save: posts to /partial-submit, shows partial-result screen
✅ Partial result screen shows correct/wrong counts and running score%
✅ Student returns to quiz intro: sees "Resume Practice (30 answered)" button
✅ Clicking resume: restores saved answers, continues from Q31
✅ Final submit: calculates based on ALL answered questions cumulatively
✅ Result screen: no pass/fail — shows score% and marks only
```

---
---

# ═══ PHASE 4 — Topics Navigation in Subject + Course Test Sets ═══

## Context
- Subject page currently shows: Sessions, Quizzes, Assignments, Materials
- Need: clicking a subject shows TOPICS listed. Clicking a topic shows the current
  Subject page layout (sessions/practice/assignments/materials)
- CourseQuiz.js is currently a placeholder from Phase 1
- Need proper Test Sets list with start/view functionality
- Schema needs course_id on quizzes for course-level tests

---

## SQL to run before Phase 4:
```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE quizzes ALTER COLUMN subject_id DROP NOT NULL;
-- Note: existing quizzes keep subject_id, new course-level quizzes set course_id only
```

---

## COPILOT PROMPT — PHASE 4

```
Continuing 10xAccel LMS. Phase 4: Topics navigation + Course Test Sets.
Run SQL migration above first.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — SubjectStudent.js: Topics as entry point
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/subject/SubjectStudent.js

The subject page currently shows tabs directly. We want:
  - When a student clicks a subject in the sidebar → see a TOPICS list page
  - When a student clicks a topic → see the subject page filtered to that topic
  
Changes:
1. Add state: const [topics, setTopics] = useState([]); const [topicView, setTopicView] = useState(null);
   topicView = null → show topics list
   topicView = {id, name} → show the existing tabbed view

2. In fetchData, also fetch topics:
   http.get(`/api/subjects/${subjectId}/topics`)
     .then(res => setTopics(res.data || []))
     .catch(() => {});

3. Wrap the existing return JSX in a conditional:
   if (!topicView) {
     // Show topics list
     return (
       <>
         <Header />
         <Container ... >
           {/* Subject header card (same as now) */}
           <Row className="mb-4">...</Row>
           
           {/* Topics grid */}
           <Row>
             {topics.length === 0 ? (
               <Col>
                 <Card className="shadow" style={{borderRadius:12}}>
                   <CardBody className="text-center py-5">
                     <div style={{fontSize:40,marginBottom:12}}>📚</div>
                     <p className="text-muted">No topics available yet for this subject.</p>
                   </CardBody>
                 </Card>
               </Col>
             ) : (
               topics.map(topic => (
                 <Col key={topic.id} md="4" lg="3" className="mb-4">
                   <Card className="shadow" style={{borderRadius:14,cursor:'pointer',border:'2px solid transparent',transition:'all 0.2s ease'}}
                     onClick={() => setTopicView(topic)}
                     onMouseEnter={e => e.currentTarget.style.borderColor='#5e72e4'}
                     onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
                     <CardBody style={{padding:20,textAlign:'center'}}>
                       <div style={{width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg,#5e72e4,#825ee4)',
                         display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:20}}>
                         📖
                       </div>
                       <h6 style={{color:'#32325d',marginBottom:4,lineHeight:1.3}}>{topic.name}</h6>
                       {topic.description && <p style={{fontSize:12,color:'#8898aa',marginBottom:0}}>{topic.description}</p>}
                     </CardBody>
                   </Card>
                 </Col>
               ))
             )}
           </Row>
         </Container>
       </>
     );
   }
   
   // else: show existing tabbed view with a "← Back to Topics" button
   // Add at the top of the tabbed view (before the tab nav row):
   <Row className="mb-2">
     <Col>
       <button onClick={() => setTopicView(null)} style={{background:'none',border:'none',color:'#5e72e4',fontWeight:700,cursor:'pointer',padding:0,fontSize:13}}>
         ← Back to Topics
       </button>
       <span style={{color:'#8898aa',margin:'0 8px'}}>›</span>
       <span style={{color:'#32325d',fontWeight:600,fontSize:13}}>{topicView.name}</span>
     </Col>
   </Row>
   
   Also change the "Quizzes" tab label to "Practice" in the TABS array:
   { key: 'quizzes', label: `Practice (${quizzes.filter(q=>q.quiz_type==='practice').length})` }
   
   And filter quizzes to only show practice type in the quizzes tab:
   const practiceQuizzes = quizzes.filter(q => q.quiz_type === 'practice');

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — CourseQuiz.js: full Test Sets page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/quiz/CourseQuiz.js (replace the Phase 1 placeholder)

This page:
- Fetches GET /api/quizzes/course/:courseId → list of test-type quizzes for the course
- Shows each as a card: "Test Set 1", "Test Set 2" etc.
- Card shows: title, question count, duration, status (Not Started / Submitted)
- If not started: "Start Test" button → navigate to /admin/quiz/:quizId
- If submitted: "View Results" button → navigate to /admin/quiz/:quizId
  (QuizTaker intro screen handles the rest)
- Admin/Teacher: show "+ New Test Set" button → navigate to quiz builder with courseId context

Full component:

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, CardBody, CardHeader, CardTitle, Button, Badge } from 'reactstrap';
import Header from 'components/Headers/Header.js';
import http from 'utils/http';

export default function CourseQuiz() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const userRole = (window.localStorage.getItem('role') || '').toLowerCase();
  const isStaff = userRole === 'admin' || userRole === 'teacher';

  useEffect(() => {
    Promise.all([
      http.get(`/api/quizzes/course/${courseId}`),
      http.get('/api/courses/my-courses'),
    ]).then(([quizRes, courseRes]) => {
      setQuizzes(quizRes.data || []);
      const course = (courseRes.data || []).find(c => c.id === courseId);
      if (course) setCourseName(course.name);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <>
      <Header />
      <Container className="mt--7" fluid
        style={{backgroundColor:'rgb(196,214,226)',minHeight:'100vh',paddingTop:30,paddingBottom:30}}>
        
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 style={{color:'#32325d',margin:0}}>📝 {courseName} — Test Sets</h2>
                <p className="text-muted small mt-1">Full-length course tests. Complete each in one sitting.</p>
              </div>
              {isStaff && (
                <Button color="primary" style={{borderRadius:8,fontWeight:700}}
                  onClick={() => navigate('/admin/quiz-builder', {state:{courseId,courseName,isCourseQuiz:true}})}>
                  + New Test Set
                </Button>
              )}
            </div>
          </Col>
        </Row>

        {loading ? (
          <Row><Col><Card className="shadow" style={{borderRadius:12}}>
            <CardBody className="text-center py-5"><p>Loading...</p></CardBody>
          </Card></Col></Row>
        ) : quizzes.length === 0 ? (
          <Row><Col><Card className="shadow" style={{borderRadius:12}}>
            <CardBody className="text-center py-5">
              <div style={{fontSize:48,marginBottom:12}}>📋</div>
              <p className="text-muted">No test sets published yet. Check back later.</p>
            </CardBody>
          </Card></Col></Row>
        ) : (
          <Row>
            {quizzes.map((q, idx) => {
              const isSubmitted = q.my_attempt?.status === 'submitted';
              return (
                <Col key={q.id} md="6" lg="4" className="mb-4">
                  <Card className="shadow h-100"
                    style={{borderRadius:14,borderTop:`4px solid ${isSubmitted?'#2dce89':'#5e72e4'}`}}>
                    <CardBody style={{padding:20,display:'flex',flexDirection:'column'}}>
                      <div style={{flex:1}}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 style={{color:'#32325d',marginBottom:4}}>{q.title}</h5>
                          {isSubmitted ? (
                            <Badge color="success">Submitted</Badge>
                          ) : (
                            <Badge color="primary">Not Started</Badge>
                          )}
                        </div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                          <span style={{background:'#f0f4f8',borderRadius:8,padding:'4px 10px',fontSize:12,color:'#525f7f'}}>
                            ❓ {q.question_count} questions
                          </span>
                          <span style={{background:'#f0f4f8',borderRadius:8,padding:'4px 10px',fontSize:12,color:'#525f7f'}}>
                            ⏱ {q.duration_minutes} mins
                          </span>
                          {isSubmitted && q.my_attempt?.score_pct != null && (
                            <span style={{background:'#eafaf1',borderRadius:8,padding:'4px 10px',fontSize:12,color:'#2dce89',fontWeight:700}}>
                              {Number(q.my_attempt.score_pct).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        color={isSubmitted ? 'secondary' : 'primary'}
                        outline={isSubmitted}
                        style={{borderRadius:8,fontWeight:700}}
                        onClick={() => navigate(`/admin/quiz/${q.id}`)}>
                        {isSubmitted ? 'View Results' : 'Start Test'}
                      </Button>
                    </CardBody>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Container>
    </>
  );
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — Backend: course quiz endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/src/modules/quiz/quiz.service.ts

Add function getQuizzesByCourse:

export async function getQuizzesByCourse(courseId: string, studentId: string, role: string) {
  const rows = await query<any>(`
    SELECT
      q.id, q.course_id, q.title, q.quiz_type, q.description,
      q.duration_minutes, q.is_published, q.max_attempts,
      q.created_at,
      COUNT(qs.id) AS question_count,
      -- Student's own attempt (if any)
      qa.id      AS attempt_id,
      qa.status  AS attempt_status,
      qa.score_pct AS attempt_score
    FROM quizzes q
    LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = $2 AND qa.status = 'submitted'
    WHERE q.course_id = $1
      ${role === 'student' ? 'AND q.is_published = true' : ''}
    GROUP BY q.id, qa.id, qa.status, qa.score_pct
    ORDER BY q.created_at ASC
  `, [courseId, studentId]);

  return rows.map(r => ({
    ...r,
    question_count: Number(r.question_count),
    my_attempt: r.attempt_id ? {
      id: r.attempt_id, status: r.attempt_status, score_pct: r.attempt_score
    } : null,
  }));
}

File: server/src/modules/quiz/quiz.controller.ts — add:
export async function getQuizzesByCourse(req: Request, res: Response) {
  try {
    const data = await quizService.getQuizzesByCourse(
      req.params.courseId, req.user!.id, req.user!.role
    );
    return res.json(data);
  } catch (err) {
    console.error('[quiz:course]', err);
    return res.status(500).json({ error: 'Failed to fetch course quizzes' });
  }
}

File: server/src/modules/quiz/quiz.routes.ts — add:
  router.get('/course/:courseId', quizController.getQuizzesByCourse);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — QuizBuilder: support course-level quiz creation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/quiz/QuizBuilder.js

1. Add: const courseId = location.state?.courseId; const isCourseQuiz = location.state?.isCourseQuiz;

2. If isCourseQuiz: force quiz_type to 'test', disable the type selector, change title to "Create Test Set"

3. In handleSave payload:
   if (isCourseQuiz) { payload.courseId = courseId; delete payload.subjectId; }

File: server/src/modules/quiz/quiz.service.ts — update createQuiz:
  Accept optional courseId. When set, insert with course_id instead of subject_id.
  Also update the trigger fn_quiz_teacher_check to allow course_id-based quizzes
  (skip the subject check when course_id is set).

File: server/src/modules/quiz/quiz.routes.ts — update createQuizSchema:
  subjectId: z.string().uuid().optional(),
  courseId:  z.string().uuid().optional(),
  // Validate: one of subjectId or courseId must be present
```

## Phase 4 Test Checklist
```
✅ Clicking subject in sidebar → shows topics grid
✅ Empty subjects show "No topics yet" state
✅ Clicking a topic → shows existing tabbed view with "← Back to Topics" breadcrumb
✅ "Quizzes" tab renamed to "Practice" — shows only practice-type quizzes
✅ Clicking "Quiz" in sidebar under a course → CourseQuiz page loads
✅ CourseQuiz shows test sets with correct status (Not Started / Submitted)
✅ Clicking "Start Test" → QuizTaker with countdown timer
✅ After submitting → card shows "View Results", score displayed
✅ Admin/Teacher: "+ New Test Set" button visible on CourseQuiz page
✅ Creating a test set via QuizBuilder with courseId → appears in CourseQuiz
```

---
---

# ═══ PHASE 5 — Edit / Delete CRUD ═══

## COPILOT PROMPT — PHASE 5

```
Continuing 10xAccel LMS. Phase 5: Edit/Delete for all content types.
All deletes must be SOFT (set is_active=false or deleted_at). Never hard delete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — Admin: Edit/Delete Courses
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/admin/AdminCourses.js
  - Add edit (✏️) and delete (🗑) icon buttons per course row
  - Edit opens a modal pre-filled with course name/code/description
  - Save calls PATCH /api/admin/courses/:courseId
  - Delete shows confirmation → calls DELETE /api/admin/courses/:courseId
  - On success: re-fetch course list

File: server/src/modules/admin/admin.routes.ts
  router.patch('/courses/:courseId',  adminController.updateCourse);
  router.delete('/courses/:courseId', adminController.deleteCourse);

File: server/src/modules/admin/admin.service.ts
  export async function updateCourse(id, data) {
    return query('UPDATE courses SET name=COALESCE($2,name), code=COALESCE($3,code), description=COALESCE($4,description), updated_at=now() WHERE id=$1 RETURNING *', [id, data.name??null, data.code??null, data.description??null]);
  }
  export async function deleteCourse(id) {
    await query('UPDATE courses SET is_active=false, updated_at=now() WHERE id=$1', [id]);
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — Admin: Edit/Delete Subjects
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Same pattern as courses.
File: client/src/views/admin/AdminSubjects.js
File: server/src/modules/admin/admin.routes.ts — add PATCH/DELETE /subjects/:subjectId
File: server/src/modules/admin/admin.service.ts — add updateSubject, deleteSubject

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — Admin/Teacher: Edit/Delete Sessions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/admin/AdminSessions.js and client/src/views/subject/SubjectTeacher.js
  - Add edit and delete buttons per session
  - Edit modal: title, session_date, start_time, end_time, meeting_link
  - PATCH /api/classes/sessions/:sessionId
  - DELETE /api/classes/sessions/:sessionId (sets status='cancelled')

File: server/src/modules/classes/classes.routes.ts
  router.patch('/sessions/:sessionId',  classesController.updateSession);
  router.delete('/sessions/:sessionId', classesController.cancelSession);

File: server/src/modules/classes/classes.service.ts
  export async function updateSession(id, data) { ... }
  export async function cancelSession(id) {
    await query("UPDATE sessions SET status='cancelled', updated_at=now() WHERE id=$1", [id]);
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — Teacher/Admin: Delete Quiz (unpublish = soft delete)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/subject/SubjectTeacher.js
  - In the quizzes list, add delete button (only for unpublished quizzes)
  - Confirm modal → PATCH /api/quizzes/:quizId/unpublish (set is_published=false)

File: server/src/modules/quiz/quiz.routes.ts
  router.delete('/:quizId', quizController.deleteQuiz);

File: server/src/modules/quiz/quiz.service.ts
  export async function softDeleteQuiz(quizId) {
    await query("UPDATE quizzes SET is_published=false, is_active=false, updated_at=now() WHERE id=$1", [quizId]);
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 5 — Topics: Edit/Delete in SubjectTeacher
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/subject/SubjectTeacher.js
  - Add a "Topics" section to the teacher view
  - Shows list of topics with create, edit, delete buttons
  - Create: POST /api/subjects/:subjectId/topics
  - Edit: PATCH /api/subjects/:subjectId/topics/:topicId
  - Delete: DELETE /api/subjects/:subjectId/topics/:topicId
```

## Phase 5 Test Checklist
```
✅ Admin can edit course name → change persists after page reload
✅ Admin can soft-delete course → disappears from list, students can't enroll
✅ Admin can edit/delete subject
✅ Teacher/Admin can edit session title and time → updates in student view
✅ Teacher/Admin can cancel session → shows as cancelled in student view
✅ Teacher can delete unpublished quiz
✅ Teacher can create/edit/delete topics from SubjectTeacher view
✅ All deletes are soft (records still in DB, just hidden)
```

---
---

# ═══ PHASE 6 — Resources Page Overhaul ═══

## COPILOT PROMPT — PHASE 6

```
Continuing 10xAccel LMS. Phase 6: Resources page.

File: client/src/views/examples/Resources.js
Full rewrite. Currently shows a static list.

New behavior:
1. On mount, fetch GET /api/courses/my-courses (already returns courses + subjects array)
2. For each subject, also fetch GET /api/subjects/:id/topics (run in parallel)
3. Display as accordion:
   Course name (bold header, expandable)
   └─ Subject name (sub-header, also expandable)
      ├─ Topics: [Topic 1] [Topic 2] [Topic 3]  (each is a clickable chip → navigate to /admin/subject/:id)
      ├─ [📚 Practice]     → navigate to /admin/subject/:id (student sees topics → clicks topic → practice tab)
      ├─ [📝 Assignments]  → navigate to /admin/subject/:id
      └─ [📁 Materials]    → navigate to /admin/subject/:id

Implementation notes:
- Use React state for expandedCourse and expandedSubject (accordion)
- Fetch topics lazily: when a subject expands, fetch its topics if not already loaded
  Use a Map state: const [topicsMap, setTopicsMap] = useState({}); // {subjectId: topics[]}
- Show skeleton/loading per subject while topics load
- Keep the existing search bar at top, filter subjects by name
- Style: clean card-based layout, not a table
- No changes to backend needed — uses existing /api/courses/my-courses and /api/subjects/:id/topics
```

## Phase 6 Test Checklist
```
✅ Resources page shows enrolled courses
✅ Expanding a course shows its subjects
✅ Expanding a subject shows its topics as clickable chips
✅ Clicking a topic chip navigates to the correct subject page
✅ Practice/Assignments/Materials links navigate to the subject page
✅ Search bar filters subjects by name
✅ Empty state shown when no courses enrolled
```

---
---

# ═══ PHASE 7 — Reports: Practice Scores + Remove Pass Rate ═══

## COPILOT PROMPT — PHASE 7

```
Continuing 10xAccel LMS. Phase 7: Reports overhaul.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — Backend: add practice stats to progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: server/src/modules/progress/progress.service.ts

In getStudentProgress(), the existing query fetches all quizzes combined.
Update the query to split practice vs test stats:

Add to the SELECT block:
  -- Practice-specific stats
  COUNT(DISTINCT qa.id)
    FILTER (WHERE qa.status IN ('submitted','partial') AND qz.quiz_type = 'practice')
                                              AS practice_attempted,
  COUNT(DISTINCT aa.id)
    FILTER (WHERE qa.status IN ('submitted','partial') AND qz.quiz_type = 'practice' AND aa.is_correct = true)
                                              AS practice_correct,
  COUNT(DISTINCT aa.id)
    FILTER (WHERE qa.status IN ('submitted','partial') AND qz.quiz_type = 'practice' AND aa.is_correct = false)
                                              AS practice_incorrect,
  -- Test-specific stats  
  COUNT(DISTINCT qa.id)
    FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')
                                              AS test_attempted,

Also add LEFT JOIN attempt_answers aa ON aa.attempt_id = qa.id (if not already joined).

Update the SubjectProgress interface and return mapping to include these new fields.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — Frontend: Report.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: client/src/views/examples/Report.js

In StudentReport component:
1. Remove ALL "Pass Rate" references:
   - Remove passRate calculation
   - Remove the "Pass Rate" chip from the quiz stats mini-grid
   - Remove ScoreBar for pass rate
   
2. Remove "Passed" count from the hero StatChip row (or replace with "Tests Done")
   Change: <StatChip icon="🏆" label="Passed" value={totalPassed} color="#fff" />
   To:     <StatChip icon="📝" label="Tests" value={data.reduce((s,d)=>s+(d.test_attempted||0),0)} color="#fff" />

3. In each subject card, rename "Quizzes" section to split into two:
   
   TESTS section (for test-type quiz data):
   - Attempted: subj.test_attempted
   - Avg Score bar
   - Best Score bar
   
   PRACTICE section (new):
   - Questions Answered: subj.practice_attempted (show as questions count)
   - Correct: subj.practice_correct  (green chip)
   - Wrong:   subj.practice_incorrect (red chip)
   - Accuracy: if practice_correct+practice_incorrect > 0 → (correct/total)*100%
   - ScoreBar for accuracy

In TeacherReport table:
1. Remove "Passed" column header and cell
2. Add "Practice Q's" column (shows practice questions answered per student)
3. Remove "Pass Rate" from class avg badge — show "Class Avg: X%" only
```

## Phase 7 Test Checklist
```
✅ Student report: "Pass Rate" nowhere on the page
✅ Student report: Subject cards show Tests section and Practice section separately
✅ Student report: Practice section shows questions answered, correct, wrong, accuracy
✅ Teacher report: "Passed" column removed
✅ Teacher report: "Practice Q's" column shows count
✅ Students with only practice data (no tests) still see their practice stats
✅ Students with no data see the empty state card
```

---
---

# ═══ PHASE 8 — Difficulty Color Indicators ═══

## COPILOT PROMPT — PHASE 8

```
Continuing 10xAccel LMS. Phase 8: Difficulty color indicators in QuizTaker.
This is a small targeted change to QuizTaker.js only.

File: client/src/views/quiz/QuizTaker.js

Add this constant near the top of the component:
const DIFF = {
  easy:   { label:'Easy',   color:'#2dce89', bg:'#e3f9ee' },
  medium: { label:'Medium', color:'#fb6340', bg:'#fff0eb' },
  hard:   { label:'Hard',   color:'#f5365c', bg:'#fde8ec' },
};

1. In the taking phase question header, find the difficulty Badge:
   <Badge color="light" style={{ fontWeight: 600 }}>{q?.difficulty}</Badge>
   
   Replace with:
   <span style={{
     background: DIFF[q?.difficulty]?.bg || '#f0f4f8',
     color:      DIFF[q?.difficulty]?.color || '#8898aa',
     borderRadius: 20, padding: '3px 12px',
     fontSize: 11, fontWeight: 700,
   }}>
     {DIFF[q?.difficulty]?.label || q?.difficulty}
   </span>

2. In the question navigator grid, update dot colors by difficulty:
   Find the question nav button styles. Change background to:
   background: isCurrent ? '#5e72e4'
     : isAnswered ? (DIFF[qItem.difficulty]?.color || '#2dce89')
     : '#fff',
   border: `2px solid ${isCurrent ? '#5e72e4' : isAnswered ? (DIFF[qItem.difficulty]?.color||'#2dce89') : '#e9ecef'}`,
   
   Also add a tiny difficulty dot below each number in the nav grid:
   <div style={{fontSize:8, color: DIFF[qItem.difficulty]?.color||'#8898aa'}}>●</div>

3. In the result screen answer review, add difficulty badge next to question number:
   <span style={{
     background: DIFF[a.difficulty]?.bg||'#f0f4f8',
     color: DIFF[a.difficulty]?.color||'#8898aa',
     borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700, marginLeft:8,
   }}>
     {DIFF[a.difficulty]?.label||a.difficulty}
   </span>
   
   Note: the attempt result answers from getAttemptResult() need to include difficulty.
   Update the query in quiz.service.ts getAttemptResult() to add q.difficulty to the SELECT.
```

## Phase 8 Test Checklist
```
✅ Easy questions show green difficulty badge
✅ Medium questions show orange difficulty badge  
✅ Hard questions show red difficulty badge
✅ Question navigator dots colored by difficulty when answered
✅ Result screen shows difficulty badge next to each question
✅ Colors consistent: green=easy, orange=medium, red=hard
```

---
---

# GLOBAL RULES (applies to all phases)

```
1. NEVER hard-delete — always soft delete (is_active=false, status='cancelled', etc.)
2. NEVER touch: auth.service.ts, auth.routes.ts, auth.middleware.ts, db.ts, env.ts
3. All new API endpoints must use authMiddleware
4. After every phase: npm run build must pass with 0 errors
5. Test with all 3 roles after every phase: admin, teacher, student
6. LaTeX: use KaTeX only. Syntax: $inline$ and $$block$$
7. Images: max 5MB, jpg/png/gif/webp only, Supabase Storage quiz-images bucket
8. The db.ts uses a pg Pool. All queries use query() or withTransaction() from config/db
9. Routes use authMiddleware from middlewares/auth.middleware — req.user.id and req.user.role
10. Frontend: React Router v6. Navigation uses useNavigate(). Route state via location.state
11. Frontend HTTP: use the http utility from utils/http (not raw axios directly)
12. Mobile: all new UI must work at 375px minimum width
```

---

# SUPABASE MIGRATION SCRIPT (run all at once after all phases)

```sql
-- Phase 1 migrations
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  order_index SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, name)
);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);

-- Phase 3 migrations
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS last_question_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_status_check
  CHECK (status IN ('in_progress','partial','submitted','timed_out','abandoned'));

-- Phase 4 migrations
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE quizzes ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS trg_quiz_teacher_check;
```
