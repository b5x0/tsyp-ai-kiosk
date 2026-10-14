// ==============================================================================
// TSYP 13 AI KIOSK - CORE FRONTEND ENGINE
// ==============================================================================

const BACKEND_URL = window.location.origin;

// State
let currentChapterId = "GREETING";
let tourData = [];
let currentSlideIndex = 0;
let currentLang = 'en';

let audioObj = null;
let imageInterval = null;
let imageFadeTimeout = null;

let isTourMode = false;
let isTransactionActive = false;
let silenceTimer = null;

// DOM Elements
const screens = {
    idle: document.getElementById('idle-screen'),
    lang: document.getElementById('language-screen'),
    main: document.getElementById('main-screen')
};

const ui = {
    presentationArea: document.getElementById('presentation-area'),
    img: document.getElementById('presentation-img'),
    slideTitle: document.getElementById('slide-title'),
    slideSubtitle: document.getElementById('slide-subtitle'),
    chapterTag: document.getElementById('slide-chapter-tag'),
    imageIndicators: document.getElementById('image-indicators'),
    
    orb: document.getElementById('galaxy-view'),
    orbStatusText: document.getElementById('orb-status-text'),
    
    aiSubText: document.getElementById('ai-sub-text'),
    userSubText: document.getElementById('user-sub-text'),
    userSubContainer: document.getElementById('user-subtitles'),
    audioWave: document.getElementById('audio-wave'),
    
    btnNext: document.getElementById('next-btn'),
    btnPrev: document.getElementById('prev-btn'),
    btnAsk: document.getElementById('ask-btn'),
    askBtnText: document.getElementById('ask-btn-text'),
    tourToggleBtn: document.getElementById('tour-toggle-btn'),
    tourToggleLabel: document.getElementById('tour-toggle-label'),
    tourToggleIcon: document.getElementById('tour-toggle-icon'),
    exitBtn: document.getElementById('exit-btn'),
    
    langChips: document.querySelectorAll('.lang-chip')
};

// ================= 1. COSMIC STARFALL VISUALS =================
function initStarfall() {
    const container = document.getElementById('starfall');
    if (!container) return;
    container.innerHTML = '';
    const starCount = 70;
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        star.style.left = `${Math.random() * 100}%`;
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.opacity = Math.random() * 0.8 + 0.2;
        star.style.animationDuration = `${4 + Math.random() * 6}s`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(star);
    }
}
initStarfall();

// Screen Management
function switchScreen(name) {
    Object.values(screens).forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    if (screens[name]) {
        screens[name].classList.remove('hidden');
        screens[name].classList.add('active');
    }
}

document.getElementById('start-btn').addEventListener('click', () => switchScreen('lang'));
function goToIdle() {
    stopEverything();
    switchScreen('idle');
}

// Language chip highlight
function updateLangChipUI(lang) {
    ui.langChips.forEach(chip => {
        if (chip.getAttribute('data-lang') === lang) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

// ================= 2. SESSION INITIALIZATION =================
async function selectLanguage(lang) {
    if (isTransactionActive) return;
    isTransactionActive = true;
    currentLang = lang;
    updateLangChipUI(lang);

    switchScreen('main');
    ui.aiSubText.innerText = "Connecting to AI Museum Guide...";
    ui.userSubContainer.classList.add('hidden-sub');

    try {
        const res = await fetch(`${BACKEND_URL}/get_tour_data`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ lang: lang })
        });
        const data = await res.json();
        tourData = data.tour || [];
        isTransactionActive = false;

        currentSlideIndex = 0;
        playSlide(0, false);
    } catch(err) {
        console.error("Load Tour Error:", err);
        ui.aiSubText.innerText = "Connection error. Please try again.";
        isTransactionActive = false;
        setButtonsState('idle');
    }
}

async function quickSwitchLang(lang) {
    if (lang === currentLang) return;
    stopEverything();
    currentLang = lang;
    updateLangChipUI(lang);
    
    ui.aiSubText.innerText = "Changing language...";
    try {
        const res = await fetch(`${BACKEND_URL}/get_tour_data`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ lang: lang })
        });
        const data = await res.json();
        tourData = data.tour || [];
        playSlide(currentSlideIndex, isTourMode);
    } catch(e) {
        console.error(e);
    }
}

// ================= 3. PRESENTATION SLIDESHOW ENGINE =================
function playSlide(index, showVisuals = true) {
    stopEverything();

    const slide = tourData[index];
    if (!slide) return;

    currentSlideIndex = index;
    currentChapterId = slide.id || "GREETING";

    // Update Meta texts
    ui.chapterTag.innerText = `CHAPTER ${String(index + 1).padStart(2, '0')} / ${String(tourData.length).padStart(2, '0')}`;
    ui.slideTitle.innerText = slide.title || "IEEE ISSAT Sousse";
    ui.slideSubtitle.innerText = slide.subtitle || "";
    ui.aiSubText.innerText = slide.text;

    if (showVisuals && slide.images && slide.images.length > 0) {
        enterMuseumMode();
    } else {
        exitMuseumMode();
    }

    // Audio Playback
    if (slide.audio) {
        setButtonsState('locked');
        const format = slide.audio_format || 'mp3';
        audioObj = new Audio(`data:audio/${format};base64,${slide.audio}`);
        
        ui.orb.classList.add('speaking');
        ui.orbStatusText.innerText = "Speaking...";
        ui.audioWave.classList.add('active');

        if (showVisuals && slide.images && slide.images.length > 0) {
            startSmartSlideshow(slide.images, audioObj);
        }

        audioObj.play().catch(e => console.log("Autoplay policy:", e));

        audioObj.onended = () => {
            ui.orb.classList.remove('speaking');
            ui.orbStatusText.innerText = "Ready";
            ui.audioWave.classList.remove('active');

            setTimeout(() => {
                if (index === 0) {
                    // Auto-listen after greeting
                    ui.userSubText.innerText = "Say 'Start Tour' or ask a question...";
                    ui.userSubContainer.classList.remove('hidden-sub');
                    startListening();
                } else {
                    setButtonsState('idle');
                }
            }, 600);
        };
    } else {
        setButtonsState('idle');
        if (index === 0) startListening();
    }
}

function playDynamicResponse(text, audioB64, format = 'mp3') {
    stopEverything();
    ui.aiSubText.innerText = text;

    if (audioB64) {
        setButtonsState('locked');
        audioObj = new Audio(`data:audio/${format};base64,${audioB64}`);
        
        ui.orb.classList.add('speaking');
        ui.orbStatusText.innerText = "Speaking...";
        ui.audioWave.classList.add('active');
        
        audioObj.play().catch(e => console.log("Audio play error:", e));

        audioObj.onended = () => {
            ui.orb.classList.remove('speaking');
            ui.orbStatusText.innerText = "Ready";
            ui.audioWave.classList.remove('active');

            setTimeout(() => {
                setButtonsState('idle');
                if (!isTourMode) {
                    ui.userSubText.innerText = "Listening...";
                    ui.userSubContainer.classList.remove('hidden-sub');
                    startListening();
                }
            }, 600);
        };
    } else {
        setButtonsState('idle');
    }
}

function startSmartSlideshow(images, audio) {
    if (!images || images.length === 0) return;

    // Render dot indicators
    ui.imageIndicators.innerHTML = '';
    images.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.classList.add('img-dot');
        if (idx === 0) dot.classList.add('active');
        ui.imageIndicators.appendChild(dot);
    });

    ui.img.src = images[0];
    ui.img.classList.remove('fade-out');

    const updateDots = (activeIdx) => {
        const dots = ui.imageIndicators.querySelectorAll('.img-dot');
        dots.forEach((d, i) => {
            if (i === activeIdx) d.classList.add('active');
            else d.classList.remove('active');
        });
    };

    const setupCycle = (durationSec) => {
        const count = images.length;
        if (count <= 1) return;
        
        const intervalMs = Math.max(3000, (durationSec * 1000) / count);
        let currentIdx = 0;

        imageInterval = setInterval(() => {
            currentIdx = (currentIdx + 1) % count;
            ui.img.classList.add('fade-out');

            imageFadeTimeout = setTimeout(() => {
                ui.img.src = images[currentIdx];
                ui.img.classList.remove('fade-out');
                updateDots(currentIdx);
            }, 400);
        }, intervalMs);
    };

    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setupCycle(audio.duration);
    } else {
        audio.onloadedmetadata = () => {
            setupCycle(audio.duration || 12);
        };
        // Fallback timer if metadata takes long
        setTimeout(() => {
            if (!imageInterval) setupCycle(12);
        }, 1500);
    }
}

// Mode Switches
function enterMuseumMode() {
    isTourMode = true;
    ui.presentationArea.style.opacity = '1';
    ui.presentationArea.style.pointerEvents = 'auto';
    ui.orb.classList.remove('center-mode');
    
    ui.tourToggleBtn.classList.add('active');
    ui.tourToggleLabel.innerText = "Tour Mode (Active)";
}

function exitMuseumMode() {
    isTourMode = false;
    ui.presentationArea.style.opacity = '0';
    ui.presentationArea.style.pointerEvents = 'none';
    ui.orb.classList.add('center-mode');
    
    ui.tourToggleBtn.classList.remove('active');
    ui.tourToggleLabel.innerText = "Tour Mode";
}

function toggleTourMode() {
    if (isTourMode) {
        exitMuseumMode();
        ui.aiSubText.innerText = "Switched to Interactive Q&A Mode. Ask me any question!";
    } else {
        currentSlideIndex = 1;
        playSlide(1, true);
    }
}

// ================= 4. SPEECH RECOGNITION (ANTI-ZOMBIE LOGIC) =================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let speechAvailable = false;

if (SpeechRecognition) {
    try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        speechAvailable = true;
    } catch(e) {
        console.warn("Speech Recognition not supported:", e);
    }
}

if (ui.btnAsk) {
    ui.btnAsk.addEventListener('click', () => {
        if (isTransactionActive) return;
        if (!speechAvailable) {
            toggleInputModal(true);
            return;
        }
        ui.userSubText.innerText = "Listening...";
        ui.userSubContainer.classList.remove('hidden-sub');
        startListening();
    });
}

function startListening() {
    if (isTransactionActive || !speechAvailable) return;

    try { recognition.abort(); } catch(e) {}

    setTimeout(() => {
        try {
            recognition.lang = currentLang === 'ar' ? 'ar-TN' : (currentLang === 'fr' ? 'fr-FR' : 'en-US');
            recognition.start();

            setButtonsState('listening');
            ui.orb.classList.add('listening');
            ui.orbStatusText.innerText = "Listening...";
        } catch(err) {
            console.error("Mic start failed:", err);
            setButtonsState('idle');
        }
    }, 80);
}

if (recognition) {
    recognition.onresult = (event) => {
        clearTimeout(silenceTimer);

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }

        const displayText = final || interim;
        ui.userSubText.innerText = displayText;

        // 1.8 seconds pause detection
        silenceTimer = setTimeout(() => {
            if (displayText.trim().length > 0) {
                commitUserSpeech(displayText);
            }
        }, 1800);
    };

    recognition.onend = () => {
        ui.orb.classList.remove('listening');
        if (!isTransactionActive) {
            ui.orbStatusText.innerText = "Ready";
            setTimeout(() => {
                if (ui.askBtnText.innerText.includes("Listening")) {
                    setButtonsState('idle');
                }
            }, 800);
        }
    };

    recognition.onerror = (e) => {
        console.warn("Recognition event:", e.error);
        if (e.error === 'not-allowed') {
            ui.userSubText.innerText = "Microphone access blocked. Use buttons or type below.";
        }
    };
}

async function commitUserSpeech(text) {
    try { if (recognition) recognition.abort(); } catch(e) {}
    
    ui.orb.classList.remove('listening');
    if (isTransactionActive) return;
    isTransactionActive = true;

    await handleUserIntent(text);
}

// ================= 5. ROUTER & REASONING DISPATCH =================
async function handleUserIntent(text) {
    if (!text || text.trim() === "") {
        isTransactionActive = false;
        setButtonsState('idle');
        return;
    }

    ui.aiSubText.innerText = "Thinking...";
    ui.orbStatusText.innerText = "Analyzing...";
    setButtonsState('locked');

    try {
        const res = await fetch(`${BACKEND_URL}/chat_router`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                text: text,
                lang: currentLang,
                chapter: currentChapterId
            })
        });

        const data = await res.json();
        isTransactionActive = false;

        // TOUR INTENT
        if (data.mode === 'TOUR') {
            currentSlideIndex = 1;
            playSlide(1, true);
            return;
        }

        // CHAT INTENT
        if (data.response) {
            playDynamicResponse(data.response, data.audio, data.audio_format || 'mp3');
        } else {
            ui.aiSubText.innerText = "I'm ready for your next question!";
            setButtonsState('idle');
        }
    } catch(err) {
        console.error("Router error:", err);
        ui.aiSubText.innerText = "Network connection issue. Please retry.";
        isTransactionActive = false;
        setButtonsState('idle');
    }
}

// Topic Preset Queries
function askPreset(queryText) {
    if (isTransactionActive) return;
    ui.userSubText.innerText = queryText;
    ui.userSubContainer.classList.remove('hidden-sub');
    commitUserSpeech(queryText);
}

// ================= 6. BUTTON STATE MANAGEMENT =================
function setButtonsState(state) {
    const isLocked = (state === 'locked' || state === 'listening');
    ui.btnNext.disabled = isLocked;
    ui.btnPrev.disabled = isLocked;
    ui.tourToggleBtn.disabled = isLocked;

    ui.btnAsk.classList.remove('listening', 'locked');

    switch(state) {
        case 'listening':
            ui.btnAsk.classList.add('listening');
            ui.askBtnText.innerText = "Listening...";
            break;
        case 'locked':
            ui.btnAsk.classList.add('locked');
            ui.askBtnText.innerText = "...";
            break;
        case 'idle':
            ui.askBtnText.innerText = "Ask Guide";
            break;
    }
}

// Navigation Controls
function nextSlide() {
    if (isTransactionActive) return;
    if (currentSlideIndex < tourData.length - 1) {
        currentSlideIndex++;
        playSlide(currentSlideIndex, true);
    } else {
        exitMuseumMode();
        playDynamicResponse(
            "That concludes our 10-year tour! Feel free to ask me anything about our branch or projects.",
            null
        );
    }
}

function prevSlide() {
    if (isTransactionActive) return;
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        playSlide(currentSlideIndex, true);
    }
}

function stopEverything() {
    if (audioObj) {
        audioObj.pause();
        audioObj = null;
    }
    clearInterval(imageInterval);
    clearTimeout(imageFadeTimeout);
    clearTimeout(silenceTimer);

    try { if (recognition) recognition.abort(); } catch(e){}

    ui.orb.classList.remove('speaking', 'listening');
    ui.audioWave.classList.remove('active');
    isTransactionActive = false;
}

function fullReset() {
    stopEverything();
    location.reload();
}

// Manual Text Input Fallback Modal
function toggleInputModal(show) {
    const modal = document.getElementById('text-input-modal');
    if (!modal) return;
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

function sendManualQuery() {
    const input = document.getElementById('manual-input');
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    toggleInputModal(false);
    askPreset(text);
}

document.addEventListener('keydown', (e) => {
    // Arrow shortcuts for kiosk keyboard
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'Escape') toggleInputModal(false);
});