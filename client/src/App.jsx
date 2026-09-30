import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/jobs";
const AUTH_URL = "http://localhost:5000/api/auth";

const emptyJob = {
  company: "",
  role: "",
  status: "Applied",
  date: "",
  location: "",
  jobUrl: "",
  contact: "",
  salary: "",
  notes: "",
  interviewDate: "",
  interviewTime: "",
  interviewLink: "",
  interviewer: "",
  interviewNotes: "",
  followUpDate: "",
  nextAction: "",
};

const statusOptions = ["Applied", "Interview", "Offer", "Rejected"];
const statusFlow = ["Applied", "Interview", "Offer"];

function getStatusHistoryKey(userId) {
  return `careertrack-status-history-${userId || "guest"}`;
}

function loadStatusHistory(userId) {
  try {
    return JSON.parse(
      localStorage.getItem(getStatusHistoryKey(userId)) || "{}"
    );
  } catch {
    return {};
  }
}

function getActivityKey(userId) {
  return `careertrack-activity-${userId || "guest"}`;
}

function loadActivity(userId) {
  try {
    return JSON.parse(
      localStorage.getItem(getActivityKey(userId)) || "{}"
    );
  } catch {
    return {};
  }
}

function formatHistoryDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [filter, setFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [statusHistory, setStatusHistory] = useState({});
  const [activityHistory, setActivityHistory] = useState({});

  const [newJob, setNewJob] = useState(emptyJob);

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("careertrack-theme") === "dark"
  );

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "careertrack-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  async function checkAuthentication() {
    const token = localStorage.getItem("careertrack-token");

    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch(`${AUTH_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("careertrack-token");
        setAuthLoading(false);
        return;
      }

      const data = await response.json();
      setUser(data);
      setStatusHistory(loadStatusHistory(data._id));
      setActivityHistory(loadActivity(data._id));

      await fetchJobs(token);
    } catch (error) {
      console.error(error);
      localStorage.removeItem("careertrack-token");
    } finally {
      setAuthLoading(false);
    }
  }

  async function fetchJobs(token = localStorage.getItem("careertrack-token")) {
    if (!token) return;

    try {
      setLoading(true);

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch applications");
      }

      const data = await response.json();
      setJobs(data);

      if (user?._id) {
        const currentHistory = loadStatusHistory(user._id);
        const currentActivity = loadActivity(user._id);
        let changed = false;
        let activityChanged = false;
        const nextHistory = { ...currentHistory };
        const nextActivity = { ...currentActivity };

        data.forEach((job) => {
          if (!nextHistory[job._id] && job.status) {
            nextHistory[job._id] = [
              {
                status: job.status,
                changedAt: job.updatedAt || job.createdAt || new Date().toISOString(),
              },
            ];
            changed = true;
          }

          if (!nextActivity[job._id]) {
            nextActivity[job._id] = [{
              type: "created",
              title: "Application created",
              detail: `${job.company} application added to CareerTrack`,
              createdAt: job.createdAt || job.updatedAt || new Date().toISOString(),
            }];
            activityChanged = true;
          }
        });

        if (changed) {
          localStorage.setItem(
            getStatusHistoryKey(user._id),
            JSON.stringify(nextHistory)
          );
          setStatusHistory(nextHistory);
        }

        if (activityChanged) {
          localStorage.setItem(
            getActivityKey(user._id),
            JSON.stringify(nextActivity)
          );
          setActivityHistory(nextActivity);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();

    setAuthError("");
    setAuthSubmitting(true);

    try {
      const endpoint =
        authMode === "login"
          ? `${AUTH_URL}/login`
          : `${AUTH_URL}/register`;

      const body =
        authMode === "login"
          ? {
              email: authForm.email,
              password: authForm.password,
            }
          : authForm;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      localStorage.setItem("careertrack-token", data.token);

      setUser(data.user);
      setStatusHistory(loadStatusHistory(data.user._id));
      setActivityHistory(loadActivity(data.user._id));

      setAuthForm({
        name: "",
        email: "",
        password: "",
      });

      await fetchJobs(data.token);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem("careertrack-token");

    setUser(null);
    setJobs([]);
    setStatusHistory({});
    setActivityHistory({});
    setSelectedJob(null);
    setShowForm(false);
    setActivePage("Dashboard");
  }

  async function saveJob(e) {
    e.preventDefault();

    if (!newJob.company.trim() || !newJob.role.trim()) {
      alert("Company and role are required.");
      return;
    }

    const token = localStorage.getItem("careertrack-token");

    try {
      const isEditing = Boolean(editingJob);

      const response = await fetch(
        isEditing ? `${API_URL}/${editingJob._id}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newJob),
        }
      );

      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save application");
      }

      const savedJob = await response.json();

      const historyUserId = user?._id;
      const currentHistory = loadStatusHistory(historyUserId);
      const previousStatus = isEditing
        ? editingJob?.status
        : null;
      const existingEvents = currentHistory[savedJob._id] || [];

      if (
        existingEvents.length === 0 ||
        previousStatus !== savedJob.status
      ) {
        const nextEvents = [
          ...existingEvents,
          {
            status: savedJob.status,
            changedAt: new Date().toISOString(),
          },
        ];

        const nextHistory = {
          ...currentHistory,
          [savedJob._id]: nextEvents,
        };

        localStorage.setItem(
          getStatusHistoryKey(historyUserId),
          JSON.stringify(nextHistory)
        );
        setStatusHistory(nextHistory);
      }

      const currentActivity = loadActivity(historyUserId);
      const existingActivity = currentActivity[savedJob._id] || [];
      const now = new Date().toISOString();
      const activityEvents = [];

      if (!isEditing) {
        activityEvents.push({
          type: "created",
          title: "Application created",
          detail: `${savedJob.company} application added to CareerTrack`,
          createdAt: now,
        });
      } else {
        if (previousStatus !== savedJob.status) {
          activityEvents.push({
            type: "status",
            title: `Status changed to ${savedJob.status}`,
            detail: `${savedJob.company} · ${savedJob.role}`,
            createdAt: now,
          });
        }

        const interviewChanged =
          (editingJob?.interviewDate || "") !== (savedJob.interviewDate || "") ||
          (editingJob?.interviewTime || "") !== (savedJob.interviewTime || "") ||
          (editingJob?.interviewer || "") !== (savedJob.interviewer || "") ||
          (editingJob?.interviewLink || "") !== (savedJob.interviewLink || "") ||
          (editingJob?.interviewNotes || "") !== (savedJob.interviewNotes || "");

        if (interviewChanged && (savedJob.interviewDate || savedJob.interviewTime || savedJob.interviewer || savedJob.interviewLink || savedJob.interviewNotes)) {
          activityEvents.push({
            type: "interview",
            title: "Interview details updated",
            detail: savedJob.interviewDate
              ? `${savedJob.interviewDate}${savedJob.interviewTime ? ` at ${savedJob.interviewTime}` : ""}`
              : "Interview information added",
            createdAt: now,
          });
        }

        const followUpChanged =
          (editingJob?.followUpDate || "") !== (savedJob.followUpDate || "") ||
          (editingJob?.nextAction || "") !== (savedJob.nextAction || "");

        if (followUpChanged && (savedJob.followUpDate || savedJob.nextAction)) {
          activityEvents.push({
            type: "followup",
            title: "Follow-up updated",
            detail: savedJob.nextAction || savedJob.followUpDate,
            createdAt: now,
          });
        }

        if (activityEvents.length === 0) {
          activityEvents.push({
            type: "updated",
            title: "Application updated",
            detail: `${savedJob.company} · ${savedJob.role}`,
            createdAt: now,
          });
        }
      }

      const nextActivity = {
        ...currentActivity,
        [savedJob._id]: [...existingActivity, ...activityEvents].slice(-30),
      };

      localStorage.setItem(
        getActivityKey(historyUserId),
        JSON.stringify(nextActivity)
      );
      setActivityHistory(nextActivity);

      if (isEditing) {
        setJobs((prev) =>
          prev.map((job) =>
            job._id === savedJob._id ? savedJob : job
          )
        );
      } else {
        setJobs((prev) => [savedJob, ...prev]);
      }

      closeForm();
    } catch (error) {
      console.error(error);
      alert("Could not save application.");
    }
  }

  async function deleteJob(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this application?"
    );

    if (!confirmed) return;

    const token = localStorage.getItem("careertrack-token");

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to delete application");
      }

      setJobs((prev) => prev.filter((job) => job._id !== id));

      const currentHistory = loadStatusHistory(user?._id);
      if (currentHistory[id]) {
        const nextHistory = { ...currentHistory };
        delete nextHistory[id];
        localStorage.setItem(
          getStatusHistoryKey(user?._id),
          JSON.stringify(nextHistory)
        );
        setStatusHistory(nextHistory);
      }

      const currentActivity = loadActivity(user?._id);
      if (currentActivity[id]) {
        const nextActivity = { ...currentActivity };
        delete nextActivity[id];
        localStorage.setItem(
          getActivityKey(user?._id),
          JSON.stringify(nextActivity)
        );
        setActivityHistory(nextActivity);
      }

      if (selectedJob?._id === id) {
        setSelectedJob(null);
      }
    } catch (error) {
      console.error(error);
      alert("Could not delete application.");
    }
  }

  function openAddForm() {
    setEditingJob(null);

    setNewJob({
      ...emptyJob,
      date: new Date().toISOString().split("T")[0],
    });

    setShowForm(true);
  }

  function editJob(job) {
    setEditingJob(job);

    setNewJob({
      company: job.company || "",
      role: job.role || "",
      status: job.status || "Applied",
      date: job.date || "",
      location: job.location || "",
      jobUrl: job.jobUrl || "",
      contact: job.contact || "",
      salary: job.salary || "",
      notes: job.notes || "",
      interviewDate: job.interviewDate || "",
      interviewTime: job.interviewTime || "",
      interviewLink: job.interviewLink || "",
      interviewer: job.interviewer || "",
      interviewNotes: job.interviewNotes || "",
      followUpDate: job.followUpDate || "",
      nextAction: job.nextAction || "",
    });

    setShowForm(true);
    setSelectedJob(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingJob(null);
    setNewJob(emptyJob);
  }

  function clearFilters() {
    setSearch("");
    setGlobalSearch("");
    setGlobalSearchOpen(false);
    setFilter("All");
  }

  function handleGlobalSearch(value) {
    setGlobalSearch(value);
    setSearch(value);
    setGlobalSearchOpen(true);
  }

  function handleGlobalSearchSubmit(e) {
    e.preventDefault();

    setSearch(globalSearch);
    setGlobalSearchOpen(false);
    setActivePage("Applications");
  }

  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();

    if (!query) return [];

    return jobs
      .filter((job) => {
        return (
          job.company?.toLowerCase().includes(query) ||
          job.role?.toLowerCase().includes(query) ||
          job.location?.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [jobs, globalSearch]);

  function exportCSV() {
    if (jobs.length === 0) {
      alert("There are no applications to export.");
      return;
    }

    const headers = [
      "Company",
      "Role",
      "Status",
      "Application Date",
      "Location",
      "Job URL",
      "Contact",
      "Salary",
      "Notes",
      "Interview Date",
      "Interview Time",
      "Interview Link",
      "Interviewer",
      "Interview Notes",
      "Follow-up Date",
      "Next Action",
    ];

    const escapeCSV = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = jobs.map((job) => [
      job.company,
      job.role,
      job.status,
      job.date,
      job.location,
      job.jobUrl,
      job.contact,
      job.salary,
      job.notes,
      job.interviewDate,
      job.interviewTime,
      job.interviewLink,
      job.interviewer,
      job.interviewNotes,
      job.followUpDate,
      job.nextAction,
    ]);

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `careertrack-applications-${
      new Date().toISOString().split("T")[0]
    }.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        job.company?.toLowerCase().includes(searchText) ||
        job.role?.toLowerCase().includes(searchText) ||
        job.location?.toLowerCase().includes(searchText);

      const matchesFilter =
        filter === "All" || job.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [jobs, search, filter]);

  const stats = useMemo(
    () => ({
      total: jobs.length,
      applied: jobs.filter((job) => job.status === "Applied").length,
      interviews: jobs.filter((job) => job.status === "Interview").length,
      offers: jobs.filter((job) => job.status === "Offer").length,
      rejected: jobs.filter((job) => job.status === "Rejected").length,
    }),
    [jobs]
  );

  const interviewRate =
    stats.total > 0
      ? Math.round((stats.interviews / stats.total) * 100)
      : 0;

  const offerRate =
    stats.total > 0
      ? Math.round((stats.offers / stats.total) * 100)
      : 0;

  const responseRate =
    stats.total > 0
      ? Math.round(
          ((stats.interviews +
            stats.offers +
            stats.rejected) /
            stats.total) *
            100
        )
      : 0;

  const monthlyData = useMemo(() => {
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const monthName = date.toLocaleString("en-US", {
        month: "short",
      });

      const month = date.getMonth();
      const year = date.getFullYear();

      const count = jobs.filter((job) => {
        if (!job.date) return false;

        const jobDate = new Date(job.date);

        return (
          jobDate.getMonth() === month &&
          jobDate.getFullYear() === year
        );
      }).length;

      months.push({
        month: monthName,
        count,
      });
    }

    return months;
  }, [jobs]);

  const maxMonthly = Math.max(
    ...monthlyData.map((item) => item.count),
    1
  );

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-logo">C</div>
        <strong>Loading CareerTrack...</strong>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={(mode) => {
          setAuthMode(mode);
          setAuthError("");
        }}
        form={authForm}
        setForm={setAuthForm}
        error={authError}
        submitting={authSubmitting}
        onSubmit={handleAuth}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  return (
    <div className={`app-shell ${darkMode ? "dark" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>

          <div>
            <div className="brand-name">CareerTrack</div>
            <div className="brand-subtitle">
              Job Command Center
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavButton
            active={activePage === "Dashboard"}
            onClick={() => setActivePage("Dashboard")}
            icon="⌂"
          >
            Dashboard
          </NavButton>

          <NavButton
            active={activePage === "Applications"}
            onClick={() => setActivePage("Applications")}
            icon="▤"
            count={jobs.length}
          >
            Applications
          </NavButton>

          <NavButton
            active={activePage === "Analytics"}
            onClick={() => setActivePage("Analytics")}
            icon="◫"
          >
            Analytics
          </NavButton>

          <NavButton
            active={activePage === "Interviews"}
            onClick={() => {
              setActivePage("Applications");
              setFilter("Interview");
            }}
            icon="◉"
            count={stats.interviews}
          >
            Interviews
          </NavButton>

          <NavButton
            active={activePage === "Offers"}
            onClick={() => {
              setActivePage("Applications");
              setFilter("Offer");
            }}
            icon="★"
            count={stats.offers}
          >
            Offers
          </NavButton>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">✦</div>

            <div>
              <strong>Stay organized</strong>
              <p>
                Track every opportunity in one place.
              </p>
            </div>
          </div>

          <NavButton
            active={activePage === "Settings"}
            onClick={() => setActivePage("Settings")}
            icon="⚙"
          >
            Settings
          </NavButton>

          <button className="logout-button" onClick={logout}>
            <span>↪</span>
            Sign out
          </button>

          <div className="profile">
            <div className="profile-avatar">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="profile-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            CareerTrack <span>/</span>{" "}
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="global-search-wrap">
              <form
                className="global-search"
                onSubmit={handleGlobalSearchSubmit}
              >
                <span>⌕</span>

                <input
                  value={globalSearch}
                  onFocus={() => setGlobalSearchOpen(true)}
                  onChange={(e) =>
                    handleGlobalSearch(e.target.value)
                  }
                  placeholder="Search applications..."
                  aria-label="Search applications"
                />

                {globalSearch && (
                  <button
                    type="button"
                    className="global-search-clear"
                    onClick={() => {
                      setGlobalSearch("");
                      setSearch("");
                      setGlobalSearchOpen(false);
                    }}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </form>

              {globalSearchOpen && globalSearch.trim() && (
                <div className="global-search-results">
                  {globalSearchResults.length > 0 ? (
                    <>
                      <div className="global-search-heading">
                        Applications
                      </div>

                      {globalSearchResults.map((job) => (
                        <button
                          key={job._id}
                          className="global-search-result"
                          onClick={() => {
                            setSelectedJob(job);
                            setGlobalSearchOpen(false);
                          }}
                        >
                          <span className="global-result-logo">
                            {job.company?.charAt(0)?.toUpperCase()}
                          </span>

                          <span className="global-result-copy">
                            <strong>{job.company}</strong>
                            <small>{job.role}</small>
                          </span>

                          <span
                            className={`status-pill ${job.status.toLowerCase()}`}
                          >
                            {job.status}
                          </span>
                        </button>
                      ))}

                      <button
                        className="global-search-view-all"
                        onClick={handleGlobalSearchSubmit}
                      >
                        View all matching applications →
                      </button>
                    </>
                  ) : (
                    <div className="global-search-empty">
                      <strong>No applications found</strong>
                      <span>Try a company, role or location.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              className="icon-button"
              title="Toggle theme"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? "☀" : "☾"}
            </button>

            <div className="top-avatar">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        <div className="page-content">
          {activePage === "Dashboard" && (
            <Dashboard
              stats={stats}
              jobs={jobs}
              openAddForm={openAddForm}
              setActivePage={setActivePage}
              setSelectedJob={setSelectedJob}
            />
          )}

          {activePage === "Applications" && (
            <Applications
              filteredJobs={filteredJobs}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              clearFilters={clearFilters}
              openAddForm={openAddForm}
              editJob={editJob}
              deleteJob={deleteJob}
              setSelectedJob={setSelectedJob}
            />
          )}

          {activePage === "Analytics" && (
            <Analytics
              stats={stats}
              interviewRate={interviewRate}
              offerRate={offerRate}
              responseRate={responseRate}
              monthlyData={monthlyData}
              maxMonthly={maxMonthly}
              jobs={jobs}
            />
          )}

          {activePage === "Settings" && (
            <Settings
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              exportCSV={exportCSV}
              clearFilters={clearFilters}
              jobs={jobs}
              user={user}
            />
          )}
        </div>

        <footer className="app-footer">
          CareerTrack <span>•</span> Your job search, organized.
        </footer>
      </main>

      {showForm && (
        <JobFormModal
          newJob={newJob}
          setNewJob={setNewJob}
          editingJob={editingJob}
          saveJob={saveJob}
          closeForm={closeForm}
        />
      )}

      {selectedJob && (
        <DetailsModal
          job={selectedJob}
          setSelectedJob={setSelectedJob}
          editJob={editJob}
          deleteJob={deleteJob}
          statusHistory={statusHistory[selectedJob._id] || []}
          activityHistory={activityHistory[selectedJob._id] || []}
        />
      )}
    </div>
  );
}

/* =========================
   AUTH SCREEN
========================= */

function AuthScreen({
  mode,
  setMode,
  form,
  setForm,
  error,
  submitting,
  onSubmit,
  darkMode,
  setDarkMode,
}) {
  return (
    <div className={`auth-screen ${darkMode ? "auth-dark" : ""}`}>
      <div className="auth-theme">
        <button
          className="icon-button"
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? "☀" : "☾"}
        </button>
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">C</div>

          <div>
            <strong>CareerTrack</strong>
            <span>Job Command Center</span>
          </div>
        </div>

        <div className="auth-heading">
          <div className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
          </div>

          <h1>
            {mode === "login"
              ? "Welcome back."
              : "Create your account."}
          </h1>

          <p>
            {mode === "login"
              ? "Sign in to continue tracking your career."
              : "Start organizing your job search today."}
          </p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="auth-form">
          {mode === "register" && (
            <div className="form-field">
              <label>Full Name</label>

              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                required
              />
            </div>
          )}

          <div className="form-field">
            <label>Email</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-field">
            <label>Password</label>

            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            onClick={() =>
              setMode(
                mode === "login" ? "register" : "login"
              )
            }
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>

      <div className="auth-footer">
        CareerTrack • Secure career tracking
      </div>
    </div>
  );
}

/* =========================
   NAV
========================= */

function NavButton({
  children,
  active,
  onClick,
  icon,
  count,
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>

      {children}

      {count !== undefined && (
        <span className="nav-count">{count}</span>
      )}
    </button>
  );
}

/* =========================
   DASHBOARD HELPERS
========================= */

function parseLocalDate(value) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDashboardDate(value) {
  const date = parseLocalDate(value);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDaysFromToday(value) {
  const target = parseLocalDate(value);
  if (!target) return null;

  const today = parseLocalDate(getTodayKey());
  return Math.round((target - today) / 86400000);
}

/* =========================
   DASHBOARD
========================= */

function Dashboard({
  stats,
  jobs,
  openAddForm,
  setActivePage,
  setSelectedJob,
}) {
  const todayKey = getTodayKey();

  const upcomingInterviews = jobs
    .filter((job) => job.interviewDate && job.interviewDate >= todayKey)
    .sort((a, b) => {
      const aKey = `${a.interviewDate}T${a.interviewTime || "23:59"}`;
      const bKey = `${b.interviewDate}T${b.interviewTime || "23:59"}`;
      return aKey.localeCompare(bKey);
    })
    .slice(0, 4);

  const followUps = jobs
    .filter((job) => job.followUpDate)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
    .slice(0, 4);

  const overdueFollowUps = followUps.filter(
    (job) => job.followUpDate < todayKey
  );

  const upcomingFollowUps = followUps.filter(
    (job) => job.followUpDate >= todayKey
  );

  const recentJobs = jobs.slice(0, 5);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OVERVIEW</div>

          <h1>Good to see you.</h1>

          <p>
            Here’s what’s happening with your job search.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openAddForm}
        >
          + Add Application
        </button>
      </div>

      <div className="kpi-grid">
        <KpiCard
          title="Total Applications"
          value={stats.total}
          icon="▤"
          text="All applications"
        />

        <KpiCard
          title="Interviews"
          value={stats.interviews}
          icon="◉"
          text="Active conversations"
        />

        <KpiCard
          title="Offers"
          value={stats.offers}
          icon="★"
          text="Offers received"
        />

        <KpiCard
          title="Rejected"
          value={stats.rejected}
          icon="×"
          text="Closed applications"
        />
      </div>

      <section className="dashboard-action-grid">
        <DashboardScheduleCard
          title="Upcoming Interviews"
          subtitle="Your next scheduled conversations."
          icon="◉"
          jobs={upcomingInterviews}
          emptyText="No upcoming interviews scheduled."
          type="interview"
          setSelectedJob={setSelectedJob}
          setActivePage={setActivePage}
        />

        <DashboardScheduleCard
          title="Follow-ups"
          subtitle="Stay on top of your next actions."
          icon="↗"
          jobs={followUps}
          emptyText="No follow-ups scheduled."
          type="followup"
          overdueCount={overdueFollowUps.length}
          upcomingCount={upcomingFollowUps.length}
          setSelectedJob={setSelectedJob}
          setActivePage={setActivePage}
        />
      </section>

      <section className="application-section">
        <div className="section-top">
          <div>
            <h2>Recent Applications</h2>

            <p>Your latest job applications.</p>
          </div>

          <button
            className="text-button"
            onClick={() => setActivePage("Applications")}
          >
            View all →
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌁</div>

            <h3>No applications yet</h3>

            <p>
              Start tracking your job search by adding an
              application.
            </p>

            <button
              className="primary-button"
              onClick={openAddForm}
            >
              Add First Application
            </button>
          </div>
        ) : (
          <ApplicationTable
            jobs={recentJobs}
            onView={setSelectedJob}
            compact
          />
        )}
      </section>
    </>
  );
}

function DashboardScheduleCard({
  title,
  subtitle,
  icon,
  jobs,
  emptyText,
  type,
  overdueCount = 0,
  upcomingCount = 0,
  setSelectedJob,
  setActivePage,
}) {
  return (
    <section className="schedule-card">
      <div className="schedule-card-header">
        <div>
          <div className="schedule-card-title-row">
            <div className="schedule-card-icon">{icon}</div>
            <h2>{title}</h2>
          </div>
          <p>{subtitle}</p>
        </div>

        {type === "followup" && (
          <div className="schedule-badges">
            {overdueCount > 0 && (
              <span className="schedule-badge overdue">
                {overdueCount} overdue
              </span>
            )}
            {upcomingCount > 0 && (
              <span className="schedule-badge">
                {upcomingCount} upcoming
              </span>
            )}
          </div>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="schedule-empty">
          <span>✓</span>
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="schedule-list">
          {jobs.map((job) => {
            const daysAway = getDaysFromToday(
              type === "interview"
                ? job.interviewDate
                : job.followUpDate
            );
            const isOverdue = daysAway !== null && daysAway < 0;

            return (
              <button
                key={job._id}
                className="schedule-item"
                onClick={() => setSelectedJob(job)}
              >
                <div className="schedule-date-block">
                  <strong>
                    {formatDashboardDate(
                      type === "interview"
                        ? job.interviewDate
                        : job.followUpDate
                    )}
                  </strong>
                  {type === "interview" && job.interviewTime && (
                    <span>{job.interviewTime}</span>
                  )}
                </div>

                <div className="schedule-main">
                  <strong>{job.company}</strong>
                  <span>{job.role}</span>
                  {type === "interview" && job.interviewer && (
                    <small>With {job.interviewer}</small>
                  )}
                  {type === "followup" && job.nextAction && (
                    <small>{job.nextAction}</small>
                  )}
                </div>

                <div className="schedule-status">
                  {isOverdue ? (
                    <span className="schedule-overdue">Overdue</span>
                  ) : daysAway === 0 ? (
                    <span className="schedule-today">Today</span>
                  ) : daysAway === 1 ? (
                    <span>Tomorrow</span>
                  ) : (
                    <span>{daysAway}d</span>
                  )}
                  <b>›</b>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <button
          className="schedule-footer-button"
          onClick={() => {
            setActivePage("Applications");
            setSelectedJob(null);
          }}
        >
          View applications →
        </button>
      )}
    </section>
  );
}

/* =========================
   APPLICATIONS
========================= */

function Applications({
  filteredJobs,
  search,
  setSearch,
  filter,
  setFilter,
  clearFilters,
  openAddForm,
  editJob,
  deleteJob,
  setSelectedJob,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">APPLICATIONS</div>

          <h1>All Applications</h1>

          <p>
            Manage and track every opportunity.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openAddForm}
        >
          + Add Application
        </button>
      </div>

      <section className="application-section">
        <div className="filter-bar">
          <div className="table-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, role or location..."
            />
          </div>

          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">All statuses</option>

            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            className="secondary-button clear-button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌁</div>

            <h3>No applications found</h3>

            <p>
              Try changing your search or filters.
            </p>

            <button
              className="secondary-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <ApplicationTable
            jobs={filteredJobs}
            onView={setSelectedJob}
            onEdit={editJob}
            onDelete={deleteJob}
          />
        )}
      </section>
    </>
  );
}

/* =========================
   ANALYTICS
========================= */

function Analytics({
  stats,
  interviewRate,
  offerRate,
  responseRate,
  monthlyData,
  maxMonthly,
  jobs,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">INSIGHTS</div>

          <h1>Analytics</h1>

          <p>
            Understand your job search performance.
          </p>
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <div className="analytics-kpi">
          <span>Response Rate</span>

          <strong>{responseRate}%</strong>

          <small>
            Applications receiving a response
          </small>
        </div>

        <div className="analytics-kpi">
          <span>Interview Rate</span>

          <strong>{interviewRate}%</strong>

          <small>
            Applications reaching interviews
          </small>
        </div>

        <div className="analytics-kpi">
          <span>Offer Rate</span>

          <strong>{offerRate}%</strong>

          <small>
            Applications becoming offers
          </small>
        </div>

        <div className="analytics-kpi">
          <span>Pipeline</span>

          <strong>{stats.total}</strong>

          <small>
            Total tracked applications
          </small>
        </div>
      </div>

      <div className="analytics-layout">
        <section className="analytics-card">
          <div className="analytics-card-header">
            <h2>Application Pipeline</h2>

            <p>Current distribution by status.</p>
          </div>

          <div className="pipeline-chart">
            {statusOptions.map((status) => {
              const count = jobs.filter(
                (job) => job.status === status
              ).length;

              const percentage =
                stats.total > 0
                  ? Math.round(
                      (count / stats.total) * 100
                    )
                  : 0;

              return (
                <div
                  className="pipeline-row"
                  key={status}
                >
                  <div className="pipeline-label">
                    <span>{status}</span>

                    <strong>{count}</strong>
                  </div>

                  <div className="pipeline-track">
                    <div
                      className={`pipeline-fill ${status.toLowerCase()}`}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>

                  <span className="pipeline-percent">
                    {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="analytics-card">
          <div className="analytics-card-header">
            <h2>Conversion</h2>

            <p>How applications progress.</p>
          </div>

          <div className="conversion-list">
            <div className="conversion-item">
              <div>
                <span>Applications</span>
                <strong>{stats.total}</strong>
              </div>

              <div className="conversion-arrow">
                ↓
              </div>
            </div>

            <div className="conversion-item">
              <div>
                <span>Interviews</span>
                <strong>{stats.interviews}</strong>
              </div>

              <div className="conversion-rate">
                {interviewRate}%
              </div>
            </div>

            <div className="conversion-item">
              <div>
                <span>Offers</span>
                <strong>{stats.offers}</strong>
              </div>

              <div className="conversion-rate">
                {offerRate}%
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="analytics-card">
        <div className="analytics-card-header">
          <h2>Application Activity</h2>

          <p>
            Applications submitted over the last six months.
          </p>
        </div>

        <div className="bar-chart">
          {monthlyData.map((item) => (
            <div
              className="bar-column"
              key={item.month}
            >
              <span className="bar-value">
                {item.count}
              </span>

              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    height: `${
                      (item.count / maxMonthly) * 100
                    }%`,
                  }}
                />
              </div>

              <span className="bar-label">
                {item.month}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="insights-grid">
        <div className="insight-card">
          <div className="insight-icon">✦</div>

          <div>
            <strong>Keep applying</strong>

            <p>
              Consistent applications help maintain a
              healthy pipeline.
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon">◉</div>

          <div>
            <strong>Track follow-ups</strong>

            <p>
              Keep interview and recruiter information
              updated.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================
   SETTINGS
========================= */

function Settings({
  darkMode,
  setDarkMode,
  exportCSV,
  clearFilters,
  jobs,
  user,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PREFERENCES</div>

          <h1>Settings</h1>

          <p>
            Customize your CareerTrack experience.
          </p>
        </div>
      </div>

      <div className="settings-container">
        <section className="settings-card">
          <div className="settings-section-header">
            <div className="settings-icon">◐</div>

            <div>
              <h2>Account</h2>

              <p>Your CareerTrack account.</p>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <strong>{user.name}</strong>

              <span>{user.email}</span>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-header">
            <div className="settings-icon">◐</div>

            <div>
              <h2>Appearance</h2>

              <p>
                Choose how CareerTrack looks.
              </p>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <strong>Dark mode</strong>

              <span>
                Use a darker interface for low-light
                environments.
              </span>
            </div>

            <button
              className={`toggle ${
                darkMode ? "enabled" : ""
              }`}
              onClick={() => setDarkMode(!darkMode)}
            >
              <span />
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-header">
            <div className="settings-icon">↓</div>

            <div>
              <h2>Data</h2>

              <p>
                Manage your application data.
              </p>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <strong>Export applications</strong>

              <span>
                Download all {jobs.length} applications
                as CSV.
              </span>
            </div>

            <button
              className="secondary-button"
              onClick={exportCSV}
            >
              Export CSV
            </button>
          </div>

          <div className="settings-row">
            <div>
              <strong>Clear filters</strong>

              <span>
                Reset application search and status
                filters.
              </span>
            </div>

            <button
              className="secondary-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-header">
            <div className="settings-icon">i</div>

            <div>
              <h2>About CareerTrack</h2>

              <p>
                Application tracking made simple.
              </p>
            </div>
          </div>

          <div className="about-box">
            <div>
              <strong>CareerTrack</strong>

              <span>
                Job Application Command Center
              </span>
            </div>

            <div className="version-badge">
              v1.0.0
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* =========================
   JOB FORM
========================= */

function JobFormModal({
  newJob,
  setNewJob,
  editingJob,
  saveJob,
  closeForm,
}) {
  return (
    <div className="modal-overlay" onClick={closeForm}>
      <div
        className="form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">
              {editingJob
                ? "EDIT APPLICATION"
                : "NEW APPLICATION"}
            </div>

            <h2>
              {editingJob
                ? "Update application"
                : "Add application"}
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={closeForm}
          >
            ×
          </button>
        </div>

        <form
          className="modern-form"
          onSubmit={saveJob}
        >
          <div className="form-grid">
            <FormInput
              label="Company *"
              value={newJob.company}
              placeholder="e.g. Microsoft"
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  company: value,
                })
              }
              required
            />

            <FormInput
              label="Role *"
              value={newJob.role}
              placeholder="e.g. AI Engineer"
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  role: value,
                })
              }
              required
            />

            <div className="form-field">
              <label>Status</label>

              <select
                value={newJob.status}
                onChange={(e) =>
                  setNewJob({
                    ...newJob,
                    status: e.target.value,
                  })
                }
              >
                {statusOptions.map((status) => (
                  <option key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <FormInput
              label="Application Date"
              type="date"
              value={newJob.date}
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  date: value,
                })
              }
            />

            <FormInput
              label="Location"
              value={newJob.location}
              placeholder="e.g. Kochi / Remote"
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  location: value,
                })
              }
            />

            <FormInput
              label="Salary"
              value={newJob.salary}
              placeholder="e.g. ₹8 LPA"
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  salary: value,
                })
              }
            />

            <FormInput
              label="Contact"
              value={newJob.contact}
              placeholder="Recruiter / Email"
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  contact: value,
                })
              }
            />

            <FormInput
              label="Job URL"
              value={newJob.jobUrl}
              placeholder="https://..."
              onChange={(value) =>
                setNewJob({
                  ...newJob,
                  jobUrl: value,
                })
              }
            />
          </div>

          <div className="form-field">
            <label>Notes</label>

            <textarea
              value={newJob.notes}
              onChange={(e) =>
                setNewJob({
                  ...newJob,
                  notes: e.target.value,
                })
              }
              placeholder="Add notes about this application..."
              rows="4"
            />
          </div>

          <div className="form-section-title">
            <div>Interview & Follow-up</div>
            <span>Keep important next steps attached to this application.</span>
          </div>

          <div className="form-grid">
            <FormInput
              label="Interview Date"
              type="date"
              value={newJob.interviewDate}
              onChange={(value) =>
                setNewJob({ ...newJob, interviewDate: value })
              }
            />

            <FormInput
              label="Interview Time"
              type="time"
              value={newJob.interviewTime}
              onChange={(value) =>
                setNewJob({ ...newJob, interviewTime: value })
              }
            />

            <FormInput
              label="Interviewer"
              value={newJob.interviewer}
              placeholder="e.g. Sarah Thomas"
              onChange={(value) =>
                setNewJob({ ...newJob, interviewer: value })
              }
            />

            <FormInput
              label="Interview / Meeting Link"
              value={newJob.interviewLink}
              placeholder="https://meet.google.com/..."
              onChange={(value) =>
                setNewJob({ ...newJob, interviewLink: value })
              }
            />

            <FormInput
              label="Follow-up Date"
              type="date"
              value={newJob.followUpDate}
              onChange={(value) =>
                setNewJob({ ...newJob, followUpDate: value })
              }
            />

            <FormInput
              label="Next Action"
              value={newJob.nextAction}
              placeholder="e.g. Send thank-you email"
              onChange={(value) =>
                setNewJob({ ...newJob, nextAction: value })
              }
            />
          </div>

          <div className="form-field">
            <label>Interview Notes</label>

            <textarea
              value={newJob.interviewNotes}
              onChange={(e) =>
                setNewJob({ ...newJob, interviewNotes: e.target.value })
              }
              placeholder="Add interviewer details, questions, preparation notes, or outcomes..."
              rows="3"
            />
          </div>

          <div className="form-actions-modern">
            <button
              type="button"
              className="secondary-button"
              onClick={closeForm}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
            >
              {editingJob
                ? "Save Changes"
                : "Add Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormInput({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <div className="form-field">
      <label>{label}</label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* =========================
   DETAILS
========================= */

function DetailsModal({
  job,
  setSelectedJob,
  editJob,
  deleteJob,
  statusHistory = [],
  activityHistory = [],
}) {
  return (
    <div
      className="modal-overlay"
      onClick={() => setSelectedJob(null)}
    >
      <div
        className="details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-company">
            <div className="large-company-logo">
              {job.company?.charAt(0)?.toUpperCase()}
            </div>

            <div>
              <div className="eyebrow">
                APPLICATION DETAILS
              </div>

              <h2>{job.company}</h2>

              <p>{job.role}</p>
            </div>
          </div>

          <button
            className="modal-close"
            onClick={() => setSelectedJob(null)}
          >
            ×
          </button>
        </div>

        <div className="details-status">
          <span
            className={`status-pill ${job.status.toLowerCase()}`}
          >
            <span className="status-dot" />

            {job.status}
          </span>
        </div>

        <StatusProgress status={job.status} />

        <StatusTimeline history={statusHistory} />

        <ActivityTimeline activities={activityHistory} />

        <div className="details-grid-modern">
          <DetailItem
            title="Application Date"
            value={job.date}
          />

          <DetailItem
            title="Location"
            value={job.location}
          />

          <DetailItem
            title="Salary"
            value={job.salary}
          />

          <DetailItem
            title="Contact"
            value={job.contact}
          />
        </div>

        {(job.interviewDate ||
          job.interviewTime ||
          job.interviewer ||
          job.interviewLink ||
          job.interviewNotes) && (
          <div className="details-section-modern">
            <div className="details-section-heading">Interview</div>

            <div className="details-grid-modern">
              <DetailItem title="Interview Date" value={job.interviewDate} />
              <DetailItem title="Interview Time" value={job.interviewTime} />
              <DetailItem title="Interviewer" value={job.interviewer} />

              {job.interviewLink && (
                <div className="detail-item">
                  <span>Meeting Link</span>
                  <a
                    href={job.interviewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="detail-link"
                  >
                    Open meeting ↗
                  </a>
                </div>
              )}
            </div>

            {job.interviewNotes && (
              <div className="notes-modern">
                <span>Interview Notes</span>
                <p>{job.interviewNotes}</p>
              </div>
            )}
          </div>
        )}

        {(job.followUpDate || job.nextAction) && (
          <div className="details-section-modern">
            <div className="details-section-heading">Follow-up</div>

            <div className="details-grid-modern">
              <DetailItem title="Follow-up Date" value={job.followUpDate} />
              <DetailItem title="Next Action" value={job.nextAction} />
            </div>
          </div>
        )}

        {job.jobUrl && (
          <div className="job-link-box">
            <span>Job Posting</span>

            <a
              href={job.jobUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open job posting ↗
            </a>
          </div>
        )}

        <div className="notes-modern">
          <span>Notes</span>

          <p>{job.notes || "No notes added."}</p>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={() => editJob(job)}
          >
            Edit
          </button>

          <button
            className="danger-button"
            onClick={() => deleteJob(job._id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusProgress({ status }) {
  const isRejected = status === "Rejected";
  const currentIndex = statusFlow.indexOf(status);

  return (
    <div className="status-progress">
      <div className="details-section-heading">Application Progress</div>

      <div className="progress-track">
        {statusFlow.map((step, index) => {
          const completed = !isRejected && currentIndex >= index;
          const current = !isRejected && currentIndex === index;

          return (
            <div
              key={step}
              className={`progress-step ${
                completed ? "completed" : ""
              } ${current ? "current" : ""}`}
            >
              <div className="progress-dot">
                {completed ? "✓" : index + 1}
              </div>
              <span>{step}</span>
            </div>
          );
        })}
      </div>

      {isRejected && (
        <div className="rejected-progress">
          <span className="progress-dot">×</span>
          <div>
            <strong>Rejected</strong>
            <span>This application is closed.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusTimeline({ history }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="status-timeline">
      <div className="details-section-heading">Status History</div>

      <div className="timeline-list">
        {[...history].reverse().map((event, index) => (
          <div className="timeline-item" key={`${event.changedAt}-${index}`}>
            <div className="timeline-marker">
              <span />
            </div>

            <div className="timeline-content">
              <strong>{event.status}</strong>
              <span>{formatHistoryDate(event.changedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline({ activities }) {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="activity-timeline">
      <div className="details-section-heading">Activity</div>

      <div className="activity-list">
        {[...activities].reverse().map((event, index) => (
          <div className="activity-item" key={`${event.createdAt}-${index}`}>
            <div className={`activity-icon ${event.type || "updated"}`}>
              {event.type === "status" ? "↗" : event.type === "interview" ? "◉" : event.type === "followup" ? "✓" : event.type === "created" ? "+" : "•"}
            </div>
            <div className="activity-content">
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
              <small>{formatHistoryDate(event.createdAt)}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailItem({ title, value }) {
  return (
    <div className="detail-item">
      <span>{title}</span>

      <strong>{value || "—"}</strong>
    </div>
  );
}

/* =========================
   TABLE
========================= */

function ApplicationTable({
  jobs,
  onView,
  onEdit,
  onDelete,
  compact = false,
}) {
  return (
    <div className="table-wrapper">
      <table className="application-table">
        <thead>
          <tr className="table-header">
            <th>Company</th>
            <th>Role</th>
            <th>Status</th>
            <th>Date</th>

            {!compact && <th>Location</th>}

            <th />
          </tr>
        </thead>

        <tbody>
          {jobs.map((job) => (
            <tr
              className="table-row"
              key={job._id}
            >
              <td>
                <div className="company-cell">
                  <div className="company-logo">
                    {job.company
                      ?.charAt(0)
                      ?.toUpperCase()}
                  </div>

                  <strong>{job.company}</strong>
                </div>
              </td>

              <td>
                <div className="role-cell">
                  <strong>{job.role}</strong>

                  {job.salary && (
                    <span>{job.salary}</span>
                  )}
                </div>
              </td>

              <td>
                <span
                  className={`status-pill ${job.status.toLowerCase()}`}
                >
                  <span className="status-dot" />

                  {job.status}
                </span>
              </td>

              <td>{job.date || "—"}</td>

              {!compact && (
                <td>{job.location || "—"}</td>
              )}

              <td>
                <div className="row-actions">
                  <button
                    className="action-button"
                    onClick={() => onView(job)}
                  >
                    View
                  </button>

                  {onEdit && (
                    <button
                      className="action-button"
                      onClick={() => onEdit(job)}
                    >
                      Edit
                    </button>
                  )}

                  {onDelete && (
                    <button
                      className="action-button delete-action"
                      onClick={() => onDelete(job._id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================
   KPI
========================= */

function KpiCard({
  title,
  value,
  icon,
  text,
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span>{title}</span>

        <div className="kpi-icon">
          {icon}
        </div>
      </div>

      <strong>{value}</strong>

      <small>{text}</small>
    </div>
  );
}

export default App;