/* ============================
   Wedding Photo App – Frontend
   ============================ */

(function () {
    'use strict';

    // ---- Configuration ----
    const API_BASE = window.WEDDING_API_BASE || 'https://wedding-api.batterybytes.de';

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
    const sectionDots = document.getElementById('sectionDots');
    const coupleName = document.getElementById('coupleName');
    const couplePhotoWrap = document.getElementById('couplePhotoWrap');
    const coupleImg = document.getElementById('coupleImg');
    const sectionUpload = document.getElementById('sectionUpload');
    const sectionGallery = document.getElementById('sectionGallery');
    const sectionGame = document.getElementById('sectionGame');

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
            sectionDots.style.display = 'flex';
            authGate.style.display = 'none';
            return true;
        } catch (e) {
            // Invalid key or no connection
            snapContainer.style.display = 'none';
            sectionDots.style.display = 'none';
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
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    const btnRefreshGallery = document.getElementById('btnRefreshGallery');
    const galleryScroll = document.getElementById('galleryScroll');
    let galleryImageList = [];
    let currentLightboxIndex = -1;
    let lightboxTouchStartX = null;
    let galleryTouchStartY = null;
    let sectionHandoffLocked = false;

    function closeLightbox() {
        lightbox.style.display = 'none';
        lightboxImg.src = '';
        currentLightboxIndex = -1;
    }

    function showLightboxImage(index) {
        if (!galleryImageList.length) return;

        var normalized = (index + galleryImageList.length) % galleryImageList.length;
        currentLightboxIndex = normalized;
        lightboxImg.src = '';
        lightbox.style.display = 'flex';

        var image = galleryImageList[normalized];
        fetchAuthenticatedImage(API_BASE + image.full).then(function (blobUrl) {
            if (currentLightboxIndex !== normalized) return;
            lightboxImg.src = blobUrl;
        });
    }

    function navigateLightbox(step) {
        if (currentLightboxIndex === -1) return;
        showLightboxImage(currentLightboxIndex + step);
    }

    function lockSectionHandoff() {
        sectionHandoffLocked = true;
        window.setTimeout(function () { sectionHandoffLocked = false; }, 450);
    }

    function scrollToSection(section) {
        if (!section || sectionHandoffLocked) return;
        lockSectionHandoff();
        snapContainer.scrollTo({ top: section.offsetTop, behavior: 'smooth' });
    }

    function handoffGalleryScroll(direction) {
        if (direction > 0) scrollToSection(sectionGame);
        if (direction < 0) scrollToSection(sectionUpload);
    }

    async function loadGallery() {
        try {
            var data = await apiGet('/gallery');
            galleryImageList = data.images || [];
            galleryItems.innerHTML = '';

            if (!galleryImageList.length) {
                galleryEmpty.style.display = '';
                return;
            }

            galleryEmpty.style.display = 'none';

            galleryImageList.forEach(function (img, index) {
                var div = document.createElement('div');
                div.className = 'gallery-item';
                var imgEl = document.createElement('img');
                imgEl.alt = 'Hochzeitsfoto';
                imgEl.loading = 'lazy';
                div.appendChild(imgEl);

                fetchAuthenticatedImage(API_BASE + img.thumbnail).then(function (blobUrl) {
                    imgEl.src = blobUrl;
                });

                div.addEventListener('click', function () { showLightboxImage(index); });

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
        closeLightbox();
    });

    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    lightboxPrev.addEventListener('click', function (e) {
        e.stopPropagation();
        navigateLightbox(-1);
    });

    lightboxNext.addEventListener('click', function (e) {
        e.stopPropagation();
        navigateLightbox(1);
    });

    document.addEventListener('keydown', function (e) {
        if (lightbox.style.display === 'none') return;
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
        if (e.key === 'Escape') closeLightbox();
    });

    lightbox.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches.length) return;
        lightboxTouchStartX = e.touches[0].clientX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
        if (lightboxTouchStartX === null) return;
        var touch = e.changedTouches && e.changedTouches[0];
        if (!touch) {
            lightboxTouchStartX = null;
            return;
        }
        var deltaX = touch.clientX - lightboxTouchStartX;
        lightboxTouchStartX = null;
        if (Math.abs(deltaX) < 40) return;
        if (deltaX < 0) navigateLightbox(1);
        if (deltaX > 0) navigateLightbox(-1);
    }, { passive: true });

    galleryScroll.addEventListener('wheel', function (e) {
        var atTop = galleryScroll.scrollTop <= 0;
        var atBottom = galleryScroll.scrollTop + galleryScroll.clientHeight >= galleryScroll.scrollHeight - 1;

        if (e.deltaY > 0 && atBottom) {
            e.preventDefault();
            handoffGalleryScroll(1);
        } else if (e.deltaY < 0 && atTop) {
            e.preventDefault();
            handoffGalleryScroll(-1);
        }
    }, { passive: false });

    galleryScroll.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches.length) return;
        galleryTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    galleryScroll.addEventListener('touchend', function (e) {
        if (galleryTouchStartY === null) return;
        var touch = e.changedTouches && e.changedTouches[0];
        if (!touch) {
            galleryTouchStartY = null;
            return;
        }
        var deltaY = galleryTouchStartY - touch.clientY;
        var atTop = galleryScroll.scrollTop <= 0;
        var atBottom = galleryScroll.scrollTop + galleryScroll.clientHeight >= galleryScroll.scrollHeight - 1;
        galleryTouchStartY = null;

        if (deltaY > 40 && atBottom) handoffGalleryScroll(1);
        if (deltaY < -40 && atTop) handoffGalleryScroll(-1);
    }, { passive: true });

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
    const sectionList = [sectionUpload, sectionGallery, sectionGame];
    const dotList = Array.prototype.slice.call(document.querySelectorAll('.section-dot'));

    function updateDotIndicator() {
        var current = 0;
        var bestDistance = Infinity;
        for (var i = 0; i < sectionList.length; i++) {
            var distance = Math.abs(sectionList[i].offsetTop - container.scrollTop);
            if (distance < bestDistance) {
                bestDistance = distance;
                current = i;
            }
        }

        dotList.forEach(function (dot, idx) {
            dot.classList.toggle('active', idx === current);
        });
    }

    dotList.forEach(function (dot) {
        dot.addEventListener('click', function () {
            var targetId = dot.getAttribute('data-target');
            var target = document.getElementById(targetId);
            scrollToSection(target);
        });
    });

    container.addEventListener('scroll', function () {
        if (hintsFaded) return;
        hintsFaded = true;
        document.querySelectorAll('.scroll-hint').forEach(function (el) {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.5s';
        });
    }, { passive: true });

    container.addEventListener('scroll', updateDotIndicator, { passive: true });

    function updateAppHeight() {
        var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', Math.round(h) + 'px');
    }

    updateAppHeight();
    window.addEventListener('resize', updateAppHeight, { passive: true });
    window.addEventListener('orientationchange', updateAppHeight, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateAppHeight, { passive: true });
    }

    // ---- Init ----
    initAuth();
    loadConfig().then(function (ok) {
        if (ok) {
            loadGallery();
            loadTask();
            updateDotIndicator();
        }
    });
})();
