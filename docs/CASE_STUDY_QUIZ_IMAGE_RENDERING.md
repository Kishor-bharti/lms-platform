# Case Study: Quiz Question Images Not Rendering

## Overview
Users could upload images to quiz questions, the images were successfully stored in Supabase, but when students attempted the quiz or when teachers edited quizzes, the images failed to render. The backend was returning `image_url: null` despite images being uploaded.

## Timeline

### Phase 1: Initial Problem Report
**Symptom:** Students taking quizzes saw missing images despite:
- Upload succeeding (no error messages)
- Direct Supabase URL working when pasted in browser
- Frontend code rendering `<img src={image_url}>` correctly

**First Hypothesis:** Supabase bucket not public / CSP blocking images

### Phase 2: Bucket Configuration Fixed ✅
Discovered and fixed:
- Bucket was set to **Private** (should be **Public**)
- Missing **SELECT RLS policy** on `storage.objects`

Added to Supabase dashboard:
```sql
CREATE POLICY "Public read access for quiz-images"
ON storage.objects FOR SELECT USING (bucket_id = 'quiz-images');
```

**Result:** Direct Supabase URLs now accessible. ✅

### Phase 3: CSP Headers Fixed ✅
Server had **default CSP blocking external image sources** in production.

Added to `server/src/app.ts`:
```typescript
'img-src': ["'self'", 'data:', supabaseOrigin],
```

**Result:** Images could now load through CSP. ✅

### Phase 4: Database Shows NULL - The Real Bug 🔴
Instrumentation revealed the actual issue:

**Frontend (QuizBuilder.js):**
```javascript
[QuizBuilder] Saving Q1 with image_url: 
  https://jiouzrnrbmkntbjlklnl.supabase.co/storage/v1/object/public/quiz-images/1772365482277-zby4a2tuzd.jpeg
```

**Backend (quiz.controller.ts):**
```
[quiz] createQuiz: Q1 from payload: { image_url: undefined, question_text: 'a' }
```

**Database (quiz retrieval):**
```json
{ "id": "8d318236-8cc4-44db-b937-58e9f95bd6ad", "image_url": null, "question_text": "a" }
```

**The mystery:** Frontend has the URL → Backend receives `undefined` → Database stores `null`

---

## Root Cause Analysis

### The Smoking Gun: Zod Validation Schema

Located: `server/src/modules/quiz/quiz.routes.ts`

The `questionSchema` was defined as:
```typescript
const questionSchema = z.object({
  question_text: z.string().min(1),
  explanation:   z.string().optional(),
  difficulty:    z.enum(['easy', 'medium', 'hard']),
  marks:         z.number().int().min(1).max(100),
  order_index:   z.number().int().min(0),
  options:       z.array(optionSchema).min(2).max(6),
  // ❌ MISSING: image_url
  // ❌ MISSING: topic_id
});
```

### The Mechanism

1. **Frontend sends valid payload:**
   ```json
   {
     "question_text": "Which car?",
     "image_url": "https://jiouzrnrbmkntbjlklnl.supabase.co/storage/v1/object/...",
     "topic_id": "abc-123-def",
     "difficulty": "medium",
     ...
   }
   ```

2. **Validation middleware processes it:**
   ```typescript
   // validateBody middleware
   const result = schema.safeParse(req.body);  // Zod validates
   req.body = result.data;                      // ⚠️ Zod strips unknown fields!
   ```

3. **Zod's behavior:** By default, `safeParse()` **silently removes any fields not in the schema** (stripping mode). This is a security feature to prevent injection of unexpected fields.

4. **Result after validation:**
   ```json
   {
     "question_text": "Which car?",
     // ❌ image_url gone (not in schema)
     // ❌ topic_id gone (not in schema)
     "difficulty": "medium",
     ...
   }
   ```

5. **Backend receives undefined fields** → defaults them to `null` → saves `null` to database

### Why It Wasn't Caught Earlier

- **No TypeScript errors** — Zod strips at runtime; no compile-time warning
- **Silent failure** — No error message; validation passed, fields just vanished
- **Assumption mistake** — Dev assumed all fields in frontend payload were validated. Zod actually strips unrecognized fields by design
- **Schema incomplete** — `image_url` and `topic_id` are genuine business fields, not extras

---

## The Solution

### Added Missing Fields to `questionSchema`

**File:** `server/src/modules/quiz/quiz.routes.ts`

```typescript
const questionSchema = z.object({
  question_text: z.string().min(1),
  image_url:     z.string().url().optional().or(z.literal('')),  // ✅ Added
  explanation:   z.string().optional(),
  difficulty:    z.enum(['easy', 'medium', 'hard']),
  marks:         z.number().int().min(1).max(100),
  order_index:   z.number().int().min(0),
  topic_id:      z.string().uuid().optional().or(z.literal('')),  // ✅ Added
  options:       z.array(optionSchema).min(2).max(6),
});
```

**Why `.or(z.literal(''))`?** — The frontend's `BLANK_QUESTION` initializes these with empty strings (`image_url: ''`, `topic_id: ''`), so we allow both optional UUIDs and empty strings.

### Updated Both Schemas

Applied the same fix to `updateQuizSchema` to handle quiz edits.

---

## Impact & Verification

### Before Fix
```json
{
  "image_url": null,
  "topic_id": null,
  "question_text": "Which car?"
}
```

### After Fix
```json
{
  "image_url": "https://jiouzrnrbmkntbjlklnl.supabase.co/storage/v1/object/public/quiz-images/1772365482277-zby4a2tuzd.jpeg",
  "topic_id": "abc-123-def-456",
  "question_text": "Which car?"
}
```

### Fixed Issues
1. ✅ Images now render in quiz attempts
2. ✅ Topic tags preserved when editing quizzes
3. ✅ Images visible in quiz review/results screens
4. ✅ Images visible when editing quizzes (pre-populated)

---

## Key Learnings

### 1. Zod's Stripping Behavior
By default, `z.object().parse()` or `safeParse()` **strips unknown properties**. If you don't want this:
```typescript
// ❌ Strips unknown fields (default)
const result = schema.safeParse(req.body);

// ✅ Allows unknown fields (if needed)
const schema = z.object({...}).passthrough();
```

### 2. Schema-Driven Development Risk
When using validation schemas as the source of truth:
- **Every business field** must be explicitly declared
- Easy to forget optional fields when they're not shown in UI by default (images are lazy-loaded, topic_id is pre-set)
- Requires discipline to keep schema in sync with data model

### 3. Silent Failures Are Dangerous
Zod's silent stripping is intentional (security), but it masked a real bug. Add logging:
```typescript
if (!result.success) console.error('Validation failed');
console.log('Parsed body:', result.data); // Log what got through
```

### 4. Test Coverage Gaps
The bug wasn't caught because:
- No integration test for "upload image → save quiz → retrieve quiz → image present"
- Tests that mock responses don't catch database layer issues

---

## Solution Checklist

- [x] Add `image_url` field to `questionSchema` in Zod
- [x] Add `topic_id` field to `questionSchema` in Zod
- [x] Apply same to `updateQuizSchema` for edit flow
- [x] Verify TypeScript compilation
- [x] Rebuild and test in UI
- [x] Confirm images now render in student quiz attempts
- [x] Confirm topic tags preserved on edit

---

## Recommendations for Future

1. **Validate schema against data model:**
   ```typescript
   // Keep this comment updated as a checklist
   // Schema fields: question_text ✓, image_url ✓, topic_id ✓, explanation ✓, ...
   ```

2. **Enable strict mode on Zod:**
   ```typescript
   const schema = z.object({...}).strict(); // Reject unknown fields explicitly
   ```

3. **Add middleware logging:**
   ```typescript
   export function validateBody(schema: ZodSchema) {
     return (req, res, next) => {
       const result = schema.safeParse(req.body);
       if (!result.success) {
         console.warn('Validation error:', result.error);
       } else if (Object.keys(result.data).length < Object.keys(req.body).length) {
         console.warn('Fields stripped during validation:', 
           Object.keys(req.body).filter(k => !(k in result.data)));
       }
       // ...
     };
   }
   ```

4. **Integration test:**
   ```typescript
   describe('Quiz image persistence', () => {
     it('should save and retrieve question images', async () => {
       const quiz = await createQuizWithImage('https://example.com/image.jpg');
       const retrieved = await getQuiz(quiz.id);
       expect(retrieved.questions[0].image_url).toBe('https://example.com/image.jpg');
     });
   });
   ```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Duration** | ~2 hours investigation |
| **Root Cause** | Zod validation schema missing `image_url` and `topic_id` fields |
| **Fix Complexity** | Low (2 lines added to schema) |
| **Impact** | Critical (image rendering, quiz editing) |
| **Prevention** | Schema validation, integration tests, middleware logging |

The silent stripping behavior of Zod combined with incomplete schema definitions created a bug that was hard to detect — frontend code was correct, Supabase was correctly configured, but the validation layer discarded the data.
