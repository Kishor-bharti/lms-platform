--
-- PostgreSQL database dump
--

\restrict 8pkuQcjIw0toBNicSn0fdtEktVlGgpqMOr19YRcPcZSB6cDZYzUDRn4qUcjI0Sa

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_quiz_teacher_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_quiz_teacher_check() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.created_by AND role_id = 1) THEN
    RETURN NEW;
  END IF;
  IF NEW.course_id IS NOT NULL AND NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subject_teachers WHERE subject_id = NEW.subject_id AND teacher_id = NEW.created_by) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fn_session_teacher_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_session_teacher_check() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles
             WHERE user_id = NEW.teacher_id AND role_id = 1) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subject_teachers
                 WHERE subject_id = NEW.subject_id
                 AND teacher_id = NEW.teacher_id) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assignment_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    submission_url text,
    notes text,
    submitted_at timestamp with time zone,
    is_late boolean DEFAULT false NOT NULL,
    marks_awarded numeric(6,2),
    feedback text,
    graded_by uuid,
    graded_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT assignment_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'submitted'::character varying, 'graded'::character varying, 'returned'::character varying])::text[])))
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    due_date timestamp with time zone,
    max_marks numeric(6,2) DEFAULT 100 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    attachment_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    topic_id uuid
);


--
-- Name: attempt_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option_id uuid,
    is_correct boolean,
    marks_awarded numeric(4,2),
    time_spent_seconds integer,
    answered_at timestamp with time zone
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    option_label character(1) NOT NULL,
    option_text text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    CONSTRAINT options_option_label_check CHECK ((option_label = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar, 'D'::bpchar])))
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    set_id uuid,
    topic_id uuid,
    question_text text NOT NULL,
    image_url text,
    explanation text,
    difficulty character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    order_index smallint DEFAULT 0 NOT NULL,
    marks numeric(4,2) DEFAULT 1.00 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    explanation_image_url text,
    CONSTRAINT questions_difficulty_check CHECK (((difficulty)::text = ANY ((ARRAY['easy'::character varying, 'medium'::character varying, 'hard'::character varying])::text[])))
);


--
-- Name: quiz_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    set_id uuid,
    student_id uuid NOT NULL,
    attempt_number smallint DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    time_taken_seconds integer,
    marks_obtained numeric(7,2),
    total_marks numeric(7,2),
    score_pct numeric(5,2),
    is_passed boolean,
    ip_address inet,
    last_question_index integer DEFAULT 0 NOT NULL,
    CONSTRAINT quiz_attempts_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'partial'::character varying, 'submitted'::character varying, 'timed_out'::character varying, 'abandoned'::character varying])::text[])))
);


--
-- Name: quiz_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    set_number smallint NOT NULL,
    title character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    quiz_type character varying(20) NOT NULL,
    description text,
    duration_minutes smallint NOT NULL,
    passing_score numeric(5,2),
    is_published boolean DEFAULT false NOT NULL,
    available_from timestamp with time zone,
    available_until timestamp with time zone,
    max_attempts smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    course_id uuid,
    topic_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT quizzes_quiz_type_check CHECK (((quiz_type)::text = ANY ((ARRAY['test'::character varying, 'practice'::character varying])::text[])))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id smallint NOT NULL,
    name character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_recurrence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_recurrence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pattern character varying(20) NOT NULL,
    interval_value smallint DEFAULT 1 NOT NULL,
    days_of_week smallint[],
    recur_until date,
    max_occurrences smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_recurrence_pattern_check CHECK (((pattern)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    session_date date NOT NULL,
    start_time time with time zone NOT NULL,
    end_time time with time zone NOT NULL,
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying NOT NULL,
    meeting_link text,
    meeting_password character varying(100),
    zoom_meeting_id character varying(100),
    zoom_start_url text,
    zoom_host_email character varying(255),
    recording_url text,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    topic_id uuid,
    CONSTRAINT sessions_check CHECK ((end_time > start_time)),
    CONSTRAINT sessions_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'live'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: student_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    quizzes_attempted integer DEFAULT 0 NOT NULL,
    quizzes_passed integer DEFAULT 0 NOT NULL,
    avg_score_pct numeric(5,2),
    best_score_pct numeric(5,2),
    total_time_spent_mins integer DEFAULT 0 NOT NULL,
    assignments_submitted integer DEFAULT 0 NOT NULL,
    assignments_graded integer DEFAULT 0 NOT NULL,
    avg_assignment_marks numeric(6,2),
    sessions_attended integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp with time zone,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subject_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrollment_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    enrolled_by uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subject_enrollments_enrollment_status_check CHECK (((enrollment_status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: subject_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    material_type character varying(20) NOT NULL,
    file_url text NOT NULL,
    file_size_kb integer,
    order_index smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    topic_id uuid,
    CONSTRAINT subject_materials_material_type_check CHECK (((material_type)::text = ANY ((ARRAY['pdf'::character varying, 'video'::character varying, 'link'::character varying, 'doc'::character varying, 'image'::character varying])::text[])))
);


--
-- Name: subject_teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_teachers (
    subject_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid NOT NULL
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(30) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    order_index smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id smallint NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(20),
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_session_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_session_dashboard AS
 SELECT s.id,
    s.title,
    s.session_date,
    s.start_time,
    s.end_time,
    s.meeting_link,
    s.meeting_password,
    s.recording_url,
    s.status,
    s.zoom_meeting_id,
    s.timezone,
    s.is_recurring,
        CASE
            WHEN ((s.status)::text = 'live'::text) THEN 'live'::character varying
            WHEN ((s.session_date = CURRENT_DATE) AND ((s.status)::text = 'scheduled'::text)) THEN 'today'::character varying
            WHEN ((s.session_date = (CURRENT_DATE + 1)) AND ((s.status)::text = 'scheduled'::text)) THEN 'tomorrow'::character varying
            WHEN (s.session_date > (CURRENT_DATE + 1)) THEN 'scheduled'::character varying
            ELSE s.status
        END AS display_status,
    sub.name AS subject_name,
    sub.code AS subject_code,
    c.name AS course_name,
    c.code AS course_code,
    (((t.first_name)::text || ' '::text) || (t.last_name)::text) AS teacher_name,
    t.email AS teacher_email,
    sr.pattern,
    sr.days_of_week,
    sr.recur_until
   FROM ((((public.sessions s
     JOIN public.subjects sub ON ((sub.id = s.subject_id)))
     JOIN public.courses c ON ((c.id = sub.course_id)))
     JOIN public.users t ON ((t.id = s.teacher_id)))
     LEFT JOIN public.session_recurrence sr ON ((sr.id = s.recurrence_id)));


--
-- Name: v_student_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_student_report AS
 SELECT sp.id,
    sp.student_id,
    sp.subject_id,
    sp.quizzes_attempted,
    sp.quizzes_passed,
    sp.avg_score_pct,
    sp.best_score_pct,
    sp.total_time_spent_mins,
    sp.assignments_submitted,
    sp.assignments_graded,
    sp.avg_assignment_marks,
    sp.sessions_attended,
    sp.last_activity_at,
    sp.computed_at,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS student_name,
    u.email AS student_email,
    sub.name AS subject_name,
    sub.code AS subject_code,
    c.name AS course_name,
    c.code AS course_code
   FROM (((public.student_progress sp
     JOIN public.users u ON ((u.id = sp.student_id)))
     JOIN public.subjects sub ON ((sub.id = sp.subject_id)))
     JOIN public.courses c ON ((c.id = sub.course_id)));


--
-- Name: v_subject_resources; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_subject_resources AS
 SELECT sub.id AS subject_id,
    sub.name AS subject_name,
    c.name AS course_name,
    count(DISTINCT
        CASE
            WHEN ((q.quiz_type)::text = 'test'::text) THEN q.id
            ELSE NULL::uuid
        END) AS test_quizzes,
    count(DISTINCT
        CASE
            WHEN ((q.quiz_type)::text = 'practice'::text) THEN q.id
            ELSE NULL::uuid
        END) AS practice_quizzes,
    count(DISTINCT a.id) AS total_assignments,
    count(DISTINCT sm.id) AS total_materials
   FROM ((((public.subjects sub
     JOIN public.courses c ON ((c.id = sub.course_id)))
     LEFT JOIN public.quizzes q ON (((q.subject_id = sub.id) AND (q.is_published = true))))
     LEFT JOIN public.assignments a ON (((a.subject_id = sub.id) AND (a.is_published = true))))
     LEFT JOIN public.subject_materials sm ON (((sm.subject_id = sub.id) AND (sm.is_active = true))))
  GROUP BY sub.id, sub.name, c.name;


--
-- Name: v_teacher_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_teacher_dashboard AS
 SELECT st.teacher_id,
    (((t.first_name)::text || ' '::text) || (t.last_name)::text) AS teacher_name,
    sub.id AS subject_id,
    sub.name AS subject_name,
    c.name AS course_name,
    count(DISTINCT se.student_id) FILTER (WHERE ((se.enrollment_status)::text = 'active'::text)) AS enrolled_students,
    count(DISTINCT q.id) AS total_quizzes,
    count(DISTINCT a.id) AS total_assignments
   FROM ((((((public.subject_teachers st
     JOIN public.users t ON ((t.id = st.teacher_id)))
     JOIN public.subjects sub ON ((sub.id = st.subject_id)))
     JOIN public.courses c ON ((c.id = sub.course_id)))
     LEFT JOIN public.subject_enrollments se ON ((se.subject_id = sub.id)))
     LEFT JOIN public.quizzes q ON ((q.subject_id = sub.id)))
     LEFT JOIN public.assignments a ON ((a.subject_id = sub.id)))
  GROUP BY st.teacher_id, t.first_name, t.last_name, sub.id, sub.name, c.name;


--
-- Name: assignment_submissions assignment_submissions_assignment_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id);


--
-- Name: assignment_submissions assignment_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: attempt_answers attempt_answers_attempt_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_attempt_id_question_id_key UNIQUE (attempt_id, question_id);


--
-- Name: attempt_answers attempt_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_pkey PRIMARY KEY (id);


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);


--
-- Name: courses courses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_name_key UNIQUE (name);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: options options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (id);


--
-- Name: options options_question_id_option_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_question_id_option_label_key UNIQUE (question_id, option_label);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: quiz_attempts quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiz_attempts quiz_attempts_quiz_id_student_id_attempt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_quiz_id_student_id_attempt_number_key UNIQUE (quiz_id, student_id, attempt_number);


--
-- Name: quiz_sets quiz_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_sets
    ADD CONSTRAINT quiz_sets_pkey PRIMARY KEY (id);


--
-- Name: quiz_sets quiz_sets_quiz_id_set_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_sets
    ADD CONSTRAINT quiz_sets_quiz_id_set_number_key UNIQUE (quiz_id, set_number);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: session_recurrence session_recurrence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_recurrence
    ADD CONSTRAINT session_recurrence_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: student_progress student_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_pkey PRIMARY KEY (id);


--
-- Name: student_progress student_progress_student_id_subject_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_student_id_subject_id_key UNIQUE (student_id, subject_id);


--
-- Name: subject_enrollments subject_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_enrollments
    ADD CONSTRAINT subject_enrollments_pkey PRIMARY KEY (id);


--
-- Name: subject_enrollments subject_enrollments_subject_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_enrollments
    ADD CONSTRAINT subject_enrollments_subject_id_student_id_key UNIQUE (subject_id, student_id);


--
-- Name: subject_materials subject_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_materials
    ADD CONSTRAINT subject_materials_pkey PRIMARY KEY (id);


--
-- Name: subject_teachers subject_teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_teachers
    ADD CONSTRAINT subject_teachers_pkey PRIMARY KEY (subject_id, teacher_id);


--
-- Name: subjects subjects_course_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_course_id_code_key UNIQUE (course_id, code);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: topics topics_subject_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_subject_id_name_key UNIQUE (subject_id, name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_answers_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answers_attempt ON public.attempt_answers USING btree (attempt_id);


--
-- Name: idx_assignments_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_subject ON public.assignments USING btree (subject_id);


--
-- Name: idx_attempts_quiz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_quiz ON public.quiz_attempts USING btree (quiz_id);


--
-- Name: idx_attempts_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_started ON public.quiz_attempts USING btree (started_at);


--
-- Name: idx_attempts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_status ON public.quiz_attempts USING btree (status);


--
-- Name: idx_attempts_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_student ON public.quiz_attempts USING btree (student_id);


--
-- Name: idx_enrollments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_status ON public.subject_enrollments USING btree (enrollment_status);


--
-- Name: idx_enrollments_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_student ON public.subject_enrollments USING btree (student_id);


--
-- Name: idx_enrollments_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_subject ON public.subject_enrollments USING btree (subject_id);


--
-- Name: idx_materials_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_subject ON public.subject_materials USING btree (subject_id, order_index);


--
-- Name: idx_one_correct_per_question; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_one_correct_per_question ON public.options USING btree (question_id) WHERE (is_correct = true);


--
-- Name: idx_options_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_options_question ON public.options USING btree (question_id);


--
-- Name: idx_progress_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_student ON public.student_progress USING btree (student_id);


--
-- Name: idx_progress_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_subject ON public.student_progress USING btree (subject_id);


--
-- Name: idx_questions_quiz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_quiz ON public.questions USING btree (quiz_id);


--
-- Name: idx_questions_set; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_set ON public.questions USING btree (set_id);


--
-- Name: idx_questions_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_topic ON public.questions USING btree (topic_id);


--
-- Name: idx_quizzes_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_is_active ON public.quizzes USING btree (is_active);


--
-- Name: idx_quizzes_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_published ON public.quizzes USING btree (is_published, available_from, available_until);


--
-- Name: idx_quizzes_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_subject ON public.quizzes USING btree (subject_id);


--
-- Name: idx_quizzes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_type ON public.quizzes USING btree (quiz_type);


--
-- Name: idx_sessions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_date ON public.sessions USING btree (session_date);


--
-- Name: idx_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_status ON public.sessions USING btree (status);


--
-- Name: idx_sessions_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_subject ON public.sessions USING btree (subject_id);


--
-- Name: idx_sessions_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_teacher ON public.sessions USING btree (teacher_id, session_date, status);


--
-- Name: idx_sessions_zoom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_zoom_id ON public.sessions USING btree (zoom_meeting_id);


--
-- Name: idx_subject_teachers_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_teachers_subject ON public.subject_teachers USING btree (subject_id);


--
-- Name: idx_subject_teachers_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_teachers_teacher ON public.subject_teachers USING btree (teacher_id);


--
-- Name: idx_submissions_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_assignment ON public.assignment_submissions USING btree (assignment_id);


--
-- Name: idx_submissions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_student ON public.assignment_submissions USING btree (student_id);


--
-- Name: idx_topics_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_subject ON public.topics USING btree (subject_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: quizzes trg_quiz_teacher_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quiz_teacher_check BEFORE INSERT ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_teacher_check();


--
-- Name: sessions trg_session_teacher_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_session_teacher_check BEFORE INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.fn_session_teacher_check();


--
-- Name: assignments trg_updated_at_assignments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_assignments BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: courses trg_updated_at_courses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_courses BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: questions trg_updated_at_questions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_questions BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: quizzes trg_updated_at_quizzes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_quizzes BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: sessions trg_updated_at_sessions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_sessions BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: subject_materials trg_updated_at_subject_materials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_subject_materials BEFORE UPDATE ON public.subject_materials FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: subjects trg_updated_at_subjects; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_subjects BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: users trg_updated_at_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: assignment_submissions assignment_submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: assignment_submissions assignment_submissions_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.users(id);


--
-- Name: assignment_submissions assignment_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: assignments assignments_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: attempt_answers attempt_answers_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(id) ON DELETE CASCADE;


--
-- Name: attempt_answers attempt_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: attempt_answers attempt_answers_selected_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_answers
    ADD CONSTRAINT attempt_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.options(id);


--
-- Name: courses courses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: options options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: questions questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: questions questions_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: questions questions_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.quiz_sets(id) ON DELETE CASCADE;


--
-- Name: questions questions_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: quiz_attempts quiz_attempts_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_attempts quiz_attempts_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.quiz_sets(id);


--
-- Name: quiz_attempts quiz_attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quiz_sets quiz_sets_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_sets
    ADD CONSTRAINT quiz_sets_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quizzes quizzes_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_recurrence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_recurrence_id_fkey FOREIGN KEY (recurrence_id) REFERENCES public.session_recurrence(id);


--
-- Name: sessions sessions_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: student_progress student_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_progress student_progress_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: subject_enrollments subject_enrollments_enrolled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_enrollments
    ADD CONSTRAINT subject_enrollments_enrolled_by_fkey FOREIGN KEY (enrolled_by) REFERENCES public.users(id);


--
-- Name: subject_enrollments subject_enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_enrollments
    ADD CONSTRAINT subject_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subject_enrollments subject_enrollments_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_enrollments
    ADD CONSTRAINT subject_enrollments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: subject_materials subject_materials_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_materials
    ADD CONSTRAINT subject_materials_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: subject_materials subject_materials_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_materials
    ADD CONSTRAINT subject_materials_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: subject_materials subject_materials_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_materials
    ADD CONSTRAINT subject_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: subject_teachers subject_teachers_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_teachers
    ADD CONSTRAINT subject_teachers_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: subject_teachers subject_teachers_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_teachers
    ADD CONSTRAINT subject_teachers_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: subject_teachers subject_teachers_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_teachers
    ADD CONSTRAINT subject_teachers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: topics topics_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: topics topics_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8pkuQcjIw0toBNicSn0fdtEktVlGgpqMOr19YRcPcZSB6cDZYzUDRn4qUcjI0Sa

