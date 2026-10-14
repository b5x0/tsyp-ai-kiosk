// ==============================================================================
// TSYP 14 AI KIOSK - UTOPIA ARCHIPELAGO ENGINE (2026)
// Interactive Digital Touchscreen Kiosk • No Audio / Text-Only Intelligence
// ==============================================================================

const BACKEND_URL = (window.location.origin && window.location.origin.startsWith('http')) 
    ? window.location.origin 
    : 'http://127.0.0.1:5005';

// Global Kiosk State
let currentLang = 'en';
let islands = [];
let currentIslandIndex = 0;
let isThinking = false;
let mediaTimer = null;

// DOM Elements Cache
const screens = {
    idle: document.getElementById('idle-screen'),
    map: document.getElementById('map-screen'),
    island: document.getElementById('island-screen')
};

const ui = {
    // Top Bar
    exitBtn: document.getElementById('exit-btn'),
    langChips: document.querySelectorAll('.lang-chip'),
    
    // Map View
    nodesContainer: document.getElementById('nodes-container'),
    svgCanvas: document.getElementById('constellation-svg'),
    
    // Island View
    badge: document.getElementById('island-badge'),
    indexTag: document.getElementById('island-index-tag'),
    title: document.getElementById('island-title'),
    subtitle: document.getElementById('island-subtitle'),
    img: document.getElementById('island-img'),
    indicators: document.getElementById('media-indicators'),
    
    // AI Curator Stage
    aiText: document.getElementById('ai-speech-text'),
    userBubble: document.getElementById('user-speech-bubble'),
    userText: document.getElementById('user-speech-text'),
    chipsContainer: document.getElementById('island-chips'),
    queryInput: document.getElementById('custom-query-input'),
    queryBtn: document.getElementById('submit-query-btn'),
    
    // Global Floating Dock
    dock: document.getElementById('kiosk-dock'),
    dockMapBtn: document.getElementById('dock-map-btn'),
    dockPrevBtn: document.getElementById('dock-prev-btn'),
    dockNextBtn: document.getElementById('dock-next-btn')
};

// ==============================================================================
// 1. VISUAL ATMOSPHERE & SCREEN ROUTING
// ==============================================================================

function initCosmicStars() {
    const starContainer = document.getElementById('starfall');
    if (!starContainer) return;
    starContainer.innerHTML = '';
    const totalStars = 65;
    for (let i = 0; i < totalStars; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        star.style.left = `${Math.random() * 100}%`;
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.opacity = Math.random() * 0.8 + 0.2;
        star.style.animationDuration = `${4 + Math.random() * 6}s`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        starContainer.appendChild(star);
    }
}
initCosmicStars();

function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s) {
            s.classList.add('hidden');
            s.classList.remove('active');
        }
    });
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
        screens[screenName].classList.add('active');
    }

    // Floating Dock visibility
    if (ui.dock) {
        if (screenName === 'idle') {
            ui.dock.classList.add('hidden-on-welcome');
        } else {
            ui.dock.classList.remove('hidden-on-welcome');
        }
    }
}

function exitToIdle() {
    stopTimers();
    switchScreen('idle');
    const topLangGroup = document.getElementById('top-lang-group');
    if (topLangGroup) topLangGroup.classList.add('hidden-on-welcome');
    closeLangModal();
}
if (ui.exitBtn) ui.exitBtn.addEventListener('click', exitToIdle);

// ==============================================================================
// 2. LANGUAGE MANAGEMENT & ONBOARDING
// ==============================================================================

function openLangModal() {
    requestKioskFullscreen();
    const modal = document.getElementById('lang-modal-overlay');
    if (modal) modal.classList.remove('hidden');
}

function closeLangModal() {
    const modal = document.getElementById('lang-modal-overlay');
    if (modal) modal.classList.add('hidden');
}

async function selectLanguageAndLaunch(lang) {
    currentLang = lang;

    if (ui.langChips) {
        ui.langChips.forEach(chip => {
            if (chip.getAttribute('data-lang') === lang) chip.classList.add('active');
            else chip.classList.remove('active');
        });
    }

    const topLangGroup = document.getElementById('top-lang-group');
    if (topLangGroup) topLangGroup.classList.remove('hidden-on-welcome');

    closeLangModal();
    await loadIslandsData();
    openArchipelagoMap();
}

async function setLanguage(lang) {
    if (lang === currentLang && islands.length > 0) return;
    currentLang = lang;
    
    if (ui.langChips) {
        ui.langChips.forEach(chip => {
            if (chip.getAttribute('data-lang') === lang) chip.classList.add('active');
            else chip.classList.remove('active');
        });
    }

    await loadIslandsData();

    if (screens.island && screens.island.classList.contains('active')) {
        dockToIsland(currentIslandIndex);
    }
}

async function loadIslandsData() {
    try {
        const res = await fetch(`${BACKEND_URL}/get_islands`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ lang: currentLang })
        });
        const data = await res.json();
        islands = data.islands || [];
        renderArchipelagoMap();
    } catch(err) {
        console.error("Failed to load islands data:", err);
    }
}

// ==============================================================================
// 3. ARCHIPELAGO MAP (14 CONNECTED NODES)
// ==============================================================================

function openArchipelagoMap() {
    stopTimers();
    switchScreen('map');
    renderArchipelagoMap();
}

function renderArchipelagoMap() {
    if (!ui.nodesContainer || !islands || islands.length === 0) return;

    ui.nodesContainer.innerHTML = '';
    
    // Draw SVG Constellation Connections
    if (ui.svgCanvas) {
        ui.svgCanvas.innerHTML = '';
        const coreNode = islands.find(i => i.id === 'CORE') || islands[0];
        
        islands.forEach((node, idx) => {
            if (node.id !== 'CORE') {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${coreNode.x}%`);
                line.setAttribute('y1', `${coreNode.y}%`);
                line.setAttribute('x2', `${node.x}%`);
                line.setAttribute('y2', `${node.y}%`);
                line.classList.add('constellation-line');
                line.style.animationDelay = `${idx * 60}ms`;
                ui.svgCanvas.appendChild(line);
            }
            if (idx > 0 && idx < islands.length - 1) {
                const nextNode = islands[idx + 1];
                const ringLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                ringLine.setAttribute('x1', `${node.x}%`);
                ringLine.setAttribute('y1', `${node.y}%`);
                ringLine.setAttribute('x2', `${nextNode.x}%`);
                ringLine.setAttribute('y2', `${nextNode.y}%`);
                ringLine.classList.add('constellation-line');
                ringLine.style.animationDelay = `${(idx + 1) * 75}ms`;
                ui.svgCanvas.appendChild(ringLine);
            }
        });
    }

    // Render 14 Node Cards
    islands.forEach((node, index) => {
        const card = document.createElement('div');
        card.classList.add('island-node');
        if (node.id === 'CORE') card.classList.add('core-node');
        if (index === currentIslandIndex) card.classList.add('active-node');

        card.style.left = `${node.x}%`;
        card.style.top = `${node.y}%`;
        card.style.animationDelay = `${index * 65}ms`;

        card.innerHTML = `
            <div class="node-icon-box">${node.icon || '📍'}</div>
            <div class="node-text-box">
                <span class="node-badge-tag">${node.badge || 'NODE'}</span>
                <span class="node-name">${node.title}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            dockToIsland(index);
        });

        ui.nodesContainer.appendChild(card);
    });
}

// ==============================================================================
// 4. ISLAND STAGE VIEW & MEDIA SHOWCASE
// ==============================================================================

function dockToIsland(index) {
    if (!islands || index < 0 || index >= islands.length) return;
    
    stopTimers();
    currentIslandIndex = index;
    const island = islands[index];

    switchScreen('island');

    // Metadata & Labels
    if (ui.badge) ui.badge.innerText = island.badge || "NODE";
    if (ui.indexTag) ui.indexTag.innerText = `${String(index + 1).padStart(2, '0')} / ${String(islands.length).padStart(2, '0')}`;
    if (ui.title) ui.title.innerText = `${island.icon || ''} ${island.title}`;
    if (ui.subtitle) ui.subtitle.innerText = island.subtitle || "";
    if (ui.aiText) ui.aiText.innerText = island.text || "Welcome to this island!";

    // Reset user question bubble and input
    if (ui.userBubble) ui.userBubble.classList.add('hidden');
    if (ui.userText) ui.userText.innerText = "";
    if (ui.queryInput) {
        ui.queryInput.value = "";
        const placeholders = {
            en: `Ask AI anything about ${island.title}...`,
            fr: `Posez une question sur ${island.title}...`,
            ar: `اسأل الذكاء الاصطناعي على ${island.title}...`
        };
        ui.queryInput.placeholder = placeholders[currentLang] || placeholders.en;
    }

    // Render Topic Prompt Chips
    renderIslandPromptChips(island);

    // Media Slideshow
    startMediaShowcase(island.images);
}

function nextIsland() {
    if (!islands || islands.length === 0) return;
    currentIslandIndex = (currentIslandIndex + 1) % islands.length;
    dockToIsland(currentIslandIndex);
}

function prevIsland() {
    if (!islands || islands.length === 0) return;
    currentIslandIndex = (currentIslandIndex - 1 + islands.length) % islands.length;
    dockToIsland(currentIslandIndex);
}

function startMediaShowcase(images) {
    clearInterval(mediaTimer);
    if (!ui.img || !ui.indicators) return;

    if (!images || images.length === 0) {
        ui.img.src = 'assets/icon.png';
        ui.indicators.innerHTML = '';
        return;
    }

    ui.indicators.innerHTML = '';
    images.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.classList.add('media-dot');
        if (i === 0) dot.classList.add('active');
        ui.indicators.appendChild(dot);
    });

    let activeImgIdx = 0;
    ui.img.src = images[0];

    if (images.length > 1) {
        mediaTimer = setInterval(() => {
            activeImgIdx = (activeImgIdx + 1) % images.length;
            ui.img.style.opacity = '0.3';
            setTimeout(() => {
                ui.img.src = images[activeImgIdx];
                ui.img.style.opacity = '1';
                const dots = ui.indicators.querySelectorAll('.media-dot');
                dots.forEach((d, idx) => {
                    if (idx === activeImgIdx) d.classList.add('active');
                    else d.classList.remove('active');
                });
            }, 300);
        }, 4500);
    }
}

function renderIslandPromptChips(island) {
    if (!ui.chipsContainer) return;
    ui.chipsContainer.innerHTML = '';

    const questionsByLang = {
        en: [
            `Tell me more about ${island.title}`,
            "What are your biggest achievements?",
            "How can students join this team?",
            "What events and competitions are organized?"
        ],
        fr: [
            `Parlez-moi de ${island.title}`,
            "Quels sont vos plus grands succès ?",
            "Comment rejoindre l'équipe ?",
            "Quels événements organisez-vous ?"
        ],
        ar: [
            `احكيلي أكثر على ${island.title}`,
            "شنوة أهم الإنجازات والجوائز؟",
            "كيفاش نجم نشارك معكم في النادي؟",
            "شنوة المسابقات والفعاليات اللي تنظموها؟"
        ]
    };

    const questions = questionsByLang[currentLang] || questionsByLang.en;

    questions.forEach(q => {
        const btn = document.createElement('button');
        btn.classList.add('topic-chip');
        btn.innerText = `💡 ${q}`;
        btn.onclick = () => askQuestion(q);
        ui.chipsContainer.appendChild(btn);
    });
}

// ==============================================================================
// 5. INTERACTIVE TEXT Q&A (GEMINI 2.5 FLASH ON VERTEX AI)
// ==============================================================================

function handleQuerySubmit(event) {
    if (event) event.preventDefault();
    if (!ui.queryInput) return;
    const text = ui.queryInput.value.trim();
    if (text) {
        askQuestion(text);
        ui.queryInput.value = "";
    }
}

async function askQuestion(queryText) {
    if (!queryText || !queryText.trim() || isThinking) return;
    queryText = queryText.trim();

    // Show visitor question
    if (ui.userBubble) ui.userBubble.classList.remove('hidden');
    if (ui.userText) ui.userText.innerText = queryText;

    isThinking = true;
    if (ui.queryBtn) ui.queryBtn.disabled = true;

    const thinkingLabels = {
        en: "AI is reflecting on this...",
        fr: "L'IA réfléchit...",
        ar: "جاري استحضار الإجابة من الذكاء الاصطناعي..."
    };
    if (ui.aiText) {
        ui.aiText.style.opacity = '0.5';
        ui.aiText.innerText = thinkingLabels[currentLang] || "AI is reflecting...";
    }

    try {
        const currentIsland = islands[currentIslandIndex] || {};
        const res = await fetch(`${BACKEND_URL}/chat_router`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                text: queryText,
                lang: currentLang,
                chapter: currentIsland.id || 'CORE'
            })
        });

        const data = await res.json();
        isThinking = false;
        if (ui.queryBtn) ui.queryBtn.disabled = false;

        if (ui.aiText) {
            ui.aiText.style.opacity = '1';
            ui.aiText.innerText = data.response || "No response received. Please try another question.";
        }
    } catch(err) {
        console.error("Chat query error:", err);
        isThinking = false;
        if (ui.queryBtn) ui.queryBtn.disabled = false;
        if (ui.aiText) {
            ui.aiText.style.opacity = '1';
            ui.aiText.innerText = (currentLang === 'ar')
                ? "حدث خطأ في الاتصال، تفضل عاود اسألني."
                : "Connection error. Please tap a question again.";
        }
    }
}

function stopTimers() {
    clearInterval(mediaTimer);
    isThinking = false;
}

// ==============================================================================
// 6. IPAD FULLSCREEN & TOPBAR COLLAPSE CONTROLS
// ==============================================================================

function toggleKioskFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        requestKioskFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function requestKioskFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    }
}

function toggleTopBarCollapse() {
    const topBar = document.getElementById('top-bar');
    const restoreBtn = document.getElementById('restore-bar-btn');
    if (!topBar) return;
    const isCollapsed = topBar.classList.toggle('collapsed');
    document.body.classList.toggle('topbar-hidden', isCollapsed);
    if (restoreBtn) {
        if (isCollapsed) restoreBtn.classList.remove('hidden');
        else restoreBtn.classList.add('hidden');
    }
    // Re-render map constellation lines to match resized canvas
    setTimeout(renderArchipelagoMap, 350);
}

// Keyboard shortcuts for Kiosk
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') exitToIdle();
    if (e.key === 'ArrowRight') nextIsland();
    if (e.key === 'ArrowLeft') prevIsland();
    if (e.key === 'f' || e.key === 'F') toggleKioskFullscreen();
});

// Auto-redraw constellation on rotation/resize
window.addEventListener('resize', () => {
    if (screens.map && screens.map.classList.contains('active')) {
        renderArchipelagoMap();
    }
});
window.addEventListener('orientationchange', () => {
    setTimeout(renderArchipelagoMap, 250);
});

// Auto initialize island metadata on load
loadIslandsData();