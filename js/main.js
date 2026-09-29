document.addEventListener('DOMContentLoaded', () => {
    const langButtons = document.querySelectorAll('.lang-switch-footer button');
    let siteContent = {};
    let projectsData = [];
    let labData = [];
    let currentLang = null;

    // --- Dev: 12-Spalten-Overlay (Taste G) ---
    const gridColumns = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-columns'), 10) || 12;
    const gridOverlay = document.createElement('div');
    gridOverlay.className = 'grid-overlay';
    gridOverlay.innerHTML = '<span></span>'.repeat(gridColumns);
    document.body.appendChild(gridOverlay);
    document.body.classList.toggle('show-grid', localStorage.getItem('showGrid') === '1');

    document.addEventListener('keydown', (e) => {
        if (e.repeat || (e.key || '').toLowerCase() !== 'g' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest('input, textarea, [contenteditable]')) return;
        const show = document.body.classList.toggle('show-grid');
        localStorage.setItem('showGrid', show ? '1' : '0');
    });

    // Globale Daten laden
    /* 
       Updated Loading Logic:
       Only show Main Loader on First Visit.
       Subsequent pages use "Blur-Up" effect on images.
    */

    const loader = document.getElementById('loader');
    
    // Check if we have already visited in this session
    const isSessionActive = sessionStorage.getItem('visited');

    if (isSessionActive && loader) {
       // If visited, hide loader IMMEDIATELY (no animation) to allow internal nav
       loader.style.display = 'none';
    } else {
       // First visit: Keep loader visible until assets are ready
    }
    
    Promise.all([
        fetch('data/site-content.json').then(r => r.json()),
        fetch('data/projects.json').then(r => r.json()),
        fetch('data/lab.json').then(r => r.json())
    ]).then(async ([content, projects, lab]) => {
        siteContent = content;
        projectsData = projects;
        labData = lab;

        // If it's the very first visit, run the preloader logic
        if (!isSessionActive) {
            // --- Asset Preloading (Splash Screen) ---
            const assetsToLoad = [];
            
            // 1. Hero Images from Projects
            projects.forEach(p => {
                if(p.hero_image) assetsToLoad.push({ type: 'image', src: p.hero_image });
            });

            // Helper to load image
            const preloadImage = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => { resolve(); };
                    img.onerror = () => { resolve(); }; 
                    img.src = src;
                });
            };

            // Execute Preloading
            const loadAssetsPromise = Promise.all(assetsToLoad.map(asset => {
                if (asset.type === 'image') return preloadImage(asset.src);
                return Promise.resolve();
            }));

            // Wait max 5 seconds for images, otherwise proceed
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));

            await Promise.race([loadAssetsPromise, timeoutPromise]);
            
            // Minimum loading time of 1s for animation
            await new Promise(r => setTimeout(r, 1000));

            // Finish
            sessionStorage.setItem('visited', 'true');
            
            if (loader) {
                 // Fade out
                loader.classList.add('hidden');
                setTimeout(() => { loader.style.display = 'none'; }, 500);
            }
        } 



        // Initiale Sprache setzen (URL Parameter > LocalStorage > Default)
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        const savedLang = localStorage.getItem('language');
        const defaultLang = content.settings.default_language;

        const langToUse = (urlLang && content.settings.available_languages.includes(urlLang)) ? urlLang 
                        : (savedLang ? savedLang : defaultLang);

        setLanguage(langToUse);

        // Lab Initialisierung (nur einmalig)
        if (document.getElementById('lab-canvas')) {
            initLabInteraction();
        }

    }).catch(error => {
        console.error('Fehler beim Laden der Daten:', error);
        if (loader) {
            loader.innerHTML = '<p style="color:white; text-align:center; position:absolute; top:50%; width:100%;">Inhalte konnten nicht geladen werden.</p>';
            loader.classList.remove('hidden');
            loader.style.display = 'block';
        }
    });



    // --- Event Listener ---
    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            setLanguage(lang);
        });
    });

    // --- Mobile Menü (Burger) ---
    const navBurger = document.querySelector('.nav-burger');
    const navMenu = document.getElementById('nav-menu');
    const mobileQuery = window.matchMedia('(max-width: 768px)'); // = $bp-mobile

    const isMenuOpen = () => document.body.classList.contains('menu-open');

    function updateMenuLabel() {
        if (!navBurger) return;
        const ui = siteContent.ui && siteContent.ui[currentLang];
        // Vor dem Laden der Daten: Fallback in der Sprache des Besuchers
        const lang = currentLang || localStorage.getItem('language');
        const fallback = lang === 'en' ? { open: 'menu', close: 'close' } : { open: 'menü', close: 'schließen' };
        const labels = (ui && ui.menu) || fallback;
        navBurger.textContent = isMenuOpen() ? labels.close : labels.open;
    }

    function setMenu(open) {
        if (!navBurger) return;
        document.body.classList.toggle('menu-open', open);
        navBurger.setAttribute('aria-expanded', String(open));
        // Seiteninhalt hinter dem Menü nicht bedienbar/fokussierbar
        document.querySelectorAll('body > :not(.main-nav):not(.main-footer):not(script)')
            .forEach(el => el.toggleAttribute('inert', open));
        // Geschlossenes Menü (mobil) sofort aus Fokus-Reihenfolge und Accessibility-Tree, auch während es ausblendet
        navMenu.inert = !open && mobileQuery.matches;
        updateMenuLabel();
    }

    // Ohne Animation schließen (Breakpoint-Wechsel, Zurück-Navigation): menu-animate steuert die Transitions
    function closeMenuInstantly() {
        document.body.classList.remove('menu-animate');
        setMenu(false);
    }

    if (navBurger && navMenu) {
        navMenu.inert = mobileQuery.matches;
        navBurger.addEventListener('click', () => {
            document.body.classList.add('menu-animate');
            setMenu(!isMenuOpen());
        });
        // Tippen auf die freie Fläche schließt das Menü
        navMenu.addEventListener('click', (e) => { if (e.target === navMenu) setMenu(false); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMenuOpen()) {
                setMenu(false);
                navBurger.focus();
            }
        });
        // Beim Wechsel des Breakpoints und beim Zurück-Navigieren (bfcache) sofort geschlossen
        mobileQuery.addEventListener('change', closeMenuInstantly);
        window.addEventListener('pageshow', (e) => { if (e.persisted) closeMenuInstantly(); });
    }



// --- Accordion Logic ---
    function initAccordionAnimation() {
        // Run on all that haven't been initialized yet
        document.querySelectorAll('details.pd-accordion').forEach((targetDetail) => {
            if (targetDetail.hasAttribute('data-anim-init')) return;
            targetDetail.setAttribute('data-anim-init', 'true');

            const summary = targetDetail.querySelector('summary');
            const content = targetDetail.querySelector('.accordion-content');
            
            // Initial State: Closed
            content.style.height = '0px';
            content.style.opacity = '0';
            content.style.paddingBottom = '0px';
            content.style.overflow = 'hidden';

            summary.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (targetDetail.hasAttribute('open')) {
                    // --- CLOSE ---
                    // 1. Set explicit height from current scrollHeight
                    content.style.height = `${content.scrollHeight}px`;
                    content.style.paddingBottom = '20px'; // Match CSS
                    
                    // Force reflow
                    void content.offsetHeight; 

                    // 2. Animate to 0
                    requestAnimationFrame(() => {
                        content.style.height = '0px';
                        content.style.opacity = '0';
                        content.style.paddingBottom = '0px';
                    });

                    // 3. Remove open attribute after transition
                    setTimeout(() => {
                        targetDetail.removeAttribute('open');
                    }, 250);

                } else {
                    // --- OPEN ---
                    targetDetail.setAttribute('open', '');
                    
                    // 1. Measure target height
                    content.style.height = 'auto'; // Temporarily auto to measure
                    content.style.paddingBottom = '20px';
                    const targetHeight = content.scrollHeight;
                    
                    // 2. Reset to 0 for start of animation
                    content.style.height = '0px';
                    content.style.opacity = '0';
                    content.style.paddingBottom = '0px';
                    
                    // Force reflow
                    void content.offsetHeight; 

                    // 3. Animate to target
                    requestAnimationFrame(() => {
                        content.style.height = `${targetHeight}px`;
                        content.style.opacity = '1';
                        content.style.paddingBottom = '20px';
                    });
                    
                    // 4. (Optional) Set to auto after animation if content is dynamic
                    setTimeout(() => {
                         // We keep it fixed or set to auto here.
                         // content.style.height = 'auto';
                    }, 250);
                }
            });
        });
    }

// --- Hero Player (Vimeo) ---
    // Zustand der eigenen Steuerung; Start = pausiert, passend zur sichtbaren Play-Fläche
    let heroState = { paused: true, muted: false };
    let vimeoApiPromise = null;

    function loadVimeoApi() {
        if (window.Vimeo && window.Vimeo.Player) return Promise.resolve();
        if (!vimeoApiPromise) {
            vimeoApiPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://player.vimeo.com/api/player.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }
        return vimeoApiPromise;
    }

    // Beschriftung aus Zustand + aktueller Sprache (site-content.json ui.*.player)
    function updateHeroControls() {
        const btnPlay = document.getElementById('btn-play');
        const btnSound = document.getElementById('btn-sound');
        if (!btnPlay || !btnSound) return;

        const labels = siteContent.ui[currentLang].player;
        btnPlay.textContent = heroState.paused ? labels.play : labels.pause;
        btnSound.textContent = heroState.muted ? labels.sound_on : labels.sound_off;
        document.getElementById('hero-wrapper').classList.toggle('is-playing', !heroState.paused);
    }

    function initHeroPlayer() {
        const iframe = document.getElementById('hero-player');
        const wrapper = document.getElementById('hero-wrapper');
        if (!iframe || !wrapper) return;

        const overlay = document.getElementById('hero-overlay');
        const controls = wrapper.querySelector('.hero-controls');

        const setState = (changes) => {
            Object.assign(heroState, changes);
            updateHeroControls();
        };
        setState({ paused: true, muted: false });

        const playerReady = loadVimeoApi().then(() => {
            const player = new Vimeo.Player(iframe);
            return player.ready().then(() => player);
        });

        // Anzeige immer aus dem tatsächlichen Player-Zustand ableiten
        // (Autoplay kann blockiert sein oder stumm starten)
        const syncState = (player) => Promise.all([player.getPaused(), player.getMuted()])
            .then(([paused, muted]) => setState({ paused, muted }));

        // Klicks vor dem Ready werden nachgeholt, aber erst nach dem ersten Abgleich
        const playerSynced = playerReady.then(player => syncState(player).then(() => player));
        playerSynced.catch(() => {}); // Fehler behandelt der Fallback unten

        let userMuted = null; // Explizite Ton-Wahl des Besuchers

        playerReady.then(player => {
            player.on('play', () => syncState(player));
            player.on('pause', () => setState({ paused: true }));
            player.on('volumechange', () => syncState(player));

            // Vimeo stellt kurz nach dem Autoplay-Start still (ohne Event) die Embed-Einstellung muted=0
            // wieder her -> Ton-Zustand regelmäßig abgleichen und die Wahl des Besuchers wiederherstellen
            setInterval(() => {
                if (document.hidden) return;
                player.getMuted().then(muted => {
                    if (userMuted !== null && muted !== userMuted) return player.setMuted(userMuted);
                    if (muted !== heroState.muted) setState({ muted });
                });
            }, 500);
        }).catch(() => {
            // Fallback ohne Player-API: eigene Steuerung weg, Vimeos Klick-zum-Abspielen erlauben
            if (overlay) overlay.remove();
            if (controls) controls.remove();
            iframe.style.pointerEvents = 'auto';
        });

        if (overlay) {
            overlay.addEventListener('click', () => {
                playerSynced.then(player => player.play()).catch(() => {});
            });
        }

        document.getElementById('btn-play').addEventListener('click', () => {
            const wantPlay = heroState.paused; // Absicht zum Zeitpunkt des Klicks
            playerSynced.then(player => (wantPlay ? player.play() : player.pause())).catch(() => {});
        });

        document.getElementById('btn-sound').addEventListener('click', () => {
            const mute = !heroState.muted;
            userMuted = mute;
            setState({ muted: mute });
            playerSynced
                .then(player => player.setMuted(mute)
                    .then(() => (mute ? null : player.setVolume(1)))
                    .then(() => syncState(player)))
                .catch(() => {});
        });
    }

    // Core Functions ---
    function setLanguage(lang) {
        if (!siteContent.settings || !siteContent.settings.available_languages.includes(lang)) return;

        currentLang = lang;
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;

        // Update URL without reload
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url);

        // UI Updates
        updateUI(lang);
        renderProjects(lang);
        renderProjectDetail(lang);
        renderAbout(lang);
        renderLab(lang);
    }

    function updateUI(lang) {
        // Buttons active state
        langButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        // Allgemeine UI Texte
        const ui = siteContent.ui[lang];
        if (!ui) return;

        // Nav Link Texte aktualisieren
        const navProjects = document.querySelector('nav a[href="index.html"]');
        const navLab = document.querySelector('nav a[href="lab.html"]');
        const navAbout = document.querySelector('nav a[href="about.html"]');
        const labTitleOverlay = document.querySelector('.lab-title-overlay');

        if (navProjects) navProjects.textContent = ui.nav.projects;
        if (navLab) navLab.textContent = ui.nav.lab;
        if (navAbout) navAbout.textContent = ui.nav.about;
        if (labTitleOverlay) labTitleOverlay.textContent = ui.nav.lab;
        updateMenuLabel();

        // Update Footer Text
        const footerLinks = document.querySelectorAll('[data-i18n-footer]');
        footerLinks.forEach(link => {
            const key = link.getAttribute('data-i18n-footer');
            if (ui.footer && ui.footer[key]) {
                link.textContent = ui.footer[key];
                link.setAttribute('data-text', ui.footer[key]); // Reserve space for bold hover
            }
        });

        // Set Default Page Title for Home
        if (window.location.pathname.endsWith('/') || window.location.pathname.includes('index.html')) {
             document.title = lang === 'de' ? 'Tom Henkel - Projekte' : 'Tom Henkel - Work';
        }
    }


    // --- Home: Projektliste + Vorschau (Bild als Poster, darüber Preview-Video) ---
    // Mobil: Hochformat-Video vollflächig, die Previews wechseln automatisch.
    // Desktop: Querformat-Video des Eintrags beim Hover, in Schleife.
    const STILL_DURATION = 6000; // Standbild ohne Video (später Teil des Animationssystems)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    let featuredProjects = [];
    let activePreview = -1;
    let cycleTimer;
    let hoverTimeout;
    const prefetchedVideos = new Set();

    const autoplayAllowed = () => !reduceMotion.matches && !saveData;
    const cycleEnabled = () => mobileQuery.matches && autoplayAllowed() && featuredProjects.length > 1;
    const nextPreviewIndex = () => (activePreview + 1) % featuredProjects.length;

    // Variante nach Seitenverhältnis des Vorschaufensters: höher als breit -> Hochformat (Handy, Tablets), sonst Querformat.
    // Fehlt eine Variante, wird die andere genommen (object-fit: cover beschneidet sie)
    function previewVideoSrc(p) {
        if (!p || !p.preview || !autoplayAllowed()) return null;
        const visual = document.querySelector('.home-visual');
        const box = visual ? visual.getBoundingClientRect() : null;
        const portrait = box ? box.height > box.width : mobileQuery.matches;
        const { portrait: portraitSrc, landscape: landscapeSrc } = p.preview;
        return portrait ? (portraitSrc || landscapeSrc) : (landscapeSrc || portraitSrc);
    }

    function scheduleNextPreview() {
        clearTimeout(cycleTimer);
        if (cycleEnabled()) cycleTimer = setTimeout(() => showPreview(nextPreviewIndex()), STILL_DURATION);
    }

    function markActivePreview() {
        document.querySelectorAll('.project-list-item').forEach((el, i) => el.classList.toggle('active', i === activePreview));
    }

    function showPreview(index) {
        const img = document.getElementById('project-preview-image');
        const video = document.getElementById('project-preview-video');
        const p = featuredProjects[index];
        if (!img || !p) return;

        activePreview = index;
        markActivePreview();
        clearTimeout(cycleTimer);

        // Standbild (Poster) sofort, mit Fade
        const poster = (p.preview && p.preview.poster) || p.hero_image;
        if (img.getAttribute('src') !== poster) {
            img.classList.remove('visible');
            img.onload = () => img.classList.add('visible');
            img.src = poster;
        }

        if (!video) return;
        const src = previewVideoSrc(p);
        video.classList.remove('visible');
        if (!src) {
            video.pause();
            video.removeAttribute('src');
            scheduleNextPreview();
            return;
        }
        video.loop = !mobileQuery.matches; // Mobil: danach das nächste Projekt
        if (video.getAttribute('src') !== src) video.src = src;
        else video.currentTime = 0;
        video.play().catch(() => scheduleNextPreview()); // z. B. Stromsparmodus: Standbild + Timer
    }

    function initPreviewVideo() {
        const video = document.getElementById('project-preview-video');
        if (!video || video.dataset.init) return;
        video.dataset.init = 'true';
        video.muted = true;

        video.addEventListener('playing', () => video.classList.add('visible'));
        video.addEventListener('error', () => {
            if (!video.getAttribute('src')) return;
            video.classList.remove('visible'); // Fehlendes Video: Standbild bleibt
            scheduleNextPreview();
        });
        video.addEventListener('ended', () => { if (cycleEnabled()) showPreview(nextPreviewIndex()); });

        // Nächstes Video kurz vor Ende vorladen
        video.addEventListener('timeupdate', () => {
            if (!cycleEnabled() || !video.duration || video.currentTime / video.duration < 0.6) return;
            const next = previewVideoSrc(featuredProjects[nextPreviewIndex()]);
            if (!next || prefetchedVideos.has(next)) return;
            prefetchedVideos.add(next);
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = next;
            document.head.appendChild(link);
        });

        // Versteckter Tab: pausieren, danach weiter
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                video.pause();
                clearTimeout(cycleTimer);
            } else if (video.getAttribute('src')) {
                video.play().catch(() => scheduleNextPreview());
            } else {
                scheduleNextPreview();
            }
        });

        // Breakpoint-Wechsel: automatischen Wechsel (mobil) starten bzw. stoppen, Schleife anpassen
        mobileQuery.addEventListener('change', () => showPreview(Math.max(activePreview, 0)));

        // Vorschaufenster ändert Größe (Fenster, Drehen): Video nur tauschen, wenn eine andere Variante passt
        const visual = document.querySelector('.home-visual');
        let resizeTimer;
        if (visual && window.ResizeObserver) {
            new ResizeObserver(() => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const p = featuredProjects[activePreview];
                    if (p && previewVideoSrc(p) !== video.getAttribute('src')) showPreview(activePreview);
                }, 150);
            }).observe(visual);
        }
    }

    function renderProjects(lang) {
        const listContainer = document.getElementById('project-list');
        if (!listContainer) return;

        featuredProjects = projectsData.filter(p => p.featured);

        // DocumentFragment for better performance
        const fragment = document.createDocumentFragment();

        featuredProjects.forEach((p, index) => {
            const data = p[lang];

            const item = document.createElement('a');
            item.href = `project.html?id=${p.id}`;
            item.className = 'project-list-item';
            item.innerHTML = `
                <span class="p-title">${data.title}</span>
                <span class="p-category">${data.category || ''}</span>
            `;

            // Desktop: Vorschau beim Hover (kurz entprellt); mobil wechselt sie automatisch
            item.addEventListener('mouseenter', () => {
                if (mobileQuery.matches) return;
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => { if (index !== activePreview) showPreview(index); }, 100);
            });

            fragment.appendChild(item);
        });

        listContainer.innerHTML = '';
        listContainer.appendChild(fragment);

        // Erster Aufruf: erste Vorschau setzen. Sprachwechsel: nur die Markierung übernehmen, das Video läuft weiter
        initPreviewVideo();
        if (activePreview < 0) showPreview(0);
        else markActivePreview();
    }

    // HTML aus JSON-Texten entfernen (für Attribute und document.title)
    const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    function renderProjectDetail(lang) {
        const container = document.getElementById('project-detail');
        if (!container) return;

        const urlParams = new URLSearchParams(window.location.search);
        const pid = urlParams.get('id');
        const currentIndex = projectsData.findIndex(p => p.id === pid);
        const project = projectsData[currentIndex];

        if (!project) {
            document.title = 'Project not found | Tom Henkel';
            container.innerHTML = '<p>Project not found.</p>';
            return;
        }

        const content = project[lang];
        // Dynamic Page Title
        document.title = `${stripTags(content.title)} | Tom Henkel`;

        const ui = siteContent.ui[lang]; // For "More Projects" text if needed

        // --- UPDATE MODE: Only update text if structure exists for this project ---
        if (container.getAttribute('data-rendered-id') === pid) {
            // Update Title & Meta
            const titleEl = container.querySelector('.pd-title');
            if (titleEl) titleEl.innerHTML = content.title;
            
            const catEl = container.querySelector('.pd-cat');
            if (catEl) catEl.innerHTML = content.category || '';
            
            const yearEl = container.querySelector('.pd-year');
            if (yearEl) yearEl.innerHTML = project.year || '';

            // Subtitle
            const subtitleEl = container.querySelector('.pd-subtitle');
            if (subtitleEl) subtitleEl.innerHTML = content.subtitle || content.short_description || '';

            // Text Block 1
            const text1El = container.querySelector('.pd-text-block-right');
            if (text1El) text1El.innerHTML = content.full_description;

            // Accordions
            const accordionDetails = container.querySelectorAll('.pd-accordion');
            if (accordionDetails.length === content.accordions.length) {
                accordionDetails.forEach((el, i) => {
                    const acc = content.accordions[i];
                    el.querySelector('summary').innerHTML = acc.title;
                    el.querySelector('.accordion-content').innerHTML = acc.content;
                });
            } else {
                // Formatting mismatch or count changed? Re-render container of accordions
                const accContainer = container.querySelector('.pd-accordions');
                if (accContainer) {
                    accContainer.innerHTML = content.accordions.map(acc => `
                        <details class="pd-accordion">
                            <summary>${acc.title}</summary>
                            <div class="accordion-content">${acc.content}</div>
                        </details>
                    `).join('');
                    
                    // Re-init animation listeners for new elements
                    initAccordionAnimation();
                }
            }

            // Text Block 2
            const text2El = container.querySelector('.pd-text-block-2');
            if (content.second_description && text2El) {
                 text2El.querySelector('h3').innerHTML = content.second_description.title;
                 text2El.querySelector('p').innerHTML = content.second_description.text;
            }

            // Footer Nav (Prev/Next)
            const prevIndex = (currentIndex - 1 + projectsData.length) % projectsData.length;
            const nextIndex = (currentIndex + 1) % projectsData.length;
            const prevP = projectsData[prevIndex];
            const nextP = projectsData[nextIndex];
            
            const footerTitle = container.querySelector('.pd-footer-nav-title');
            if (footerTitle) footerTitle.innerHTML = lang === 'de' ? 'Weitere Projekte' : 'More Work';

            const navItems = container.querySelectorAll('.pd-footer-nav .nav-item');
            if (navItems.length >= 2) {
                // Prev
                navItems[0].querySelector('.nav-title').innerHTML = prevP[lang].title;
                navItems[0].querySelector('.nav-desc').innerHTML = prevP[lang].category;
                // Next
                navItems[1].querySelector('.nav-title').innerHTML = nextP[lang].title;
                navItems[1].querySelector('.nav-desc').innerHTML = nextP[lang].category;
            }

            // Hero Controls (Beschriftung in neuer Sprache)
            updateHeroControls();

            return; // Stop here, no HTML destruction
        }

        // --- INITIAL RENDER MODE ---
        container.setAttribute('data-rendered-id', pid);

        // 1. Hero (Video or Image)
        // Uses vimeo_id if present, else standard hero video, else image
        let heroHTML = '';

        if (project.vimeo_id) {
           // controls=0 to hide native UI
           // dnt=1 for privacy
           // muted=0 (try to play with sound), autoplay=1
           // Button labels are set by updateHeroControls()
           heroHTML = `
             <div class="pd-hero" id="hero-wrapper">
                <iframe id="hero-player" src="https://player.vimeo.com/video/${project.vimeo_id}?autoplay=1&amp;muted=0&amp;controls=0&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;dnt=1" frameborder="0" allow="autoplay; fullscreen" title="${stripTags(content.title)}"></iframe>
                <div class="hero-overlay" id="hero-overlay">
                    <div class="big-play-btn"></div>
                </div>
                <div class="hero-controls">
                    <button id="btn-play"></button>
                    <button id="btn-sound"></button>
                </div>
             </div>`;
        } else if (project.hero_video) {
            heroHTML = `<div class="pd-hero"><video src="${project.hero_video}" autoplay muted loop playsinline></video></div>`;
        } else {
            heroHTML = `<div class="pd-hero"><img src="${project.hero_image}" alt=""></div>`;
        }

        // 2.–4. Title block: Title & Meta, Subtitle als zweite Zeile
        // (volle Breite, damit die Beschreibung immer darunter beginnt)
        const subtitleHTML = `<div class="pd-subtitle">${content.subtitle || content.short_description || ''}</div>`;
        const metaHTML = `
            <div class="pd-title-row">
                <h1 class="pd-title">${content.title}</h1>
                <div class="pd-meta">
                    <span class="pd-cat">${content.category || ''}</span>
                    <span class="pd-year">${project.year || ''}</span>
                </div>
                ${subtitleHTML}
            </div>
        `;

        // 5. Media Pair (Hardcoded or first 2 gallery items)
        let mediaPairHTML = '';
        if (project.media_pair && project.media_pair.length >= 2) {
             // Use explicit pair
             mediaPairHTML = `
                <div class="pd-media-pair">
                    ${project.media_pair.map(src => `<img src="${src}">`).join('')}
                </div>
             `;
        } else if (project.gallery && project.gallery.length >= 2) {
             // Fallback to first 2 gallery items
             mediaPairHTML = `
                <div class="pd-media-pair">
                    <img src="${project.gallery[0].src}">
                    <img src="${project.gallery[1].src}">
                </div>
             `;
        }

        // 6. Text Block 1
        const text1HTML = `<div class="pd-text-block-right">${content.full_description}</div>`;

        // 7. Accordions
        const accordionsHTML = `
            <div class="pd-accordions">
                ${content.accordions.map(acc => `
                    <details class="pd-accordion">
                        <summary>${acc.title}</summary>
                        <div class="accordion-content">${acc.content}</div>
                    </details>
                `).join('')}
            </div>
        `;

        // 8. Gallery (Remaining items or explicit list)
        // Filter out items used in media pair if we auto-picked them? For simplicity, just render full gallery.
        const galleryItems = project.gallery.slice(2).map(item => { // Skip first 2 if we used them above
            if (item.type === 'video') return `<div class="gallery-item video"><video src="${item.src}" controls></video></div>`;
            return `<img src="${item.src}" alt="">`; 
        }).join('');
        
        const galleryHTML = `<div class="pd-gallery">${galleryItems}</div>`;

        // 9. Text Block 2 (Headline + Text)
        const text2HTML = content.second_description ? `
            <div class="pd-text-block-2">
                <h3>${content.second_description.title}</h3>
                <p>${content.second_description.text}</p>
            </div>
        ` : '';

        // 10 & 11. Footer Nav (Previous / Next)
        // Logic: Circular nav
        const prevIndex = (currentIndex - 1 + projectsData.length) % projectsData.length;
        const nextIndex = (currentIndex + 1) % projectsData.length;
        const prevP = projectsData[prevIndex];
        const nextP = projectsData[nextIndex];

        // Ensure we load the localized content for preview
        const prevContent = prevP[lang];
        const nextContent = nextP[lang];

        // Card media: landscape preview video if available (and motion allowed), else the hero image
        const cardMedia = (p) => (p.preview && p.preview.landscape && autoplayAllowed())
            ? `<video src="${p.preview.landscape}" autoplay muted loop playsinline></video>`
            : `<img src="${p.hero_image}">`;

        const footerNavHTML = `
            <div class="pd-footer-nav-title">${lang === 'de' ? 'Weitere Projekte' : 'More Work'}</div>
            <div class="pd-footer-nav">
                <a href="project.html?id=${prevP.id}" class="nav-item">
                    <div class="nav-media">
                         ${cardMedia(prevP)}
                    </div>
                    <span class="nav-title">${prevContent.title}</span>
                    <span class="nav-desc">${prevContent.category}</span>
                </a>
                <a href="project.html?id=${nextP.id}" class="nav-item">
                    <div class="nav-media">
                         ${cardMedia(nextP)}
                    </div>
                    <span class="nav-title">${nextContent.title}</span>
                    <span class="nav-desc">${nextContent.category}</span>
                </a>
            </div>
        `;

        // Assembling
        container.innerHTML = `
            ${heroHTML}
            ${metaHTML}
            ${mediaPairHTML}
            ${text1HTML}
            ${accordionsHTML}
            ${galleryHTML}
            ${text2HTML}
            ${footerNavHTML}
        `;
        
        // --- Init Accordion Animations ---
        initAccordionAnimation();

        // --- Hero Player (Vimeo) ---
        if (project.vimeo_id) initHeroPlayer();
    }

    function renderAbout(lang) {
        const container = document.getElementById('about-content');
        if (!container) return;

        const aboutData = siteContent.about;
        const content = aboutData[lang];

        // "Blur-up" Logic:
        // Ideally we would have a small thumb path in JSON like "portrait_small.jpg".
        // Use existing image as placeholder with CSS filter for now.
        
        // Dynamic Page Title
        document.title = lang === 'de' ? 'Tom Henkel - Über mich' : 'Tom Henkel - About';

        container.innerHTML = `
            <section class="about-section">
                <div class="about-image">
                    <!-- Placeholder (blurred copy or low-res) -->
                    <img src="${aboutData.profile_image}" class="blur-placeholder" alt="">
                    
                    <!-- Main Image (hidden until loaded) -->
                    <img src="${aboutData.profile_image}" alt="Portrait" 
                         onload="this.classList.add('loaded')" 
                         class="main-img">
                </div>
                <div class="about-text">
                    <div class="description">${content.description}</div>
                    <div class="contact-info">
                        <a href="mailto:${siteContent.settings.contact_email}">${siteContent.settings.contact_email}</a>
                        <br>
                        <a href="${siteContent.settings.instagram_url}" target="_blank">Instagram</a>
                    </div>
                </div>
            </section>
        `;
    }

    function renderLab(lang) {
        const canvas = document.getElementById('lab-canvas');
        if (!canvas) return;

        // Dynamic Page Title
        document.title = 'Tom Henkel - The Lab';

        canvas.innerHTML = '';

        labData.forEach(item => {
            const el = document.createElement('div');
            el.className = `lab-item lab-item-${item.type}`;
            el.style.left = `${item.position.x}px`;
            el.style.top = `${item.position.y}px`;
            
            if (item.size) {
                 if (item.size.w) el.style.width = typeof item.size.w === 'number' ? item.size.w+'px' : item.size.w;
                 if (item.size.h) el.style.height = typeof item.size.h === 'number' ? item.size.h+'px' : item.size.h;
            }

            const content = item[lang];
            
            let innerHTML = '';
            if (item.type === 'image') {
                innerHTML = `<img src="${item.src}" alt="${content.title}" draggable="false">`;
            } else if (item.type === 'video') {
                // Autoplay, Loop, Muted für "Environment" Videos.
                // Pointer-events: none standard, aber wir wollen controls? User sagte "videos abgespielt werden".
                // Wir machen controls verfügbar und erlauben clicks.
                innerHTML = `<video src="${item.src}" poster="${item.poster || ''}" loop muted autoplay playsinline></video>`;
            } else if (item.type === 'text-block') {
                innerHTML = `<h3>${content.title}</h3><p>${content.content}</p>`;
            }

            // Title Overlay
            if (content.title && item.type !== 'text-block') {
                innerHTML += `<div class="lab-caption">${content.title}</div>`;
            }

            el.innerHTML = innerHTML;
            canvas.appendChild(el);
        });
    }

    function initLabInteraction() {
        const container = document.getElementById('lab-canvas-container');
        const canvas = document.getElementById('lab-canvas');
        
        // Settings
        let position = { x: 0, y: 0 };
        let targetPosition = { x: 0, y: 0 };
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        
        // Physics for smoothness (Linear Interpolation)
        const ease = 0.1; // 0.1 = smooth/slow, 1 = instant
        
        // Initial center
        position.x = (window.innerWidth / 2) - 500; // Ungefähr mittig starten (angenommen Canvas Inhalt ist um 0,0 - 1000,1000)
        position.y = (window.innerHeight / 2) - 300;
        targetPosition.x = position.x;
        targetPosition.y = position.y;

        // Animation Loop
        function animate() {
            // Lerp (Linear Interpolation) für Smoothness
            position.x += (targetPosition.x - position.x) * ease;
            position.y += (targetPosition.y - position.y) * ease;
            
            // Apply transform sub-pixel perfect
            canvas.style.transform = `translate3d(${position.x.toFixed(2)}px, ${position.y.toFixed(2)}px, 0)`;
            
            requestAnimationFrame(animate);
        }
        animate(); // Start loop

        // Event Listeners
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            container.classList.add('grabbing');
            dragStart.x = e.pageX - targetPosition.x;
            dragStart.y = e.pageY - targetPosition.y;
        });

        window.addEventListener('mouseup', () => {
            if(isDragging) {
                isDragging = false;
                container.classList.remove('grabbing');
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            targetPosition.x = e.pageX - dragStart.x;
            targetPosition.y = e.pageY - dragStart.y;
        });
        
        // Optional: Touch support
        container.addEventListener('touchstart', (e) => {
            isDragging = true;
            const touch = e.touches[0];
            dragStart.x = touch.pageX - targetPosition.x;
            dragStart.y = touch.pageY - targetPosition.y;
        }, {passive: false});
        
        window.addEventListener('touchend', () => {
             isDragging = false;
        });
        
        window.addEventListener('touchmove', (e) => {
             if (!isDragging) return;
             // e.preventDefault(); // Kann Scrollen verhindern
             const touch = e.touches[0];
             targetPosition.x = touch.pageX - dragStart.x;
             targetPosition.y = touch.pageY - dragStart.y;
        }, {passive: false});
    }
});