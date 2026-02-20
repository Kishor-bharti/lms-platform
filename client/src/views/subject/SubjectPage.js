// SubjectPage.js — role-based wrapper
// Renders SubjectTeacher for teachers/admins, SubjectStudent for students

import React from "react";
import SubjectStudent from "./SubjectStudent";
import SubjectTeacher from "./SubjectTeacher";

export default function SubjectPage() {
  const role = typeof window !== "undefined"
    ? window.localStorage.getItem("role")
    : null;

  if (role === "teacher" || role === "admin") {
    return <SubjectTeacher />;
  }
  return <SubjectStudent />;
}
