import React, { useState, useEffect, useRef } from "react";

import {
  Calendar,
  Check,
  Trash2,
  Plus,
  Filter,
  Moon,
  Sun,
  Pencil,
  Lock,
  ShieldCheck,
} from "lucide-react";

import mulungushiLogo from "./assets/mulungushi-logo.png";


export default function App() {
  
  /* ================== SECURITY SETTINGS ================== */
  const PIN_KEY = "plannerPinHash";
  const LOCK_KEY = "plannerLocked";
  const INACTIVITY_MINUTES = 5;

  /* ================== STORAGE ================== */
  const STORAGE_KEY = "studentTasks";

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, hydrated]);

  /* ================== SECURITY STATE ================== */
  const [isLocked, setIsLocked] = useState(() => {
    const stored = localStorage.getItem(LOCK_KEY);
    return stored ? stored === "true" : true; // default locked
  });

  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SECONDS = 30;

  const [hasPin, setHasPin] = useState(() => !!localStorage.getItem(PIN_KEY));

  const lastActivityRef = useRef(Date.now());

  // Small hashing helper (not encryption, but better than storing PIN in plain text)
  const hashPin = async (pin) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const lockApp = () => {
    setIsLocked(true);
    localStorage.setItem(LOCK_KEY, "true");
    setPinInput("");
    setPinError("");
    setAttempts(0);
    setLockoutUntil(null);
    setLockoutSecondsLeft(0);

  };

  const unlockApp = () => {
    setIsLocked(false);
    localStorage.setItem(LOCK_KEY, "false");
    setPinInput("");
    setPinError("");
    setAttempts(0);
    setLockoutUntil(null);
    setLockoutSecondsLeft(0);

  };

  // Auto-lock on inactivity
  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActivity));

    const interval = setInterval(() => {
      if (isLocked) return;
      const ms = Date.now() - lastActivityRef.current;
      if (ms > INACTIVITY_MINUTES * 60 * 1000) {
        lockApp();
      }
    }, 3000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActivity));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  /* ================== APP STATE ================== */
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("Study");
  const [filter, setFilter] = useState("All");
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifiedTasks, setNotifiedTasks] = useState([]);

  // Edit state
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCategory, setEditCategory] = useState("Study");

  const categories = ["Study", "Exams", "Personal"];
  const filters = ["All", "Completed", "Pending"];

  /* ================== NOTIFICATIONS ================== */
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  const notifyDueTasks = () => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const today = new Date().toDateString();

    tasks.forEach((task) => {
      const taskDate = new Date(task.dueDate).toDateString();

      if (!task.completed && taskDate === today && !notifiedTasks.includes(task.id)) {
        new Notification("📌 Task Due Today", {
          body: task.title,
          icon: mulungushiLogo,
        });

        setNotifiedTasks((prev) => [...prev, task.id]);
      }
    });
  };

  useEffect(() => {
    if (isLocked) return; // don’t notify while locked
    notifyDueTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isLocked]);
  useEffect(() => {
  if (!lockoutUntil) return;

  const timer = setInterval(() => {
    const now = Date.now();
    const diff = lockoutUntil - now;

    if (diff <= 0) {
      setLockoutUntil(null);
      setLockoutSecondsLeft(0);
      setAttempts(0);
      clearInterval(timer);
    } else {
      setLockoutSecondsLeft(Math.ceil(diff / 1000));
    }
  }, 1000);

  return () => clearInterval(timer);
}, [lockoutUntil]);


  /* ================== AI HELPERS ================== */
  const estimateMinutes = (title, cat) => {
    const t = (title || "").toLowerCase();
    if (t.includes("project") || t.includes("coding") || t.includes("build")) return 180;
    if (t.includes("assignment") || t.includes("homework")) return 120;
    if (t.includes("exam") || cat === "Exams") return 90;
    if (t.includes("study") || t.includes("revise") || t.includes("revision") || t.includes("read")) return 60;
    if (t.includes("research")) return 75;
    return 45;
  };

  const breakdownTask = (title, cat) => {
    const t = (title || "").toLowerCase();
    let steps = [];

    if (t.includes("study") || t.includes("revise") || t.includes("revision") || t.includes("read")) {
      steps = [
        "Review notes (20 mins)",
        "Watch 1 short video (10 mins)",
        "Do 5 practice questions",
        "Write a 5-line summary",
      ];
    } else if (t.includes("exam") || cat === "Exams") {
      steps = ["List topics to cover", "Practice past questions", "Review mistakes", "Quick recap notes"];
    } else if (t.includes("project") || t.includes("coding") || t.includes("build")) {
      steps = ["Define requirements", "Build core feature", "Test & fix bugs", "Push to GitHub"];
    } else if (t.includes("assignment") || t.includes("homework")) {
      steps = ["Read instructions carefully", "Solve first half", "Solve second half", "Proofread and submit"];
    } else {
      steps = ["Break this task into smaller steps"];
    }

    return steps.map((text, idx) => ({ id: idx + 1, text, done: false }));
  };

  const toggleSubtask = (taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        const normalized = (task.subtasks || []).map((st, idx) =>
          typeof st === "string" ? { id: idx + 1, text: st, done: false } : st
        );

        const updated = normalized.map((st) =>
          st.id === subtaskId ? { ...st, done: !st.done } : st
        );

        return { ...task, subtasks: updated };
      })
    );
  };

  const getFocusTasks = () => {
    const now = new Date();

    const scoreTask = (task) => {
      if (task.completed) return -999;
      const due = new Date(task.dueDate);
      const daysLeft = Math.floor((due - now) / (1000 * 60 * 60 * 24));
      let score = 0;

      if (daysLeft < 0) score += 100;
      else if (daysLeft === 0) score += 70;
      else if (daysLeft <= 2) score += 50;
      else score += 10;

      if (task.category === "Exams") score += 15;
      return score;
    };

    return [...tasks]
      .filter((t) => !t.completed)
      .sort((a, b) => scoreTask(b) - scoreTask(a))
      .slice(0, 3);
  };

  const getAISuggestion = () => {
    if (tasks.length === 0) return "Add tasks to receive smart tips 📘";

    const overdue = tasks.filter((t) => !t.completed && new Date(t.dueDate) < new Date()).length;
    const exams = tasks.filter((t) => t.category === "Exams" && !t.completed).length;

    if (overdue >= 3) return "⚠️ You have multiple overdue tasks. Focus on them first!";
    if (exams >= 2) return "📚 Exams are coming up. Prioritize exam-related tasks.";
    return "✅ You're on track! Keep maintaining your study plan.";
  };

  /* ================== TASK ACTIONS ================== */
  const addTask = () => {
    if (!taskTitle.trim() || !dueDate) return;

    const newTask = {
      id: Date.now(),
      title: taskTitle,
      dueDate,
      category,
      completed: false,
      createdAt: new Date().toISOString(),
      estimatedMinutes: estimateMinutes(taskTitle, category),
      subtasks: breakdownTask(taskTitle, category),
    };

    setTasks((prev) => [...prev, newTask]);
    setTaskTitle("");
    setDueDate("");
    setCategory("Study");
  };

  const toggleComplete = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  /* ================== EDIT TASK ================== */
  const startEdit = (task) => {
    setEditingTask(task.id);
    setEditTitle(task.title);
    setEditDueDate(task.dueDate);
    setEditCategory(task.category);
  };

  const saveEdit = () => {
    if (!editTitle.trim() || !editDueDate) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingTask
          ? {
              ...t,
              title: editTitle,
              dueDate: editDueDate,
              category: editCategory,
              estimatedMinutes: estimateMinutes(editTitle, editCategory),
              subtasks: breakdownTask(editTitle, editCategory),
            }
          : t
      )
    );

    setEditingTask(null);
  };

  /* ================== FILTER & SEARCH ================== */
  const filteredTasks = tasks.filter((task) => {
    if (filter === "Completed" && !task.completed) return false;
    if (filter === "Pending" && task.completed) return false;
    if (searchQuery.trim() && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  /* ================== STATS ================== */
  const progress =
    tasks.length === 0 ? 0 : Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);

  const focusTasks = getFocusTasks();

  /* ================== STYLES ================== */
  const bgClass = darkMode
    ? "bg-slate-900"
    : "bg-gradient-to-br from-blue-50 via-white to-red-50";

  const cardBg = darkMode ? "bg-gray-800" : "bg-white";
  const textClass = darkMode ? "text-gray-100" : "text-gray-800";
  const secondaryText = darkMode ? "text-gray-400" : "text-gray-600";

  const categoryStyles = {
    Study: darkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800",
    Exams: darkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800",
    Personal: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
  };

  /* ================== SECURITY UI (LOCK SCREEN) ================== */
  const handleSetPin = async () => {
    setPinError("");
    if (pinInput.length < 4) return setPinError("PIN must be at least 4 digits.");
    if (pinInput !== pinConfirm) return setPinError("PINs do not match.");

    const hash = await hashPin(pinInput);
    localStorage.setItem(PIN_KEY, hash);
    setHasPin(true);
    unlockApp();
    setPinInput("");
    setPinConfirm("");
  };

 const handleUnlock = async () => {
  setPinError("");

  // ⛔ block unlocking if currently locked out
  if (lockoutUntil && Date.now() < lockoutUntil) {
    setPinError(`Too many attempts. Try again in ${lockoutSecondsLeft}s.`);
    return;
  }

  const savedHash = localStorage.getItem(PIN_KEY);

  if (!savedHash) {
    unlockApp();
    setHasPin(false);
    return;
  }

  const enteredHash = await hashPin(pinInput);

  if (enteredHash !== savedHash) {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    // if reached max attempts → lock out
    if (nextAttempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockoutUntil(until);
      setLockoutSecondsLeft(LOCKOUT_SECONDS);
      setPinError(`Too many attempts. Locked for ${LOCKOUT_SECONDS}s.`);
      setPinInput("");
      return;
    }

    setPinError(`Wrong PIN. Attempts left: ${MAX_ATTEMPTS - nextAttempts}`);
    return;
  }

  // ✅ correct pin
  setAttempts(0);
  setLockoutUntil(null);
  setLockoutSecondsLeft(0);
  unlockApp();
};


  const handleResetPin = () => {
    // simple reset (for demo). In real apps you’d require old PIN.
    localStorage.removeItem(PIN_KEY);
    localStorage.setItem(LOCK_KEY, "true");
    setHasPin(false);
    setIsLocked(true);
    setPinInput("");
    setPinConfirm("");
    setPinError("");
  };

  if (isLocked) {
    return (
      <div className={`min-h-screen ${bgClass} p-4 flex items-center justify-center`}>
        <div className={`${cardBg} w-full max-w-md rounded-2xl shadow-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-indigo-600/10">
              <Lock className="text-indigo-600" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${textClass}`}>Planner Locked</h2>
              <p className={secondaryText}>Enter your PIN to continue</p>
            </div>
          </div>

          {!hasPin ? (
            <>
              <div className={`mb-3 text-sm ${secondaryText} flex items-center gap-2`}>
                <ShieldCheck size={16} /> Set a new PIN for this device
              </div>

              <input
                type="password"
                inputMode="numeric"
                placeholder="Create PIN (min 4 digits)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className={`w-full px-4 py-3 rounded-lg border-2 mb-3 ${
                  darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"
                }`}
              />

              <input
                type="password"
                inputMode="numeric"
                placeholder="Confirm PIN"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                className={`w-full px-4 py-3 rounded-lg border-2 mb-3 ${
                  darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"
                }`}
              />

              {pinError && <p className="text-sm text-red-500 mb-3">{pinError}</p>}

              <button
                onClick={handleSetPin}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold shadow-md hover:shadow-lg"
              >
                Set PIN & Unlock
              </button>

              <button
                onClick={() => unlockApp()}
                className={`w-full mt-3 py-2 rounded-lg font-medium ${
                  darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"
                }`}
              >
                Skip (no PIN)
              </button>
            </>
          ) : (
            <>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className={`w-full px-4 py-3 rounded-lg border-2 mb-3 ${
                  darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"
                }`}
              />

              {pinError && <p className="text-sm text-red-500 mb-3">{pinError}</p>}

              <button
  onClick={handleUnlock}
  disabled={lockoutUntil && Date.now() < lockoutUntil}
  className={`w-full py-3 rounded-lg font-semibold shadow-md hover:shadow-lg ${
    lockoutUntil && Date.now() < lockoutUntil
      ? "bg-gray-400 text-white cursor-not-allowed"
      : "bg-indigo-600 text-white"
  }`}
>
  {lockoutUntil && Date.now() < lockoutUntil
    ? `Locked (${lockoutSecondsLeft}s)`
    : "Unlock"}
</button>

              <button
                onClick={handleResetPin}
                className="w-full mt-3 py-2 rounded-lg font-medium text-red-600 bg-red-50"
              >
                Reset PIN (demo)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ================== MAIN UI ================== */
  return (
    <div className={`min-h-screen ${bgClass} p-4 transition-colors duration-300`}>
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 mt-2">
          <div className="flex items-center gap-4">
            <img src={mulungushiLogo} alt="Logo" className="w-14 h-14 object-contain" />
            <div>
              <h1 className={`text-4xl font-bold ${darkMode ? "text-blue-300" : "text-blue-800"}`}>
                Study Planner
              </h1>
              <p className={secondaryText}>Mulungushi University</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={lockApp}
              className={`${cardBg} px-3 py-2 rounded-xl shadow hover:shadow-md flex items-center gap-2`}
              title="Lock app"
            >
              <Lock size={16} className={darkMode ? "text-gray-200" : "text-gray-700"} />
              <span className={`text-sm ${textClass}`}>Lock</span>
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`${cardBg} p-3 rounded-full shadow-lg hover:shadow-xl`}
              title="Toggle theme"
            >
              {darkMode ? <Sun className="text-red-400" /> : <Moon className="text-blue-700" />}
            </button>
          </div>
        </div>

        {/* PROGRESS */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`font-semibold ${textClass}`}>Overall Progress</span>
            <span className={`text-2xl font-bold ${textClass}`}>{progress}%</span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-blue-700 to-red-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={`text-sm ${secondaryText} mt-2`}>
            {tasks.filter((t) => t.completed).length} of {tasks.length} tasks completed
          </p>
        </div>

        {/* AI PANEL */}
        <div className={`${cardBg} rounded-xl shadow-lg p-5 mb-6 border-l-4 border-indigo-500`}>
          <h3 className={`font-semibold mb-2 ${textClass}`}>🤖 AI Study Assistant</h3>
          <p className={secondaryText}>{getAISuggestion()}</p>
        </div>

        {/* TODAY'S FOCUS */}
        <div className={`${cardBg} rounded-xl shadow-lg p-5 mb-6 border-l-4 border-blue-600`}>
          <h3 className={`font-semibold mb-2 ${textClass}`}>🎯 Today’s Focus</h3>

          {focusTasks.length === 0 ? (
            <p className={secondaryText}>No pending tasks. You’re clear for today ✅</p>
          ) : (
            <ul className={`space-y-2 ${secondaryText}`}>
              {focusTasks.map((t) => (
                <li key={t.id} className="flex justify-between gap-3">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-sm">
                    {new Date(t.dueDate).toLocaleDateString()} • ⏳ {(t.estimatedMinutes ?? 45)}m
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ADD TASK */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <h2 className={`text-xl font-semibold ${textClass} mb-4 flex items-center gap-2`}>
            <Plus size={22} /> Add New Task
          </h2>

          <input
            type="text"
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            className={`w-full px-4 py-3 mb-4 rounded-lg border-2 ${
              darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"
            }`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`px-4 py-3 rounded-lg border-2 ${
                darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"
              }`}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`px-4 py-3 rounded-lg border-2 ${
                darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"
              }`}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={addTask}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold shadow-md hover:shadow-lg"
          >
            Add Task
          </button>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === f
                  ? "bg-indigo-600 text-white shadow-md"
                  : darkMode
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  : "bg-white text-gray-700 hover:bg-gray-50 shadow"
              }`}
            >
              <Filter size={14} className="inline mr-2" />
              {f}
            </button>
          ))}
        </div>

        {/* SEARCH */}
        <div className={`${cardBg} rounded-xl shadow-md p-4 mb-6`}>
          <input
            type="text"
            placeholder="🔍 Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border-2 ${
              darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"
            } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        {/* TASK LIST */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className={`${cardBg} rounded-xl shadow-lg p-10 text-center`}>
              <p className={`text-lg ${secondaryText}`}>No tasks found.</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const overdue = !task.completed && new Date(task.dueDate) < new Date();

              const normalizedSubtasks = (task.subtasks || []).map((st, idx) =>
                typeof st === "string" ? { id: idx + 1, text: st, done: false } : st
              );

              const doneCount = normalizedSubtasks.filter((s) => s.done).length;
              const totalCount = normalizedSubtasks.length;

              return (
                <div
                  key={task.id}
                  className={`${cardBg} rounded-xl shadow-md p-5 ${overdue ? "border-l-4 border-red-600" : ""}`}
                >
                  <div className="flex gap-4 items-start">
                    <button
                      onClick={() => toggleComplete(task.id)}
                      className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        task.completed ? "bg-green-500 border-green-500" : "border-gray-400"
                      }`}
                    >
                      {task.completed && <Check size={14} className="text-white" />}
                    </button>

                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold ${textClass} ${task.completed ? "line-through" : ""}`}>
                        {task.title}
                      </h3>

                      <div className="flex flex-wrap gap-3 mt-2 items-center">
                        <span className={`text-sm ${secondaryText} flex items-center gap-1`}>
                          <Calendar size={14} />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>

                        <span className={`text-xs px-3 py-1 rounded-full ${categoryStyles[task.category]}`}>
                          {task.category}
                        </span>

                        <span className={`text-sm ${secondaryText}`}>⏳ {(task.estimatedMinutes ?? 45)} min</span>

                        {overdue && (
                          <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700">Overdue</span>
                        )}
                      </div>

                      {totalCount > 0 && (
                        <div className="mt-3">
                          <div className={`text-sm ${secondaryText} mb-2`}>
                            Subtasks: <span className="font-medium">{doneCount}/{totalCount}</span>
                          </div>

                          <ul className="space-y-2">
                            {normalizedSubtasks.map((st) => (
                              <li key={st.id} className="flex items-start gap-2">
                                <button
                                  onClick={() => toggleSubtask(task.id, st.id)}
                                  className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${
                                    st.done
                                      ? "bg-green-500 border-green-500"
                                      : darkMode
                                      ? "border-gray-600"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {st.done && <Check size={12} className="text-white" />}
                                </button>

                                <span className={`text-sm ${secondaryText} ${st.done ? "line-through opacity-70" : ""}`}>
                                  {st.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 rounded-lg text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
