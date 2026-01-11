import React, { useState, useEffect } from 'react';
import { Calendar, Check, Trash2, Plus, Filter, Moon, Sun } from 'lucide-react';
import mulungushiLogo from './assets/mulungushi-logo.png';

export default function StudentPlanner() {
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('Study');
  const [filter, setFilter] = useState('All');
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /* ================== LOCAL STORAGE ================== */
  useEffect(() => {
    const savedTasks = localStorage.getItem('studentTasks');
    if (savedTasks) setTasks(JSON.parse(savedTasks));
  }, []);

  useEffect(() => {
    localStorage.setItem('studentTasks', JSON.stringify(tasks));
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
    };

    setTasks([...tasks, newTask]);
    setTaskTitle('');
    setDueDate('');
    setCategory('Study');
  };

  const toggleComplete = (id) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  /* ================== FILTERS & STATS ================== */
 const getFilteredTasks = () => {
  let filtered = tasks;

  if (filter === 'Completed') {
    filtered = filtered.filter(t => t.completed);
  } else if (filter === 'Pending') {
    filtered = filtered.filter(t => !t.completed);
  }

  if (searchQuery.trim()) {
    filtered = filtered.filter(task =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  return filtered;
};


  const getProgress = () => {
    if (tasks.length === 0) return 0;
    return Math.round(
      (tasks.filter(t => t.completed).length / tasks.length) * 100
    );
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') addTask();
  };

  /* ================== STYLES ================== */
  const categoryStyles = {
    Study: darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800',
    Exams: darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800',
    Personal: darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700',
  };

  const filteredTasks = getFilteredTasks();
  const progress = getProgress();

  const categories = ['Study', 'Exams', 'Personal'];
  const filters = ['All', 'Completed', 'Pending'];

  const bgClass = darkMode
    ? 'bg-slate-900'
    : 'bg-gradient-to-br from-blue-50 via-white to-red-50';

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textClass = darkMode ? 'text-gray-100' : 'text-gray-800';
  const secondaryText = darkMode ? 'text-gray-400' : 'text-gray-600';

  /* ================== UI ================== */
  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-300 p-4`}>
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 mt-4">
          <div className="flex items-center gap-4">
            <img
              src={mulungushiLogo}
              alt="Mulungushi University Logo"
              className="w-14 h-14 object-contain"
            />
            <div>
              <h1 className={`text-4xl font-bold ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                Study Planner
              </h1>
              <p className={secondaryText}>Mulungushi University</p>
            </div>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-3 rounded-full ${cardBg} shadow-lg hover:shadow-xl`}
          >
            {darkMode ? <Sun className="text-red-400" /> : <Moon className="text-blue-700" />}
          </button>
        </div>

        {/* PROGRESS */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <div className="flex justify-between mb-2">
            <span className={`font-semibold ${textClass}`}>Overall Progress</span>
            <span className={`text-2xl font-bold ${textClass}`}>{progress}%</span>
          </div>

          <div className="w-full bg-gray-300 rounded-full h-4">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-blue-700 to-red-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className={`text-sm ${secondaryText} mt-2`}>
            {tasks.filter(t => t.completed).length} of {tasks.length} tasks completed
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
            onKeyPress={handleKeyPress}
            className={`w-full px-4 py-3 mb-4 rounded-lg border ${
              darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
            }`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`px-4 py-3 rounded-lg border ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
              }`}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`px-4 py-3 rounded-lg border ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
              }`}
            >
              {categories.map(cat => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            onClick={addTask}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold"
          >
            Add Task
          </button>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : darkMode
                  ? 'bg-gray-800 text-gray-300'
                  : 'bg-white text-gray-700 shadow'
              }`}
            >
              <Filter size={14} className="inline mr-2" />
              {f}
            </button>
          ))}
        </div>
        <div className={`${cardBg} rounded-xl shadow-md p-4 mb-6`}>
  <input
    type="text"
    placeholder="🔍 Search tasks..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className={`w-full px-4 py-3 rounded-lg border ${
      darkMode
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'border-gray-300'
    } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
  />
</div>

        {/* TASK LIST */}
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const isOverdue =
              !task.completed && new Date(task.dueDate) < new Date();

            return (
              <div
                key={task.id}
                className={`${cardBg} rounded-xl shadow-md p-5 ${
                  isOverdue ? 'border-l-4 border-red-600' : ''
                }`}
              >
                <div className="flex gap-4 items-start">
                  <button
                    onClick={() => toggleComplete(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      task.completed ? 'bg-green-500 border-green-500' : 'border-gray-400'
                    }`}
                  >
                    {task.completed && <Check size={14} className="text-white" />}
                  </button>

                  <div className="flex-1">
                    <h3 className={`${textClass} font-semibold ${task.completed && 'line-through'}`}>
                      {task.title}
                    </h3>

                    <div className="flex gap-3 mt-2 flex-wrap">
                      <span className={`${secondaryText} flex items-center gap-1 text-sm`}>
                        <Calendar size={14} />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>

                      <span className={`text-xs px-3 py-1 rounded-full ${categoryStyles[task.category]}`}>
                        {task.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
