import { TOAST_DURATION_MS, MAX_LOG_ENTRIES } from './config.js';

let isLoading = false;
let infoShownForSession = false;

export const getIsLoading = () => isLoading;

export const setLoading = (loading) => {
    isLoading = loading;
    document.getElementById('refresh-btn').disabled = loading;
};

export const showError = (message) => {
    const toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', TOAST_DURATION_MS);
};

export const showInfoPopup = (message, onShowFn) => {
    onShowFn();

    if (infoShownForSession) return;
    infoShownForSession = true;

    document.getElementById('info-popup-message').textContent = message;
    document.getElementById('info-popup').style.display = 'flex';
    document.getElementById('info-popup-dismiss').onclick = () => {
        document.getElementById('info-popup').style.display = 'none';
    };
};

export const logApi = (message, type = 'normal') => {
    const entries = document.getElementById('log-entries');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (type === 'skipped') entry.classList.add('log-skipped');
    if (type === 'request') entry.classList.add('log-request');
    if (type === 'response') entry.classList.add('log-response');
    entry.innerHTML = `<span class="log-time">${time}</span> ${message}`;
    entries.insertBefore(entry, entries.firstChild);
    while (entries.children.length > MAX_LOG_ENTRIES) {
        entries.removeChild(entries.lastChild);
    }
};

export const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
};

export const updateStats = (count) => {
    document.getElementById('stats').textContent = count;
};

export const updateLastUpdate = (text) => {
    document.getElementById('last-update').textContent = text;
};
