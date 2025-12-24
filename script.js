// ================= CONFIGURATION =================
const BACKEND_URL = "http://127.0.0.1:5000";

// ================= STATE =================
let currentChapterId = "GENERAL"; 
let tourData = [];      
let currentSlideIndex = -1; 
let currentLang = 'en';

let audioObj = null;    
let imageInterval = null;
let imageFadeTimeout = null;

let isTourMode = false; 

// THE SAFETY LOCKS
let isTransactionActive = false; // TRUE only when sending data to Python
let silenceTimer = null;         // Timer to detect when user stops speaking

// ================= DOM ELEMENTS =================
const screens = {
    idle: document.getElementById('idle-screen'),
    lang: document.getElementById('language-screen'),
    main: document.getElementById('main-screen')
};

const ui = {
    presentationArea: document.getElementById('presentation-area'),
    img: document.getElementById('presentation-img'),
    orb: document.getElementById('galaxy-view'),
    orbCore: document.querySelector('.orb-core'),
    aiSub: document.getElementById('ai-subtitles'),
    userSub: document.getElementById('user-subtitles'),
    nav: document.getElementById('nav-controls'),
    
    btnNext: document.getElementById('next-btn'),
    btnPrev: document.getElementById('prev-btn'),
    btnAsk: document.getElementById('ask-btn'),
    btnExit: document.getElementById('exit-btn')
};

// ================= 1. VISUALS =================
function initStarfall() {
    const container = document.getElementById('starfall');
    container.innerHTML = ''; 
    for (let i = 0; i < 60; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        star.style.left = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 3 + 1}px`; 
        star.style.height = star.style.width;
        star.style.opacity = Math.random();
        star.style.animationDuration = `${3 + Math.random() * 5}s`;
        container.appendChild(star);
    }
}
initStarfall();

document.getElementById('start-btn').addEventListener('click', () => switchScreen('lang'));

function switchScreen(name) {
    Object.values(screens).forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    screens[name].classList.remove('hidden');
    screens[name].classList.add('active');
}

// ================= 2. SESSION START =================
async function selectLanguage(lang) {
    if (isTransactionActive) return;
    isTransactionActive = true;

    currentLang = lang;
    switchScreen('main');
    ui.aiSub.innerText = "Initializing...";
    ui.userSub.classList.add('hidden-sub');
    
    try {
        const res = await fetch(`${BACKEND_URL}/get_tour_data`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ lang: lang })
        });
        const data = await res.json();
        tourData = data.tour; 
        
        isTransactionActive = false; 
        playSlide(0, false); 
        
    } catch(e) {
        console.error(e);
        ui.aiSub.innerText = "Connection Error.";
        isTransactionActive = false;
    }
}

// ================= 3. THE ENGINE =================
function playSlide(index, showVisuals = true) {
    stopEverything(); // This now calls clearUserText() automatically
    
    const slide = tourData[index];
    if (!slide) return;
    
    // 1. CAPTURE CONTEXT (Fixes "Vecna" issue)
    if (slide.id) currentChapterId = slide.id; 
    
    ui.aiSub.innerText = slide.text; 

    // VISUALS
    if (showVisuals) {
        enterMuseumMode();
    } else {
        exitMuseumMode();
    }

    // AUDIO PLAYBACK
    if (slide.audio) {
        setButtonsState('locked'); 

        audioObj = new Audio(`data:audio/wav;base64,${slide.audio}`);
        ui.orb.classList.add('speaking');
        
        if (showVisuals && slide.images.length > 0) {
            startSmartSlideshow(slide.images, audioObj);
        }

        audioObj.play().catch(e => console.log("Autoplay blocked"));
        
        audioObj.onended = () => {
            ui.orb.classList.remove('speaking');
            
            // Wait 800ms
            setTimeout(() => {
                if (index === 0) {
                    // Greeting -> Auto Listen
                    ui.userSub.innerText = "Listening...";
                    ui.userSub.classList.remove('hidden-sub');
                    startListening();
                } else {
                    // Tour -> Wait for button
                    setButtonsState('idle'); 
                }
            }, 800); 
        };
    } else {
        setButtonsState('idle');
        if (index === 0) startListening();
    }
}

function playDynamicResponse(text, audioB64) {
    stopEverything(); // This now force-kills the mic
    
    ui.aiSub.innerText = text;
    
    if (audioB64) {
        setButtonsState('locked'); 

        audioObj = new Audio(`data:audio/wav;base64,${audioB64}`);
        ui.orb.classList.add('speaking');
        audioObj.play();
        
        audioObj.onended = () => {
            ui.orb.classList.remove('speaking');
            
            setTimeout(() => {
                if (isTourMode) {
                    setButtonsState('idle'); 
                } else {
                    ui.userSub.innerText = "Listening...";
                    ui.userSub.classList.remove('hidden-sub');
                    startListening();
                }
            }, 800);
        };
    } else {
        // NO AUDIO CASE (End of Tour)
        setButtonsState('idle');
        
        if (!isTourMode) {
            setTimeout(() => {
                ui.userSub.innerText = "Listening...";
                ui.userSub.classList.remove('hidden-sub');
                // The new startListening will handle the reset
                startListening();
            }, 800);
        }
    }
}

function startSmartSlideshow(images, audioObj) {
    ui.img.src = images[0];
    ui.img.classList.remove('fade-out');

    audioObj.onloadedmetadata = () => {
        const duration = audioObj.duration;
        const imgCount = images.length;
        
        if (imgCount > 1 && duration > 0) {
            const intervalTime = (duration * 1000) / imgCount;
            let imgIdx = 0;
            
            imageInterval = setInterval(() => {
                imgIdx = (imgIdx + 1) % imgCount;
                ui.img.classList.add('fade-out');
                imageFadeTimeout = setTimeout(() => {
                    ui.img.src = images[imgIdx];
                    ui.img.classList.remove('fade-out');
                }, 500); 
            }, intervalTime);
        }
    };
}

// ================= 4. ROBUST SPEECH RECOGNITION =================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

// KEY SETTINGS FOR ROBUSTNESS
recognition.continuous = true; // KEEP LISTENING until we tell it to stop
recognition.interimResults = true; // We need this to detect silence

ui.btnAsk.addEventListener('click', () => {
    if (isTransactionActive) return;
    ui.userSub.innerText = "Listening...";
    ui.userSub.classList.remove('hidden-sub');
    startListening();
});

function startListening() {
    if (isTransactionActive) return;

    // Double-tap safety: Kill it again just in case
    try { recognition.abort(); } catch(e) {} 

    // Wait 50ms for the hardware to release, then start
    setTimeout(() => {
        try { 
            recognition.lang = currentLang === 'ar' ? 'ar-TN' : (currentLang === 'fr' ? 'fr-FR' : 'en-US');
            recognition.start(); 
            
            setButtonsState('listening');
            ui.orbCore.style.boxShadow = "0 0 50px cyan"; 
            console.log("Mic Started Successfully"); // Check Console if this appears
        } catch(e) {
            console.error("Mic Start Error:", e);
        }
    }, 100);
}
recognition.onresult = (event) => {
    // 1. CLEAR THE TIMER (User is still talking)
    clearTimeout(silenceTimer);

    // 2. BUILD TRANSCRIPT
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    const displayText = finalTranscript || interimTranscript;
    ui.userSub.innerText = `You: ${displayText}`;

    // 3. SET SILENCE TIMER (The "Wait for Pause" Logic)
    // Wait 2 seconds. If no new words come in, SEND IT.
    silenceTimer = setTimeout(() => {
        if (displayText.trim().length > 0) {
            commitUserSpeech(displayText);
        }
    }, 2000); 
};

async function commitUserSpeech(text) {
    // FIX: Use abort() instead of stop() to kill the process instantly.
    // This prevents the "Deaf Mic" issue on the next turn.
    try { recognition.abort(); } catch(e) {}
    
    ui.orbCore.style.boxShadow = "none";
    
    if (isTransactionActive) return;
    isTransactionActive = true; 

    await handleUserIntent(text);
}

recognition.onend = () => {
    // If mic stops but we are NOT sending data, it might be accidental.
    // However, continuous=true usually keeps it open.
    // We only remove the visual glow here.
    if (!isTransactionActive) {
        ui.orbCore.style.boxShadow = "none";
        // If user didn't say anything, reset buttons after a moment
        setTimeout(() => {
            if (ui.btnAsk.innerText.includes("Listening")) {
                 setButtonsState('idle'); 
                 ui.userSub.classList.add('hidden-sub');
            }
        }, 1000);
    }
};

// ================= 5. ROUTER =================
async function handleUserIntent(text) {
    // 1. Sanity Check
    if (!text || text.trim() === "" || text === "undefined") {
        console.log("Empty speech detected, ignoring.");
        isTransactionActive = false; 
        setButtonsState('idle');
        return;
    }

    ui.aiSub.innerText = "Thinking...";
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

        // === THE FIX IS HERE ===
        
        // 2. CHECK SPECIFIC MODES FIRST
        // If it is a Tour command, run it immediately. It doesn't need 'data.response'.
        if (data.mode === 'TOUR') {
            currentSlideIndex = 1; 
            playSlide(1, true); 
            return; // Exit function successfully
        }

        // 3. ERROR HANDLING (For Chat Mode)
        // If it wasn't a Tour, it MUST have a text response. If not, it's an error.
        if (data.error || !data.response) {
            console.error("Backend Error:", data.error);
            ui.aiSub.innerText = "I didn't quite catch that.";
            setButtonsState('idle');
            
            setTimeout(() => {
                if (!isTourMode) startListening();
            }, 500);
            return;
        }

        // 4. CHAT SUCCESS
        playDynamicResponse(data.response, data.audio);

    } catch (e) { 
        console.error(e);
        ui.aiSub.innerText = "Connection Error.";
        isTransactionActive = false;
        setButtonsState('idle');
    }
}

// ================= 6. BUTTON STATES =================
function setButtonsState(state) {
    ui.btnNext.disabled = false;
    ui.btnPrev.disabled = false;
    ui.btnExit.disabled = false;
    ui.btnAsk.disabled = false;
    
    switch(state) {
        case 'listening':
            ui.btnNext.disabled = true;
            ui.btnPrev.disabled = true;
            ui.btnExit.disabled = true;
            ui.btnAsk.disabled = true;
            ui.btnAsk.innerText = "👂 Listening...";
            break;
        case 'locked':
            ui.btnNext.disabled = true;
            ui.btnPrev.disabled = true;
            ui.btnExit.disabled = true;
            ui.btnAsk.disabled = true;
            ui.btnAsk.innerText = "🔒 ...";
            break;
        case 'idle':
            ui.btnAsk.innerText = "🎤 Ask Question";
            break;
    }
}

// ================= 7. HELPERS =================

function clearUserText() {
    ui.userSub.innerText = "";
    ui.userSub.classList.add('hidden-sub');
}

function enterMuseumMode() {
    isTourMode = true;
    ui.presentationArea.classList.add('active');
    ui.orb.classList.add('mini-mode');
    ui.nav.classList.remove('hidden'); 
}

function exitMuseumMode() {
    isTourMode = false;
    ui.presentationArea.classList.remove('active');
    ui.orb.classList.remove('mini-mode');
    ui.nav.classList.add('hidden');
}

function stopEverything() {
    if (audioObj) audioObj.pause();
    clearInterval(imageInterval);
    clearTimeout(imageFadeTimeout);
    clearTimeout(silenceTimer);
    
    // FIX: Force Kill the Mic
    try { recognition.abort(); } catch(e){}
    
    isTransactionActive = false;
    clearUserText(); 
}

function fullReset() {
    stopEverything();
    location.reload();
}

function nextSlide() {
    if (isTransactionActive) return;
    if (currentSlideIndex < tourData.length - 1) {
        currentSlideIndex++;
        playSlide(currentSlideIndex, true);
    } else {
        exitMuseumMode();
        playDynamicResponse("That concludes the tour. You can ask me any questions!", null);
    }
}

function prevSlide() {
    if (isTransactionActive) return;
    if (currentSlideIndex > 1) { 
        currentSlideIndex--;
        playSlide(currentSlideIndex, true);
    }
}