import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import http from "utils/http";
import { withTimeZoneQuery } from "utils/date";
import routes from "routes.js";

/* ── route → icon ── */
const ROUTE_ICON = {
  "/admin/index":          "ni ni-tv-2",
  "/admin/sessions":       "ni ni-calendar-grid-58",
  "/admin/classes":        "ni ni-books",
  "/admin/report":         "ni ni-chart-bar-32",
  "/admin/profile":        "ni ni-single-02",
  "/admin/admin-overview": "ni ni-settings-gear-65",
  "/admin/admin-users":    "ni ni-single-02",
  "/admin/admin-courses":  "ni ni-book-bookmark",
  "/admin/admin-subjects": "ni ni-collection",
  "/admin/admin-sessions": "ni ni-calendar-grid-58",
};

/* ── highlight query inside a string ── */
function Highlight({ text = "", query = "" }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(94,114,228,0.25)", color: "#5e72e4", borderRadius: 3, padding: "0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchBar() {
  const navigate  = useNavigate();
  const inputRef  = useRef(null);
  const wrapRef   = useRef(null);

  const [query,     setQuery]     = useState("");
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [groups,    setGroups]    = useState([]);   // [{label, icon, items:[{title,sub,path,icon}]}]
  const [activeIdx, setActiveIdx] = useState(-1);
  const [cache,     setCache]     = useState(null); // fetched API data

  const role    = (typeof window !== "undefined" ? window.localStorage.getItem("role") : "") || "";
  const isAdmin = role === "admin";

  /* ── flatten results for keyboard nav ── */
  const flat = groups.flatMap(g => g.items);

  /* ── page results (client-side) ── */
  const pageResults = useCallback((q) => {
    const uRole = role.toUpperCase();
    return routes
      .filter(r =>
        r.layout === "/admin" &&
        r.path !== "/logout" &&
        !r.path.includes(":") &&
        (!r.roles || r.roles.includes(uRole)) &&
        r.name.toLowerCase().includes(q.toLowerCase())
      )
      .slice(0, 5)
      .map(r => ({
        title: r.name,
        sub: (r.layout + r.path).replace("/admin", ""),
        path: r.layout + r.path,
        icon: ROUTE_ICON[r.layout + r.path] || "ni ni-tv-2",
      }));
  }, [role]);

  /* ── fetch + cache API data once, then filter ── */
  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setGroups([]); return; }

    setLoading(true);
    try {
      let data = cache;
      if (!data) {
        const [coursesRes, sessionsRes, usersRes] = await Promise.all([
          isAdmin
            ? http.get("/api/admin/courses")
            : http.get("/api/courses/my-courses"),
          isAdmin
            ? http.get("/api/admin/sessions?limit=100")
            : http.get(withTimeZoneQuery("/api/classes/my-sessions-v2")),
          isAdmin ? http.get("/api/admin/users?limit=200") : Promise.resolve(null),
        ]);
        data = {
          courses:  Array.isArray(coursesRes?.data)  ? coursesRes.data  : [],
          sessions: Array.isArray(sessionsRes?.data) ? sessionsRes.data : [],
          users:    Array.isArray(usersRes?.data?.users)
            ? usersRes.data.users
            : Array.isArray(usersRes?.data)
              ? usersRes.data
              : [],
        };
        setCache(data);
      }

      const qL = q.toLowerCase();
      const newGroups = [];

      /* pages */
      const pageItems = pageResults(q);
      if (pageItems.length)
        newGroups.push({ label: "Pages", icon: "ni ni-compass-04", items: pageItems });

      /* courses */
      const courseItems = data.courses
        .filter(c => (c.name || "").toLowerCase().includes(qL))
        .slice(0, 4)
        .map(c => ({
          title: c.name,
          sub:   c.code ? `Code: ${c.code}` : c.description?.slice(0, 45) || "Course",
          path:  isAdmin ? "/admin/admin-courses" : "/admin/index",
          icon:  "ni ni-book-bookmark",
        }));
      if (courseItems.length)
        newGroups.push({ label: "Courses", icon: "ni ni-book-bookmark", items: courseItems });

      /* sessions */
      const sessionItems = data.sessions
        .filter(s => (s.title || s.class_title || s.name || "").toLowerCase().includes(qL))
        .slice(0, 4)
        .map(s => ({
          title: s.title || s.class_title || s.name || "Session",
          sub:   s.class_title && s.title !== s.class_title
            ? `Subject: ${s.class_title}`
            : s.scheduled_at
              ? new Date(s.scheduled_at).toLocaleDateString()
              : "Session",
          path:  isAdmin ? "/admin/admin-sessions" : role === "student" ? "/admin/classes" : "/admin/sessions",
          icon:  "ni ni-calendar-grid-58",
        }));
      if (sessionItems.length)
        newGroups.push({ label: "Sessions", icon: "ni ni-calendar-grid-58", items: sessionItems });

      /* users — admin only */
      if (isAdmin) {
        const userItems = data.users
          .filter(u => {
            const full = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
            return full.trim().includes(qL) || (u.email || "").toLowerCase().includes(qL);
          })
          .slice(0, 4)
          .map(u => ({
            title: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
            sub:   u.email,
            path:  "/admin/admin-users",
            icon:  "ni ni-single-02",
          }));
        if (userItems.length)
          newGroups.push({ label: "Users", icon: "ni ni-single-02", items: userItems });
      }

      setGroups(newGroups);
    } catch (err) {
      console.error("[SearchBar] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [cache, isAdmin, pageResults, role]);

  /* ── debounce ── */
  useEffect(() => {
    if (!query.trim()) { setGroups([]); setOpen(false); setActiveIdx(-1); return; }
    setOpen(true);
    const t = setTimeout(() => doSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  /* ── keyboard navigation ── */
  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && flat[activeIdx]) go(flat[activeIdx].path);
      else if (flat.length === 1) go(flat[0].path);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const go = (path) => {
    navigate(path);
    setQuery("");
    setGroups([]);
    setOpen(false);
    setActiveIdx(-1);
  };

  /* ── click outside ── */
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const clear = () => { setQuery(""); setGroups([]); setOpen(false); inputRef.current?.focus(); };

  /* ── render ── */
  return (
    <div ref={wrapRef} className="sb-wrap">
      {/* ── input row ── */}
      <div className="sb-input-row">
        <span className="sb-icon-left">
          {loading
            ? <span className="sb-spinner" />
            : <i className="fas fa-search" />
          }
        </span>
        <input
          ref={inputRef}
          className="sb-input"
          placeholder="Search anything..."
          value={query}
          autoComplete="off"
          spellCheck="false"
          onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button className="sb-clear" onClick={clear} tabIndex={-1}>×</button>
        )}
        <span className="sb-kbd-hint">⌘K</span>
      </div>

      {/* ── dropdown ── */}
      {open && (
        <div className="sb-dropdown">
          {/* no results */}
          {!loading && query.length >= 2 && groups.length === 0 && (
            <div className="sb-empty">
              <i className="fas fa-search sb-empty-icon" />
              <p>No results for <strong>"{query}"</strong></p>
            </div>
          )}

          {/* hint when too short */}
          {query.length < 2 && (
            <div className="sb-hint">Type at least 2 characters…</div>
          )}

          {/* loading skeleton */}
          {loading && (
            <div className="sb-loading">
              {[1,2,3].map(i => <div key={i} className="sb-skeleton" style={{ width: `${60+i*10}%` }} />)}
            </div>
          )}

          {/* results */}
          {!loading && groups.map((grp, gi) => {
            const offset = groups.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
            return (
              <div key={grp.label} className="sb-group">
                <div className="sb-group-label">
                  <i className={grp.icon} />
                  {grp.label}
                </div>
                {grp.items.map((item, ii) => {
                  const idx = offset + ii;
                  return (
                    <div
                      key={ii}
                      className={`sb-item${activeIdx === idx ? " sb-item-active" : ""}`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseLeave={() => setActiveIdx(-1)}
                      onClick={() => go(item.path)}
                    >
                      <span className="sb-item-icon">
                        <i className={item.icon} />
                      </span>
                      <span className="sb-item-text">
                        <span className="sb-item-title">
                          <Highlight text={item.title} query={query} />
                        </span>
                        <span className="sb-item-sub">{item.sub}</span>
                      </span>
                      <span className="sb-item-enter">↵</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* footer */}
          {!loading && groups.length > 0 && (
            <div className="sb-footer">
              <span><kbd>↑↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>Esc</kbd> close</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        /* ── wrapper ── */
        .sb-wrap {
          position: relative;
          width: 280px;
        }

        /* ── input row ── */
        .sb-input-row {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 12px;
          padding: 0 10px;
          gap: 8px;
          transition: all 0.25s ease;
          height: 38px;
        }
        .sb-input-row:focus-within {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.3);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
        }
        .sb-icon-left {
          color: rgba(255,255,255,0.55);
          font-size: 13px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          width: 14px;
        }
        .sb-input {
          flex: 1;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          color: #fff !important;
          font-size: 13px;
          padding: 0 !important;
          min-width: 0;
        }
        .sb-input::placeholder { color: rgba(255,255,255,0.45) !important; }
        .sb-clear {
          background: rgba(255,255,255,0.15);
          border: none;
          color: rgba(255,255,255,0.7);
          border-radius: 50%;
          width: 18px; height: 18px;
          font-size: 14px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .sb-clear:hover { background: rgba(255,255,255,0.28); color: #fff; }
        .sb-kbd-hint {
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          padding: 1px 5px;
          flex-shrink: 0;
          letter-spacing: 0.3px;
          font-family: monospace;
          display: none;
        }
        .sb-input-row:not(:focus-within) .sb-kbd-hint { display: inline; }
        .sb-input-row:focus-within .sb-kbd-hint { display: none; }

        /* ── spinner ── */
        .sb-spinner {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: rgba(255,255,255,0.8);
          border-radius: 50%;
          animation: sbSpin 0.6s linear infinite;
        }
        @keyframes sbSpin { to { transform: rotate(360deg); } }

        /* ── dropdown ── */
        .sb-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          min-width: 340px;
          max-height: 440px;
          overflow-y: auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.06);
          z-index: 9999;
          padding: 6px 0 0;
          animation: sbDrop 0.18s ease;
        }
        @keyframes sbDrop {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sb-dropdown::-webkit-scrollbar { width: 4px; }
        .sb-dropdown::-webkit-scrollbar-track { background: transparent; }
        .sb-dropdown::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

        /* ── group ── */
        .sb-group { padding: 4px 0; }
        .sb-group + .sb-group { border-top: 1px solid #f0f2f5; }
        .sb-group-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 700;
          color: #a0aec0;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          padding: 8px 16px 4px;
        }
        .sb-group-label i { font-size: 11px; color: #5e72e4; }

        /* ── item ── */
        .sb-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 16px;
          cursor: pointer;
          transition: background 0.12s;
          border-radius: 0;
        }
        .sb-item:hover, .sb-item-active {
          background: #f5f7ff;
        }
        .sb-item-icon {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, rgba(94,114,228,0.12), rgba(130,94,228,0.12));
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sb-item-icon i { font-size: 13px; color: #5e72e4; }
        .sb-item-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sb-item-title {
          font-size: 13.5px;
          font-weight: 600;
          color: #2d3748;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-item-sub {
          font-size: 11.5px;
          color: #a0aec0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-item-enter {
          font-size: 11px;
          color: #cbd5e0;
          opacity: 0;
          transition: opacity 0.12s;
          flex-shrink: 0;
        }
        .sb-item:hover .sb-item-enter,
        .sb-item-active .sb-item-enter { opacity: 1; }

        /* ── states ── */
        .sb-empty {
          padding: 28px 16px;
          text-align: center;
          color: #a0aec0;
          font-size: 13px;
        }
        .sb-empty-icon { font-size: 22px; margin-bottom: 8px; opacity: 0.4; display: block; }
        .sb-empty p { margin: 0; }
        .sb-empty strong { color: #718096; }
        .sb-hint {
          padding: 14px 16px;
          font-size: 12px;
          color: #a0aec0;
          text-align: center;
        }
        .sb-loading {
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sb-skeleton {
          height: 14px;
          background: linear-gradient(90deg, #f0f2f5 25%, #e8eaf0 50%, #f0f2f5 75%);
          background-size: 200% 100%;
          border-radius: 7px;
          animation: sbShimmer 1.2s ease infinite;
        }
        @keyframes sbShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── footer kbd hints ── */
        .sb-footer {
          display: flex;
          gap: 14px;
          justify-content: center;
          padding: 8px 16px;
          border-top: 1px solid #f0f2f5;
          background: #fafbff;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
        }
        .sb-footer span {
          font-size: 11px;
          color: #a0aec0;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sb-footer kbd {
          background: #edf2f7;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 10px;
          color: #718096;
          font-family: monospace;
        }

        @media (max-width: 991px) {
          .sb-wrap { width: 220px; }
          .sb-dropdown { min-width: 280px; }
        }
      `}</style>
    </div>
  );
}
