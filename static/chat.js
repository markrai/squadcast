(function () {
    const config = (window.SQUADCAST || {});
    const room = 'default'; // Always use default room for two-person chat
    const role = (config.role || 'caregiver');

    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendEl = document.getElementById('send');
    const presenceEl = document.getElementById('presence');
    const roleAvatarEl = document.getElementById('roleAvatar');
    const fontUpEl = document.getElementById('fontUp');
    const fontDownEl = document.getElementById('fontDown');
    const themeToggleEl = document.getElementById('themeToggle');
    const settingsButtonEl = document.getElementById('settingsButton');
    const settingsModalEl = document.getElementById('settingsModal');
    const closeModalEl = document.getElementById('closeModal');
    const saveSettingsEl = document.getElementById('saveSettings');
    const cancelSettingsEl = document.getElementById('cancelSettings');
    const elderNameInputEl = document.getElementById('elderNameInput');
    const caregiverNameInputEl = document.getElementById('caregiverNameInput');
    const settingsTitleEl = document.getElementById('settingsTitle');
    const secretRoleEl = document.getElementById('secretRole');
    const roleToggleEl = document.getElementById('roleToggle');

    let socket = null;
    
    // Custom names storage (server-side, with localStorage fallback)
    const namesKey = 'squadcast:customNames';
    let customNames = { elder: 'Elder', caregiver: 'Caregiver' };
    let settingsTitleTapCount = 0;

    const fontKey = `squadcast:fontScale:${role}`;
    const defaultScale = role === 'elder' ? 1.25 : 1.0;
    const themeKey = 'squadcast:theme';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function setScale(scale) {
        // Allow a much larger maximum scale for accessibility (especially on elder view)
        const next = clamp(scale, 0.85, 2.4);
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

    // Custom names functions
    async function loadCustomNames() {
        try {
            const res = await fetch(`/api/names?room=${encodeURIComponent(room)}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.names) {
                    customNames = data.names;
                    // Also save to localStorage as backup
                    try {
                        localStorage.setItem(namesKey, JSON.stringify(customNames));
                    } catch (_) {}
                    return customNames;
                }
            }
        } catch (_) {}
        // Fallback to localStorage if server fails
        try {
            const saved = localStorage.getItem(namesKey);
            if (saved) {
                customNames = JSON.parse(saved);
                return customNames;
            }
        } catch (_) {}
        return { elder: 'Elder', caregiver: 'Caregiver' };
    }

    async function saveCustomNames(names) {
        customNames = names;
        // Save to localStorage as backup
        try {
            localStorage.setItem(namesKey, JSON.stringify(names));
        } catch (_) {}
        
        // Save to server (caregiver only)
        if (role === 'caregiver') {
            try {
                const res = await fetch(`/api/names?room=${encodeURIComponent(room)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(names)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.names) {
                        customNames = data.names;
                    }
                }
            } catch (_) {}
        }
    }

    function getDisplayName(roleName) {
        return customNames[roleName] || (roleName === 'elder' ? 'Elder' : 'Caregiver');
    }

    function updateAllDisplayedNames() {
        // Update presence text
        if (socket && socket.connected) {
            socket.emit('ping'); // Trigger presence update
        }
        
        // Update all message metadata
        const messageItems = messagesEl.querySelectorAll('.message');
        messageItems.forEach(item => {
            const meta = item.querySelector('.meta');
            if (meta) {
                const text = meta.textContent;
                const parts = text.split(' · ');
                if (parts.length === 2) {
                    const senderPart = parts[0];
                    const timePart = parts[1];
                    if (senderPart === 'Elder') {
                        meta.textContent = `${getDisplayName('elder')} · ${timePart}`;
                    } else if (senderPart === 'Caregiver') {
                        meta.textContent = `${getDisplayName('caregiver')} · ${timePart}`;
                    }
                } else if (text === 'Elder') {
                    meta.textContent = getDisplayName('elder');
                } else if (text === 'Caregiver') {
                    meta.textContent = getDisplayName('caregiver');
                }
            }
        });
    }

    // Secret role helpers
    function updateRoleToggleLabel() {
        if (!roleToggleEl) return;
        if (role === 'elder') {
            roleToggleEl.textContent = 'Current role: Elder (tap to switch to Caregiver)';
        } else {
            roleToggleEl.textContent = 'Current role: Caregiver (tap to switch to Elder)';
        }
    }

    function showSecretRoleToggle() {
        if (!secretRoleEl) return;
        console.log('Secret role menu revealed');
        secretRoleEl.style.display = 'block';
        updateRoleToggleLabel();
    }

    function resetSecretRoleToggle() {
        settingsTitleTapCount = 0;
        if (secretRoleEl) {
            secretRoleEl.style.display = 'none';
        }
    }

    // Modal functions
    async function openSettingsModal() {
        if (!settingsModalEl) return;
        const names = await loadCustomNames();
        if (elderNameInputEl) elderNameInputEl.value = names.elder || 'Elder';
        if (caregiverNameInputEl) caregiverNameInputEl.value = names.caregiver || 'Caregiver';
        settingsModalEl.style.display = 'flex';
    }

    function closeSettingsModal() {
        if (!settingsModalEl) return;
        settingsModalEl.style.display = 'none';
        resetSecretRoleToggle();
    }

    async function saveSettings() {
        if (!elderNameInputEl || !caregiverNameInputEl) return;
        const elderName = (elderNameInputEl.value || '').trim() || 'Elder';
        const caregiverName = (caregiverNameInputEl.value || '').trim() || 'Caregiver';
        
        await saveCustomNames({ elder: elderName, caregiver: caregiverName });
        closeSettingsModal();
        updateAllDisplayedNames();
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
        const senderLabel = mine ? 'You' : getDisplayName(message.role);
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
        let otherPartyOnline = false;
        
        if (role === 'elder') {
            const caregiverName = getDisplayName('caregiver');
            presenceEl.textContent = caregiverOnline ? `${caregiverName} online` : `${caregiverName} offline`;
            otherPartyOnline = caregiverOnline;
        } else {
            const elderName = getDisplayName('elder');
            presenceEl.textContent = elderOnline ? `${elderName} online` : `${elderName} offline`;
            otherPartyOnline = elderOnline;
        }
        
        // Update avatar border color based on online status
        if (roleAvatarEl) {
            if (otherPartyOnline) {
                roleAvatarEl.classList.add('online');
            } else {
                roleAvatarEl.classList.remove('online');
            }
        }
    }

    const initialScale = loadScale();
    setScale(initialScale);

    const initialTheme = loadTheme();
    setTheme(initialTheme);

    // Handle both click and touch events for iOS compatibility
    function handleFontUp(e) {
        e.preventDefault();
        e.stopPropagation();
        setScale(loadScale() + 0.07);
    }

    function handleFontDown(e) {
        e.preventDefault();
        e.stopPropagation();
        setScale(loadScale() - 0.07);
    }

    function handleThemeToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
    }

    fontUpEl.addEventListener('click', handleFontUp);
    fontUpEl.addEventListener('touchend', handleFontUp);
    fontDownEl.addEventListener('click', handleFontDown);
    fontDownEl.addEventListener('touchend', handleFontDown);
    themeToggleEl.addEventListener('click', handleThemeToggle);
    themeToggleEl.addEventListener('touchend', handleThemeToggle);

    // Settings modal handlers (caregiver only)
    if (settingsButtonEl) {
        settingsButtonEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSettingsModal();
        });
        settingsButtonEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSettingsModal();
        });
    }
    if (closeModalEl) {
        closeModalEl.addEventListener('click', closeSettingsModal);
        closeModalEl.addEventListener('touchend', closeSettingsModal);
    }
    if (cancelSettingsEl) {
        cancelSettingsEl.addEventListener('click', closeSettingsModal);
        cancelSettingsEl.addEventListener('touchend', closeSettingsModal);
    }
    if (saveSettingsEl) {
        saveSettingsEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveSettings();
        });
        saveSettingsEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveSettings();
        });
    }
    // Close modal when clicking outside
    if (settingsModalEl) {
        settingsModalEl.addEventListener('click', (e) => {
            if (e.target === settingsModalEl) {
                closeSettingsModal();
            }
        });
    }

    // Secret settings title taps (caregiver only)
    if (settingsTitleEl && role === 'caregiver') {
        const handleTitleTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            settingsTitleTapCount += 1;
            console.log('Settings heading tapped', settingsTitleTapCount, 'times');
            if (settingsTitleTapCount >= 10) {
                showSecretRoleToggle();
            }
        };
        settingsTitleEl.addEventListener('click', handleTitleTap);
        settingsTitleEl.addEventListener('touchend', handleTitleTap);
    }

    // Secret role toggle (caregiver only)
    if (roleToggleEl && role === 'caregiver') {
        const handleRoleToggle = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Switch views based on current role
            if (role === 'caregiver') {
                window.location.href = '/elder';
            } else {
                window.location.href = '/caregiver';
            }
        };
        roleToggleEl.addEventListener('click', handleRoleToggle);
        roleToggleEl.addEventListener('touchend', handleRoleToggle);
    }

    // Keep latest messages visible when keyboard opens
    if (inputEl) {
        inputEl.addEventListener('focus', () => {
            setTimeout(scrollToBottom, 100);
        });
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
            if (document.activeElement === inputEl) {
                setTimeout(scrollToBottom, 100);
            }
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                if (document.activeElement === inputEl) {
                    setTimeout(scrollToBottom, 100);
                }
            });
        }
    }

    sendEl.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Load names initially (before socket connection)
    loadCustomNames().then(() => {
        // Names loaded, will be used when rendering
    });

    if (typeof io !== 'function') {
        presenceEl.textContent = 'Offline (socket.io missing)';
        return;
    }

    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', async () => {
        presenceEl.textContent = 'Connecting…';
        if (roleAvatarEl) {
            roleAvatarEl.classList.remove('online');
        }
        // Load custom names from server
        await loadCustomNames();
        socket.emit('join', { room, role });
        await loadHistory();
    });

    socket.on('disconnect', () => {
        presenceEl.textContent = 'Disconnected';
        if (roleAvatarEl) {
            roleAvatarEl.classList.remove('online');
        }
    });

    socket.on('presence', setPresence);

    socket.on('joined', (data) => {
        if (!data || data.room !== room) return;
        presenceEl.textContent = 'Connected';
        // Presence will be updated via the 'presence' event
    });

    socket.on('new_message', (message) => {
        if (!message || message.room !== room) return;
        const shouldScroll = isNearBottom();
        renderMessage(message);
        if (shouldScroll) scrollToBottom();
    });

    socket.on('names_updated', (data) => {
        if (!data || data.room !== room || !data.names) return;
        customNames = data.names;
        // Update localStorage as backup
        try {
            localStorage.setItem(namesKey, JSON.stringify(customNames));
        } catch (_) {}
        updateAllDisplayedNames();
    });

    setInterval(() => {
        try { socket.emit('ping'); } catch (_) {}
    }, 50000);
})();
