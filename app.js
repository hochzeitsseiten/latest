/* ============================
   Wedding Photo App – Frontend
   ============================ */

(function () {
    'use strict';

    // ---- Configuration ----
    // API_BASE will be your VPS domain behind Cloudflare tunnel, e.g. https://api.wedding_api.batterybytes.de
    const API_BASE = window.WEDDING_API_BASE || 'https://wedding_api.batterybytes.de';

    // ---- Cookie helpers ----
    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + days * 86400000);
        document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function generateUserId() {
        return 'u_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    }

    // ---- Init auth ----
    // API key can arrive via ?key= query param (QR code link)
    function initAuth() {
        const params = new URLSearchParams(window.location.search);
        const keyParam = params.get('key');

        if (keyParam) {
            setCookie('api_key', keyParam, 365);
            // Clean URL so key isn't visible / shared accidentally
            window.history.replaceState({}, '', window.location.pathname);
        }

        if (!getCookie('user_id')) {
            setCookie('user_id', generateUserId(), 365);
        }
    }

    function getApiKey() {
        return getCookie('api_key') || '';
    }

    function getUserId() {
        return getCookie('user_id') || '';
    }

    // ---- API helpers ----
    function apiHeaders() {
        return {
            'X-API-Key': getApiKey(),
            'X-User-Id': getUserId()
        };
    }

    async function apiGet(path) {
        const res = await fetch(API_BASE + path, { headers: apiHeaders() });
        if (!res.ok) throw new Error('API error ' + res.status);
        return res.json();
    }

    async function apiPostForm(path, formData) {
        const headers = apiHeaders();
        const res = await fetch(API_BASE + path, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        if (!res.ok) throw new Error('API error ' + res.status);
        return res.json();
    }

    // ---- Upload section ----
    const btnUpload = document.getElementById('btnUpload');
    const fileInput = document.getElementById('fileInput');
    const uploadStatus = document.getElementById('uploadStatus');

    btnUpload.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', async function () {
        const files = fileInput.files;
        if (!files.length) return;

        uploadStatus.textContent = 'Hochladen…';
        uploadStatus.className = 'upload-status';

        try {
            for (let i = 0; i < files.length; i++) {
                const fd = new FormData();
                fd.append('file', files[i]);
                await apiPostForm('/upload', fd);
            }
            uploadStatus.textContent = files.length > 1
                ? files.length + ' Dateien hochgeladen!'
                : 'Datei hochgeladen!';
            uploadStatus.className = 'upload-status success';
            loadGallery();
        } catch (e) {
            uploadStatus.textContent = 'Fehler beim Hochladen.';
            uploadStatus.className = 'upload-status error';
        }

        fileInput.value = '';
    });

    // ---- Gallery ----
    const galleryItems = document.getElementById('galleryItems');
    const galleryEmpty = document.getElementById('galleryEmpty');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');

    async function loadGallery() {
        try {
            const data = await apiGet('/gallery');
            galleryItems.innerHTML = '';

            if (!data.images || data.images.length === 0) {
                galleryEmpty.style.display = '';
                return;
            }

            galleryEmpty.style.display = 'none';

            data.images.forEach(function (img) {
                const div = document.createElement('div');
                div.className = 'gallery-item';
                const imgEl = document.createElement('img');
                imgEl.src = API_BASE + img.thumbnail;
                imgEl.alt = 'Hochzeitsfoto';
                imgEl.loading = 'lazy';
                div.appendChild(imgEl);

                div.addEventListener('click', function () {
                    lightboxImg.src = API_BASE + img.full;
                    lightbox.style.display = 'flex';
                });

                galleryItems.appendChild(div);
            });
        } catch (e) {
            galleryEmpty.textContent = 'Galerie konnte nicht geladen werden.';
        }
    }

    lightboxClose.addEventListener('click', function () {
        lightbox.style.display = 'none';
        lightboxImg.src = '';
    });

    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) {
            lightbox.style.display = 'none';
            lightboxImg.src = '';
        }
    });

    // ---- Game mode ----
    const taskText = document.getElementById('taskText');
    const btnCapture = document.getElementById('btnCapture');
    const cameraInput = document.getElementById('cameraInput');
    const gamePreview = document.getElementById('gamePreview');
    const gamePreviewImg = document.getElementById('gamePreviewImg');
    const gameNameInput = document.getElementById('gameNameInput');
    const btnSendGame = document.getElementById('btnSendGame');
    const gameStatus = document.getElementById('gameStatus');

    let currentTask = null;

    async function loadTask() {
        try {
            const data = await apiGet('/task');
            currentTask = data.task;
            taskText.textContent = currentTask || 'Keine Aufgabe verfügbar.';
        } catch (e) {
            taskText.textContent = 'Aufgabe konnte nicht geladen werden.';
        }
    }

    btnCapture.addEventListener('click', function () {
        cameraInput.click();
    });

    cameraInput.addEventListener('change', function () {
        const file = cameraInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            gamePreviewImg.src = e.target.result;
            gamePreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    });

    btnSendGame.addEventListener('click', async function () {
        const file = cameraInput.files[0];
        const name = gameNameInput.value.trim();

        if (!file) return;
        if (!name) {
            gameStatus.textContent = 'Bitte gib deinen Namen ein.';
            gameStatus.className = 'upload-status error';
            return;
        }

        gameStatus.textContent = 'Senden…';
        gameStatus.className = 'upload-status';

        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('name', name);
            fd.append('task', currentTask || '');
            await apiPostForm('/game/submit', fd);
            gameStatus.textContent = 'Geschafft! Danke, ' + name + '!';
            gameStatus.className = 'upload-status success';
            gamePreview.style.display = 'none';
            cameraInput.value = '';
            gameNameInput.value = '';
        } catch (e) {
            gameStatus.textContent = 'Fehler beim Senden.';
            gameStatus.className = 'upload-status error';
        }
    });

    // ---- Scroll hint fade-out on scroll ----
    const container = document.getElementById('snapContainer');
    let hintsFaded = false;

    container.addEventListener('scroll', function () {
        if (hintsFaded) return;
        hintsFaded = true;
        document.querySelectorAll('.scroll-hint').forEach(function (el) {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.5s';
        });
    }, { passive: true });

    // ---- Init ----
    initAuth();
    loadGallery();
    loadTask();
})();
