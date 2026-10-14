// ==============================================================================
// TSYP 14 AI KIOSK - UTOPIA ARCHIPELAGO ENGINE (2026)
// Built for iPad, Touch Displays & Voice-Only Live Interaction
// ==============================================================================

const BACKEND_URL = (window.location.origin && window.location.origin.startsWith('http')) 
    ? window.location.origin 
    : 'http://127.0.0.1:5005';

// Universal Web Audio Context Unlocker on First Touch/Click
let audioContextUnlocked = false;
function unlockAudioContext() {
    if (audioContextUnlocked) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') ctx.resume();
        }
        const dummy = new Audio();
        dummy.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        dummy.play().then(() => { audioContextUnlocked = true; }).catch(() => {});
    } catch(e) {}
}
window.addEventListener('click', unlockAudioContext, { once: true });
window.addEventListener('touchstart', unlockAudioContext, { once: true });

// State
let currentLang = 'en';
let islands = [];
let currentIslandIndex = 0;
let isMuted = false;
let isListening = false;
let isSpeaking = false;
let isThinking = false;
let activeAudio = null;
let mediaTimer = null;
let silenceTimer = null;

// DOM Elements
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
    
    // Voice Stage
    voiceAura: document.getElementById('voice-aura'),
    voiceIcon: document.getElementById('voice-status-icon'),
    voiceLabel: document.getElementById('voice-status-label'),
    soundwave: document.getElementById('soundwave-anim'),
    aiText: document.getElementById('ai-speech-text'),
    userBubble: document.getElementById('user-speech-bubble'),
    userText: document.getElementById('user-speech-text'),
    chipsContainer: document.getElementById('island-chips'),
    
    // Dock
    dockMapBtn: document.getElementById('dock-map-btn'),
    dockPrevBtn: document.getElementById('dock-prev-btn'),
    dockNextBtn: document.getElementById('dock-next-btn'),
    dockMicBtn: document.getElementById('dock-mic-btn'),
    dockMicIcon: document.getElementById('dock-mic-icon'),
    dockMicLabel: document.getElementById('dock-mic-label')
};

// Cosmic Background Starfall
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

// Screen Transitions
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
}

// Exit to Welcome
function exitToIdle() {
    stopEverything();
    switchScreen('idle');
    updateVoiceVisualizer('muted');
}
if (ui.exitBtn) ui.exitBtn.addEventListener('click', exitToIdle);

// Language Management
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

// Load 14 Islands from API
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

// Start Experience from Welcome Screen
async function startExperience() {
    unlockAudioContext();
    if (!islands || islands.length === 0) {
        await loadIslandsData();
    }
    // Launch directly into the interactive archipelago map!
    openArchipelagoMap();
}

// ==============================================================================
// 1. INTERACTIVE ARCHIPELAGO MAP (14 CONNECTED NODES)
// ==============================================================================
function openArchipelagoMap() {
    stopEverything();
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
                ui.svgCanvas.appendChild(line);
            }
            // Ring connection between neighbors
            if (idx > 0 && idx < islands.length - 1) {
                const nextNode = islands[idx + 1];
                const ringLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                ringLine.setAttribute('x1', `${node.x}%`);
                ringLine.setAttribute('y1', `${node.y}%`);
                ringLine.setAttribute('x2', `${nextNode.x}%`);
                ringLine.setAttribute('y2', `${nextNode.y}%`);
                ringLine.classList.add('constellation-line');
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
// 2. ISLAND STAGE VIEW & MEDIA SHOWCASE
// ==============================================================================
function dockToIsland(index) {
    if (!islands || index < 0 || index >= islands.length) return;
    
    stopEverything();
    currentIslandIndex = index;
    const island = islands[index];

    switchScreen('island');

    // Metadata
    if (ui.badge) ui.badge.innerText = island.badge || "NODE";
    if (ui.indexTag) ui.indexTag.innerText = `${String(index + 1).padStart(2, '0')} / ${String(islands.length).padStart(2, '0')}`;
    if (ui.title) ui.title.innerText = `${island.icon || ''} ${island.title}`;
    if (ui.subtitle) ui.subtitle.innerText = island.subtitle || "";
    if (ui.aiText) ui.aiText.innerText = island.text || "Welcome to this island!";

    // Hide user bubble initially
    if (ui.userBubble) ui.userBubble.classList.add('hidden');

    // Update tailored topic prompt chips
    renderIslandPromptChips(island);

    // Media Slideshow
    startMediaShowcase(island.images);

    // Play 3-5s Audio Intro
    if (island.audio) {
        playAudio(island.audio, island.audio_format || 'mp3', () => {
            // After intro completes, automatically enter Live Listening
            if (!isMuted) startLiveListening();
        });
    } else {
        if (!isMuted) startLiveListening();
    }
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

    const questions = [
        `Tell me about ${island.title}`,
        "What are the major achievements?",
        "How can I join this team?"
    ];

    questions.forEach(q => {
        const btn = document.createElement('button');
        btn.classList.add('topic-chip');
        btn.innerText = q;
        btn.onclick = () => askQuestion(q);
        ui.chipsContainer.appendChild(btn);
    });
}

// ==============================================================================
// 3. CONVERSATIONAL VOICE ENGINE (GEMINI LIVE / CHATGPT VOICE UX)
// Always-Listening + Live Mute Toggle + Instant Barge-in
// ==============================================================================
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRec) {
    try {
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event) => {
            clearTimeout(silenceTimer);
            
            // Dynamic Barge-In: if AI was speaking, halt it immediately!
            if (activeAudio) {
                activeAudio.pause();
                activeAudio = null;
            }

            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) final += event.results[i][0].transcript;
                else interim += event.results[i][0].transcript;
            }

            const speechText = (final || interim).trim();
            if (speechText) {
                if (ui.userBubble) ui.userBubble.classList.remove('hidden');
                if (ui.userText) ui.userText.innerText = speechText;
                updateVoiceVisualizer('listening');

                // 1.4s silence pause detector dispatches to AI
                silenceTimer = setTimeout(() => {
                    if (speechText.length > 0) {
                        try { recognition.abort(); } catch(e){}
                        askQuestion(speechText);
                    }
                }, 1400);
            }
        };

        recognition.onend = () => {
            isListening = false;
            // Restart automatically if still unmuted and on island stage
            if (!isMuted && !isSpeaking && !isThinking && screens.island.classList.contains('active')) {
                startLiveListening();
            }
        };

        recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e.error);
            isListening = false;
            if (e.error === 'not-allowed') {
                isMuted = true;
                updateMuteBtnUI();
                updateVoiceVisualizer('muted');
            }
        };
    } catch(e) {
        console.warn("Speech API init failed:", e);
    }
}

function startLiveListening() {
    if (isMuted || !recognition) return;
    if (isSpeaking || isThinking) return;

    try { recognition.abort(); } catch(e){}

    setTimeout(() => {
        try {
            recognition.lang = currentLang === 'ar' ? 'ar-TN' : (currentLang === 'fr' ? 'fr-FR' : 'en-US');
            recognition.start();
            isListening = true;
            updateVoiceVisualizer('listening');
        } catch(err) {
            // Already started or busy
        }
    }, 60);
}

function stopListening() {
    isListening = false;
    clearTimeout(silenceTimer);
    try { if (recognition) recognition.abort(); } catch(e){}
}

function toggleMute() {
    isMuted = !isMuted;
    updateMuteBtnUI();

    if (isMuted) {
        stopEverything();
        updateVoiceVisualizer('muted');
    } else {
        updateVoiceVisualizer('listening');
        startLiveListening();
    }
}

function updateMuteBtnUI() {
    if (!ui.dockMicBtn) return;
    if (isMuted) {
        ui.dockMicBtn.classList.add('muted');
        if (ui.dockMicIcon) ui.dockMicIcon.innerText = "🔇";
        if (ui.dockMicLabel) ui.dockMicLabel.innerText = "Muted";
    } else {
        ui.dockMicBtn.classList.remove('muted');
        if (ui.dockMicIcon) ui.dockMicIcon.innerText = "🎙️";
        if (ui.dockMicLabel) ui.dockMicLabel.innerText = "Live Voice";
    }
}

// Master Ask Question Handler
async function askQuestion(queryText) {
    if (!queryText || !queryText.trim()) return;
    queryText = queryText.trim();

    stopListening();
    if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
    }

    if (ui.userBubble) ui.userBubble.classList.remove('hidden');
    if (ui.userText) ui.userText.innerText = queryText;

    isThinking = true;
    updateVoiceVisualizer('thinking');
    if (ui.aiText) ui.aiText.innerText = "Thinking...";

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

        if (data.response) {
            if (ui.aiText) ui.aiText.innerText = data.response;
            if (data.audio) {
                playAudio(data.audio, data.audio_format || 'mp3', () => {
                    if (!isMuted) startLiveListening();
                });
            } else {
                if (!isMuted) startLiveListening();
            }
        } else {
            if (ui.aiText) ui.aiText.innerText = "I'm listening, feel free to ask me anything!";
            if (!isMuted) startLiveListening();
        }
    } catch(err) {
        console.error("Chat error:", err);
        isThinking = false;
        if (ui.aiText) ui.aiText.innerText = "Connection issue. Please ask again.";
        if (!isMuted) startLiveListening();
    }
}

// Audio Playback
function playAudio(audioB64, format, onEndCallback) {
    if (!audioB64) {
        if (onEndCallback) onEndCallback();
        return;
    }

    if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
    }

    try {
        activeAudio = new Audio(`data:audio/${format};base64,${audioB64}`);
        isSpeaking = true;
        updateVoiceVisualizer('speaking');

        activeAudio.play().catch(e => {
            console.log("Audio play prevented:", e);
            isSpeaking = false;
            updateVoiceVisualizer('listening');
            if (onEndCallback) onEndCallback();
        });

        activeAudio.onended = () => {
            isSpeaking = false;
            activeAudio = null;
            updateVoiceVisualizer('listening');
            if (onEndCallback) onEndCallback();
        };

        activeAudio.onerror = (e) => {
            console.error("Audio error:", e);
            isSpeaking = false;
            activeAudio = null;
            updateVoiceVisualizer('listening');
            if (onEndCallback) onEndCallback();
        };
    } catch(e) {
        console.error("Audio init error:", e);
        isSpeaking = false;
        if (onEndCallback) onEndCallback();
    }
}

function stopEverything() {
    stopListening();
    if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
    }
    clearInterval(mediaTimer);
    clearTimeout(silenceTimer);
    isSpeaking = false;
    isThinking = false;
}

// Visualizer State Manager
function updateVoiceVisualizer(state) {
    if (!ui.voiceAura) return;
    ui.voiceAura.classList.remove('listening', 'speaking', 'thinking', 'muted');
    if (ui.soundwave) ui.soundwave.classList.remove('active');

    switch(state) {
        case 'listening':
            ui.voiceAura.classList.add('listening');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🎙️";
            if (ui.voiceLabel) ui.voiceLabel.innerText = "Live • Listening...";
            if (ui.soundwave) ui.soundwave.classList.add('active');
            break;
        case 'speaking':
            ui.voiceAura.classList.add('speaking');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🔊";
            if (ui.voiceLabel) ui.voiceLabel.innerText = "AI Guide Speaking...";
            if (ui.soundwave) ui.soundwave.classList.add('active');
            break;
        case 'thinking':
            ui.voiceAura.classList.add('thinking');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "⚡";
            if (ui.voiceLabel) ui.voiceLabel.innerText = "Thinking...";
            break;
        case 'muted':
            ui.voiceAura.classList.add('muted');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🔇";
            if (ui.voiceLabel) ui.voiceLabel.innerText = "Voice Muted";
            break;
    }
}

// Keyboard shortcuts for Kiosk
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') exitToIdle();
    if (e.key === 'ArrowRight') nextIsland();
    if (e.key === 'ArrowLeft') prevIsland();
    if (e.key === 'm' || e.key === 'M') toggleMute();
    if (e.key === ' ') {
        e.preventDefault();
        toggleMute();
    }
});

// Auto initialize on load
loadIslandsData();