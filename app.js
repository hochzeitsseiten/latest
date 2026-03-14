/* ============================
   Wedding Photo App – Frontend
   ============================ */

(function () {
    'use strict';

    // ---- Configuration ----
    const API_BASE = window.WEDDING_API_BASE || 'https://wedding_api.batterybytes.de';

    // ---- Storage helpers (localStorage for persistence) ----
    function setStored(name, value) {
        try { localStorage.setItem(name, value); } catch (e) { /* quota or private mode */ }
    }

    function getStored(name) {
        try { return localStorage.getItem(name); } catch (e) { return null; }
    }

    function generateUserId() {
        return 'u_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    }

    // ---- Init auth ----
    function initAuth() {
        const params = new URLSearchParams(window.location.search);
        const keyParam = params.get('key');

        if (keyParam) {
            setStored('api_key', keyParam);
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Migrate old cookie values to localStorage (one-time)
        if (!getStored('api_key')) {
            const cookieKey = (document.cookie.match(/(^| )api_key=([^;]+)/) || [])[2];
            if (cookieKey) setStored('api_key', decodeURIComponent(cookieKey));
        }
        if (!getStored('user_id')) {
            const cookieUid = (document.cookie.match(/(^| )user_id=([^;]+)/) || [])[2];
            if (cookieUid) setStored('user_id', decodeURIComponent(cookieUid));
        }

        if (!getStored('user_id')) {
            setStored('user_id', generateUserId());
        }
    }

    function getApiKey() {
        return getStored('api_key') || '';
    }

    function getUserId() {
        return getStored('user_id') || '';
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

    async function apiPost(path) {
        const res = await fetch(API_BASE + path, {
            method: 'POST',
            headers: apiHeaders()
        });
        if (!res.ok) throw new Error('API error ' + res.status);
        return res.json();
    }

    async function fetchAuthenticatedImage(url) {
        const res = await fetch(url, { headers: apiHeaders() });
        if (!res.ok) throw new Error('Image load error ' + res.status);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }

    // ---- Auth gate: load config or show error ----
    const authGate = document.getElementById('authGate');
    const snapContainer = document.getElementById('snapContainer');
    const coupleName = document.getElementById('coupleName');
    const couplePhotoWrap = document.getElementById('couplePhotoWrap');
    const coupleImg = document.getElementById('coupleImg');

    async function loadConfig() {
        try {
            const config = await apiGet('/config');
            // Valid key — show app
            document.title = config.couple_name + ' – Hochzeit';
            coupleName.textContent = config.couple_name;

            if (config.has_couple_image) {
                fetchAuthenticatedImage(API_BASE + '/assets/couple.jpg').then(function (blobUrl) {
                    coupleImg.src = blobUrl;
                    coupleImg.alt = config.couple_name;
                    couplePhotoWrap.style.display = '';
                });
            }

            snapContainer.style.display = '';
            authGate.style.display = 'none';
            return true;
        } catch (e) {
            // Invalid key or no connection
            snapContainer.style.display = 'none';
            authGate.style.display = 'flex';
            return false;
        }
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

    // ---- Gallery (grid layout, fills page) ----
    const galleryItems = document.getElementById('galleryItems');
    const galleryEmpty = document.getElementById('galleryEmpty');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    const btnRefreshGallery = document.getElementById('btnRefreshGallery');

    function computeGalleryGrid() {
        var section = document.getElementById('sectionGallery');
        var headerH = document.querySelector('.gallery-header').offsetHeight;
        var hintsH = 60; // space for scroll hints
        var availableH = section.clientHeight - headerH - hintsH;
        var gap = 6;
        // Determine how many rows fit
        var minCell = 100;
        var rows = Math.max(2, Math.floor(availableH / (minCell + gap)));
        var cellSize = Math.floor((availableH - (rows - 1) * gap) / rows);
        cellSize = Math.max(80, Math.min(cellSize, 160));
        document.documentElement.style.setProperty('--gallery-rows', rows);
        document.documentElement.style.setProperty('--gallery-cell', cellSize + 'px');
        return { rows: rows, cellSize: cellSize };
    }

    async function loadGallery() {
        try {
            var gridInfo = computeGalleryGrid();
            var data = await apiGet('/gallery');
            galleryItems.innerHTML = '';

            if (!data.images || data.images.length === 0) {
                galleryEmpty.style.display = '';
                return;
            }

            galleryEmpty.style.display = 'none';

            data.images.forEach(function (img) {
                var div = document.createElement('div');
                div.className = 'gallery-item';
                var imgEl = document.createElement('img');
                imgEl.alt = 'Hochzeitsfoto';
                imgEl.loading = 'lazy';
                div.appendChild(imgEl);

                fetchAuthenticatedImage(API_BASE + img.thumbnail).then(function (blobUrl) {
                    imgEl.src = blobUrl;
                });

                div.addEventListener('click', function () {
                    lightboxImg.src = '';
                    lightbox.style.display = 'flex';
                    fetchAuthenticatedImage(API_BASE + img.full).then(function (blobUrl) {
                        lightboxImg.src = blobUrl;
                    });
                });

                galleryItems.appendChild(div);
            });
        } catch (e) {
            galleryEmpty.textContent = 'Galerie konnte nicht geladen werden.';
        }
    }

    btnRefreshGallery.addEventListener('click', function () {
        loadGallery();
    });

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
    const challengeActive = document.getElementById('challengeActive');
    const challengeCompleted = document.getElementById('challengeCompleted');
    const completedImg = document.getElementById('completedImg');
    const completedText = document.getElementById('completedText');
    const btnNewChallenge = document.getElementById('btnNewChallenge');

    let currentTask = null;

    async function loadTask() {
        try {
            const data = await apiGet('/task');
            currentTask = data.task;
            taskText.textContent = currentTask || 'Keine Aufgabe verfügbar.';

            if (data.completed) {
                // Show completed state
                challengeActive.style.display = 'none';
                challengeCompleted.style.display = '';
                completedText.textContent = 'Geschafft! Danke, ' + (data.submission_name || '') + '!';
                gameStatus.textContent = '';

                if (data.submission_thumbnail) {
                    fetchAuthenticatedImage(API_BASE + data.submission_thumbnail).then(function (blobUrl) {
                        completedImg.src = blobUrl;
                    });
                }
            } else {
                challengeActive.style.display = '';
                challengeCompleted.style.display = 'none';
            }
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
            gameStatus.textContent = '';
            gamePreview.style.display = 'none';
            cameraInput.value = '';
            gameNameInput.value = '';
            // Reload task to show completed state
            loadTask();
            loadGallery();
        } catch (e) {
            if (e.message && e.message.indexOf('409') !== -1) {
                gameStatus.textContent = 'Diese Challenge hast du bereits erledigt.';
            } else {
                gameStatus.textContent = 'Fehler beim Senden.';
            }
            gameStatus.className = 'upload-status error';
        }
    });

    btnNewChallenge.addEventListener('click', async function () {
        try {
            const data = await apiPost('/task/new');
            if (data.all_done) {
                gameStatus.textContent = 'Du hast alle Challenges geschafft!';
                gameStatus.className = 'upload-status success';
                return;
            }
            currentTask = data.task;
            taskText.textContent = currentTask;
            challengeActive.style.display = '';
            challengeCompleted.style.display = 'none';
            gameStatus.textContent = '';
        } catch (e) {
            gameStatus.textContent = 'Fehler beim Laden einer neuen Challenge.';
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
    loadConfig().then(function (ok) {
        if (ok) {
            loadGallery();
            loadTask();
        }
    });
})();
