'use strict';

/* app.js — To-Do Life Dashboard 
   Pembaruan: Penambahan Fitur Menarik (Streak Pomodoro, Confetti Efek, Animasi Exit DOM)
*/

// ===========================================================================
// 1. Storage — Lapisan enkapsulasi data lokal
// ===========================================================================
const Storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'SecurityError')) {
        return;
      }
      throw e;
    }
  }
};

// ===========================================================================
// 2. Settings — Manajemen Preferensi Pengguna
// ===========================================================================
const Settings = {
  _state: null,

  init(state) {
    this._state = state;
    const defaults = { theme: 'light', name: '', timerDuration: 25, pomodoroStreak: 0 };
    let saved = Storage.get('tld_settings') || defaults;

    state.settings = {
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      name: typeof saved.name === 'string' ? saved.name : '',
      timerDuration: Number(saved.timerDuration) || 25,
      pomodoroStreak: Number(saved.pomodoroStreak) || 0 // Fitur Baru: Menyimpan jumlah sesi produktif
    };

    document.documentElement.dataset.theme = state.settings.theme;
    this._bindEvents();
    this.updateStreakDisplay();
  },

  setTheme(theme) {
    this._state.settings.theme = theme;
    document.documentElement.dataset.theme = theme;
    Storage.set('tld_settings', this._state.settings);
  },

  setName(name) {
    this._state.settings.name = String(name).trim().slice(0, 50);
    Storage.set('tld_settings', this._state.settings);
    Clock.render();
  },

  setTimerDuration(mins) {
    const parsed = parseInt(mins, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 99) return;
    this._state.settings.timerDuration = parsed;
    Storage.set('tld_settings', this._state.settings);
    Timer.reset();
  },

  // Fitur Baru: Menambah dan memperbarui data streak fokus
  incrementStreak() {
    this._state.settings.pomodoroStreak++;
    Storage.set('tld_settings', this._state.settings);
    this.updateStreakDisplay();
  },

  updateStreakDisplay() {
    const streakEl = document.getElementById('pomodoro-streak-count');
    if (streakEl) {
      streakEl.textContent = `🔥 ${this._state.settings.pomodoroStreak} Session Streak`;
      // Trigger animasi mikro bergetar saat streak bertambah
      streakEl.classList.remove('pulse-animation');
      void streakEl.offsetWidth; // Kebijakan memicu reflow CSS trigger
      streakEl.classList.add('pulse-animation');
    }
  },

  render() {
    document.getElementById('settings-name-input').value = this._state.settings.name;
    document.getElementById('settings-timer-input').value = this._state.settings.timerDuration;
    document.getElementById(`theme-${this._state.settings.theme}`).checked = true;
  },

  _bindEvents() {
    const overlay = document.getElementById('settings-overlay');
    const openBtn = document.getElementById('settings-open-btn');
    const closeBtn = document.getElementById('settings-close-btn');
    const cancelBtn = document.getElementById('settings-cancel-btn');
    const form = document.getElementById('settings-form');
    const themeToggle = document.getElementById('theme-toggle');

    if (openBtn) openBtn.addEventListener('click', () => {
      this.render();
      overlay.removeAttribute('hidden');
      overlay.classList.add('is-open');
    });

    const closePanel = () => {
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.setAttribute('hidden', ''), 200); // Sinkron dengan durasi fade-out CSS
    };

    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (cancelBtn) cancelBtn.addEventListener('click', closePanel);
    
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.setName(document.getElementById('settings-name-input').value);
      this.setTimerDuration(document.getElementById('settings-timer-input').value);
      this.setTheme(form.querySelector('input[name="theme"]:checked').value);
      closePanel();
    });

    if (themeToggle) themeToggle.addEventListener('click', () => {
      this.setTheme(this._state.settings.theme === 'light' ? 'dark' : 'light');
    });
  }
};

// ===========================================================================
// 3. Clock — Pengolah format waktu lokal & salam dinamis
// ===========================================================================
const Clock = {
  _state: null,

  init(state) {
    this._state = state;
    this.render();
    setInterval(() => this.render(), 1000);
  },

  render() {
    const now = new Date();
    const hrs = now.getHours();
    
    let greeting = 'Good morning';
    if (hrs >= 12 && hrs <= 17) greeting = 'Good afternoon';
    else if (hrs > 17) greeting = 'Good evening';

    const uName = this._state.settings.name;
    
    document.getElementById('greeting').textContent = uName ? `${greeting}, ${uName} 👋` : greeting;
    document.getElementById('clock-time').textContent = now.toTimeString().split(' ')[0];
    document.getElementById('clock-date').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
};

// ===========================================================================
// 4. Timer — Logika mundur Pomodoro
// ===========================================================================
const Timer = {
  _state: null,
  _intervalId: null,
  _secsLeft: 0,

  init(state) {
    this._state = state;
    this.reset();
    this._bindEvents();
  },

  start() {
    if (this._intervalId) return;
    document.getElementById('timer-display').classList.add('timer-running'); // Mulai animasi berdenyut halus
    this._intervalId = setInterval(() => {
      if (this._secsLeft > 0) {
        this._secsLeft--;
        this.render();
      } else {
        this.stop();
        Settings.incrementStreak(); // Tambahkan streak fokus sukses
        this._triggerAlarm();
      }
    }, 1000);
  },

  stop() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    document.getElementById('timer-display').classList.remove('timer-running');
  },

  reset() {
    this.stop();
    this._secsLeft = this._state.settings.timerDuration * 60;
    this.render();
  },

  _triggerAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch (_e) {
      alert('Focus session complete! Streak saved.');
    }
  },

  render() {
    const m = Math.floor(this._secsLeft / 60).toString().padStart(2, '0');
    const s = (this._secsLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
    document.getElementById('timer-duration-input').value = this._state.settings.timerDuration;
  },

  _bindEvents() {
    document.getElementById('timer-start-btn').addEventListener('click', () => this.start());
    document.getElementById('timer-stop-btn').addEventListener('click', () => this.stop());
    document.getElementById('timer-reset-btn').addEventListener('click', () => this.reset());
    document.getElementById('timer-duration-input').addEventListener('change', (e) => {
      Settings.setTimerDuration(e.target.value);
    });
  }
};

// ===========================================================================
// 5. Todo — Manajemen Tugas Lengkap dengan Animasi Keluar/Masuk DOM
// ===========================================================================
const Todo = {
  _state: null,
  _filter: 'created',

  init(state) {
    this._state = state;
    this._state.tasks = Storage.get('tld_tasks') || [];
    this.render();
    this._bindEvents();
  },

  addTask(text) {
    const err = document.getElementById('task-input-error');
    err.textContent = '';

    if (!text.trim()) return;
    if (this._state.tasks.some(t => t.text.toLowerCase() === text.trim().toLowerCase())) {
      err.textContent = 'This task already exists.';
      return;
    }

    const newTask = {
      id: `task_${Date.now()}`, text: text.trim(), completed: false, createdAt: Date.now()
    };

    this._state.tasks.push(newTask);
    Storage.set('tld_tasks', this._state.tasks);
    this.render();
    document.getElementById('task-input').value = '';
  },

  // Perbaikan: Menambahkan animasi hapus fade-out sebelum elemen dihapus dari DOM
  deleteTask(id, element) {
    if (element) {
      element.style.animation = 'slideOut 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards';
      element.addEventListener('animationend', () => {
        this._state.tasks = this._state.tasks.filter(t => t.id !== id);
        Storage.set('tld_tasks', this._state.tasks);
        this.render();
      });
    } else {
      this._state.tasks = this._state.tasks.filter(t => t.id !== id);
      Storage.set('tld_tasks', this._state.tasks);
      this.render();
    }
  },

  toggleTask(id, checkboxChecked) {
    const t = this._state.tasks.find(task => task.id === id);
    if (t) {
      t.completed = !t.completed;
      Storage.set('tld_tasks', this._state.tasks);
      
      // Fitur Menarik: Efek ledakan selebrasi partikel jika status berubah menjadi selesai
      if (t.completed && checkboxChecked) {
        this._triggerCelebration();
      }
      
      this.render();
    }
  },

  // Fitur Baru: Efek partikel mikro perayaan penyelesaian tugas tanpa pustaka luar
  _triggerCelebration() {
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.top = `-10px`;
      particle.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 60%)`;
      particle.style.transform = `scale(${Math.random() * 0.8 + 0.4})`;
      particle.style.animation = `confettiFall ${Math.random() * 1.5 + 1}s linear forwards`;
      
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    }
  },

  render() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';

    let items = [...this._state.tasks];
    if (this._filter === 'alpha') items.sort((a,b) => a.text.localeCompare(b.text));
    else if (this._filter === 'status') items.sort((a,b) => a.completed - b.completed);
    else items.sort((a,b) => a.createdAt - b.createdAt);

    if (!items.length) {
      list.innerHTML = `<li class="task-list-empty">No tasks yet. Add something productive!</li>`;
      return;
    }

    items.forEach(t => {
      const li = document.createElement('li');
      li.className = `task-item ${t.completed ? 'is-completed' : ''}`;
      li.style.animation = 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'; // Efek entri list baru

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'task-checkbox'; cb.checked = t.completed;
      cb.addEventListener('change', (e) => this.toggleTask(t.id, e.target.checked));

      const span = document.createElement('span');
      span.className = 'task-text'; span.textContent = t.text;

      const del = document.createElement('button');
      del.className = 'btn-icon'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Delete task');
      del.addEventListener('click', () => this.deleteTask(t.id, li));

      li.appendChild(cb); li.appendChild(span); li.appendChild(del);
      list.appendChild(li);
    });
  },

  _bindEvents() {
    document.getElementById('add-task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask(document.getElementById('task-input').value);
    });

    document.querySelectorAll('.btn-sort').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-sort').forEach(b => b.classList.remove('btn-sort--active'));
        e.target.classList.add('btn-sort--active');
        this._filter = e.target.dataset.sort;
        this.render();
      });
    });
  }
};

// ===========================================================================
// 6. Links — Launcher bookmark cepat 
// ===========================================================================
const Links = {
  _state: null,

  init(state) {
    this._state = state;
    this._state.links = Storage.get('tld_links') || [];
    this.render();
    this._bindEvents();
  },

  addLink(label, url) {
    if (!label.trim() || !url.trim()) return;
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    this._state.links.push({ id: `link_${Date.now()}`, label: label.trim(), url: target });
    Storage.set('tld_links', this._state.links);
    this.render();
    document.getElementById('link-label-input').value = '';
    document.getElementById('link-url-input').value = '';
  },

  deleteLink(id, element) {
    if (element) {
      element.style.transform = 'scale(0.8)';
      element.style.opacity = '0';
      setTimeout(() => {
        this._state.links = this._state.links.filter(l => l.id !== id);
        Storage.set('tld_links', this._state.links);
        this.render();
      }, 150);
    } else {
      this._state.links = this._state.links.filter(l => l.id !== id);
      Storage.set('tld_links', this._state.links);
      this.render();
    }
  },

  render() {
    const container = document.getElementById('links-list');
    container.innerHTML = '';

    if (!this._state.links.length) {
      container.innerHTML = `<span class="links-list-empty">No links launcher.</span>`;
      return;
    }

    this._state.links.forEach(l => {
      const wrap = document.createElement('div');
      wrap.className = 'link-btn-wrapper';
      wrap.style.animation = 'slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards';

      const btn = document.createElement('button');
      btn.className = 'link-btn'; btn.textContent = l.label;
      btn.addEventListener('click', () => window.open(l.url, '_blank'));

      const del = document.createElement('button');
      del.className = 'link-delete-btn'; del.textContent = '✕';
      del.setAttribute('aria-label', `Delete ${l.label}`);
      del.addEventListener('click', () => this.deleteLink(l.id, wrap));

      wrap.appendChild(btn); wrap.appendChild(del);
      container.appendChild(wrap);
    });
  },

  _bindEvents() {
    document.getElementById('add-link-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addLink(
        document.getElementById('link-label-input').value,
        document.getElementById('link-url-input').value
      );
    });
  }
};

// ===========================================================================
// 7. App Controller — Orkestrator Utama
// ===========================================================================
const App = {
  state: { settings: {}, tasks: [], links: [] },
  init() {
    Settings.init(this.state);
    Clock.init(this.state);
    Timer.init(this.state);
    Todo.init(this.state);
    Links.init(this.state);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());