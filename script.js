// ==============================================================================
// TSYP 13 AI KIOSK - CORE FRONTEND ENGINE
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

// State Variables
let currentChapterId = "GREETING";
let tourData = [];
let currentSlideIndex = 0;
let currentLang = 'en';

let audioObj = null;
let imageInterval = null;
let imageFadeTimeout = null;

let isTourMode = false;
let isTransactionActive = false;
let isListeningActive = false;
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
    
    questionInput: document.getElementById('question-input'),
    btnSendQuestion: document.getElementById('send-question-btn'),
    
    btnNext: document.getElementById('next-btn'),
    btnPrev: document.getElementById('prev-btn'),
    btnAsk: document.getElementById('ask-btn'),
    askBtnText: document.getElementById('ask-btn-text'),
    tourToggleBtn: document.getElementById('tour-toggle-btn'),
    tourToggleLabel: document.getElementById('tour-toggle-label'),
    exitBtn: document.getElementById('exit-btn'),
    
    langChips: document.querySelectorAll('.lang-chip')
};

// ================= 1. COSMIC STARFALL VISUALS =================
function initStarfall() {
    const container = document.getElementById('starfall');
    if (!container) return;
    container.innerHTML = '';
    const starCount = 65;
    
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

// Screen Transitions
function switchScreen(name) {
    Object.values(screens).forEach(s => {
        if (s) {
            s.classList.add('hidden');
            s.classList.remove('active');
        }
    });
    if (screens[name]) {
        screens[name].classList.remove('hidden');
        screens[name].classList.add('active');
    }
}

// Exit to Idle (Close / Reset)
function exitToIdle() {
    stopEverything();
    currentSlideIndex = 0;
    currentChapterId = "GREETING";
    isTourMode = false;
    exitMuseumMode();
    setButtonsState('idle');
    switchScreen('idle');
    ui.aiSubText.innerText = "Welcome to the IEEE ISSAT Sousse AI Kiosk! Select a language to begin.";
    ui.userSubContainer.classList.add('hidden');
    if (ui.questionInput) ui.questionInput.value = '';
}

if (ui.exitBtn) {
    ui.exitBtn.addEventListener('click', exitToIdle);
}

// Highlight active language chip
function updateLangChipUI(lang) {
    if (!ui.langChips) return;
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
    stopEverything();
    currentLang = lang;
    updateLangChipUI(lang);

    switchScreen('main');
    ui.aiSubText.innerText = "Connecting to AI Museum Guide...";
    ui.userSubContainer.classList.add('hidden');

    try {
        const res = await fetch(`${BACKEND_URL}/get_tour_data`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ lang: lang })
        });
        const data = await res.json();
        tourData = data.tour || [];

        currentSlideIndex = 0;
        playSlide(0, false);
    } catch(err) {
        console.error("Load Tour Error:", err);
        ui.aiSubText.innerText = "Connection error. Please try again.";
        setButtonsState('idle');
    }
}

async function quickSwitchLang(lang) {
    if (lang === currentLang) return;
    stopEverything();
    currentLang = lang;
    updateLangChipUI(lang);
    
    ui.aiSubText.innerText = "Switching language...";
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

    // Meta Information
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
        
        try {
            audioObj = new Audio(`data:audio/${format};base64,${slide.audio}`);
            
            ui.orb.classList.add('speaking');
            ui.orbStatusText.innerText = "Speaking...";
            ui.audioWave.classList.add('active');

            if (showVisuals && slide.images && slide.images.length > 0) {
                startSmartSlideshow(slide.images, audioObj);
            }

            audioObj.play().catch(e => {
                console.log("Audio autoplay prevented by browser policy:", e);
                ui.orb.classList.remove('speaking');
                ui.orbStatusText.innerText = "Ready";
                ui.audioWave.classList.remove('active');
                setButtonsState('idle');
            });

            audioObj.onerror = (e) => {
                console.error("Audio error:", e);
                ui.orb.classList.remove('speaking');
                ui.orbStatusText.innerText = "Ready";
                ui.audioWave.classList.remove('active');
                setButtonsState('idle');
            };

            audioObj.onended = () => {
                ui.orb.classList.remove('speaking');
                ui.orbStatusText.innerText = "Ready";
                ui.audioWave.classList.remove('active');
                setButtonsState('idle');
            };
        } catch(e) {
            console.error("Audio init error:", e);
            setButtonsState('idle');
        }
    } else {
        setButtonsState('idle');
    }
}

function playDynamicResponse(text, audioB64, format = 'mp3') {
    stopEverything();
    ui.aiSubText.innerText = text;

    if (audioB64) {
        setButtonsState('locked');
        try {
            audioObj = new Audio(`data:audio/${format};base64,${audioB64}`);
            
            ui.orb.classList.add('speaking');
            ui.orbStatusText.innerText = "Speaking...";
            ui.audioWave.classList.add('active');
            
            audioObj.play().catch(e => {
                console.log("Audio play prevented:", e);
                ui.orb.classList.remove('speaking');
                ui.orbStatusText.innerText = "Ready";
                ui.audioWave.classList.remove('active');
                setButtonsState('idle');
            });

            audioObj.onerror = (e) => {
                console.error("Audio error:", e);
                ui.orb.classList.remove('speaking');
                ui.orbStatusText.innerText = "Ready";
                ui.audioWave.classList.remove('active');
                setButtonsState('idle');
            };

            audioObj.onended = () => {
                ui.orb.classList.remove('speaking');
                ui.orbStatusText.innerText = "Ready";
                ui.audioWave.classList.remove('active');
                setButtonsState('idle');
            };
        } catch(e) {
            console.error("Dynamic audio init error:", e);
            setButtonsState('idle');
        }
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
            }, 350);
        }, intervalMs);
    };

    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setupCycle(audio.duration);
    } else {
        audio.onloadedmetadata = () => {
            setupCycle(audio.duration || 10);
        };
        setTimeout(() => {
            if (!imageInterval) setupCycle(10);
        }, 1200);
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
        ui.aiSubText.innerText = "Interactive Q&A Mode. Ask me any question!";
    } else {
        if (!tourData || tourData.length === 0) {
            selectLanguage(currentLang);
        } else {
            const nextIdx = currentSlideIndex === 0 ? 1 : currentSlideIndex;
            playSlide(nextIdx, true);
        }
    }
}

// ================= 4. QUESTION & INTENT ENGINE =================
// Master question handler for Speech, Topic Chips, and Text Input
function askQuestion(queryText) {
    if (!queryText || !queryText.trim()) return;
    queryText = queryText.trim();

    stopEverything(); // Immediately stop current audio
    switchScreen('main'); // Ensure main presentation & chat stage is active
    ui.userSubText.innerText = queryText;
    ui.userSubContainer.classList.remove('hidden');

    handleUserIntent(queryText);
}

async function handleUserIntent(text) {
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

        // TOUR INTENT
        if (data.mode === 'TOUR') {
            if (!tourData || tourData.length === 0) {
                await selectLanguage(currentLang);
            }
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
        setButtonsState('idle');
    }
}

// Text Input Bar Handler
function submitTextQuestion() {
    if (!ui.questionInput) return;
    const text = ui.questionInput.value;
    if (!text || !text.trim()) return;
    ui.questionInput.value = '';
    askQuestion(text);
}

if (ui.questionInput) {
    ui.questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitTextQuestion();
        }
    });
}

// ================= 5. SPEECH RECOGNITION (ANTI-ZOMBIE LOGIC) =================
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

function toggleMicClick() {
    if (isListeningActive) {
        // User clicked mic while listening -> Stop and commit
        stopListeningAndCommit();
    } else {
        // User clicked mic to start speaking
        if (audioObj) {
            audioObj.pause();
            audioObj = null;
        }
        ui.userSubText.innerText = "Listening...";
        ui.userSubContainer.classList.remove('hidden');
        startListening();
    }
}

function startListening() {
    if (!speechAvailable) {
        ui.userSubContainer.classList.remove('hidden');
        ui.userSubText.innerText = "Microphone not supported in this browser. Please type below.";
        if (ui.questionInput) ui.questionInput.focus();
        return;
    }

    try { recognition.abort(); } catch(e) {}

    setTimeout(() => {
        try {
            recognition.lang = currentLang === 'ar' ? 'ar-TN' : (currentLang === 'fr' ? 'fr-FR' : 'en-US');
            recognition.start();

            isListeningActive = true;
            setButtonsState('listening');
            ui.orb.classList.add('listening');
            ui.orbStatusText.innerText = "Listening...";
        } catch(err) {
            console.error("Mic start failed:", err);
            isListeningActive = false;
            setButtonsState('idle');
            ui.userSubText.innerText = "Tap mic to retry or type below.";
        }
    }, 60);
}

function stopListeningAndCommit() {
    isListeningActive = false;
    clearTimeout(silenceTimer);
    try { if (recognition) recognition.abort(); } catch(e) {}

    ui.orb.classList.remove('listening');
    setButtonsState('idle');

    const spokenText = ui.userSubText.innerText.replace("Listening...", "").trim();
    if (spokenText && spokenText.length > 0) {
        handleUserIntent(spokenText);
    }
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

        // Silence pause detector: 1.6s
        silenceTimer = setTimeout(() => {
            if (displayText.trim().length > 0) {
                isListeningActive = false;
                try { recognition.abort(); } catch(e) {}
                ui.orb.classList.remove('listening');
                setButtonsState('idle');
                handleUserIntent(displayText.trim());
            }
        }, 1600);
    };

    recognition.onend = () => {
        ui.orb.classList.remove('listening');
        if (isListeningActive) {
            isListeningActive = false;
            setButtonsState('idle');
        }
    };

    recognition.onerror = (e) => {
        console.warn("Recognition error:", e.error);
        isListeningActive = false;
        ui.orb.classList.remove('listening');
        setButtonsState('idle');

        if (e.error === 'not-allowed') {
            ui.userSubContainer.classList.remove('hidden');
            ui.userSubText.innerText = "Microphone access blocked. Please type in the input bar below!";
            if (ui.questionInput) ui.questionInput.focus();
        }
    };
}

// ================= 6. BUTTON STATE MANAGEMENT =================
function setButtonsState(state) {
    const isLocked = (state === 'locked');
    ui.btnNext.disabled = isLocked;
    ui.btnPrev.disabled = isLocked;
    ui.tourToggleBtn.disabled = isLocked;

    ui.btnAsk.classList.remove('listening', 'locked');

    switch(state) {
        case 'listening':
            ui.btnAsk.classList.add('listening');
            ui.askBtnText.innerText = "Stop / Send";
            break;
        case 'locked':
            ui.btnAsk.classList.add('locked');
            ui.askBtnText.innerText = "Speaking...";
            break;
        case 'idle':
            ui.askBtnText.innerText = "Ask Guide";
            break;
    }
}

// Navigation Controls
function nextSlide() {
    if (!tourData || tourData.length === 0) return;
    if (currentSlideIndex < tourData.length - 1) {
        currentSlideIndex++;
        playSlide(currentSlideIndex, true);
    } else {
        exitMuseumMode();
        playDynamicResponse(
            "That concludes our 10-year tour! Feel free to ask me anything about our branch, teams, or projects.",
            null
        );
    }
}

function prevSlide() {
    if (!tourData || tourData.length === 0) return;
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

    isListeningActive = false;
    try { if (recognition) recognition.abort(); } catch(e){}

    ui.orb.classList.remove('speaking', 'listening');
    ui.audioWave.classList.remove('active');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        exitToIdle();
        return;
    }
    if (e.target && e.target.tagName === 'INPUT') return; // Don't trigger arrows if user is typing
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
});