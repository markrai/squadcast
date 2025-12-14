(function () {
    const config = (window.SQUADCAST || {});
    const room = 'default'; // Always use default room for two-person chat
    const role = (config.role || 'caregiver');

    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendEl = document.getElementById('send');
    const presenceEl = document.getElementById('presence');
    const fontUpEl = document.getElementById('fontUp');
    const fontDownEl = document.getElementById('fontDown');
    const themeToggleEl = document.getElementById('themeToggle');

    let socket = null;

    const fontKey = `squadcast:fontScale:${role}`;
    const defaultScale = role === 'elder' ? 1.25 : 1.0;
    const themeKey = 'squadcast:theme';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function setScale(scale) {
        const next = clamp(scale, 0.85, 1.8);
        document.documentElement.style.setProperty('--scale', String(next));
        try { localStorage.setItem(fontKey, String(next)); } catch (_) {}
    }

    function loadScale() {
        try {
            const raw = localStorage.getItem(fontKey);
            const parsed = raw ? parseFloat(raw) : NaN;
            if (Number.isFinite(parsed)) return parsed;
        } catch (_) {}
        return defaultScale;
    }

    function setTheme(isLight) {
        const root = document.documentElement;
        if (isLight) {
            root.classList.add('light-mode');
            themeToggleEl.textContent = '🌙';
            themeToggleEl.setAttribute('aria-label', 'Toggle dark mode');
        } else {
            root.classList.remove('light-mode');
            themeToggleEl.textContent = '☀';
            themeToggleEl.setAttribute('aria-label', 'Toggle light mode');
        }
        try {
            localStorage.setItem(themeKey, isLight ? 'light' : 'dark');
        } catch (_) {}
    }

    function loadTheme() {
        try {
            const saved = localStorage.getItem(themeKey);
            return saved === 'light';
        } catch (_) {}
        return false;
    }

    function toggleTheme() {
        const isLight = document.documentElement.classList.contains('light-mode');
        setTheme(!isLight);
    }

    function formatTime(iso) {
        try {
            const date = new Date(iso);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (_) {
            return '';
        }
    }

    function isNearBottom() {
        const scroller = document.querySelector('.chat');
        if (!scroller) return true;
        const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        return distance < 120;
    }

    function scrollToBottom() {
        const scroller = document.querySelector('.chat');
        if (!scroller) return;
        scroller.scrollTop = scroller.scrollHeight;
    }

    function renderMessage(message) {
        const mine = message.role === role;
        const item = document.createElement('li');
        item.className = `message ${mine ? 'message-self' : 'message-other'}`;

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = message.text || '';

        const meta = document.createElement('div');
        meta.className = 'meta';
        const senderLabel = mine ? 'You' : (message.role === 'elder' ? 'Elder' : 'Caregiver');
        const timeLabel = message.ts ? formatTime(message.ts) : '';
        meta.textContent = timeLabel ? `${senderLabel} · ${timeLabel}` : senderLabel;

        item.appendChild(bubble);
        item.appendChild(meta);
        messagesEl.appendChild(item);
    }

    async function loadHistory() {
        const res = await fetch(`/api/messages?room=${encodeURIComponent(room)}&limit=200`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.messages) ? data.messages : [];
        messagesEl.innerHTML = '';
        for (const message of list) renderMessage(message);
        scrollToBottom();
    }

    function sendMessage() {
        const text = (inputEl.value || '').trim();
        if (!text) return;
        if (!socket) return;
        socket.emit('send_message', { room, role, text });
        inputEl.value = '';
        inputEl.focus();
    }

    function setPresence(p) {
        if (!p || p.room !== room) return;
        const elderOnline = (p.elder || 0) > 0;
        const caregiverOnline = (p.caregiver || 0) > 0;
        if (role === 'elder') {
            presenceEl.textContent = caregiverOnline ? 'Caregiver online' : 'Caregiver offline';
        } else {
            presenceEl.textContent = elderOnline ? 'Elder online' : 'Elder offline';
        }
    }

    const initialScale = loadScale();
    setScale(initialScale);

    const initialTheme = loadTheme();
    setTheme(initialTheme);

    fontUpEl.addEventListener('click', () => setScale(loadScale() + 0.07));
    fontDownEl.addEventListener('click', () => setScale(loadScale() - 0.07));
    themeToggleEl.addEventListener('click', toggleTheme);

    sendEl.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    if (typeof io !== 'function') {
        presenceEl.textContent = 'Offline (socket.io missing)';
        return;
    }

    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', async () => {
        presenceEl.textContent = 'Connecting…';
        socket.emit('join', { room, role });
        await loadHistory();
    });

    socket.on('disconnect', () => {
        presenceEl.textContent = 'Disconnected';
    });

    socket.on('presence', setPresence);

    socket.on('joined', (data) => {
        if (!data || data.room !== room) return;
        presenceEl.textContent = 'Connected';
    });

    socket.on('new_message', (message) => {
        if (!message || message.room !== room) return;
        const shouldScroll = isNearBottom();
        renderMessage(message);
        if (shouldScroll) scrollToBottom();
    });

    setInterval(() => {
        try { socket.emit('ping'); } catch (_) {}
    }, 50000);
})();
