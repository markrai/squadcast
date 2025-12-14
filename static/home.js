(function () {
    const elderLink = document.getElementById('elderLink');
    const caregiverLink = document.getElementById('caregiverLink');
    const themeToggleEl = document.getElementById('themeToggle');

    const themeKey = 'squadcast:theme';
    const viewKey = 'squadcast:preferredView';

    function saveViewPreference(view) {
        try {
            localStorage.setItem(viewKey, view);
        } catch (_) {}
    }

    function loadViewPreference() {
        try {
            return localStorage.getItem(viewKey);
        } catch (_) {}
        return null;
    }

    function redirectToPreferredView() {
        const preferredView = loadViewPreference();
        if (!preferredView) return;
        
        if (preferredView === 'elder') {
            window.location.href = '/elder';
        } else if (preferredView === 'caregiver') {
            window.location.href = '/caregiver';
        }
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

    // Track view selection
    elderLink.addEventListener('click', (e) => {
        saveViewPreference('elder');
    });

    caregiverLink.addEventListener('click', (e) => {
        saveViewPreference('caregiver');
    });

    const initialTheme = loadTheme();
    setTheme(initialTheme);
    themeToggleEl.addEventListener('click', toggleTheme);

    // Auto-redirect to preferred view on page load
    redirectToPreferredView();
})();

