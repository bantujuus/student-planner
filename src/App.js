import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Trash2,
  Plus,
  Filter,
  Moon,
  Sun,
  Lock,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Clock,
} from "lucide-react";

export default function App() {
  /* ================== SECURITY SETTINGS ================== */
  const INACTIVITY_MINUTES = 5;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SECONDS = 30;

  /* ================== STORAGE KEYS ================== */
  const PIN_KEY = "planner:pin-hash";
  const LOCK_KEY = "planner:locked";
  const SALT_KEY = "planner:salt";
  const ENCRYPTED_TASKS_KEY = "planner:tasks-encrypted";
  const ENCRYPTED_TIMETABLE_KEY = "planner:timetable-encrypted";

  /* ================== STORAGE WRAPPER ================== */
  const storage = {
    get: async (key) => ({ value: localStorage.getItem(key) }),
    set: async (key, value) => localStorage.setItem(key, value),
    delete: async (key) => localStorage.removeItem(key),
  };

  /* ================== ENCRYPTION HELPERS ================== */
  const getOrCreateSalt = async () => {
    try {
      const result = await storage.get(SALT_KEY);
      if (result?.value) return new Uint8Array(result.value.split(",").map(Number));
    } catch {}

    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).join(",");
    await storage.set(SALT_KEY, salt);
    return new Uint8Array(salt.split(",").map(Number));
  };

  const deriveKeyFromPin = async (pin) => {
    const encoder = new TextEncoder();
    const salt = await getOrCreateSalt();

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  };

  const encryptData = async (value, pin) => {
    const key = await deriveKeyFromPin(pin);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
  };

  const decryptData = async (encryptedObj, pin) => {
    const key = await deriveKeyFromPin(pin);
    const iv = new Uint8Array(encryptedObj.iv);
    const data = new Uint8Array(encryptedObj.data);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  };

  /* ================== APP STATE ================== */
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("Study");
  const [filter, setFilter] = useState("All");
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifiedTasks, setNotifiedTasks] = useState([]);
  const [showTimetable, setShowTimetable] = useState(false);

  /* ================== TIMETABLE STATE ================== */
  const [classes, setClasses] = useState([]);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const [course, setCourse] = useState("");
  const [day, setDay] = useState("Mon");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [room, setRoom] = useState("");
  const [classError, setClassError] = useState("");

  /* ================== SECURITY STATE ================== */
  const [isLocked, setIsLocked] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [hasPin, setHasPin] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const pinRef = useRef("");

  /* ================== INITIALIZE ================== */
  useEffect(() => {
    const init = async () => {
      try {
        const lockResult = await storage.get(LOCK_KEY);
        const pinResult = await storage.get(PIN_KEY);

        setHasPin(!!pinResult?.value);
        setIsLocked(lockResult?.value ? lockResult.value === "true" : true);
      } catch {
        setIsLocked(true);
      }
      setIsLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================== HASH PIN ================== */
  const hashPin = async (pin) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  /* ================== LOCK/UNLOCK ================== */
  const lockApp = async () => {
    setIsLocked(true);
    await storage.set(LOCK_KEY, "true");
    setTasks([]);
    setClasses([]);
    setPinInput("");
    setPinError("");
    setAttempts(0);
    setLockoutUntil(null);
    setLockoutSecondsLeft(0);
    pinRef.current = "";
  };

  const unlockApp = async () => {
    setIsLocked(false);
    await storage.set(LOCK_KEY, "false");
    setPinInput("");
    setPinError("");
    setAttempts(0);
    setLockoutUntil(null);
    setLockoutSecondsLeft(0);
  };

  /* ================== AUTO-LOCK ================== */
  useEffect(() => {
    const markActivity = () => (lastActivityRef.current = Date.now());

    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActivity));

    const interval = setInterval(() => {
      if (isLocked) return;
      const ms = Date.now() - lastActivityRef.current;
      if (ms > INACTIVITY_MINUTES * 60 * 1000) lockApp();
    }, 3000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActivity));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  /* ================== LOCKOUT TIMER ================== */
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

  /* ================== SAVE ENCRYPTED DATA ================== */
  useEffect(() => {
    const saveAll = async () => {
      if (isLocked || !pinRef.current) return;

      try {
        const encTasks = await encryptData(tasks, pinRef.current);
        await storage.set(ENCRYPTED_TASKS_KEY, JSON.stringify(encTasks));
      } catch {}

      try {
        const encTimetable = await encryptData(classes, pinRef.current);
        await storage.set(ENCRYPTED_TIMETABLE_KEY, JSON.stringify(encTimetable));
      } catch {}
    };

    saveAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, classes, isLocked]);

  /* ================== NOTIFICATIONS ================== */
  useEffect(() => {
    if ("Notification" in window) Notification.requestPermission();
  }, []);

  const notifyDueTasks = () => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = new Date().toDateString();

    tasks.forEach((task) => {
      const taskDate = new Date(task.dueDate).toDateString();
      if (!task.completed && taskDate === today && !notifiedTasks.includes(task.id)) {
        new Notification("📌 Task Due Today", { body: task.title });
        setNotifiedTasks((prev) => [...prev, task.id]);
      }
    });
  };

  useEffect(() => {
    if (isLocked) return;
    notifyDueTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isLocked]);

  /* ================== TIMETABLE HELPERS ================== */
  const timeToMinutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const overlaps = (aStart, aEnd, bStart, bEnd) => {
    const A1 = timeToMinutes(aStart);
    const A2 = timeToMinutes(aEnd);
    const B1 = timeToMinutes(bStart);
    const B2 = timeToMinutes(bEnd);
    return A1 < B2 && B1 < A2;
  };

  const addClass = () => {
    setClassError("");

    if (!course.trim()) return setClassError("Please enter a course name.");
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return setClassError("End time must be after start time.");

    const conflict = classes.some((c) => c.day === day && overlaps(startTime, endTime, c.startTime, c.endTime));
    if (conflict) return setClassError("Time conflict: You already have a class in this slot.");

    const newClass = {
      id: Date.now(),
      course: course.trim(),
      day,
      startTime,
      endTime,
      room: room.trim(),
    };

    setClasses((prev) => [...prev, newClass]);
    setCourse("");
    setDay("Mon");
    setStartTime("08:00");
    setEndTime("09:00");
    setRoom("");
  };

  const deleteClass = (id) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 8; h <= 17; h += 1) {
      const hh = String(h).padStart(2, "0");
      slots.push(`${hh}:00`);
    }
    return slots;
  }, []);

  // ✅ FIX: show a class in ALL hour-cells it overlaps (not only where it starts)
  const getClassForCell = (dayName, slotStart) => {
    const slotEndMinutes = timeToMinutes(slotStart) + 60;
    const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, "0")}:${String(slotEndMinutes % 60).padStart(
      2,
      "0"
    )}`;

    return classes.find((c) => {
      if (c.day !== dayName) return false;
      return overlaps(slotStart, slotEnd, c.startTime, c.endTime);
    });
  };

  const isStartOfClassInSlot = (c, slotStart) => {
    const s = timeToMinutes(slotStart);
    const cs = timeToMinutes(c.startTime);
    return cs >= s && cs < s + 60;
  };

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
      steps = ["Review notes (20 mins)", "Watch 1 short video (10 mins)", "Do 5 practice questions", "Write a 5-line summary"];
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

  const daysUntil = (dateStr) => {
    const today = new Date();
    const d = new Date(dateStr);
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / (1000 * 60 * 60 * 24));
  };

  const aiPriorityScore = (task) => {
    const left = daysUntil(task.dueDate);
    let score = 0;

    if (left < 0) score += 100; // overdue
    else if (left === 0) score += 70; // due today
    else if (left <= 2) score += 50;
    else if (left <= 5) score += 30;
    else score += 10;

    score += Math.min(30, Math.round((task.estimatedMinutes || 45) / 10));
    if (task.category === "Exams") score += 10;

    return score;
  };

  const aiLabel = (task) => {
    const score = aiPriorityScore(task);
    if (score >= 90) return "Critical";
    if (score >= 60) return "High";
    if (score >= 35) return "Medium";
    return "Low";
  };

  const getBusyIntervalsForDay = (dayName) =>
    classes
      .filter((c) => c.day === dayName)
      .map((c) => [timeToMinutes(c.startTime), timeToMinutes(c.endTime)])
      .sort((a, b) => a[0] - b[0]);

  const suggestStudyTimesForDay = (dayName, minutesNeeded = 60) => {
    const dayStart = 8 * 60;
    const dayEnd = 17 * 60;

    const busy = getBusyIntervalsForDay(dayName);
    const free = [];
    let cursor = dayStart;

    for (const [bs, be] of busy) {
      if (cursor < bs) free.push([cursor, bs]);
      cursor = Math.max(cursor, be);
    }
    if (cursor < dayEnd) free.push([cursor, dayEnd]);

    const slot = free.find(([s, e]) => e - s >= minutesNeeded) || free[0];
    if (!slot) return null;

    const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    const start = slot[0];
    const end = Math.min(slot[0] + minutesNeeded, slot[1]);
    return `${dayName} ${toHHMM(start)}–${toHHMM(end)}`;
  };

  const nextBestTask = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    if (pending.length === 0) return null;
    return pending.slice().sort((a, b) => aiPriorityScore(b) - aiPriorityScore(a))[0];
  }, [tasks]);

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

  /* ================== FILTERS ================== */
  const filteredTasks = tasks.filter((task) => {
    if (filter === "Completed" && !task.completed) return false;
    if (filter === "Pending" && task.completed) return false;
    if (searchQuery.trim() && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const progress = tasks.length === 0 ? 0 : Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);

  /* ================== SET PIN & UNLOCK ================== */
  const handleSetPin = async () => {
    setPinError("");
    if (pinInput.length < 4) return setPinError("PIN must be at least 4 digits.");
    if (pinInput !== pinConfirm) return setPinError("PINs do not match.");

    const hash = await hashPin(pinInput);
    await storage.set(PIN_KEY, hash);
    setHasPin(true);

    pinRef.current = pinInput;
    await storage.set(ENCRYPTED_TASKS_KEY, JSON.stringify(await encryptData([], pinInput)));
    await storage.set(ENCRYPTED_TIMETABLE_KEY, JSON.stringify(await encryptData([], pinInput)));

    await unlockApp();
    setPinInput("");
    setPinConfirm("");
  };

  const handleUnlock = async () => {
    setPinError("");

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setPinError(`Too many attempts. Try again in ${lockoutSecondsLeft}s.`);
      return;
    }

    try {
      const savedHashResult = await storage.get(PIN_KEY);
      if (!savedHashResult?.value) return;

      const enteredHash = await hashPin(pinInput);

      if (enteredHash !== savedHashResult.value) {
        const nextAttemptsCount = attempts + 1;
        setAttempts(nextAttemptsCount);

        if (nextAttemptsCount >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockoutUntil(until);
          setLockoutSecondsLeft(LOCKOUT_SECONDS);
          setPinError(`Too many attempts. Locked for ${LOCKOUT_SECONDS}s.`);
          setPinInput("");
          return;
        }

        setPinError(`Wrong PIN. Attempts left: ${MAX_ATTEMPTS - nextAttemptsCount}`);
        return;
      }

      // Correct PIN - decrypt data
      try {
        const encTasksResult = await storage.get(ENCRYPTED_TASKS_KEY);
        const encTableResult = await storage.get(ENCRYPTED_TIMETABLE_KEY);

        const loadedTasks = encTasksResult?.value ? await decryptData(JSON.parse(encTasksResult.value), pinInput) : [];
        const loadedClasses = encTableResult?.value ? await decryptData(JSON.parse(encTableResult.value), pinInput) : [];

        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
        setClasses(Array.isArray(loadedClasses) ? loadedClasses : []);
      } catch {
        setPinError("Failed to decrypt data. Wrong PIN or corrupted storage.");
        return;
      }

      pinRef.current = pinInput;
      await unlockApp();
    } catch {
      setPinError("Error accessing storage. Please try again.");
    }
  };

  const handleResetPin = async () => {
    await storage.delete(PIN_KEY);
    await storage.delete(ENCRYPTED_TASKS_KEY);
    await storage.delete(ENCRYPTED_TIMETABLE_KEY);
    await storage.delete(SALT_KEY);
    await storage.set(LOCK_KEY, "true");

    setHasPin(false);
    setIsLocked(true);
    setTasks([]);
    setClasses([]);
    setPinInput("");
    setPinConfirm("");
    setPinError("");
    pinRef.current = "";
  };

  /* ================== LOADING STATE ================== */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <GraduationCap size={48} className="mx-auto mb-4 text-indigo-600 animate-pulse" />
          <p className="text-gray-600">Loading Study Planner...</p>
        </div>
      </div>
    );
  }

  /* ================== LOCK SCREEN ================== */
  if (isLocked) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-slate-900" : "bg-gray-50"} p-4 flex items-center justify-center`}>
        <div className={`${darkMode ? "bg-gray-800" : "bg-white"} w-full max-w-md rounded-2xl shadow-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-indigo-600/10">
              <Lock className="text-indigo-600" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>Planner Locked</h2>
              <p className={darkMode ? "text-gray-400" : "text-gray-600"}>Enter your PIN to continue</p>
            </div>
          </div>

          {!hasPin ? (
            <>
              <div className={`mb-3 text-sm ${darkMode ? "text-gray-400" : "text-gray-600"} flex items-center gap-2`}>
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
                {lockoutUntil && Date.now() < lockoutUntil ? `Locked (${lockoutSecondsLeft}s)` : "Unlock"}
              </button>

              <button onClick={handleResetPin} className="w-full mt-3 py-2 rounded-lg font-medium text-red-600 bg-red-50">
                Reset PIN & Clear Data
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ================== MAIN UI ================== */
  const bgClass = darkMode ? "bg-slate-900" : "bg-gradient-to-br from-blue-50 via-white to-red-50";
  const cardBg = darkMode ? "bg-gray-800" : "bg-white";
  const textClass = darkMode ? "text-gray-100" : "text-gray-800";
  const secondaryText = darkMode ? "text-gray-400" : "text-gray-600";

  const categoryStyles = {
    Study: darkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800",
    Exams: darkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800",
    Personal: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
  };

  const aiBadgeClass = (label) => {
    if (label === "Critical") return "bg-red-600 text-white";
    if (label === "High") return "bg-orange-500 text-white";
    if (label === "Medium") return "bg-yellow-400 text-gray-900";
    return "bg-green-500 text-white";
  };

  return (
    <div className={`min-h-screen ${bgClass} p-4 transition-colors duration-300`}>
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 mt-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <GraduationCap size={32} className="text-white" />
            </div>
            <div>
              <h1 className={`text-4xl font-bold ${darkMode ? "text-blue-300" : "text-blue-800"}`}>Study Planner</h1>
              <p className={secondaryText}>Mulungushi University</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTimetable((v) => !v)}
              className={`${showTimetable ? "bg-indigo-600 text-white" : cardBg} px-4 py-2 rounded-xl shadow-lg hover:shadow-xl flex items-center gap-2 transition-all border-2 ${
                showTimetable ? "border-indigo-600" : "border-transparent"
              }`}
              title="Toggle timetable"
            >
              <Calendar size={18} className={showTimetable ? "text-white" : darkMode ? "text-gray-200" : "text-gray-700"} />
              <span className={`text-sm font-semibold ${showTimetable ? "text-white" : textClass}`}>
                {showTimetable ? "Hide Timetable" : "Show Timetable"}
              </span>
            </button>

            <button onClick={lockApp} className={`${cardBg} px-3 py-2 rounded-xl shadow hover:shadow-md flex items-center gap-2`} title="Lock app">
              <Lock size={16} className={darkMode ? "text-gray-200" : "text-gray-700"} />
              <span className={`text-sm ${textClass}`}>Lock</span>
            </button>

            <button onClick={() => setDarkMode(!darkMode)} className={`${cardBg} p-3 rounded-full shadow-lg hover:shadow-xl`} title="Toggle theme">
              {darkMode ? <Sun className="text-red-400" /> : <Moon className="text-blue-700" />}
            </button>
          </div>
        </div>

        {/* AI QUICK PANEL */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-600/10">
                <Sparkles className="text-indigo-600" />
              </div>
              <div>
                <div className={`font-semibold ${textClass}`}>AI Study Assistant</div>
                <div className={`text-sm ${secondaryText}`}>
                  Prioritizes tasks + suggests a study slot using your timetable
                </div>
              </div>
            </div>

            {nextBestTask ? (
              <div className={`flex items-center gap-3 ${darkMode ? "bg-gray-700" : "bg-gray-50"} rounded-xl p-3 border ${darkMode ? "border-gray-600" : "border-gray-200"}`}>
                <div>
                  <div className={`text-sm font-semibold ${textClass}`}>Next best task:</div>
                  <div className={`text-sm ${secondaryText}`}>{nextBestTask.title}</div>
                  <div className={`text-xs ${secondaryText} mt-1 flex items-center gap-2`}>
                    <Clock size={14} />
                    {Math.min(90, nextBestTask.estimatedMinutes || 60)} mins •{" "}
                    {suggestStudyTimesForDay("Mon", Math.min(60, nextBestTask.estimatedMinutes || 60)) ||
                      "Add classes for better suggestions"}
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${aiBadgeClass(aiLabel(nextBestTask))}`}>
                  {aiLabel(nextBestTask)}
                </span>
              </div>
            ) : (
              <div className={`text-sm ${secondaryText}`}>Add a task to get AI suggestions.</div>
            )}
          </div>
        </div>

        {/* TIMETABLE SECTION */}
        {showTimetable && (
          <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
            <h2 className={`text-xl font-semibold ${textClass} mb-4`}>📅 Weekly Timetable</h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="Course (e.g. CSC301)"
                className={`px-3 py-2 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
              />

              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={`px-3 py-2 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`px-3 py-2 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
              />

              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`px-3 py-2 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
              />

              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room (optional)"
                className={`px-3 py-2 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
              />
            </div>

            {classError && <p className="text-sm text-red-500 mb-3">{classError}</p>}

            <button onClick={addClass} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:shadow-md mb-6">
              Add Class
            </button>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-6 gap-2 mb-2">
                  <div className={`text-sm font-semibold ${secondaryText}`}>Time</div>
                  {DAYS.map((d) => (
                    <div key={d} className={`text-sm font-semibold ${textClass} text-center`}>
                      {d}
                    </div>
                  ))}
                </div>

                {timeSlots.map((slot) => (
                  <div key={slot} className="grid grid-cols-6 gap-2 mb-2">
                    <div className={`text-sm ${secondaryText} pt-2`}>{slot}</div>

                    {DAYS.map((d) => {
                      const c = getClassForCell(d, slot);

                      return (
                        <div
                          key={d + slot}
                          className={`${darkMode ? "bg-gray-700" : "bg-gray-50"} rounded-lg p-2 min-h-[56px] border ${
                            darkMode ? "border-gray-600" : "border-gray-200"
                          }`}
                        >
                          {c ? (
                            <div className="flex justify-between gap-2">
                              <div>
                                <div className={`text-sm font-semibold ${textClass}`}>
                                  {isStartOfClassInSlot(c, slot) ? c.course : "↳"}
                                </div>

                                {isStartOfClassInSlot(c, slot) ? (
                                  <div className={`text-xs ${secondaryText}`}>
                                    {c.startTime}–{c.endTime}
                                    {c.room ? ` • ${c.room}` : ""}
                                  </div>
                                ) : (
                                  <div className={`text-xs ${secondaryText}`}>Continues…</div>
                                )}
                              </div>

                              {isStartOfClassInSlot(c, slot) ? (
                                <button
                                  onClick={() => deleteClass(c.id)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Remove class"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROGRESS */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`font-semibold ${textClass}`}>Overall Progress</span>
            <span className={`text-2xl font-bold ${textClass}`}>{progress}%</span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
            <div className="h-4 rounded-full bg-gradient-to-r from-blue-700 to-red-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className={`text-sm ${secondaryText} mt-2`}>
            {tasks.filter((t) => t.completed).length} of {tasks.length} tasks completed
          </p>
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
            className={`w-full px-4 py-3 mb-4 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`px-4 py-3 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`px-4 py-3 rounded-lg border-2 ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
            >
              {["Study", "Exams", "Personal"].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button onClick={addTask} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold shadow-md hover:shadow-lg">
            Add Task
          </button>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["All", "Completed", "Pending"].map((f) => (
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
            filteredTasks
              .slice()
              .sort((a, b) => aiPriorityScore(b) - aiPriorityScore(a)) // AI sorting
              .map((task) => {
                const overdue = !task.completed && new Date(task.dueDate) < new Date();
                const label = aiLabel(task);
                const suggested = suggestStudyTimesForDay("Mon", Math.min(60, task.estimatedMinutes || 60));

                return (
                  <div key={task.id} className={`${cardBg} rounded-xl shadow-md p-5 ${overdue ? "border-l-4 border-red-600" : ""}`}>
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
                        <h3 className={`text-lg font-semibold ${textClass} ${task.completed ? "line-through" : ""}`}>{task.title}</h3>

                        <div className="flex flex-wrap gap-3 mt-2 items-center">
                          <span className={`text-sm ${secondaryText} flex items-center gap-1`}>
                            <Calendar size={14} />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>

                          <span className={`text-xs px-3 py-1 rounded-full ${categoryStyles[task.category]}`}>{task.category}</span>

                          <span className={`text-xs px-3 py-1 rounded-full ${aiBadgeClass(label)} flex items-center gap-1`}>
                            <Sparkles size={14} />
                            AI: {label}
                          </span>

                          <span className={`text-xs px-3 py-1 rounded-full ${darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"} flex items-center gap-1`}>
                            <Clock size={14} />
                            {task.estimatedMinutes} mins
                          </span>

                          {overdue && <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700">Overdue</span>}
                        </div>

                        <div className={`text-xs ${secondaryText} mt-2`}>
                          Suggested session:{" "}
                          {suggested || "Add classes to timetable for better suggestions"}
                        </div>
                      </div>

                      <button onClick={() => deleteTask(task.id)} className="p-2 rounded-lg text-red-500 hover:text-red-700">
                        <Trash2 size={18} />
                      </button>
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
