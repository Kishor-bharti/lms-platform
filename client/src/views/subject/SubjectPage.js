// SubjectPage.js — role-based wrapper
// Renders SubjectTeacher for teachers/admins, SubjectStudent for students

import React from "react";
import SubjectStudent from "./SubjectStudent";
import SubjectTeacher from "./SubjectTeacher";
import { useAuth } from 'context/AuthContext';

export default function SubjectPage() {
  const { role } = useAuth();

  if (role === "teacher" || role === "admin") {
    return <SubjectTeacher />;
  }
  return <SubjectStudent />;
}
