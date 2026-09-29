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
            
            // Nur das erste Standbild der Startseite; alle anderen Medien laden über den Media-Reveal, wenn sie gebraucht werden
            const firstFeatured = document.getElementById('project-list') && projects.find(p => p.featured);
            const firstPoster = firstFeatured && firstFeatured.hero && firstFeatured.hero.image;
            if (firstPoster) assetsToLoad.push({ type: 'image', src: firstPoster.src });

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
    // Auf- und Zuklappen mit den Motion-Tokens; offen gilt height: auto, damit Sprachwechsel
    // und Größenänderungen den Inhalt nie abschneiden. Bewegung reduzieren: ohne Animation.
    function initAccordionAnimation() {
        const rootStyle = getComputedStyle(document.documentElement);
        const duration = parseFloat(rootStyle.getPropertyValue('--duration-base')) || 300;
        const easing = rootStyle.getPropertyValue('--ease-out').trim() || 'ease-out';

        document.querySelectorAll('details.pd-accordion').forEach((detail) => {
            if (detail.hasAttribute('data-anim-init')) return;
            detail.setAttribute('data-anim-init', 'true');

            const summary = detail.querySelector('summary');
            const content = detail.querySelector('.accordion-content');
            let animation = null;
            let closing = false;

            summary.addEventListener('click', (e) => {
                e.preventDefault();
                const open = !detail.open || closing; // Klick während des Schließens öffnet wieder

                if (reduceMotion.matches || !content.animate) {
                    detail.open = open;
                    return;
                }

                // Von der aktuellen Höhe aus starten (auch mitten in einer laufenden Animation)
                const from = detail.open ? content.getBoundingClientRect().height : 0;
                if (animation) animation.cancel();
                detail.open = true;
                const full = content.scrollHeight;
                const padding = getComputedStyle(content).paddingBottom;
                const frames = [
                    { height: `${from}px`, paddingBottom: from ? padding : '0px', opacity: from ? 1 : 0 },
                    open ? { height: `${full}px`, paddingBottom: padding, opacity: 1 } : { height: '0px', paddingBottom: '0px', opacity: 0 },
                ];

                closing = !open;
                animation = content.animate(frames, { duration, easing, fill: open ? 'none' : 'forwards' });
                animation.onfinish = () => {
                    if (!open) detail.open = false;
                    animation.cancel(); // Inline-Werte weg: offen gilt wieder die natürliche Höhe
                    animation = null;
                    closing = false;
                };
            });
        });
    }

// --- Hero Player: Teaser-Loop läuft sofort, der Vimeo-Film lädt erst per Klick ---
    // Vor dem Klick geht keine Anfrage an Vimeo (Datenschutz); der Klick erlaubt auch den Ton.
    // Zustand der eigenen Steuerung; Start = pausiert, passend zur sichtbaren Play-Fläche. film = Vimeo geladen
    let heroState = { paused: true, muted: false, film: false };
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
        btnSound.hidden = !heroState.film; // Der Teaser hat keinen Ton
        const hint = document.getElementById('hero-hint');
        if (hint) {
            hint.textContent = labels.vimeo_hint;
            hint.hidden = heroState.film;
        }
        document.getElementById('hero-wrapper').classList.toggle('is-playing', !heroState.paused);
    }

    function initHeroPlayer(vimeoId, title) {
        const wrapper = document.getElementById('hero-wrapper');
        if (!wrapper) return;

        const overlay = document.getElementById('hero-overlay');
        const controls = wrapper.querySelector('.hero-controls');
        const teaser = wrapper.querySelector('video');

        const setState = (changes) => {
            Object.assign(heroState, changes);
            updateHeroControls();
        };
        setState({ paused: true, muted: false, film: false });

        let playerSynced = null; // entsteht erst mit dem ersten Klick
        let userMuted = null; // Explizite Ton-Wahl des Besuchers

        function loadFilm() {
            const iframe = document.createElement('iframe');
            iframe.id = 'hero-player';
            iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=0&controls=0&title=0&byline=0&portrait=0&badge=0&autopause=0&dnt=1`;
            iframe.allow = 'autoplay; fullscreen';
            iframe.title = title;
            wrapper.insertBefore(iframe, overlay || controls);
            setState({ film: true });

            // Film sichtbar, sobald er läuft; der Teaser hält so lange an
            const showFilm = () => {
                wrapper.classList.add('film-visible');
                if (teaser) {
                    teaser.setAttribute('data-hold', '');
                    teaser.pause();
                }
            };

            const playerReady = loadVimeoApi().then(() => {
                const player = new Vimeo.Player(iframe);
                return player.ready().then(() => player);
            });

            // Anzeige immer aus dem tatsächlichen Player-Zustand ableiten
            // (der Ton kann blockiert sein, dann startet der Film stumm)
            const syncState = (player) => Promise.all([player.getPaused(), player.getMuted()])
                .then(([paused, muted]) => setState({ paused, muted }));

            playerSynced = playerReady.then(player => syncState(player).then(() => player));
            playerSynced.catch(() => {}); // Fehler behandelt der Fallback unten

            playerReady.then(player => {
                player.on('play', () => {
                    showFilm();
                    syncState(player);
                });
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
                showFilm();
                iframe.style.pointerEvents = 'auto';
            });
        }

        // Erster Klick lädt den Film (Autoplay mit Ton), danach abspielen / pausieren
        const togglePlay = () => {
            if (!playerSynced) {
                loadFilm();
                return;
            }
            const wantPlay = heroState.paused; // Absicht zum Zeitpunkt des Klicks
            playerSynced.then(player => (wantPlay ? player.play() : player.pause())).catch(() => {});
        };

        if (overlay) overlay.addEventListener('click', togglePlay);
        document.getElementById('btn-play').addEventListener('click', togglePlay);

        document.getElementById('btn-sound').addEventListener('click', () => {
            if (!playerSynced) return;
            const mute = !heroState.muted;
            userMuted = mute;
            setState({ muted: mute });
            playerSynced
                .then(player => player.setMuted(mute)
                    .then(() => (mute ? null : player.setVolume(1)))
                    .then(() => player.getMuted().then(muted => setState({ muted }))))
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


    // --- Media-Reveal: Bilder und Videos erscheinen unscharf und werden scharf, sobald sie geladen sind (site-weit) ---
    // mediaHTML() baut das Markup, initMediaReveal() lädt; Stil in css/components/_media.scss.
    // Einfachform (Projekte): { type: "image" | "video", src, width, height, placeholder, color, focus, alt: { de, en }, poster (Video-Standbild) }
    // Art Direction (About): { alt, color, eager, sources: [{ media, srcset, sizes, placeholder }], img: { srcset, sizes, width, height, placeholder } }
    // Video: stummer Loop, spielt nur im Sichtfeld; darf er nicht laufen, erscheint das Standbild
    const escapeAttr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const mediaAlt = (media, lang) => (media.alt && media.alt[lang]) || '';
    const revealInitialized = new WeakSet();
    let revealObserver = null;

    // Breite eines Feldes über n Spalten (12er-Raster, 25px Rand, 20px Spaltenabstand); mobil immer volle Breite
    const cellSizes = (span) => `(max-width: 768px) calc(100vw - 50px), calc((100vw - 270px) * ${span} / 12 + ${(span - 1) * 20}px)`;

    const mediaStyle = (media) => {
        const vars = [media.color && `--media-bg: ${media.color}`, media.focus && `--focus: ${media.focus}`].filter(Boolean);
        return vars.length ? ` style="${vars.join('; ')}"` : '';
    };

    function pictureHTML(media, lang) {
        const { img, sources = [] } = media;
        // Die winzige Vorschau steht im srcset, die echte Quelle wartet in data-srcset, bis initMediaReveal sie einsetzt
        const srcAttrs = (s) => `${s.placeholder ? `srcset="${s.placeholder}" ` : ''}data-srcset="${s.srcset}"${s.sizes ? ` sizes="${s.sizes}"` : ''}`;
        const sourceTags = sources.map(s => `<source media="${s.media}" ${srcAttrs(s)}>`).join('');
        const size = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : '';

        return `<picture class="media-reveal"${mediaStyle(media)}${media.eager ? ' data-eager' : ''}>${sourceTags}`
            + `<img ${srcAttrs(img)} alt="${escapeAttr(mediaAlt(media, lang))}"${size} decoding="async"${media.eager ? ' fetchpriority="high"' : ''}>`
            + `</picture>`;
    }

    function videoHTML(media) {
        // poster: 32px-Vorschau (sofort da); data-poster: Standbild, wird nur geladen, wenn der Loop nicht laufen darf
        const poster = media.placeholder ? ` poster="${media.placeholder}"` : '';
        const still = media.poster ? ` data-poster="${media.poster}"` : '';
        return `<div class="media-reveal"${mediaStyle(media)}${media.eager ? ' data-eager' : ''}>`
            + `<video data-src="${media.src}"${poster}${still} muted loop playsinline preload="none" aria-hidden="true"></video>`
            + `</div>`;
    }

    // Einfachform -> Bild bzw. Video; opts.sizes = Anzeigebreite (cellSizes), opts.eager = wichtigstes Medium beim Seitenstart
    function mediaHTML(media, lang, opts = {}) {
        const eager = opts.eager || media.eager;
        if (media.type === 'video') return videoHTML({ ...media, eager });
        if (media.img) return pictureHTML({ ...media, eager }, lang);
        return pictureHTML({
            alt: media.alt, color: media.color, focus: media.focus, eager,
            img: {
                srcset: media.width ? `${media.src} ${media.width}w` : media.src,
                sizes: media.width ? opts.sizes : null,
                width: media.width, height: media.height, placeholder: media.placeholder,
            },
        }, lang);
    }

    function loadMedia(wrapper) {
        const reveal = () => wrapper.classList.add('is-loaded');

        const img = wrapper.querySelector('img');
        if (img) {
            // Vorschau-URLs merken: das load der Vorschau darf das Bild nicht scharf schalten
            const placeholders = new Set();
            wrapper.querySelectorAll('[data-srcset][srcset]').forEach(el => {
                placeholders.add(new URL(el.getAttribute('srcset'), document.baseURI).href);
            });
            const onSettle = (e) => {
                if (placeholders.has(img.currentSrc)) return;
                if (e.type === 'error') wrapper.classList.add('is-error'); // Datei fehlt: Farbfläche statt kaputtem Bild
                img.decode().catch(() => {}).then(reveal); // erst entschärfen, wenn das Bild fertig dekodiert ist
            };
            img.addEventListener('load', onSettle);
            img.addEventListener('error', onSettle);

            // Die echte Quelle erst unsichtbar laden und danach einsetzen (kommt dann aus dem Cache):
            // Chrome verwirft die Vorschau sonst schon beim Anfordern und zeigt bis zum Laden eine leere Fläche
            const swap = () => wrapper.querySelectorAll('[data-srcset]').forEach(el => {
                el.setAttribute('srcset', el.dataset.srcset);
                el.removeAttribute('data-srcset');
            });
            const active = [...wrapper.querySelectorAll('source[data-srcset]')]
                .find(s => !s.media || window.matchMedia(s.media).matches) || img; // dieselbe Wahl wie der Browser
            const probe = new Image();
            probe.sizes = active.getAttribute('sizes') || '';
            probe.srcset = active.dataset.srcset;
            if (img.getAttribute('fetchpriority')) probe.fetchPriority = img.getAttribute('fetchpriority');
            probe.decode().catch(() => {}).then(swap);
        }

        wrapper.querySelectorAll('video[data-src]').forEach(video => loadVideo(video, reveal));
    }

    // --- Video-Loops: laden mit dem Media-Reveal, spielen nur sichtbar, pausieren außerhalb und im versteckten Tab ---
    const visibleLoops = new Set();
    const loopFallbacks = new WeakMap();
    let playbackObserver = null;

    function loadVideo(video, reveal) {
        const src = video.dataset.src;
        video.removeAttribute('data-src');

        // Standbild statt Loop (Bewegung reduzieren, Datensparen, Autoplay blockiert, Videofehler)
        let stillShown = false;
        const showStill = () => {
            if (stillShown) return;
            stillShown = true;
            visibleLoops.delete(video);
            if (playbackObserver) playbackObserver.unobserve(video);
            video.pause();
            if (video.getAttribute('src')) {
                video.removeAttribute('src');
                video.load(); // zurück auf das Poster
            }
            const still = video.dataset.poster;
            if (!still) return; // kein Standbild: die unscharfe Vorschau bleibt stehen
            const probe = new Image();
            probe.onload = () => {
                video.poster = still;
                probe.decode().catch(() => {}).then(reveal);
            };
            probe.src = still;
        };

        if (!autoplayAllowed()) {
            showStill();
            return;
        }
        loopFallbacks.set(video, showStill);
        video.muted = true;
        video.preload = 'auto'; // lädt jetzt, 200px bevor das Video ins Bild kommt
        video.addEventListener('loadeddata', reveal, { once: true });
        video.addEventListener('error', showStill, { once: true });
        video.src = src;
        watchPlayback(video);
    }

    function playLoop(video) {
        if (document.hidden || video.hasAttribute('data-hold') || !video.getAttribute('src')) return;
        video.play().catch(err => {
            // Stromsparmodus u. Ä. verbietet Autoplay -> Standbild; AbortError (pause() während play()) ignorieren
            if (err && err.name === 'NotAllowedError') loopFallbacks.get(video)();
        });
    }

    function watchPlayback(video) {
        if (!('IntersectionObserver' in window)) {
            playLoop(video);
            return;
        }
        if (!playbackObserver) {
            playbackObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        visibleLoops.add(entry.target);
                        playLoop(entry.target);
                    } else {
                        visibleLoops.delete(entry.target);
                        entry.target.pause();
                    }
                });
            });
            document.addEventListener('visibilitychange', () => {
                visibleLoops.forEach(v => (document.hidden ? v.pause() : playLoop(v)));
            });
        }
        playbackObserver.observe(video);
    }

    // Nach jedem Rendern aufrufen; bereits gestartete Medien werden übersprungen.
    // data-eager (wichtigstes Bild beim Seitenstart) lädt sofort, alles andere 200px bevor es in den Viewport kommt.
    function initMediaReveal(root = document) {
        root.querySelectorAll('.media-reveal').forEach(wrapper => {
            if (revealInitialized.has(wrapper)) return;
            revealInitialized.add(wrapper);

            if (wrapper.hasAttribute('data-eager') || !('IntersectionObserver' in window)) {
                loadMedia(wrapper);
                return;
            }
            if (!revealObserver) {
                revealObserver = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) return;
                        revealObserver.unobserve(entry.target);
                        loadMedia(entry.target);
                    });
                }, { rootMargin: '200px' });
            }
            revealObserver.observe(wrapper);
        });
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
    // Querformat = der Hero-Teaser des Projekts. Fehlt eine Variante, wird die andere genommen (object-fit: cover beschneidet sie)
    function previewVideoSrc(p) {
        if (!p || !autoplayAllowed()) return null;
        const portraitSrc = p.preview && p.preview.portrait;
        const landscapeSrc = p.hero && p.hero.teaser;
        if (!portraitSrc && !landscapeSrc) return null;
        const visual = document.querySelector('.home-visual');
        const box = visual ? visual.getBoundingClientRect() : null;
        const portrait = box ? box.height > box.width : mobileQuery.matches;
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
        const poster = (p.hero && p.hero.image && p.hero.image.src) || '';
        if (poster && img.getAttribute('src') !== poster) {
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

    // --- Projektseite: Hero, Titelblock, Module aus dem Baukasten, Weitere Projekte ---
    // Module (project.blocks): media (Medien-Zeile), text, accordions. Anleitung: docs/projekt-baukasten.md
    const localized = (field, lang) => (field && typeof field === 'object' ? field[lang] : field) || '';
    const cssRatio = (ratio) => {
        const m = String(ratio || '').match(/^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/);
        return m ? `${m[1]} / ${m[2]}` : null;
    };
    const warnBlock = (project, index, reason) => console.warn(`[Projekt ${project.id}] Block ${index + 1} übersprungen: ${reason}`);

    // Der Teaser nutzt das Hero-Bild als Standbild und Vorschau
    const teaserMedia = (hero) => ({
        type: 'video',
        src: hero.teaser,
        poster: hero.image && hero.image.src,
        placeholder: hero.image && hero.image.placeholder,
        color: hero.image && hero.image.color,
    });
    const heroMedia = (hero) => (hero.teaser ? teaserMedia(hero) : hero.image && { type: 'image', ...hero.image });

    function heroHTML(project, lang) {
        const hero = project.hero || {};
        const media = heroMedia(hero);
        // Beschriftung von Buttons und Hinweis setzt updateHeroControls()
        const filmControls = hero.vimeo ? `
                <div class="hero-overlay" id="hero-overlay"><div class="big-play-btn"></div></div>
                <div class="hero-controls">
                    <span class="hero-hint" id="hero-hint"></span>
                    <button id="btn-play" type="button"></button>
                    <button id="btn-sound" type="button" hidden></button>
                </div>` : '';
        return `<div class="pd-hero" id="hero-wrapper">${media ? mediaHTML(media, lang, { eager: true, sizes: cellSizes(12) }) : ''}${filmControls}</div>`;
    }

    // Medien-Zeile: cols = Spalten je Feld (zusammen max. 12), start = Startspalte, null = leeres Feld.
    // Das größte Feld bestimmt die Höhe (ratio oder sein natürliches Format), die anderen übernehmen sie (cover).
    function mediaRowHTML(block, lang, index, project) {
        const cols = Array.isArray(block.cols) ? block.cols : [];
        const items = Array.isArray(block.items) ? block.items : [];
        const start = block.start || 1;
        const used = start - 1 + cols.reduce((sum, span) => sum + span, 0);

        let problem = null;
        if (!cols.length || cols.length !== items.length) problem = '"cols" und "items" brauchen gleich viele Einträge';
        else if (used > 12) problem = `die Zeile belegt ${used} von 12 Spalten`;
        else if (items.some(item => item && !(item.src && item.width && item.height))) problem = 'jedes Medium braucht "src", "width" und "height"';
        else if (items.every(item => !item)) problem = 'die Zeile enthält kein Medium';
        if (problem) {
            warnBlock(project, index, problem);
            return '';
        }
        if (block.ratio && !cssRatio(block.ratio)) console.warn(`[Projekt ${project.id}] Block ${index + 1}: "ratio" ${block.ratio} ungültig (z. B. "16:9"), natürliches Format genutzt`);

        const lead = cols.reduce((best, span, i) => (items[i] && (best < 0 || span > cols[best]) ? i : best), -1);
        const rowRatio = cssRatio(block.ratio) || `${items[lead].width} / ${items[lead].height}`;

        const cells = cols.map((span, i) => {
            const item = items[i];
            const place = `${i === 0 && start > 1 ? `--col-start: ${start}; ` : ''}--col-span: ${span}`;
            if (!item) return `<div class="pd-cell is-empty" style="${place}"></div>`;
            return `<div class="pd-cell${i === lead ? ' is-lead' : ''}" data-item="${i}" style="${place}; --ratio: ${item.width} / ${item.height}">`
                + `${mediaHTML(item, lang, { sizes: cellSizes(span) })}</div>`;
        }).join('');
        return `<div class="pd-block pd-media" data-block="${index}" style="--row-ratio: ${rowRatio}">${cells}</div>`;
    }

    function textBlockHTML(block, lang, index) {
        const title = block.title ? `<h3 class="pd-text-title">${localized(block.title, lang)}</h3>` : '';
        return `<div class="pd-block pd-text" data-block="${index}">${title}<div class="pd-text-body">${localized(block.text, lang)}</div></div>`;
    }

    function accordionsBlockHTML(block, lang, index, project) {
        const items = Array.isArray(block.items) ? block.items : [];
        if (!items.length) {
            warnBlock(project, index, 'Akkordeons ohne "items"');
            return '';
        }
        return `<div class="pd-block pd-accordions" data-block="${index}">${items.map(acc => `
                <details class="pd-accordion">
                    <summary>${localized(acc.title, lang)}</summary>
                    <div class="accordion-content">${localized(acc.content, lang)}</div>
                </details>`).join('')}
            </div>`;
    }

    // Je Modul-Typ: Markup und Sprachwechsel (nur Texte, Medien bleiben stehen)
    const BLOCKS = {
        media: {
            html: mediaRowHTML,
            update: (el, block, lang) => el.querySelectorAll('[data-item]').forEach(cell => {
                const img = cell.querySelector('img');
                if (img) img.alt = mediaAlt(block.items[cell.dataset.item], lang);
            }),
        },
        text: {
            html: textBlockHTML,
            update: (el, block, lang) => {
                const title = el.querySelector('.pd-text-title');
                if (title) title.innerHTML = localized(block.title, lang);
                el.querySelector('.pd-text-body').innerHTML = localized(block.text, lang);
            },
        },
        accordions: {
            html: accordionsBlockHTML,
            update: (el, block, lang) => el.querySelectorAll('.pd-accordion').forEach((detail, i) => {
                detail.querySelector('summary').innerHTML = localized(block.items[i].title, lang);
                detail.querySelector('.accordion-content').innerHTML = localized(block.items[i].content, lang);
            }),
        },
    };

    function blocksHTML(project, lang) {
        return (project.blocks || []).map((block, index) => {
            const type = BLOCKS[block && block.type];
            if (!type) {
                warnBlock(project, index, `unbekannter Typ "${block && block.type}"`);
                return '';
            }
            return type.html(block, lang, index, project);
        }).join('');
    }

    // Karte "Weitere Projekte": Teaser als Loop, sonst das Hero-Bild (dekorativ, der Titel steht daneben)
    function projectCardHTML(p, lang) {
        const media = heroMedia(p.hero || {});
        return `
                <a href="project.html?id=${p.id}" class="nav-item">
                    <div class="nav-media">${media ? mediaHTML({ ...media, alt: null }, lang, { sizes: cellSizes(6) }) : ''}</div>
                    <span class="nav-title">${p[lang].title}</span>
                    <span class="nav-desc">${p[lang].category || ''}</span>
                </a>`;
    }

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

        // Weitere Projekte: vorheriges und nächstes (im Kreis)
        const prevP = projectsData[(currentIndex - 1 + projectsData.length) % projectsData.length];
        const nextP = projectsData[(currentIndex + 1) % projectsData.length];
        const moreTitle = lang === 'de' ? 'Weitere Projekte' : 'More Work';

        // --- UPDATE MODE: Sprachwechsel tauscht nur Texte, Medien bleiben stehen (kein neuer Request) ---
        if (container.getAttribute('data-rendered-id') === pid) {
            container.querySelector('.pd-title').innerHTML = content.title;
            container.querySelector('.pd-cat').innerHTML = content.category || '';
            container.querySelector('.pd-subtitle').innerHTML = content.subtitle || '';
            container.querySelectorAll('[data-block]').forEach(el => {
                const block = project.blocks[el.dataset.block];
                BLOCKS[block.type].update(el, block, lang);
            });
            container.querySelector('.pd-footer-nav-title').innerHTML = moreTitle;
            container.querySelectorAll('.pd-footer-nav .nav-item').forEach((item, i) => {
                const p = i === 0 ? prevP : nextP;
                item.querySelector('.nav-title').innerHTML = p[lang].title;
                item.querySelector('.nav-desc').innerHTML = p[lang].category || '';
            });
            updateHeroControls();
            return;
        }

        // --- INITIAL RENDER MODE ---
        container.setAttribute('data-rendered-id', pid);
        container.innerHTML = `
            ${heroHTML(project, lang)}
            <div class="pd-title-row">
                <h1 class="pd-title">${content.title}</h1>
                <div class="pd-meta">
                    <span class="pd-cat">${content.category || ''}</span>
                    <span class="pd-year">${project.year || ''}</span>
                </div>
                <div class="pd-subtitle">${content.subtitle || ''}</div>
            </div>
            ${blocksHTML(project, lang)}
            <div class="pd-footer-nav-title">${moreTitle}</div>
            <div class="pd-footer-nav">
                ${projectCardHTML(prevP, lang)}
                ${projectCardHTML(nextP, lang)}
            </div>
        `;

        initAccordionAnimation();
        initMediaReveal(container);
        if (project.hero && project.hero.vimeo) initHeroPlayer(project.hero.vimeo, stripTags(content.title));
    }

    function renderAbout(lang) {
        const container = document.getElementById('about-content');
        if (!container) return;

        const aboutData = siteContent.about;
        const content = aboutData[lang];
        const { contact_email: email, instagram_url: instagram } = siteContent.settings;

        // Dynamic Page Title
        document.title = lang === 'de' ? 'Tom Henkel - Über mich' : 'Tom Henkel - About';

        // --- UPDATE MODE: Sprachwechsel tauscht nur die Texte, das Porträt bleibt stehen (kein Neuladen, kein erneutes Weichzeichnen) ---
        const section = container.querySelector('.about-section');
        if (section) {
            section.querySelector('.description').innerHTML = content.description;
            const img = section.querySelector('.about-image img');
            if (img) img.alt = mediaAlt(aboutData.portrait, lang);
            return;
        }

        // --- INITIAL RENDER MODE ---
        container.innerHTML = `
            <section class="about-section">
                <div class="about-image">${pictureHTML(aboutData.portrait, lang)}</div>
                <div class="about-text">
                    <div class="description">${content.description}</div>
                    <div class="contact-info">
                        <a href="mailto:${email}">${email}</a>
                        <br>
                        <a href="${instagram}" target="_blank" rel="noopener">Instagram</a>
                    </div>
                </div>
            </section>
        `;
        initMediaReveal(container);
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