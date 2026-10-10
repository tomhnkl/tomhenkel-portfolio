document.addEventListener('DOMContentLoaded', () => {
    const langButtons = document.querySelectorAll('.lang-switch-footer button');
    let siteContent = {};
    let projectsData = [];
    let labData = [];
    let currentLang = null;
    // Texte für Navigation, Footer und Tab-Titel ({ ui, email, languages, defaultLang }); pro Sitzung zwischengespeichert,
    // damit Folgeseiten ohne Loader sofort in der richtigen Sprache erscheinen
    let uiText = null;
    const LANG_CHOICE_KEY = 'languageChoice';

    // Motion-Tokens aus css/base/_variables.scss in ms (bei "Bewegung reduzieren" 0)
    const motionMs = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

    // --- Unterstreichung mit Lücken an Wortabständen (D24, wie der frühere Lining-Schnitt) ---
    // Jedes Wort kommt in ein .ul-w, die Linie liegt dann nur auf den Wörtern (Mixin underline in css/base/_typography.scss).
    // CSS allein (text-decoration-skip-spaces) kann nur Chrome, WebKit nicht. Nach jedem Setzen des Textes erneut aufrufen.
    function underlineWords(el) {
        if (!el || el.querySelector('.ul-w')) return el; // schon aufgeteilt
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const texts = [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        texts.forEach(node => {
            if (!node.textContent.trim()) return;
            const words = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach(part => {
                if (!part) return;
                if (!part.trim()) {
                    words.appendChild(document.createTextNode(part)); // Abstand bleibt Text, ohne Linie
                    return;
                }
                const word = document.createElement('span');
                word.className = 'ul-w';
                word.textContent = part;
                words.appendChild(word);
            });
            node.replaceWith(words);
        });
        // Ein Kind statt vieler: in Flex-Containern (Footer-Links) bleiben die Wörter in einer Zeile
        const group = document.createElement('span');
        group.className = 'ul-words';
        group.append(...el.childNodes);
        el.appendChild(group);
        return el;
    }
    const setWords = (el, text) => {
        if (!el || (el.textContent === text && el.querySelector('.ul-w'))) return; // unverändert: DOM stehen lassen
        el.textContent = text;
        underlineWords(el);
    };
    // Alles mit Unterstreichung im Inhalt (Links, Kartentitel); nach dem Rendern und nach dem Sprachwechsel
    const underlineAll = (scope) => scope.querySelectorAll('.text-link, .nav-title').forEach(underlineWords);
    // Statische Labels aus dem HTML (Navigation, Footer) sofort aufteilen
    document.querySelectorAll('.nav-right a, .footer-left a, .nav-burger').forEach(underlineWords);

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
    
    // Alle Pfade ab der Wurzel: Projektseiten liegen unter /work/<id> (D6), relative Pfade zeigten dort ins Leere.
    // Die JSON-Dateien schreiben Medien relativ ("images/…", "videos/…"); rootPaths setzt beim Laden ein "/" davor,
    // auch vor jeden Eintrag eines srcset. data:-Vorschauen, http(s) und schon absolute Pfade bleiben, wie sie sind
    const MEDIA_PATH = /^(?:images|videos)\//;
    function rootPaths(value) {
        if (typeof value === 'string') return MEDIA_PATH.test(value) ? value.replace(/(^|,\s*)((?:images|videos)\/)/g, '$1/$2') : value;
        if (Array.isArray(value)) return value.map(rootPaths);
        if (value && typeof value === 'object') Object.keys(value).forEach(key => { value[key] = rootPaths(value[key]); });
        return value;
    }

    Promise.all([
        fetch('/data/site-content.json').then(r => r.json()),
        fetch('/data/projects.json').then(r => r.json()),
        // lab.json lädt nur die Lab-Seite; fehlt sie oder ist sie kaputt, bleibt die Leinwand leer
        document.getElementById('lab-canvas')
            ? fetch('/data/lab.json').then(r => r.json()).catch(error => { console.warn('lab.json nicht geladen:', error); return []; })
            : []
    ]).then(async ([content, projects, lab]) => {
        siteContent = rootPaths(content);
        projectsData = rootPaths(projects);
        labData = Array.isArray(lab) ? rootPaths(lab) : [];

        // Sprache und Navigation/Footer umstellen, solange der Loader noch deckt
        uiText = {
            ui: content.ui,
            email: content.settings.contact_email,
            languages: content.settings.available_languages,
            defaultLang: content.settings.default_language
        };
        try { sessionStorage.setItem('uiText', JSON.stringify(uiText)); } catch (e) { /* ohne Speicher: nur kein Vorab-Umschalten */ }
        const langToUse = resolveLanguage();
        currentLang = langToUse;
        updateUI(langToUse);

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
                setTimeout(() => { loader.style.display = 'none'; }, motionMs('--duration-slow'));
            }
        } 



        setLanguage(langToUse);

        // Lab Initialisierung (nur einmalig)
        if (document.getElementById('lab-canvas')) {
            initLabInteraction();
        }

    }).catch(error => {
        // Ladefehler als Poster im Loader (D14): Wort, eine Zeile, "Neu laden"; deckt Nav und Footer
        console.error('Fehler beim Laden der Daten:', error);
        if (!loader) return;
        const lang = currentLang || fallbackLanguage();
        const texts = stateTexts(lang).error;
        document.documentElement.lang = lang;
        loader.innerHTML = posterHTML({ word: texts.word, text: texts.text, link: texts.reload, href: location.href, role: 'alert' });
        loader.querySelectorAll('.state-poster-word, .state-link').forEach(underlineWords);
        loader.classList.remove('hidden');
        loader.style.display = '';
    });

    // --- Systemzustände als Poster (D14): Ladefehler, Projekt nicht gefunden; ohne JS und 404 stehen im HTML ---
    // Texte aus site-content.json ui.*.states; der Ladefehler braucht eine Kopie hier, falls site-content.json selbst fehlt
    const STATE_FALLBACK = {
        de: { error: { word: 'hm.', text: 'Die Inhalte sind nicht angekommen.', reload: 'Neu laden' } },
        en: { error: { word: 'hm.', text: 'The content didn’t arrive.', reload: 'Reload' } },
    };

    function stateTexts(lang) {
        const ui = uiText && uiText.ui[lang];
        return (ui && ui.states) || STATE_FALLBACK[lang] || STATE_FALLBACK.de;
    }

    // Browsersprache: die erste unterstützte in navigator.languages entscheidet (en-GB vor de → en), sonst null
    function browserLanguage(available) {
        return (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''])
            .map(l => String(l).toLowerCase().split('-')[0])
            .find(l => available.includes(l)) || null;
    }

    // Sprache ohne site-content.json: gespeicherte Wahl, sonst Browsersprache (de oder en)
    function fallbackLanguage() {
        const choice = storedLanguage();
        if (STATE_FALLBACK[choice]) return choice;
        return browserLanguage(Object.keys(STATE_FALLBACK)) || 'de';
    }

    // Großes unterstrichenes Wort, unten eine Zeile mit Link. framed: Nav und Footer bleiben darüber bedienbar
    function posterHTML({ word, text, link, href, tag = 'p', framed = false, role = '' }) {
        return `<div class="state-poster${framed ? ' is-framed' : ''}"${role ? ` role="${role}"` : ''}>`
            + `<${tag} class="state-poster-word">${word}</${tag}>`
            + `<p class="state-poster-line">${text} <a class="text-link state-link" href="${escapeAttr(href)}">${link}</a></p>`
            + `</div>`;
    }



    // --- Event Listener ---
    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            // Ausdrückliche Wahl merken: gilt ab jetzt vor der Browsersprache
            try { localStorage.setItem(LANG_CHOICE_KEY, lang); } catch (e) { /* nur für diese Seite */ }
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
        const ui = uiText && uiText.ui[currentLang];
        // Vor dem Laden der Daten: Fallback in der Sprache des Besuchers
        const lang = currentLang || storedLanguage();
        const fallback = lang === 'en' ? { open: 'menu', close: 'close' } : { open: 'menü', close: 'schließen' };
        const labels = (ui && ui.menu) || fallback;
        setWords(navBurger, isMenuOpen() ? labels.close : labels.open);
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

    // --- Sprache wählen: ?lang= (Link) > ausdrückliche Wahl (de / en) > Browsersprache > Standard (de) ---
    function storedLanguage() {
        try { return localStorage.getItem(LANG_CHOICE_KEY); } catch (e) { return null; }
    }

    function resolveLanguage() {
        const available = uiText.languages;
        const urlLang = new URLSearchParams(window.location.search).get('lang');
        if (available.includes(urlLang)) return urlLang;
        const choice = storedLanguage();
        if (available.includes(choice)) return choice;
        return browserLanguage(available) || uiText.defaultLang;
    }

    // Folgeseiten (Loader schon aus): Navigation und Footer sofort aus dem Sitzungsspeicher umstellen, kein Aufblitzen der deutschen Texte
    try { uiText = JSON.parse(sessionStorage.getItem('uiText')); } catch (e) { uiText = null; }
    if (uiText && uiText.ui && Array.isArray(uiText.languages)) {
        currentLang = resolveLanguage();
        updateUI(currentLang);
    } else {
        uiText = null;
    }



// --- Accordion Logic ---
    // Auf- und Zuklappen mit den Motion-Tokens; offen gilt height: auto, damit Sprachwechsel
    // und Größenänderungen den Inhalt nie abschneiden. Bewegung reduzieren: ohne Animation.
    function initAccordionAnimation() {
        const duration = motionMs('--duration-base');
        const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'ease-out';

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

                if (reduceMotion.matches || !duration || !content.animate) {
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

// --- Hero Player: Teaser-Loop läuft sofort, der Film lädt erst per Klick ---
    // Film von Bunny Stream als HLS im eigenen <video> (D4), übergangsweise auch Vimeo/YouTube im iframe.
    // Vor dem Klick geht keine Anfrage an den Anbieter (Datenschutz); der Klick erlaubt auch den Ton.
    // Steuerung (D11): ein Wort mittig über dem Film; läuft er, "pause" und darunter der Ton, nach einer Ruhezeit ausgeblendet.
    // Zustand der eigenen Steuerung; Start = pausiert. film = Film geladen
    let heroState = { paused: true, muted: false, film: false };
    const HERO_IDLE_MS = 2500; // so lange ohne Maus, Tipp oder Fokus, bis die Steuerung über dem laufenden Film ausblendet
    const IFRAME_START_MS = 4000; // Vimeo/YouTube: läuft der Film bis dahin nicht, übernimmt die Anzeige des Anbieters
    const MUTE_SYNC_MS = 500; // Abgleich des Ton-Zustands mit dem Player
    const HLS_SCRIPT = '/js/vendor/hls.light.min.js'; // hls.js 1.7.3 (light), selbst gehostet, lädt erst beim ersten Klick

    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });

    // Ereignisse eines Players; was vor dem ersten Zuhören kam (z. B. Start direkt im Klick), wird nachgeholt
    function filmEvents() {
        const handlers = { play: [], pause: [], error: [], blocked: [] };
        const early = new Set();
        return {
            emit(event) {
                if (!handlers[event].length) early.add(event);
                handlers[event].forEach(fn => fn());
            },
            on(event, fn) {
                handlers[event].push(fn);
                if (early.delete(event)) fn();
            },
        };
    }

    // Bunny-Host aus site-content.json (settings.bunny_cdn, z. B. "vz-xxxx.b-cdn.net"); leer = noch nicht eingerichtet
    const bunnyHost = () => String((siteContent.settings && siteContent.settings.bunny_cdn) || '').trim()
        .replace(/^https?:\/\//, '').replace(/\/+$/, '');

    const filmIframe = (src, title) => {
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
        iframe.title = title;
        return iframe;
    };

    // Anbieter: create(id, title) -> Element im Hero, connect(element) -> Player mit einheitlicher Schnittstelle
    // { play, pause, isPaused, isMuted, setMuted, on('play' | 'pause' | 'error' | 'blocked', fn) }; alle Methoden liefern Promises.
    // iframe: true = Player des Anbieters (startet über die Einbettungs-URL); sonst eigenes <video>
    const FILM_PROVIDERS = {
        bunny: {
            name: 'Bunny Stream',
            hlsLib: null,
            create(id, title) {
                const video = document.createElement('video');
                video.playsInline = true; // iOS: im Hero abspielen, nicht im Vollbild
                video.preload = 'auto';
                video.setAttribute('aria-label', title);
                video.dataset.src = `https://${bunnyHost()}/${encodeURIComponent(id)}/playlist.m3u8`;
                return video;
            },
            connect(video) {
                const events = filmEvents();
                let hls = null;
                // Start mit Ton; verbietet der Browser den Ton, stumm starten ("ton an" bleibt bedienbar).
                // Scheitert auch das: blocked (Bedienelemente des Browsers). AbortError = pause() während play(), Quellfehler meldet 'error'
                const start = () => video.play().catch(err => {
                    if (!err || err.name !== 'NotAllowedError') return;
                    if (video.muted) return events.emit('blocked');
                    video.muted = true;
                    return start();
                });
                video.addEventListener('playing', () => events.emit('play')); // erst mit dem ersten Bild, vorher bleibt der Teaser
                video.addEventListener('pause', () => events.emit('pause'));
                video.addEventListener('error', () => events.emit('error'));
                const player = {
                    play: start,
                    pause: () => Promise.resolve(video.pause()),
                    isPaused: () => Promise.resolve(video.paused),
                    isMuted: () => Promise.resolve(video.muted),
                    setMuted: (mute) => {
                        video.muted = mute; // synchron, damit der Ton auf iOS noch in der Klick-Geste angeht
                        if (!mute) video.volume = 1;
                        return Promise.resolve();
                    },
                    on: events.on,
                    destroy: () => {
                        if (hls) hls.destroy();
                        hls = null;
                        video.removeAttribute('src');
                        video.load(); // laufende Downloads abbrechen
                    },
                };

                // Safari/iOS: HLS nativ, Start noch im Klick (iOS erlaubt Ton nur direkt aus der Geste)
                if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = video.dataset.src;
                    start();
                    return Promise.resolve(player);
                }
                // Sonst hls.js; Qualitätsstufe höchstens so groß wie der Player (capLevelToPlayerSize)
                this.hlsLib = this.hlsLib || (window.Hls ? Promise.resolve() : loadScript(HLS_SCRIPT));
                return this.hlsLib.catch(err => {
                    this.hlsLib = null; // nächster Klick lädt neu
                    throw err;
                }).then(() => new Promise((resolve, reject) => {
                    if (!Hls.isSupported()) throw new Error('HLS wird in diesem Browser nicht unterstützt');
                    hls = new Hls({ capLevelToPlayerSize: true });
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        start();
                        resolve(player);
                    });
                    hls.on(Hls.Events.ERROR, (event, data) => {
                        if (!data.fatal) return; // kleine Fehler behebt hls.js selbst
                        player.destroy();
                        reject(new Error(`hls.js: ${data.details}`));
                        events.emit('error');
                    });
                    hls.loadSource(video.dataset.src);
                    hls.attachMedia(video);
                }));
            },
        },
        vimeo: {
            name: 'Vimeo',
            iframe: true,
            create: (id, title) => filmIframe(`https://player.vimeo.com/video/${id}?autoplay=1&muted=0&controls=0&title=0&byline=0&portrait=0&badge=0&autopause=0&dnt=1`, title),
            api: null,
            connect(iframe) {
                this.api = this.api || (window.Vimeo && window.Vimeo.Player ? Promise.resolve() : loadScript('https://player.vimeo.com/api/player.js'));
                return this.api.then(() => {
                    const player = new Vimeo.Player(iframe);
                    return player.ready().then(() => ({
                        play: () => player.play(),
                        pause: () => player.pause(),
                        isPaused: () => player.getPaused(),
                        isMuted: () => player.getMuted(),
                        setMuted: (mute) => player.setMuted(mute).then(() => (mute ? null : player.setVolume(1))),
                        on: (event, fn) => player.on(event, fn),
                    }));
                });
            },
        },
        youtube: {
            name: 'YouTube',
            iframe: true,
            // Datenschutzfreundlicher Modus; enablejsapi + origin, damit die eigene Steuerung den Player bedienen kann
            create: (id, title) => filmIframe(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&rel=0&playsinline=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`, title),
            api: null,
            connect(iframe) {
                this.api = this.api || new Promise((resolve, reject) => {
                    if (window.YT && window.YT.Player) return resolve();
                    const previous = window.onYouTubeIframeAPIReady; // die API meldet sich über diesen globalen Callback
                    window.onYouTubeIframeAPIReady = () => {
                        if (typeof previous === 'function') previous();
                        resolve();
                    };
                    loadScript('https://www.youtube.com/iframe_api').catch(reject);
                });
                return this.api.then(() => new Promise(resolve => {
                    const events = filmEvents(); // Fehler/Start direkt nach onReady, bevor die Seite zuhört
                    const player = new YT.Player(iframe, {
                        events: {
                            onReady: () => resolve({
                                play: () => Promise.resolve(player.playVideo()),
                                pause: () => Promise.resolve(player.pauseVideo()),
                                isPaused: () => Promise.resolve(![YT.PlayerState.PLAYING, YT.PlayerState.BUFFERING].includes(player.getPlayerState())),
                                isMuted: () => Promise.resolve(player.isMuted()),
                                setMuted: (mute) => Promise.resolve(mute ? player.mute() : (player.unMute(), player.setVolume(100))),
                                on: events.on,
                            }),
                            onStateChange: (e) => {
                                if (e.data === YT.PlayerState.PLAYING) events.emit('play');
                                else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) events.emit('pause');
                            },
                            onError: () => events.emit('error'), // z. B. Video nicht gefunden oder Einbetten verboten
                        },
                    });
                }));
            },
        },
    };

    // hero.film: { "bunny": "VIDEO-ID" } (Host in site-content.json settings.bunny_cdn), übergangsweise { "vimeo": "ID" } oder { "youtube": "ID" }
    function filmOf(hero) {
        const entry = hero && hero.film && Object.entries(hero.film)[0];
        if (!entry) return null;
        const [provider, id] = entry;
        if (!FILM_PROVIDERS[provider] || !id) {
            console.warn(`[Hero] Film übersprungen: Anbieter "${provider}" unbekannt oder ohne ID (möglich: ${Object.keys(FILM_PROVIDERS).join(', ')})`);
            return null;
        }
        if (provider === 'bunny' && !bunnyHost()) {
            console.warn('[Hero] Film übersprungen: settings.bunny_cdn in site-content.json ist leer');
            return null;
        }
        return { provider, id: String(id) };
    }

    // Beschriftung aus Zustand + aktueller Sprache (site-content.json ui.*.player)
    function updateHeroControls() {
        const btnPlay = document.getElementById('btn-play');
        const btnSound = document.getElementById('btn-sound');
        if (!btnPlay || !btnSound) return;

        const labels = siteContent.ui[currentLang].player;
        setWords(btnPlay, heroState.paused ? labels.play : labels.pause);
        setWords(btnSound, heroState.muted ? labels.sound_on : labels.sound_off);
        btnSound.hidden = !heroState.film; // Der Teaser hat keinen Ton
        document.getElementById('hero-wrapper').classList.toggle('is-playing', !heroState.paused);
    }

    function initHeroPlayer(film, title) {
        const wrapper = document.getElementById('hero-wrapper');
        if (!wrapper) return;

        const provider = FILM_PROVIDERS[film.provider];
        const overlay = document.getElementById('hero-overlay');
        const controls = wrapper.querySelector('.hero-controls');
        const teaser = wrapper.querySelector('video');

        // Ruhezeit: läuft der Film, blendet die Steuerung nach HERO_IDLE_MS aus (.controls-idle, Dauer über Motion-Token).
        // Maus bewegen, Tippen und Tastaturfokus holen sie zurück; pausiert bleibt sie stehen.
        let idleTimer = null;
        let pointerOnControls = false; // Maus ruht auf einem Button
        let tapWoke = false; // der Tipp auf den ruhenden Film zeigt nur die Steuerung, pausiert nicht
        const keyboardOnControls = () => {
            try { return !!controls.querySelector(':focus-visible'); } catch (e) { return controls.contains(document.activeElement); }
        };
        const wake = () => {
            clearTimeout(idleTimer);
            wrapper.classList.remove('controls-idle');
            if (heroState.paused || !controls) return;
            idleTimer = setTimeout(function rest() {
                if (pointerOnControls || keyboardOnControls()) {
                    idleTimer = setTimeout(rest, HERO_IDLE_MS); // Maus oder Fokus auf der Steuerung: sichtbar lassen
                    return;
                }
                if (!heroState.paused) wrapper.classList.add('controls-idle');
            }, HERO_IDLE_MS);
        };

        const setState = (changes) => {
            const wasPaused = heroState.paused;
            Object.assign(heroState, changes);
            updateHeroControls();
            if (heroState.paused !== wasPaused) wake(); // läuft: Ruhezeit beginnt, pausiert: Steuerung bleibt
        };
        setState({ paused: true, muted: false, film: false });

        wrapper.addEventListener('pointermove', wake);
        wrapper.addEventListener('pointerdown', (e) => {
            tapWoke = e.pointerType !== 'mouse' && wrapper.classList.contains('controls-idle');
            wake();
        });
        if (controls) controls.addEventListener('focusin', wake);
        // Maus über einem Button: bei jeder Bewegung neu bestimmt (WebKit meldet kein pointerleave,
        // wenn das Wort unter der Maus gerade getauscht wurde, z. B. "ton aus" -> "ton an")
        document.addEventListener('pointermove', (e) => {
            pointerOnControls = e.pointerType === 'mouse' && !!(e.target.closest && e.target.closest('.hero-controls button'));
        });

        let playerSynced = null; // entsteht erst mit dem ersten Klick
        let connected = null; // der Player, sobald er bereit ist (Klicks rufen ihn dann direkt auf, noch in der Geste)
        let userMuted = null; // Explizite Ton-Wahl des Besuchers
        let current = null; // das Film-Element im Hero
        let muteSync = null;

        function loadFilm() {
            const el = provider.create(film.id, title);
            el.id = 'hero-player';
            el.classList.add('hero-film');
            wrapper.insertBefore(el, overlay || controls);
            current = el;
            setState({ film: true, paused: false }); // Absicht des Klicks; der tatsächliche Zustand kommt vom Player

            // Film sichtbar, sobald er läuft; der Teaser hält so lange an
            let started = false;
            const showFilm = () => {
                wrapper.classList.add('film-visible');
                if (teaser) {
                    teaser.setAttribute('data-hold', '');
                    teaser.pause();
                }
            };

            // Fallback: Steuerung des Anbieters bzw. des Browsers übernehmen, ein Tipp direkt auf das Video startet ihn
            // (API lädt nicht, Anbieter meldet einen Fehler, oder der Start wird blockiert, z. B. Ton in Safari)
            const handOver = ({ keepControls }) => {
                clearTimeout(idleTimer);
                wrapper.classList.remove('controls-idle');
                if (overlay) overlay.remove();
                if (controls && !keepControls) controls.remove();
                showFilm();
                if (!provider.iframe) el.controls = true;
                el.style.pointerEvents = 'auto';
            };

            // Eigenes Video: der Stream lädt nicht (Netz, falsche ID, hls.js fehlt) -> zurück zum Teaser, der nächste Klick versucht es neu
            const reset = () => {
                if (current !== el) return; // schon zurückgesetzt
                console.warn(`[Hero] Film nicht geladen (${provider.name}, ${film.id}), zurück zum Teaser`);
                if (connected && connected.destroy) connected.destroy();
                clearInterval(muteSync);
                el.remove();
                current = connected = playerSynced = userMuted = null;
                wrapper.classList.remove('film-visible');
                if (teaser) {
                    teaser.removeAttribute('data-hold');
                    playLoop(teaser);
                }
                setState({ paused: true, muted: false, film: false });
            };

            // Anzeige immer aus dem tatsächlichen Player-Zustand ableiten
            // (der Ton kann blockiert sein, dann startet der Film stumm)
            const syncState = (player) => Promise.all([player.isPaused(), player.isMuted()])
                .then(([paused, muted]) => setState({ paused, muted }));

            const playerReady = provider.connect(el);
            playerSynced = playerReady.then(player => syncState(player).then(() => player));
            playerSynced.catch(() => {}); // Fehler behandelt der Fallback unten

            // Vimeo/YouTube: kommt der Film nach dem Klick nicht in Gang (Start blockiert, Player wird nicht bereit, Anbieter
            // zeigt eine Meldung), übernimmt die Anzeige des Anbieters: seine Meldung bzw. ein Tipp startet ihn.
            // Den tatsächlichen Zustand prüfen, das play-Ereignis kann schon vor dem Zuhören gekommen sein
            if (provider.iframe) setTimeout(() => {
                if (started) return;
                if (!connected) {
                    handOver({ keepControls: false });
                    return;
                }
                connected.isPaused().then(paused => {
                    if (paused) handOver({ keepControls: true });
                    else showFilm();
                }).catch(() => {});
            }, IFRAME_START_MS);

            playerReady.then(player => {
                if (current !== el) return;
                connected = player;
                player.on('play', () => {
                    started = true;
                    showFilm();
                    syncState(player);
                });
                player.on('pause', () => setState({ paused: true }));
                if (provider.iframe) {
                    player.on('error', () => handOver({ keepControls: false }));
                } else {
                    player.on('error', reset);
                    player.on('blocked', () => handOver({ keepControls: false }));
                }

                // Ton-Zustand regelmäßig abgleichen und die Wahl des Besuchers wiederherstellen
                // (Vimeo stellt kurz nach dem Start still die Embed-Einstellung wieder her; YouTube meldet Ton nicht per Event)
                muteSync = setInterval(() => {
                    if (document.hidden) return;
                    player.isMuted().then(muted => {
                        if (userMuted !== null && muted !== userMuted) return player.setMuted(userMuted);
                        if (muted !== heroState.muted) setState({ muted });
                    });
                }, MUTE_SYNC_MS);
            }).catch(() => (provider.iframe ? handOver({ keepControls: false }) : reset()));
        }

        // Erster Klick lädt den Film (Start mit Ton), danach abspielen / pausieren
        const togglePlay = () => {
            if (!playerSynced) {
                loadFilm();
                return;
            }
            const wantPlay = heroState.paused; // Absicht zum Zeitpunkt des Klicks
            const toggle = (player) => (wantPlay ? player.play() : player.pause());
            (connected ? toggle(connected) : playerSynced.then(toggle)).catch(() => {});
        };

        // Der ganze Hero ist Klickfläche; der Button ist das Ziel für Tastatur und Screenreader
        if (overlay) overlay.addEventListener('click', () => {
            if (tapWoke) {
                tapWoke = false;
                return;
            }
            togglePlay();
        });
        document.getElementById('btn-play').addEventListener('click', togglePlay);

        document.getElementById('btn-sound').addEventListener('click', () => {
            if (!playerSynced) return;
            const mute = !heroState.muted;
            userMuted = mute;
            setState({ muted: mute });
            const apply = (player) => player.setMuted(mute).then(() => player.isMuted().then(muted => setState({ muted })));
            (connected ? apply(connected) : playerSynced.then(apply)).catch(() => {});
        });
    }

    // Core Functions ---
    function setLanguage(lang) {
        if (!siteContent.settings || !siteContent.settings.available_languages.includes(lang)) return;

        currentLang = lang;

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

    // Tab-Titel: "<Seite> — Tom Henkel", ohne Seite nur "Tom Henkel"
    function pageTitle(lang, name) {
        const ui = uiText && uiText.ui[lang];
        const site = (ui && ui.page_title) || 'Tom Henkel';
        return name ? `${name} — ${site}` : site;
    }

    // Navigation, Footer, Sprachknöpfe, <html lang> und Tab-Titel (ohne Seiteninhalt); läuft auch vor dem Laden der Daten
    function updateUI(lang) {
        document.documentElement.lang = lang;

        // Sprachknöpfe: aktiver Zustand sichtbar und für Screenreader (aria-pressed)
        langButtons.forEach(btn => {
            const active = btn.getAttribute('data-lang') === lang;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });

        // Allgemeine UI Texte
        const ui = uiText && uiText.ui[lang];
        if (!ui) return;

        // Navigation (das Lab bleibt durchgestrichen und ohne Link, bis es fertig ist)
        document.querySelectorAll('[data-i18n-nav]').forEach(link => {
            const text = ui.nav[link.getAttribute('data-i18n-nav')];
            if (text) setWords(link, text);
        });
        const labTitleOverlay = document.querySelector('.lab-title-overlay');
        if (labTitleOverlay) labTitleOverlay.textContent = ui.nav.lab;
        updateMenuLabel();

        // Update Footer Text
        const footerLinks = document.querySelectorAll('[data-i18n-footer]');
        footerLinks.forEach(link => {
            const key = link.getAttribute('data-i18n-footer');
            if (ui.footer && ui.footer[key]) {
                setWords(link, ui.footer[key]);
                link.setAttribute('data-text', ui.footer[key]); // Reserve space for bold hover
            }
        });
        // Kontakt: Adresse nur aus settings.contact_email (nie fest im HTML)
        const contact = document.querySelector('[data-i18n-footer="contact"]');
        if (contact && uiText.email) contact.href = `mailto:${uiText.email}`;

        // Skip-Link (erster Tab-Stopp) und unsichtbare Seitenüberschriften (About: "Über mich")
        const titles = ui.titles || {};
        document.querySelectorAll('[data-i18n-skip]').forEach(el => { if (ui.skip) el.textContent = ui.skip; });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const text = titles[el.getAttribute('data-i18n-title')];
            if (text) el.textContent = text;
        });

        // Tab-Titel (Projektseite: renderProjectDetail, braucht die Projektdaten)
        if (document.getElementById('project-list')) document.title = pageTitle(lang);
        else if (document.getElementById('about-content')) document.title = pageTitle(lang, titles.about);
        else if (document.getElementById('lab-canvas')) document.title = pageTitle(lang, titles.lab);
    }


    // --- Media-Reveal: Bilder und Videos erscheinen unscharf und werden scharf, sobald sie geladen sind (site-weit) ---
    // mediaHTML() baut das Markup, initMediaReveal() lädt; Stil in css/components/_media.scss.
    // Einfachform (Projekte): { type: "image" | "video", src, width, height, placeholder, color, focus, alt: { de, en }, poster (Video-Standbild) }
    // Handygrößen nach Dateinamen (D3, docs/projekt-baukasten.md, Export): Bild ab 1920 px -> "<name>-1280.<ext>",
    // Video über 1280 px -> "<name>-720.mp4". check:abb verlangt diese Begleitdateien, ein fehlender Kandidat bräche das Medium
    // Art Direction (About): { alt, color, eager, sources: [{ media, srcset, sizes, placeholder }], img: { srcset, sizes, width, height, placeholder } }
    // Video: stummer Loop, spielt nur im Sichtfeld; darf er nicht laufen, erscheint das Standbild
    const escapeAttr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const mediaAlt = (media, lang) => (media.alt && media.alt[lang]) || '';
    const revealInitialized = new WeakSet();
    const revealObservers = new Map(); // ein Beobachter je Wurzel (null = Viewport)

    // Breite eines Feldes über n Spalten (12er-Raster, 25px Rand, 20px Spaltenabstand); mobil immer volle Breite
    const cellSizes = (span) => `(max-width: 768px) calc(100vw - 50px), calc((100vw - 270px) * ${span} / 12 + ${(span - 1) * 20}px)`;

    // Kleine Viewports bekommen Video und Standbild in 1280 px Breite: Handys und Tablets hochkant (iPad bis 834 px).
    // Dort ist ein Medium höchstens ~900 CSS-px breit, 1280 px reichen auch bei 2x für Video (bewegt wirkt es nicht weich)
    const SMALL_MEDIA = '(max-width: 900px)';
    const smallQuery = window.matchMedia(SMALL_MEDIA);
    const VARIANT_IMAGE_MIN = 1920; // ab dieser Breite gibt es "-1280"
    const VARIANT_VIDEO_MIN = 1281; // ab dieser Breite gibt es "-720"
    const TEASER_WIDTH = 1920; // Hero-Teaser hat laut Export immer 1920×1080 (Breite steht nicht im JSON)
    const withSuffix = (src, suffix, ext) => src.replace(/(\.[a-z0-9]+)$/i, (m) => `${suffix}${ext || m}`);
    const imageVariant = (src, width) => (src && width >= VARIANT_IMAGE_MIN ? withSuffix(src, '-1280') : null);
    const videoVariant = (src, width) => (src && width >= VARIANT_VIDEO_MIN ? withSuffix(src, '-720', '.mp4') : null);
    const PORTRAIT_STILL_MEDIA = '(max-width: 768px)'; // = mobileQuery: dort füllt die Vorschau der Startseite den Bildschirm hochkant
    const stillOf = (videoSrc) => videoSrc && withSuffix(videoSrc, '', '.webp'); // Standbild = gleicher Name als .webp
    const imageSrcset = (src, width) => {
        if (!width) return src;
        const small = imageVariant(src, width);
        return `${small ? `${small} 1280w, ` : ''}${src} ${width}w`;
    };

    const mediaStyle = (media) => {
        const vars = [media.color && `--media-bg: ${media.color}`, media.focus && `--focus: ${media.focus}`].filter(Boolean);
        return vars.length ? ` style="${vars.join('; ')}"` : '';
    };

    function pictureHTML(media, lang) {
        const { img, sources = [] } = media;
        // Die winzige Vorschau steht im srcset, die echte Quelle wartet in data-srcset, bis initMediaReveal sie einsetzt
        const srcAttrs = (s) => `${s.placeholder ? `srcset="${s.placeholder}" ` : ''}data-srcset="${s.srcset}"${s.sizes ? ` sizes="${s.sizes}"` : ''}`;
        // data-optional: fehlt die Datei, fällt das Bild auf die nächste Quelle zurück (loadMedia)
        const sourceTags = sources.map(s => `<source media="${s.media}" ${srcAttrs(s)}${s.optional ? ' data-optional' : ''}>`).join('');
        const size = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : '';

        return `<picture class="media-reveal"${mediaStyle(media)}${media.eager ? ' data-eager' : ''}>${sourceTags}`
            + `<img ${srcAttrs(img)} alt="${escapeAttr(mediaAlt(media, lang))}"${size} decoding="async"${media.eager ? ' fetchpriority="high"' : ''}>`
            + `</picture>`;
    }

    function videoHTML(media) {
        // poster: 32px-Vorschau (sofort da); data-poster: Standbild, wird nur geladen, wenn der Loop nicht laufen darf
        // (data-poster-small auf kleinen Viewports). Quellen: erst die -720-Fassung für SMALL_MEDIA, dann das Original;
        // die Pfade warten in data-src, bis loadVideo sie einsetzt. Fehlt die -720-Datei, nimmt der Browser die nächste Quelle
        const poster = media.placeholder ? ` poster="${media.placeholder}"` : '';
        const still = media.poster ? ` data-poster="${media.poster}"` : '';
        const smallStill = imageVariant(media.poster, media.posterWidth || media.width);
        const small = videoVariant(media.src, media.width);
        const sources = (small ? `<source data-src="${small}" media="${SMALL_MEDIA}">` : '') + `<source data-src="${media.src}">`;
        return `<div class="media-reveal"${mediaStyle(media)}${media.eager ? ' data-eager' : ''}>`
            + `<video data-load${poster}${still}${smallStill ? ` data-poster-small="${smallStill}"` : ''} muted loop playsinline preload="none" aria-hidden="true">${sources}</video>`
            + `</div>`;
    }

    // Einfachform -> Bild bzw. Video; opts.sizes = Anzeigebreite (cellSizes), opts.eager = wichtigstes Medium beim Seitenstart,
    // opts.portrait = Hochformat-Standbild für Handys (Startseite), sonst das Bild selbst
    function mediaHTML(media, lang, opts = {}) {
        const eager = opts.eager || media.eager;
        if (media.type === 'video') return videoHTML({ ...media, eager });
        if (media.img) return pictureHTML({ ...media, eager }, lang);
        return pictureHTML({
            alt: media.alt, color: media.color, focus: media.focus, eager,
            sources: opts.portrait ? [{ media: PORTRAIT_STILL_MEDIA, srcset: opts.portrait, optional: true }] : [],
            img: {
                srcset: imageSrcset(media.src, media.width),
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
            // Optionale Quelle lädt nicht (Hochformat-Standbild fehlt): weg damit, das Bild nimmt seine eigene Quelle
            probe.decode().catch(() => { if (active.hasAttribute('data-optional')) active.remove(); }).then(swap);
        }

        wrapper.querySelectorAll('video[data-load]').forEach(video => loadVideo(video, reveal));
    }

    // --- Video-Loops: laden mit dem Media-Reveal, spielen nur sichtbar, pausieren außerhalb und im versteckten Tab ---
    const visibleLoops = new Set();
    const loopFallbacks = new WeakMap();
    let playbackObserver = null;

    // Hat das Video eine Quelle gesetzt (src am Video oder an einem <source>)?
    const hasVideoSource = (video) => !!(video.getAttribute('src') || video.querySelector('source[src]'));

    function loadVideo(video, reveal) {
        video.removeAttribute('data-load');
        const sources = [...video.querySelectorAll('source[data-src]')];

        // Standbild statt Loop (Bewegung reduzieren, Datensparen, Autoplay blockiert, Videofehler)
        let stillShown = false;
        const showStill = () => {
            if (stillShown) return;
            stillShown = true;
            visibleLoops.delete(video);
            if (playbackObserver) playbackObserver.unobserve(video);
            video.pause();
            if (hasVideoSource(video)) {
                sources.forEach(s => s.removeAttribute('src'));
                video.load(); // zurück auf das Poster
            }
            // Kleiner Viewport: das -1280-Standbild; fehlt es, das Original
            const stills = [smallQuery.matches && video.dataset.posterSmall, video.dataset.poster].filter(Boolean);
            const tryStill = (still) => {
                if (!still) return; // kein Standbild: die unscharfe Vorschau bleibt stehen
                const probe = new Image();
                probe.onload = () => {
                    video.poster = still;
                    probe.decode().catch(() => {}).then(reveal);
                };
                probe.onerror = () => tryStill(stills[stills.indexOf(still) + 1]);
                probe.src = still;
            };
            tryStill(stills[0]);
        };

        if (!autoplayAllowed()) {
            showStill();
            return;
        }
        loopFallbacks.set(video, showStill);
        video.muted = true;
        video.preload = 'auto'; // lädt jetzt, 200px bevor das Video ins Bild kommt
        video.addEventListener('loadeddata', reveal, { once: true });
        video.addEventListener('error', showStill, { once: true }); // Datei kaputt
        // Keine Quelle lädt: das melden die <source>-Elemente, die letzte erst, wenn alle davor schon gescheitert sind
        if (sources.length) sources[sources.length - 1].addEventListener('error', showStill, { once: true });
        sources.forEach(s => {
            s.src = s.dataset.src;
            s.removeAttribute('data-src');
        });
        video.load(); // Quellen neu wählen (sie standen beim Einfügen noch ohne src da)
        watchPlayback(video);
    }

    function playLoop(video) {
        if (document.hidden || video.hasAttribute('data-hold') || !hasVideoSource(video)) return;
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

    // Sofort laden, höchstens einmal je Medium (z. B. das Standbild, das die Startseite gerade zeigt)
    function revealNow(wrapper) {
        if (revealInitialized.has(wrapper)) return;
        revealInitialized.add(wrapper);
        loadMedia(wrapper);
    }

    // Nach jedem Rendern aufrufen; bereits gestartete Medien werden übersprungen.
    // data-eager (wichtigstes Bild beim Seitenstart) lädt sofort, alles andere 200px bevor es sichtbar wird.
    // observerRoot: misst den Vorlauf an einem Element statt am Viewport, für Medien in einem abgeschnittenen,
    // verschobenen Bereich (Lab-Leinwand); am Viewport würde der Rand des Bereichs den Vorlauf auf 0 kürzen.
    function initMediaReveal(scope = document, observerRoot = null) {
        scope.querySelectorAll('.media-reveal').forEach(wrapper => {
            if (revealInitialized.has(wrapper)) return;
            if (wrapper.hasAttribute('data-eager') || !('IntersectionObserver' in window)) {
                revealNow(wrapper);
                return;
            }
            revealObserverFor(observerRoot).observe(wrapper);
        });
    }

    function revealObserverFor(root) {
        if (!revealObservers.has(root)) {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    observer.unobserve(entry.target);
                    revealNow(entry.target);
                });
            }, { root, rootMargin: '200px' });
            revealObservers.set(root, observer);
        }
        return revealObservers.get(root);
    }


    // --- Home: Projektliste + Vorschau (Bild als Poster, darüber Preview-Video) ---
    // Mobil: Hochformat-Video vollflächig, die Previews wechseln automatisch.
    // Desktop: Querformat-Video des Eintrags beim Hover, in Schleife.
    const STILL_DURATION = 6000; // Standbild ohne Video (Timing der Startseite, keine Bewegung -> kein Motion-Token)
    const STALL_TIMEOUT = 8000; // Video ohne Fortschritt gilt als hängend und wird übersprungen (Timing, kein Motion-Token)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    let featuredProjects = [];
    let activePreview = -1;
    let cycleTimer;
    let hoverTimeout;
    let stallTimer;
    let stallTime = -1;
    let preload = null; // nächstes Video als Blob: { src, controller, url }
    let videoObjectURL = null; // Blob-URL, die das Vorschauvideo gerade abspielt

    const autoplayAllowed = () => !reduceMotion.matches && !saveData;
    const cycleEnabled = () => mobileQuery.matches && autoplayAllowed() && featuredProjects.length > 1;
    const nextPreviewIndex = () => (activePreview + 1) % featuredProjects.length;

    // Variante nach Seitenverhältnis des Vorschaufensters: höher als breit -> Hochformat (Handy, Tablets), sonst Querformat.
    // Querformat = der Hero-Teaser des Projekts. Fehlt eine Variante, wird die andere genommen (object-fit: cover beschneidet sie)
    // Der Teaser kommt auf kleinen Viewports als -720-Fassung (SMALL_MEDIA); lädt sie nicht, gilt ab dann das Original
    const failedVariants = new Set();
    function previewVideoSrc(p) {
        if (!p || !autoplayAllowed()) return null;
        const portraitSrc = p.preview && p.preview.portrait;
        const landscapeSrc = p.hero && p.hero.teaser;
        if (!portraitSrc && !landscapeSrc) return null;
        const visual = document.querySelector('.home-visual');
        const box = visual ? visual.getBoundingClientRect() : null;
        const portrait = box ? box.height > box.width : mobileQuery.matches;
        const src = portrait ? (portraitSrc || landscapeSrc) : (landscapeSrc || portraitSrc);
        const small = src === landscapeSrc && smallQuery.matches ? videoVariant(src, TEASER_WIDTH) : null;
        return small && !failedVariants.has(small) ? small : src;
    }

    // Hochformat-Standbild der Startseite (preview-portrait.mp4 -> preview-portrait.webp), Standbild und Poster des Loops auf dem Handy
    const portraitStill = (p) => stillOf(p.preview && p.preview.portrait);

    function scheduleNextPreview() {
        clearTimeout(cycleTimer);
        if (cycleEnabled()) cycleTimer = setTimeout(() => showPreview(nextPreviewIndex()), STILL_DURATION);
    }

    function markActivePreview() {
        document.querySelectorAll('.project-list-item').forEach((el, i) => el.classList.toggle('active', i === activePreview));
        updateStepButton();
    }

    // --- Telefon ohne automatischen Wechsel (Bewegung reduzieren, Datensparen; D13, Option C) ---
    // Kein Timer: der Besucher wechselt per Knopf "01 / 05 weiter", Tippen auf die freie Bildfläche
    // (linkes Drittel zurück, sonst weiter) oder Wischen. Listeneinträge bleiben Links.
    const stepMode = () => mobileQuery.matches && !autoplayAllowed() && featuredProjects.length > 1;
    const stepBy = (dir) => {
        if (stepMode()) showPreview((activePreview + dir + featuredProjects.length) % featuredProjects.length);
    };

    function updateStepButton() {
        const button = document.getElementById('home-step');
        if (!button) return;
        const on = stepMode() && activePreview >= 0;
        button.hidden = !on;
        document.body.classList.toggle('home-stepping', on);
        if (!on) return;
        const ui = uiText && uiText.ui[currentLang];
        const label = (ui && ui.preview && ui.preview.next) || 'weiter';
        const pad = (n) => String(n).padStart(2, '0');
        setWords(button, `${pad(activePreview + 1)} / ${pad(featuredProjects.length)} ${label}`);
    }

    function initStepControls() {
        const button = document.getElementById('home-step');
        const main = document.querySelector('.home-container');
        if (!button || !main) return;
        button.addEventListener('click', () => stepBy(1));

        // Tippen: auf main statt document, sonst meldet iOS Safari Klicks auf leere Flächen nicht
        // composedPath statt target.closest: der Knopf tauscht beim Klick seine Wort-Spans aus, das Ziel hängt dann nicht mehr im DOM
        main.addEventListener('click', (e) => {
            if (!stepMode() || e.composedPath().some(el => el.matches && el.matches('a, button, .home-list'))) return;
            stepBy(e.clientX < window.innerWidth / 3 ? -1 : 1);
        });

        // Wischen (waagerecht, mind. 40px), auch über der Liste; nicht in Navigation und Footer
        let start = null;
        document.addEventListener('touchstart', (e) => {
            const free = e.touches.length === 1 && !isMenuOpen() && !e.target.closest('.main-nav, .main-footer');
            start = stepMode() && free ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            start = null;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) stepBy(dx < 0 ? 1 : -1);
        });

        // Einstellung "Bewegung reduzieren" ändert sich: Knopf ein- oder ausblenden
        reduceMotion.addEventListener('change', updateStepButton);
    }

    // Autoplay verboten (z. B. Stromsparmodus): Standbild + Timer. Ein abgebrochenes play() (neue Quelle, pause()) zählt nicht
    const playRejected = (err) => {
        if (err && err.name === 'NotAllowedError') {
            clearTimeout(stallTimer);
            scheduleNextPreview();
        }
    };

    // Wächter: läuft der Wechsel, muss currentTime vorankommen, sonst wie bei einem Fehler weiter
    function watchStall(video) {
        clearTimeout(stallTimer);
        if (!cycleEnabled() || document.hidden) return;
        stallTime = video.currentTime;
        stallTimer = setTimeout(() => skipPreviewVideo(video), STALL_TIMEOUT);
    }

    // Fehlendes oder hängendes Video: Standbild bleibt, nach STILL_DURATION das nächste Projekt
    function skipPreviewVideo(video) {
        clearTimeout(stallTimer);
        video.pause();
        video.classList.remove('visible');
        scheduleNextPreview();
    }

    // Nächstes Video komplett als Blob vorladen (Safari/iOS ignorieren <link rel=prefetch>).
    // Nur beim automatischen Wechsel und sichtbarer Seite; reduzierte Bewegung und Datensparen sind in cycleEnabled
    function preloadNextVideo(video) {
        if (!cycleEnabled() || document.hidden || !window.fetch || !window.AbortController) return;
        const src = previewVideoSrc(featuredProjects[nextPreviewIndex()]);
        if (!src || src === video.dataset.src || (preload && preload.src === src)) return;
        discardPreload();
        const entry = { src, controller: new AbortController(), url: null };
        preload = entry;
        fetch(src, { signal: entry.controller.signal })
            .then(res => (res.ok ? res.blob() : Promise.reject(new Error(res.status))))
            .then(blob => {
                if (preload === entry) entry.url = URL.createObjectURL(blob);
            })
            .catch(() => { if (preload === entry) preload = null; }); // abgebrochen oder fehlgeschlagen: später normal laden
    }

    // Unfertigen Download abbrechen bzw. fertigen Blob freigeben
    function discardPreload() {
        if (!preload) return;
        if (preload.url) URL.revokeObjectURL(preload.url);
        else preload.controller.abort();
        preload = null;
    }

    // Beim Wechsel: fertig vorgeladenes Video als Blob-URL übernehmen, sonst null (normale Quelle). Der Rest wird verworfen
    function takePreload(src) {
        let url = null;
        if (preload && preload.src === src && preload.url) {
            url = preload.url;
            preload = null;
        }
        discardPreload();
        return url;
    }

    // Quelle setzen; data-src merkt sich den Pfad, auch wenn eine Blob-URL spielt
    function setVideoSource(video, src, url) {
        const previous = videoObjectURL;
        if (src) {
            video.src = url || src;
            video.dataset.src = src;
        } else {
            video.removeAttribute('src');
            delete video.dataset.src;
            video.load(); // den Download des vorherigen Videos wirklich beenden
        }
        videoObjectURL = url || null;
        if (previous) URL.revokeObjectURL(previous);
    }

    // Standbilder: ein gestapelter Media-Reveal-Block pro Projekt. Er lädt beim ersten Zeigen und bleibt geladen,
    // die unscharfe Vorschau erscheint also nur, solange ein Projekt noch lädt. Jeder Block lädt nur sich selbst,
    // ein spät ankommendes Bild eines älteren Projekts kann sich daher nie vor das aktuelle schieben.
    let previewSlides = [];
    let slideLayer = 0;

    function buildPreviewSlides(lang) {
        const visual = document.querySelector('.home-visual');
        if (!visual || previewSlides.length) return;
        const slides = document.createElement('div');
        slides.className = 'home-slides';
        slides.innerHTML = featuredProjects.map(p => {
            const image = p.hero && p.hero.image;
            const media = image && mediaHTML({ type: 'image', ...image, alt: null }, lang, { sizes: cellSizes(8), portrait: portraitStill(p) });
            return `<div class="home-slide">${media || ''}</div>`;
        }).join('');
        visual.insertBefore(slides, visual.firstChild);
        previewSlides = [...slides.children];
    }

    function showSlide(index) {
        const slide = previewSlides[index];
        if (!slide) return;
        const media = slide.querySelector('.media-reveal');
        if (media) revealNow(media);
        if (slide.classList.contains('is-shown') && Number(slide.style.zIndex) === slideLayer) return; // liegt schon vorne

        // Nach vorne holen und einblenden; sobald er deckt, die übrigen ausblenden
        slide.classList.remove('is-shown');
        slide.style.zIndex = ++slideLayer;
        void slide.offsetWidth; // Überblendung startet bei 0
        slide.classList.add('is-shown');

        const settle = () => {
            if (previewSlides[activePreview] !== slide) return; // inzwischen weitergewechselt
            previewSlides.forEach(other => { if (other !== slide) other.classList.remove('is-shown'); });
        };
        if (reduceMotion.matches) {
            settle();
            return;
        }
        const onEnd = (e) => {
            if (e.target !== slide || e.propertyName !== 'opacity') return; // nicht das Scharfstellen des Bildes darin
            slide.removeEventListener('transitionend', onEnd);
            settle();
        };
        slide.addEventListener('transitionend', onEnd);
    }

    function showPreview(index) {
        const video = document.getElementById('project-preview-video');
        const p = featuredProjects[index];
        if (!p) return;

        activePreview = index;
        markActivePreview();
        clearTimeout(cycleTimer);
        clearTimeout(stallTimer);
        showSlide(index);

        if (!video) return;
        const src = previewVideoSrc(p);
        const preloaded = takePreload(src);
        video.classList.remove('visible');
        if (!src) {
            video.pause();
            if (video.getAttribute('src')) setVideoSource(video, null);
            scheduleNextPreview();
            return;
        }
        video.loop = !mobileQuery.matches; // Mobil: danach das nächste Projekt
        if (video.dataset.src !== src) setVideoSource(video, src, preloaded);
        else video.currentTime = 0;
        video.play().catch(playRejected);
        watchStall(video);
    }

    function initPreviewVideo() {
        const video = document.getElementById('project-preview-video');
        if (!video || video.dataset.init) return;
        video.dataset.init = 'true';
        video.muted = true;
        initStepControls();

        // Sobald das aktuelle Video läuft, das nächste vorladen (konkurriert nicht mit dessen Start)
        video.addEventListener('playing', () => {
            video.classList.add('visible');
            preloadNextVideo(video);
        });
        video.addEventListener('error', () => {
            if (!video.getAttribute('src')) return;
            // -720-Fassung fehlt: einmal mit dem Original versuchen
            const failed = video.dataset.src;
            if (failed && /-720\.mp4$/.test(failed) && !failedVariants.has(failed)) {
                failedVariants.add(failed);
                showPreview(activePreview);
                return;
            }
            skipPreviewVideo(video);
        });
        video.addEventListener('ended', () => { if (cycleEnabled()) showPreview(nextPreviewIndex()); });
        // Fortschritt setzt den Wächter zurück
        video.addEventListener('timeupdate', () => {
            if (!video.paused && video.currentTime !== stallTime) watchStall(video);
        });

        // Versteckter Tab: pausieren, Wächter und unfertiges Vorladen stoppen, danach weiter
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                video.pause();
                clearTimeout(cycleTimer);
                clearTimeout(stallTimer);
                if (preload && !preload.url) discardPreload();
            } else if (video.getAttribute('src')) {
                video.play().catch(playRejected);
                watchStall(video);
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
                    if (p && previewVideoSrc(p) !== (video.dataset.src || null)) showPreview(activePreview);
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
            item.href = `/work/${p.id}`;
            item.className = 'project-list-item';
            item.innerHTML = `
                <span class="p-title">${data.title}</span>
                <span class="p-category">${data.category || ''}</span>
            `;

            // Desktop: Vorschau beim Hover und beim Tastaturfokus (kurz entprellt); mobil wechselt sie automatisch
            const previewOnPointer = () => {
                if (mobileQuery.matches) return;
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => { if (index !== activePreview) showPreview(index); }, 100);
            };
            item.addEventListener('mouseenter', previewOnPointer);
            item.addEventListener('focus', previewOnPointer);

            fragment.appendChild(item);
        });

        listContainer.innerHTML = '';
        listContainer.appendChild(fragment);

        // Erster Aufruf: erste Vorschau setzen. Sprachwechsel: nur die Markierung übernehmen, Standbilder und Video bleiben
        buildPreviewSlides(lang);
        initPreviewVideo();
        if (activePreview < 0) showPreview(0);
        else markActivePreview();
    }

    // --- Smooth Scroll (Lenis, selbst gehostet in js/vendor): nur Mausrad/Trackpad, Touch bleibt nativ ---
    // Die Scroll-Position bleibt nativ (Lazy-Loading, fixierte Nav/Footer, Akkordeons laufen unverändert).
    // Stärke: --scroll-settle = Zeit, bis ein Rad-Schritt zu ~95 % angekommen ist; aus bei "Bewegung reduzieren" und im Lab.
    function initSmoothScroll() {
        const settle = motionMs('--scroll-settle') / 1000;
        if (!settle || !window.Lenis || reduceMotion.matches || document.body.classList.contains('lab-page')) return;
        // Lenis dämpft pro 1/60 s um den Anteil lerp (über die Zeit gerechnet): Restweg 5 % nach settle Sekunden
        const lenis = new Lenis({ lerp: Math.min(1, Math.log(20) / (settle * 60)), smoothWheel: true, syncTouch: false });
        const raf = (time) => {
            lenis.raf(time);
            requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
    }
    initSmoothScroll();

    // HTML aus JSON-Texten entfernen (für Attribute und document.title)
    const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // --- Projektseite: Hero, Titelblock, Module aus dem Baukasten, Weitere Projekte ---
    // Module (project.blocks): media (Medien-Zeile), text, accordions. Anleitung: docs/projekt-baukasten.md
    // Fehlt eine Übersetzung, erscheint vorerst die andere Sprache (Entwürfe bleiben sichtbar)
    const localized = (field, lang) => {
        if (!field || typeof field !== 'object') return field || '';
        return field[lang] || field[lang === 'de' ? 'en' : 'de'] || '';
    };
    const cssRatio = (ratio) => {
        const m = String(ratio || '').match(/^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/);
        return m ? `${m[1]} / ${m[2]}` : null;
    };
    const warnBlock = (project, index, reason) => console.warn(`[Projekt ${project.id}] Block ${index + 1} übersprungen: ${reason}`);

    // Der Teaser nutzt das Hero-Bild als Standbild und Vorschau
    const teaserMedia = (hero) => ({
        type: 'video',
        src: hero.teaser,
        width: TEASER_WIDTH,
        poster: hero.image && hero.image.src,
        posterWidth: hero.image && hero.image.width,
        placeholder: hero.image && hero.image.placeholder,
        color: hero.image && hero.image.color,
    });
    const heroMedia = (hero) => (hero.teaser ? teaserMedia(hero) : hero.image && { type: 'image', ...hero.image });

    function heroHTML(project, lang, film) {
        const hero = project.hero || {};
        const media = heroMedia(hero);
        // Beschriftung der Buttons setzt updateHeroControls(); das Overlay macht den ganzen Hero klickbar
        const filmControls = film ? `
                <div class="hero-overlay" id="hero-overlay" aria-hidden="true"></div>
                <div class="hero-controls">
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
        return `<div class="pd-block pd-accordions" data-block="${index}">${items.map((acc, i) => `
                <details class="pd-accordion">
                    <summary><h3 class="pd-accordion-title">${localized(acc.title, lang)}</h3></summary>
                    <div class="accordion-content">${accordionMediaHTML(acc, lang, project, index, i)}<div class="accordion-text">${accordionTextHTML(acc.content, lang)}</div></div>
                </details>`).join('')}
            </div>`;
    }

    // Akkordeon-Text: { de, en } als Fließtext, oder ein Zeitverlauf als Liste [{ date: { de, en }, text: { de, en } }]
    // (D12, Option C): je Eintrag Datum über Ereignis, space-s dazwischen
    function accordionTextHTML(content, lang) {
        if (!Array.isArray(content)) return localized(content, lang);
        const entries = content.filter(entry => entry && entry.text).map(entry => `<div class="pd-timeline-entry">`
            + `<dt>${localized(entry.date, lang)}</dt><dd>${localized(entry.text, lang)}</dd></div>`).join('');
        return `<dl class="pd-timeline">${entries}</dl>`;
    }

    // Akkordeon-Medien (acc.media): oben, in voller Akkordeon-Breite und im eigenen Format, darunter der Text
    function accordionMediaHTML(acc, lang, project, index, i) {
        const cells = (Array.isArray(acc.media) ? acc.media : []).map((item, k) => {
            if (!(item && item.src && item.width && item.height)) {
                console.warn(`[Projekt ${project.id}] Block ${index + 1}, Akkordeon ${i + 1}: Medium übersprungen, es braucht "src", "width" und "height"`);
                return '';
            }
            return `<div class="accordion-media-item" data-item="${k}" style="--ratio: ${item.width} / ${item.height}">${mediaHTML(item, lang, { sizes: cellSizes(6) })}</div>`;
        }).join('');
        return cells ? `<div class="accordion-media">${cells}</div>` : '';
    }

    // Link-Modul: eine Zeile pro Link; Links zu anderen Websites öffnen im neuen Tab und tragen ↗ (Link-Standard .text-link)
    const isExternal = (href) => /^https?:\/\//.test(href) && new URL(href).origin !== location.origin;

    function linksBlockHTML(block, lang, index, project) {
        const items = (Array.isArray(block.items) ? block.items : []).filter(item => item && item.href && item.label);
        if (!items.length) {
            warnBlock(project, index, 'Links brauchen "href" und "label"');
            return '';
        }
        return `<ul class="pd-block pd-links" data-block="${index}">${items.map((item, i) => {
            const target = isExternal(item.href) ? ' target="_blank" rel="noopener"' : '';
            return `<li><a class="text-link" data-item="${i}" href="${escapeAttr(item.href)}"${target}>${localized(item.label, lang)}</a></li>`;
        }).join('')}</ul>`;
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
        links: {
            html: linksBlockHTML,
            update: (el, block, lang) => el.querySelectorAll('[data-item]').forEach(link => {
                link.innerHTML = localized(block.items.filter(item => item && item.href && item.label)[link.dataset.item].label, lang);
            }),
        },
        accordions: {
            html: accordionsBlockHTML,
            update: (el, block, lang) => el.querySelectorAll('.pd-accordion').forEach((detail, i) => {
                const acc = block.items[i];
                detail.querySelector('.pd-accordion-title').innerHTML = localized(acc.title, lang);
                detail.querySelector('.accordion-text').innerHTML = accordionTextHTML(acc.content, lang);
                detail.querySelectorAll('.accordion-media-item').forEach(cell => {
                    const img = cell.querySelector('img');
                    if (img) img.alt = mediaAlt(acc.media[cell.dataset.item], lang);
                });
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

    // Persönlicher Text am Ende jedes Projekts (project.personal: { title?, text }); ohne Text erscheint nichts
    function personalHTML(project, lang) {
        const personal = project.personal;
        if (!personal || !localized(personal.text, lang)) return '';
        const title = personal.title ? `<h3 class="pd-text-title">${localized(personal.title, lang)}</h3>` : '';
        return `<div class="pd-block pd-text pd-personal" data-personal>${title}<div class="pd-text-body">${localized(personal.text, lang)}</div></div>`;
    }

    // Karte "Weitere Projekte": Teaser als Loop, sonst das Hero-Bild (dekorativ, der Titel steht daneben)
    function projectCardHTML(p, lang) {
        const media = heroMedia(p.hero || {});
        return `
                <a href="/work/${p.id}" class="nav-item">
                    <div class="nav-media">${media ? mediaHTML({ ...media, alt: null }, lang, { sizes: cellSizes(6) }) : ''}</div>
                    <span class="nav-title">${p[lang].title}</span>
                    <span class="nav-desc">${p[lang].category || ''}</span>
                </a>`;
    }

    // Überschrift "Weitere Projekte" / "More Work" (ui.*.more.title)
    const moreTexts = (lang) => (uiText.ui[lang] && uiText.ui[lang].more) || {};

    // Projekt nicht gefunden (Seite ohne Projekt-id oder id fehlt in projects.json, z. B. veraltet generiert):
    // Poster, nach NOT_FOUND_REDIRECT zur Work-Seite (D14). Unbekannte Adressen unter /work/ bekommen online die 404.html
    const NOT_FOUND_REDIRECT = 3000; // Lesezeit, keine Bewegung -> kein Motion-Token
    let notFoundTimer = null;

    function renderNotFound(container, lang) {
        const notFound = (uiText.ui[lang].titles || {}).not_found || 'Project not found';
        const texts = stateTexts(lang).not_found;
        document.title = pageTitle(lang, notFound);
        container.removeAttribute('data-rendered-id');
        container.innerHTML = posterHTML({ word: texts.word, text: texts.text, link: texts.link, href: '/', tag: 'h1', framed: true, role: 'status' });
        container.querySelectorAll('.state-poster-word, .state-link').forEach(underlineWords);
        if (!notFoundTimer) notFoundTimer = setTimeout(() => location.replace('/'), NOT_FOUND_REDIRECT);
    }

    function renderProjectDetail(lang) {
        const container = document.getElementById('project-detail');
        if (!container) return;

        // Projekt-id steht im HTML (work/<id>.html, generiert von npm run pages); /project.html?id= leitet nur noch um
        const pid = container.dataset.project || null;
        const currentIndex = projectsData.findIndex(p => p.id === pid);
        const project = projectsData[currentIndex];

        if (!project) {
            renderNotFound(container, lang);
            return;
        }

        const content = project[lang];
        document.title = pageTitle(lang, stripTags(content.title));

        // Weitere Projekte: vorheriges und nächstes (im Kreis)
        const prevP = projectsData[(currentIndex - 1 + projectsData.length) % projectsData.length];
        const nextP = projectsData[(currentIndex + 1) % projectsData.length];
        const moreTitle = moreTexts(lang).title || '';

        // --- UPDATE MODE: Sprachwechsel tauscht nur Texte, Medien bleiben stehen (kein neuer Request) ---
        if (container.getAttribute('data-rendered-id') === pid) {
            container.querySelector('.pd-title').innerHTML = content.title;
            container.querySelector('.pd-cat').innerHTML = content.category || '';
            container.querySelector('.pd-year').innerHTML = localized(project.year, lang); // z. B. { de: "seit 2023", en: "since 2023" }
            container.querySelector('.pd-subtitle').innerHTML = content.subtitle || '';
            container.querySelectorAll('[data-block]').forEach(el => {
                const block = project.blocks[el.dataset.block];
                BLOCKS[block.type].update(el, block, lang);
            });
            const personal = container.querySelector('[data-personal]');
            if (personal) BLOCKS.text.update(personal, project.personal, lang);
            container.querySelector('.pd-footer-nav-title').innerHTML = moreTitle;
            container.querySelectorAll('.pd-footer-nav .nav-item').forEach((item, i) => {
                const p = i === 0 ? prevP : nextP;
                item.querySelector('.nav-title').innerHTML = p[lang].title;
                item.querySelector('.nav-desc').innerHTML = p[lang].category || '';
            });
            underlineAll(container);
            updateHeroControls();
            return;
        }

        // --- INITIAL RENDER MODE ---
        container.setAttribute('data-rendered-id', pid);
        const film = filmOf(project.hero);
        container.innerHTML = `
            ${heroHTML(project, lang, film)}
            <div class="pd-title-row">
                <h1 class="pd-title">${content.title}</h1>
                <h3 class="pd-meta">
                    <span class="pd-cat">${content.category || ''}</span>
                    <span class="pd-year">${localized(project.year, lang)}</span>
                </h3>
                <h2 class="pd-subtitle">${content.subtitle || ''}</h2>
            </div>
            ${blocksHTML(project, lang)}
            ${personalHTML(project, lang)}
            <h2 class="pd-footer-nav-title">${moreTitle}</h2>
            <div class="pd-footer-nav">
                ${projectCardHTML(prevP, lang)}
                ${projectCardHTML(nextP, lang)}
            </div>
        `;
        underlineAll(container);

        initAccordionAnimation();
        initMediaReveal(container);
        if (film) initHeroPlayer(film, stripTags(content.title));
    }

    function renderAbout(lang) {
        const container = document.getElementById('about-content');
        if (!container) return;

        const aboutData = siteContent.about;
        const content = aboutData[lang];
        const { contact_email: email, instagram_url: instagram } = siteContent.settings;

        // --- UPDATE MODE: Sprachwechsel tauscht nur die Texte, das Porträt bleibt stehen (kein Neuladen, kein erneutes Weichzeichnen) ---
        const section = container.querySelector('.about-section');
        if (section) {
            section.querySelector('.description').innerHTML = content.description;
            const img = section.querySelector('.about-image img');
            if (img) img.alt = mediaAlt(aboutData.portrait, lang);
            return;
        }

        // --- INITIAL RENDER MODE (hinter die unsichtbare h1) ---
        container.insertAdjacentHTML('beforeend', `
            <section class="about-section">
                <div class="about-image">${pictureHTML(aboutData.portrait, lang)}</div>
                <div class="about-text">
                    <div class="description">${content.description}</div>
                    <div class="contact-info">
                        <a class="text-link" href="mailto:${email}">${email}</a>
                        <br>
                        <a class="text-link" href="${instagram}" target="_blank" rel="noopener">Instagram</a>
                    </div>
                </div>
            </section>
        `);
        underlineAll(container);
        initMediaReveal(container);
    }

    // --- Lab: freie Leinwand. Bilder und Videos laufen über den Media-Reveal und laden erst,
    // wenn sie in die Nähe gezogen werden; die Box hat vorab ihre Größe (Breite size.w, Höhe fest oder aus dem Format) ---
    function labItemHTML(item, lang, index) {
        const content = item[lang] || {};
        const size = item.size || {};
        const isMedia = item.type === 'image' || item.type === 'video';
        if (isMedia && !(item.src && item.width && item.height)) {
            console.warn(`[Lab ${item.id}] übersprungen: ein Medium braucht "src", "width" und "height"`);
            return '';
        }
        if (!isMedia && item.type !== 'text-block') {
            console.warn(`[Lab ${item.id}] übersprungen: unbekannter Typ "${item.type}"`);
            return '';
        }

        const px = (value) => (typeof value === 'number' ? `${value}px` : value);
        const style = [
            `left: ${item.position.x}px`,
            `top: ${item.position.y}px`,
            size.w && `width: ${px(size.w)}`,
            typeof size.h === 'number' ? `height: ${size.h}px` : isMedia && `aspect-ratio: ${item.width} / ${item.height}`,
        ].filter(Boolean).join('; ');

        const inner = isMedia
            ? mediaHTML({ ...item, alt: { de: item.de && item.de.title, en: item.en && item.en.title } }, lang, { sizes: px(size.w) || '100vw' })
                + (content.title ? `<div class="lab-caption">${content.title}</div>` : '')
            : `<h3>${content.title || ''}</h3><p>${content.content || ''}</p>`;
        return `<div class="lab-item lab-item-${item.type}" data-lab-item="${index}" style="${style}">${inner}</div>`;
    }

    function renderLab(lang) {
        const canvas = document.getElementById('lab-canvas');
        if (!canvas) return;

        // --- UPDATE MODE: Sprachwechsel tauscht nur Texte, Medien bleiben stehen (kein Neuladen) ---
        if (canvas.childElementCount) {
            canvas.querySelectorAll('[data-lab-item]').forEach(el => {
                const content = labData[el.dataset.labItem][lang] || {};
                const caption = el.querySelector('.lab-caption');
                if (caption) caption.innerHTML = content.title || '';
                const img = el.querySelector('img');
                if (img) img.alt = content.title || '';
                const title = el.querySelector('h3');
                if (title) title.innerHTML = content.title || '';
                const text = el.querySelector('p');
                if (text) text.innerHTML = content.content || '';
            });
            return;
        }

        // --- INITIAL RENDER MODE ---
        canvas.innerHTML = labData.map((item, index) => labItemHTML(item, lang, index)).join('');
        // Vorlauf am Lab-Container messen: die Leinwand ist verschoben und nach außen abgeschnitten
        initMediaReveal(canvas, document.getElementById('lab-canvas-container'));
    }

    function initLabInteraction() {
        const container = document.getElementById('lab-canvas-container');
        const canvas = document.getElementById('lab-canvas');
        
        // Settings
        let position = { x: 0, y: 0 };
        let targetPosition = { x: 0, y: 0 };
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        
        // Nachgleiten über die Zeit gerechnet: pro Halbwertszeit (--glide-half-life) halbiert sich der Restweg,
        // gleich schnell bei 60 und 120 Hz; bei "Bewegung reduzieren" (0) folgt die Leinwand sofort
        const halfLife = motionMs('--glide-half-life');

        // Initial center
        position.x = (window.innerWidth / 2) - 500; // Ungefähr mittig starten (angenommen Canvas Inhalt ist um 0,0 - 1000,1000)
        position.y = (window.innerHeight / 2) - 300;
        targetPosition.x = position.x;
        targetPosition.y = position.y;

        // Animation Loop
        let lastFrame = performance.now();
        function animate(now) {
            const dt = Math.min(64, now - lastFrame); // nach einem Hänger nicht springen
            lastFrame = now;
            const k = halfLife > 0 ? 1 - Math.pow(2, -dt / halfLife) : 1;
            position.x += (targetPosition.x - position.x) * k;
            position.y += (targetPosition.y - position.y) * k;

            // Apply transform sub-pixel perfect
            canvas.style.transform = `translate3d(${position.x.toFixed(2)}px, ${position.y.toFixed(2)}px, 0)`;

            requestAnimationFrame(animate);
        }
        animate(lastFrame); // Start loop

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