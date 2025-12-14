let capPending = false;
let capResolveFn = null;
let lastCapTime = 0;
let sessionToken = null;

export const isCapPending = () => capPending;

export const getSessionToken = () => sessionToken;

export const checkFrontendCapRequired = (config) => {
    if (!config.cap_enabled) return false;
    if (!sessionToken) return true;
    return Date.now() - lastCapTime >= config.cap_frontend_interval_ms;
};

export const resetCapTime = () => {
    lastCapTime = Date.now();
};

export const loadCapScript = (config) => {
    if (!config.cap_enabled) return;
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@cap.js/widget/cap.min.js';
    document.head.appendChild(script);
};

export const showCapModal = (config, reason = 'session') => {
    return new Promise((resolve) => {
        capResolveFn = resolve;
        capPending = true;

        const modal = document.getElementById('cap-modal');
        const container = document.getElementById('cap-widget-container');
        const status = document.getElementById('cap-status');
        const message = document.getElementById('cap-message');

        container.innerHTML = '';
        status.textContent = '';
        status.className = 'cap-status';

        if (reason === 'usage') {
            message.textContent = "What are you, some sort of Map Man? Don't forget to zoom back in a little when you're done gawking, okay? Thanks! <3";
        } else {
            message.textContent = "Sorry for the speedbump, but there's a lot of robots...";
        }

        const widget = document.createElement('cap-widget');
        widget.setAttribute('data-cap-api-endpoint', config.cap_api_endpoint);
        container.appendChild(widget);

        widget.addEventListener('solve', async (e) => {
            status.textContent = 'Verifying...';

            try {
                const resp = await fetch('/api/cap/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: e.detail.token })
                });

                const result = await resp.json();

                if (result.success) {
                    sessionToken = result.session_token;
                    status.textContent = 'Verified!';
                    status.className = 'cap-status success';

                    setTimeout(() => {
                        modal.style.display = 'none';
                        capPending = false;
                        if (capResolveFn) capResolveFn(true);
                    }, 500);
                } else {
                    status.textContent = 'Verification failed. Please try again.';
                    status.className = 'cap-status error';
                    if (widget.reset) widget.reset();
                }
            } catch (err) {
                status.textContent = 'Error: ' + err.message;
                status.className = 'cap-status error';
            }
        });

        modal.style.display = 'flex';
    });
};
