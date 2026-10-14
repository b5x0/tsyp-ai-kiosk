// ==============================================================================
// TSYP 14 AI KIOSK - UTOPIA ARCHIPELAGO ENGINE (2026)
// Built for iPad, Touch Displays & Conversational Voice Interaction
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

// Explicit Microphone Permission Request (Ensures browser mic is active)
async function requestMicPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch(e) {
            console.warn("User microphone permission prompt:", e);
            return false;
        }
    }
    return false;
}

// Global Kiosk State
let currentLang = 'en';
let islands = [];
let currentIslandIndex = 0;
let isUserMicMuted = false;
let isSpeaking = false;
let isThinking = false;
let isListening = false;
let mediaTimer = null;
let silenceTimer = null;
let audioDurationSafetyTimer = null;

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
    
    // Voice Stage
    voiceAura: document.getElementById('voice-aura'),
    voiceIcon: document.getElementById('voice-status-icon'),
    voiceLabel: document.getElementById('voice-status-label'),
    soundwave: document.getElementById('soundwave-anim'),
    aiText: document.getElementById('ai-speech-text'),
    userBubble: document.getElementById('user-speech-bubble'),
    userText: document.getElementById('user-speech-text'),
    chipsContainer: document.getElementById('island-chips'),
    
    // Global Floating Dock
    dock: document.getElementById('kiosk-dock'),
    dockMapBtn: document.getElementById('dock-map-btn'),
    dockPrevBtn: document.getElementById('dock-prev-btn'),
    dockNextBtn: document.getElementById('dock-next-btn'),
    dockMicBtn: document.getElementById('dock-mic-btn'),
    dockMicIcon: document.getElementById('dock-mic-icon'),
    dockMicLabel: document.getElementById('dock-mic-label'),
    
    // HTML5 Audio Player
    audioPlayer: document.getElementById('kiosk-audio-player')
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
    stopEverything();
    switchScreen('idle');
    const topLangGroup = document.getElementById('top-lang-group');
    if (topLangGroup) topLangGroup.classList.add('hidden-on-welcome');
    closeLangModal();
    updateVoiceVisualizer('muted');
}
if (ui.exitBtn) ui.exitBtn.addEventListener('click', exitToIdle);

// ==============================================================================
// 2. LANGUAGE MANAGEMENT & ONBOARDING
// ==============================================================================

function openLangModal() {
    unlockAudioContext();
    const modal = document.getElementById('lang-modal-overlay');
    if (modal) modal.classList.remove('hidden');
}

function closeLangModal() {
    const modal = document.getElementById('lang-modal-overlay');
    if (modal) modal.classList.add('hidden');
}

async function startExperience() {
    unlockAudioContext();
    requestMicPermission();
    openLangModal();
}

async function selectLanguageAndLaunch(lang) {
    unlockAudioContext();
    requestMicPermission();
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
    openArchipelagoMap(true);
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

function openArchipelagoMap(playWelcome = false) {
    stopEverything();
    switchScreen('map');
    renderArchipelagoMap();

    if (playWelcome && islands && islands.length > 0) {
        const coreIsland = islands.find(i => i.id === 'CORE') || islands[0];
        if (coreIsland && coreIsland.audio) {
            setTimeout(() => {
                playAudio(coreIsland.audio, coreIsland.audio_format || 'wav', () => {
                    transitionToUserTurn();
                });
            }, 600);
        }
    }
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
// 4. ISLAND STAGE VIEW & SHOWCASE
// ==============================================================================

function dockToIsland(index) {
    if (!islands || index < 0 || index >= islands.length) return;
    
    stopEverything();
    currentIslandIndex = index;
    const island = islands[index];

    switchScreen('island');

    // Metadata & Labels
    if (ui.badge) ui.badge.innerText = island.badge || "NODE";
    if (ui.indexTag) ui.indexTag.innerText = `${String(index + 1).padStart(2, '0')} / ${String(islands.length).padStart(2, '0')}`;
    if (ui.title) ui.title.innerText = `${island.icon || ''} ${island.title}`;
    if (ui.subtitle) ui.subtitle.innerText = island.subtitle || "";
    if (ui.aiText) ui.aiText.innerText = island.text || "Welcome to this island!";

    // Reset user speech bubble
    if (ui.userBubble) ui.userBubble.classList.add('hidden');
    if (ui.userText) ui.userText.innerText = "";

    // Topic Prompt Chips
    renderIslandPromptChips(island);

    // Media Slideshow
    startMediaShowcase(island.images);

    // Play 3-5s Audio Intro, then smoothly transition to visitor's turn
    if (island.audio) {
        playAudio(island.audio, island.audio_format || 'wav', () => {
            transitionToUserTurn();
        });
    } else {
        transitionToUserTurn();
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

    const questionsByLang = {
        en: [
            `Tell me more about ${island.title}`,
            "What are your biggest achievements?",
            "How can I join this team?"
        ],
        fr: [
            `Parlez-moi de ${island.title}`,
            "Quels sont vos plus grands succès ?",
            "Comment rejoindre l'équipe ?"
        ],
        ar: [
            `احكيلي أكثر على ${island.title}`,
            "شنوة أهم الإنجازات والجوائز؟",
            "كيفاش نجم نشارك معكم؟"
        ]
    };

    const questions = questionsByLang[currentLang] || questionsByLang.en;

    questions.forEach(q => {
        const btn = document.createElement('button');
        btn.classList.add('topic-chip');
        btn.innerText = q;
        btn.onclick = () => askQuestion(q);
        ui.chipsContainer.appendChild(btn);
    });
}

// ==============================================================================
// 5. AUDIO PLAYBACK & SEAMLESS TURN-TAKING ENGINE
// ==============================================================================

function b64toBlob(b64Data, contentType) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    const sliceSize = 512;
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

function playAudio(audioB64, format, onEndCallback) {
    clearTimeout(audioDurationSafetyTimer);
    
    // Stop live microphone while AI speaks to eliminate echo
    stopListening();
    
    if (!audioB64) {
        transitionToUserTurn(onEndCallback);
        return;
    }

    const audioPlayer = ui.audioPlayer || document.getElementById('kiosk-audio-player');
    if (!audioPlayer) {
        transitionToUserTurn(onEndCallback);
        return;
    }

    try {
        const mime = (format === 'wav') ? 'audio/wav' : 'audio/mp3';
        const blob = b64toBlob(audioB64, mime);
        const blobUrl = URL.createObjectURL(blob);
        
        if (audioPlayer._blobUrl) {
            URL.revokeObjectURL(audioPlayer._blobUrl);
        }
        audioPlayer._blobUrl = blobUrl;
        audioPlayer.src = blobUrl;

        isSpeaking = true;
        updateVoiceVisualizer('speaking');

        let handled = false;
        const cleanupAndFinish = () => {
            if (handled) return;
            handled = true;
            clearTimeout(audioDurationSafetyTimer);
            audioPlayer.onended = null;
            audioPlayer.onerror = null;
            transitionToUserTurn(onEndCallback);
        };

        audioPlayer.onended = cleanupAndFinish;
        audioPlayer.onerror = (e) => {
            console.warn("Audio playback error event:", e);
            cleanupAndFinish();
        };

        // Guaranteed duration safety timeout
        const estimatedSeconds = (format === 'wav') 
            ? Math.max(2.5, (blob.size - 44) / 48000)
            : Math.max(2.5, blob.size / 16000);
        const safetyTimeoutMs = Math.round((estimatedSeconds * 1000) + 1200);

        audioDurationSafetyTimer = setTimeout(() => {
            cleanupAndFinish();
        }, safetyTimeoutMs);

        audioPlayer.onloadedmetadata = () => {
            if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
                clearTimeout(audioDurationSafetyTimer);
                const exactTimeoutMs = Math.round((audioPlayer.duration * 1000) + 800);
                audioDurationSafetyTimer = setTimeout(() => {
                    cleanupAndFinish();
                }, exactTimeoutMs);
            }
        };

        audioPlayer.play().catch(err => {
            console.warn("Audio play blocked by browser policy:", err);
            cleanupAndFinish();
        });

    } catch(err) {
        console.error("Audio playback exception:", err);
        transitionToUserTurn(onEndCallback);
    }
}

// Guaranteed hand-off to the visitor
function transitionToUserTurn(callback) {
    clearTimeout(audioDurationSafetyTimer);
    const audioPlayer = ui.audioPlayer || document.getElementById('kiosk-audio-player');
    if (audioPlayer) {
        audioPlayer.pause();
    }
    isSpeaking = false;
    
    if (callback && typeof callback === 'function') {
        callback();
    }

    if (isUserMicMuted) {
        updateVoiceVisualizer('muted');
    } else {
        updateVoiceVisualizer('user-turn');
        if (screens.island.classList.contains('active') || screens.map.classList.contains('active')) {
            startLiveListening();
        }
    }
}

// Visualizer State Manager
function updateVoiceVisualizer(state) {
    if (!ui.voiceAura) return;
    ui.voiceAura.classList.remove('listening', 'user-turn', 'user-speaking', 'speaking', 'thinking', 'muted');
    if (ui.soundwave) ui.soundwave.classList.remove('active');

    const labels = {
        'speaking': {
            en: 'AI Guide Speaking...',
            fr: 'Le guide IA parle...',
            ar: 'دليل TSYP يتحدث...'
        },
        'user-turn': {
            en: 'Your Turn • Speak anytime',
            fr: 'À vous • Posez votre question',
            ar: 'تفضل • اسألني صوتياً'
        },
        'user-speaking': {
            en: 'Hearing You...',
            fr: 'Je vous écoute...',
            ar: 'أسمعك...'
        },
        'thinking': {
            en: 'AI Thinking...',
            fr: 'En réflexion...',
            ar: 'جاري التفكير...'
        },
        'muted': {
            en: 'Visitor Mic Muted (Tap Mic Live)',
            fr: 'Micro désactivé (Tapez Mic Live)',
            ar: 'تم كتم الميكروفون (اضغط لتتكلم)'
        }
    };

    const text = (labels[state] && labels[state][currentLang]) || labels[state]?.en || '';

    switch(state) {
        case 'speaking':
            ui.voiceAura.classList.add('speaking');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🔊";
            if (ui.voiceLabel) ui.voiceLabel.innerText = text;
            if (ui.soundwave) ui.soundwave.classList.add('active');
            break;

        case 'user-turn':
            ui.voiceAura.classList.add('user-turn');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🎙️";
            if (ui.voiceLabel) ui.voiceLabel.innerText = text;
            break;

        case 'user-speaking':
            ui.voiceAura.classList.add('user-speaking');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🗣️";
            if (ui.voiceLabel) ui.voiceLabel.innerText = text;
            if (ui.soundwave) ui.soundwave.classList.add('active');
            break;

        case 'thinking':
            ui.voiceAura.classList.add('thinking');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "⚡";
            if (ui.voiceLabel) ui.voiceLabel.innerText = text;
            break;

        case 'muted':
            ui.voiceAura.classList.add('muted');
            if (ui.voiceIcon) ui.voiceIcon.innerText = "🔇";
            if (ui.voiceLabel) ui.voiceLabel.innerText = text;
            break;
    }
}

// ==============================================================================
// 6. CONVERSATIONAL SPEECH RECOGNITION (WEB SPEECH API)
// ==============================================================================

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function initSpeechRecognition() {
    if (!SpeechRec) {
        console.warn("Web Speech API not supported on this browser.");
        return;
    }
    try {
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onstart = () => {
            isListening = true;
            if (!isSpeaking && !isThinking && !isUserMicMuted) {
                updateVoiceVisualizer('user-turn');
            }
        };

        recognition.onresult = (event) => {
            clearTimeout(silenceTimer);
            
            // Barge-in: if AI was speaking, halt immediately
            if (isSpeaking) {
                transitionToUserTurn();
            }

            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) final += event.results[i][0].transcript;
                else interim += event.results[i][0].transcript;
            }

            const speechText = (final || interim).trim();
            if (speechText) {
                // Immediate reactive transition to User Speaking
                updateVoiceVisualizer('user-speaking');
                if (ui.userBubble) ui.userBubble.classList.remove('hidden');
                if (ui.userText) ui.userText.innerText = speechText;

                // 1.1s silence detection triggers question submission
                silenceTimer = setTimeout(() => {
                    if (speechText.length > 0) {
                        stopListening();
                        askQuestion(speechText);
                    }
                }, 1100);
            }
        };

        recognition.onend = () => {
            isListening = false;
            // Restart automatically if user mic is unmuted and not speaking or thinking
            if (!isUserMicMuted && !isSpeaking && !isThinking && screens.island && screens.island.classList.contains('active')) {
                setTimeout(() => {
                    if (!isUserMicMuted && !isSpeaking && !isThinking) {
                        startLiveListening();
                    }
                }, 150);
            }
        };

        recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e.error);
            if (e.error === 'not-allowed') {
                isUserMicMuted = true;
                updateMuteBtnUI();
                if (!isSpeaking && !isThinking) updateVoiceVisualizer('muted');
            }
            // 'no-speech' or 'aborted' are non-fatal, onend will safely cycle
        };
    } catch(e) {
        console.warn("Speech API init failed:", e);
    }
}
initSpeechRecognition();

function startLiveListening() {
    if (isUserMicMuted) return;
    if (isSpeaking || isThinking) return;
    
    if (!recognition) {
        initSpeechRecognition();
        if (!recognition) return;
    }

    try { recognition.abort(); } catch(e){}

    setTimeout(() => {
        if (isSpeaking || isThinking || isUserMicMuted) return;
        try {
            const langMap = {
                'ar': 'ar-TN',
                'fr': 'fr-FR',
                'en': 'en-US'
            };
            recognition.lang = langMap[currentLang] || 'en-US';
            recognition.start();
            isListening = true;
            if (!isSpeaking && !isThinking) {
                updateVoiceVisualizer('user-turn');
            }
        } catch(err) {
            // Already active or starting
        }
    }, 60);
}

function stopListening() {
    isListening = false;
    clearTimeout(silenceTimer);
    try { 
        if (recognition) recognition.abort(); 
    } catch(e){}
}

// User Microphone Mute Toggle (ONLY mutes visitor microphone, NEVER AI speaker output!)
async function toggleUserMic() {
    isUserMicMuted = !isUserMicMuted;
    updateMuteBtnUI();

    if (isUserMicMuted) {
        stopListening();
        if (!isSpeaking && !isThinking) {
            updateVoiceVisualizer('muted');
        }
    } else {
        await requestMicPermission();
        if (!isSpeaking && !isThinking) {
            updateVoiceVisualizer('user-turn');
            startLiveListening();
        }
    }
}

function toggleMute() {
    toggleUserMic();
}

function updateMuteBtnUI() {
    if (!ui.dockMicBtn) return;
    if (isUserMicMuted) {
        ui.dockMicBtn.classList.add('mic-muted');
        if (ui.dockMicIcon) ui.dockMicIcon.innerText = "🔇";
        if (ui.dockMicLabel) ui.dockMicLabel.innerText = "Mic Muted";
        ui.dockMicBtn.title = "Visitor Microphone Muted (Tap to speak)";
    } else {
        ui.dockMicBtn.classList.remove('mic-muted');
        if (ui.dockMicIcon) ui.dockMicIcon.innerText = "🎙️";
        if (ui.dockMicLabel) ui.dockMicLabel.innerText = "Mic Live";
        ui.dockMicBtn.title = "Visitor Microphone Live (Listening)";
    }
}

// ==============================================================================
// 7. QUESTION DISPATCH & AI RESPONSE HANDLING
// ==============================================================================

async function askQuestion(queryText) {
    if (!queryText || !queryText.trim()) return;
    queryText = queryText.trim();

    stopListening();
    if (isSpeaking) {
        transitionToUserTurn();
    }

    if (ui.userBubble) ui.userBubble.classList.remove('hidden');
    if (ui.userText) ui.userText.innerText = queryText;

    isThinking = true;
    updateVoiceVisualizer('thinking');

    const thinkingLabels = {
        en: "Thinking...",
        fr: "En réflexion...",
        ar: "جاري التفكير..."
    };
    if (ui.aiText) ui.aiText.innerText = thinkingLabels[currentLang] || "Thinking...";

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
                playAudio(data.audio, data.audio_format || 'wav', () => {
                    transitionToUserTurn();
                });
            } else {
                transitionToUserTurn();
            }
        } else {
            const fallbackText = {
                en: "I'm listening! Feel free to ask me anything about our branch.",
                fr: "Je vous écoute ! Posez-moi vos questions sur notre branche.",
                ar: "أنا نسمع فيك! تفضل اسألني أي حاجة على فرعنا."
            };
            if (ui.aiText) ui.aiText.innerText = fallbackText[currentLang] || fallbackText.en;
            transitionToUserTurn();
        }
    } catch(err) {
        console.error("Chat error:", err);
        isThinking = false;
        if (ui.aiText) ui.aiText.innerText = (currentLang === 'ar') 
            ? "حدث خطأ في الاتصال، تفضل عاود اسألني." 
            : "Connection error. Please ask again.";
        transitionToUserTurn();
    }
}

function stopEverything() {
    stopListening();
    clearTimeout(audioDurationSafetyTimer);
    clearTimeout(silenceTimer);
    clearInterval(mediaTimer);
    const audioPlayer = ui.audioPlayer || document.getElementById('kiosk-audio-player');
    if (audioPlayer) {
        audioPlayer.pause();
    }
    isSpeaking = false;
    isThinking = false;
}

// Keyboard shortcuts for Kiosk test
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') exitToIdle();
    if (e.key === 'ArrowRight') nextIsland();
    if (e.key === 'ArrowLeft') prevIsland();
    if (e.key === 'm' || e.key === 'M') toggleUserMic();
});

// Auto initialize island metadata on load
loadIslandsData();