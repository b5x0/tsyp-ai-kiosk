import os
import io
import json
import base64
import re
import asyncio
import wave
import requests
import edge_tts
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GCP_PROJECT = os.getenv("GCP_PROJECT", "callout6")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
GCP_API_KEY = os.getenv("GCP_API_KEY")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

if CREDENTIALS_PATH and os.path.exists(CREDENTIALS_PATH):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH

app = Flask(__name__, static_folder='.')
CORS(app)

# Vertex AI LLM Client
vertex_client = None
try:
    vertex_client = genai.Client(vertexai=True, project=GCP_PROJECT, location=GCP_LOCATION)
    print(f"✅ Connected to Vertex AI on project: {GCP_PROJECT} ({GCP_LOCATION})")
except Exception as e:
    print(f"⚠️ Warning: Could not initialize Vertex AI client: {e}")

BRAIN_MODEL = "gemini-2.5-flash"
CACHE_DIR = "audio_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# ==============================================================================
# 1. 14 ARCHIPELAGO ISLANDS / NODES (TSYP 14 CONGRESS - YEAR 2026)
# Strict 3-5 Second Audio Length Policy (~10-14 words max per introductory prompt)
# ==============================================================================
TOUR_DATA = {
    "CORE": {
        "icon": "🌟",
        "title": "UTOPIA Sanctuary",
        "subtitle": "TSYP 14 Congress • 2026",
        "badge": "MAIN HUB",
        "x": 50, "y": 48, # Coordinates on Archipelago Map (% relative)
        "text_en": "Welcome to the IEEE ISSAT Sousse AI Sanctuary at TSYP 14! Tap any island to explore.",
        "text_fr": "Bienvenue au sanctuaire IA de l'IEEE ISSAT Sousse à TSYP 14 ! Touchez une île pour explorer.",
        "text_ar": "عسلامة ومرحباً بيكم في جناح IEEE ISSAT Sousse في TSYP 14! اختار أي جزيرة بش تكتشفها.",
        "images": ["assets/icon.png", "assets/slides/page_22_img_1.jpg"]
    },
    "FOUNDATION": {
        "icon": "🏛️",
        "title": "Genesis & 12 Years",
        "subtitle": "Founded 2014 • 12-Year Legacy (2026)",
        "badge": "LEGACY",
        "x": 28, "y": 28,
        "text_en": "Founded in 2014, we celebrate twelve years of transforming engineering students into world leaders.",
        "text_fr": "Fondée en 2014, notre branche célèbre douze ans d'excellence et de formation des leaders.",
        "text_ar": "تأسس فرعنا في 2014، ونحتفلو بـ 12 سنة من التميز والريادة في تكوين وتأطير المهندسين.",
        "images": ["assets/slides/page_03_img_1.jpg", "assets/slides/page_04_img_1.jpg", "assets/slides/page_05_img_1.jpg"]
    },
    "CS": {
        "icon": "💻",
        "title": "Computer Society",
        "subtitle": "Vecna Hackathon & IEEEXtreme",
        "badge": "TECHNICAL",
        "x": 72, "y": 24,
        "text_en": "Our CS Chapter hosts the high-stakes Vecna Hackathon and leads the 24-hour global IEEEXtreme.",
        "text_fr": "Notre chapitre CS organise le célèbre hackathon Vecna et brille au concours mondial IEEEXtreme.",
        "text_ar": "نادي CS مشهور بـ Vecna Hackathon ومشاركاتنا السنوية في مسابقة IEEEXtreme العالمية.",
        "images": ["assets/2.png", "assets/3.png"]
    },
    "RAS": {
        "icon": "🤖",
        "title": "Robotics & Automation",
        "subtitle": "NAO Humanoid & Innovation Days",
        "badge": "TECHNICAL",
        "x": 84, "y": 42,
        "text_en": "RAS brings robotics to life, famous for our humanoid NAO robot winning Tunisian Innovation Days!",
        "text_fr": "La RAS donne vie aux robots, avec notre humanoïde NAO primé aux Journées de l'Innovation !",
        "text_ar": "نادي RAS يحول الأفكار لروبوتات حقيقية، كيما روبوت NAO اللي ربحنا بيه الجائزة الأولى وطنياً.",
        "images": ["assets/slides/page_07_img_1.jpg", "assets/slides/page_08_img_1.jpg"]
    },
    "PES": {
        "icon": "⚡",
        "title": "Power & Energy",
        "subtitle": "Clean Grids, Wind Farms & COPX 2.0",
        "badge": "TECHNICAL",
        "x": 78, "y": 66,
        "text_en": "PES champions clean energy, organizing the COPX summit and expeditions to renewable wind farms.",
        "text_fr": "La PES mène l'énergie durable, organisant le sommet COPX et des visites de parcs éoliens.",
        "text_ar": "نادي PES يشجع الطاقة النظيفة، نظم مؤتمر COPX وعمل زيارات ميدانية لمحطات الرياح.",
        "images": ["assets/slides/page_09_img_1.jpg", "assets/slides/page_10_img_1.jpg"]
    },
    "IAS": {
        "icon": "🏭",
        "title": "Industry Applications",
        "subtitle": "Industry 4.0 & Valeo Expeditions",
        "badge": "TECHNICAL",
        "x": 62, "y": 80,
        "text_en": "IAS bridges students to Industry 4.0 with direct technical expeditions to leaders like Valeo.",
        "text_fr": "L'IAS relie les étudiants à l'Industrie 4.0 avec des immersions chez des géants comme Valeo.",
        "text_ar": "نادي IAS يربط الطلبة بسوق الشغل و Industry 4.0 وزيارات ميدانية لشركات كبرى كيما Valeo.",
        "images": ["assets/slides/page_13_img_1.jpg", "assets/4.png"]
    },
    "WIE": {
        "icon": "🌸",
        "title": "Women in Engineering",
        "subtitle": "#wielead, Artisans & Pinktober",
        "badge": "AFFINITY",
        "x": 38, "y": 80,
        "text_en": "WIE champions female leaders in STEM through #wielead and annual Pinktober cancer awareness campaigns.",
        "text_fr": "WIE valorise le leadership féminin en STEM avec #wielead et nos actions Octobre Rose.",
        "text_ar": "نادي WIE يدعم المهندسات بمبادرة #wielead، ويساند رائدات الأعمال مع حملات Pinktober للتوعية.",
        "images": ["assets/slides/page_06_img_1.jpg", "assets/slides/page_06_img_2.jpg"]
    },
    "SIGHT": {
        "icon": "🌍",
        "title": "Humanitarian Tech",
        "subtitle": "AI Gateway & Youth Scouts",
        "badge": "HUMANITARIAN",
        "x": 20, "y": 66,
        "text_en": "SIGHT uses technology for good, simplifying AI and training young scouts in hands-on robotics.",
        "text_fr": "SIGHT met la technologie au service de tous avec AI Gateway et la robotique pour les scouts.",
        "text_ar": "مجموعة SIGHT توظف التكنولوجيا للمجتمع بورشات AI Gateway وتدريب أطفال الكشافة.",
        "images": ["assets/slides/page_24_img_1.jpg", "assets/15.png"]
    },
    "COMMUNITY": {
        "icon": "🏕️",
        "title": "Campus Life & Family",
        "subtitle": "Carnival Days, Hikes & Ramadan Iftars",
        "badge": "COMMUNITY",
        "x": 16, "y": 44,
        "text_en": "More than engineering, we are a family sharing integration carnivals, mountain hikes, and Iftars.",
        "text_fr": "Plus qu'une branche, une vraie famille unie par des randonnées, carnavals et iftars conviviaux.",
        "text_ar": "أكثر من مجرد نادي، IEEE ISSAT Sousse عائلة تجمعنا خرجات الهايكينغ، أيام الإدماج، ولمة رمضان السنوية.",
        "images": ["assets/slides/page_12_img_1.jpg", "assets/slides/page_14_img_2.jpg"]
    },
    "ACHIEVEMENTS": {
        "icon": "🏆",
        "title": "TSYP Hall of Fame",
        "subtitle": "TN 2056 Winners & National Triumphs",
        "badge": "AWARDS",
        "x": 36, "y": 14,
        "text_en": "Winners of the national TN 2056 Challenge, our branch is proud of twelve years of triumphs.",
        "text_fr": "Vainqueurs du grand défi TN 2056, nous célébrons douze années de victoires nationales !",
        "text_ar": "فرعنا توج بالمرتبة الأولى في تحدي TN 2056، وديما متألقين في كل مؤتمرات TSYP.",
        "images": ["assets/slides/page_21_img_1.jpg", "assets/slides/page_18_img_1.jpg"]
    },
    "WALLE": {
        "icon": "🌱",
        "title": "WALL-E Hackathon",
        "subtitle": "AI for Gabès Ecological Crisis",
        "badge": "INITIATIVE",
        "x": 64, "y": 12,
        "text_en": "The WALL-E Hackathon uses AI and data to solve industrial pollution challenges in Gabès.",
        "text_fr": "Le Hackathon WALL-E réunit l'IA et la data pour résoudre la crise écologique à Gabès.",
        "text_ar": "هاكاثون WALL-E يوظف الـ AI والـ Data لإيجاد حلول بيئية لمشكلة التلوث في قابس.",
        "images": ["assets/hackathon.jpg", "assets/slides/page_22_img_1.jpg"]
    },
    "EXECUTIVE_BOARD": {
        "icon": "👥",
        "title": "Executive Board",
        "subtitle": "Officers, Coordinators & Leads",
        "badge": "LEADERSHIP",
        "x": 50, "y": 72,
        "text_en": "Meet our dedicated executive officers and team leads directing technical and community success.",
        "text_fr": "Rencontrez notre bureau exécutif qui pilote nos projets et coordonne nos activités.",
        "text_ar": "تعرفو على أعضاء المكتب التنفيذي اللي ينسقو في كافة أنشطة ومشاريع فرعنا بكل تفاني.",
        "images": ["assets/slides/page_22_img_1.jpg", "assets/slides/page_12_img_1.jpg"]
    },
    "GLOBAL_IEEE": {
        "icon": "🌐",
        "title": "Global IEEE Network",
        "subtitle": "Region 8 & 190+ Countries",
        "badge": "NETWORK",
        "x": 32, "y": 50,
        "text_en": "Connecting local engineering students in Sousse directly with IEEE Region 8 and global networks.",
        "text_fr": "Relier les étudiants de Sousse à la Région 8 et à la communauté mondiale de l'IEEE.",
        "text_ar": "فرعنا يربط طلبة ISSAT Sousse مباشرة بشبكة IEEE العالمية في أكثر من 190 دولة.",
        "images": ["assets/slides/page_03_img_1.jpg", "assets/slides/page_04_img_1.jpg"]
    },
    "UTOPIA_2026": {
        "icon": "🔮",
        "title": "TSYP 14 Utopia",
        "subtitle": "The Future of AI & Engineering (2026)",
        "badge": "FUTURE",
        "x": 68, "y": 50,
        "text_en": "At TSYP 14 in 2026, we explore the frontiers of ethical AI and sustainable technology.",
        "text_fr": "Au congrès TSYP 14 en 2026, nous explorons les frontières de l'IA et des technologies durables.",
        "text_ar": "في مؤتمر TSYP 14 سنة 2026، نرسمو مع بعضنا مستقبل الـ AI والهندسة المستدامة!",
        "images": ["assets/icon.png", "assets/slides/page_21_img_2.jpg"]
    }
}

CHAPTER_ORDER = list(TOUR_DATA.keys())

FULL_BRANCH_CONTEXT = """
CONTEXT & IDENTITY:
- IEEE ISSAT Sousse Student Branch (founded in 2014, celebrating 12 Years of Leadership: 2014 - 2026).
- Current Year: 2026.
- Event: TSYP 14 (Tunisian Students and Young Professionals Congress 14).
- Theme: UTOPIA (Next-Gen AI, Ecological Tech & Humanitarian Engineering).
- Motto: "Come as students, Leave as leaders".

TECHNICAL CHAPTERS & GROUPS (14 NODES):
1. CS (Computer Society): Vecna Algorithm Hackathon, IEEEXtreme 24h programming competition.
2. RAS (Robotics & Automation Society): NAO humanoid robot project (winner of 1st Edition at Tunisian Innovation Days), embedded systems.
3. PES (Power & Energy Society): Renewable energy, COPX 2.0 at ENISo, wind farm technical expeditions.
4. IAS (Industry Applications Society): Industry 4.0, corporate bridge, industrial visits to Valeo.
5. WIE (Women in Engineering Affinity): Female leadership in STEM (#wielead), Small Business Showcase, Pinktober campaigns.
6. SIGHT (Humanitarian Technology): Tech for good, AI Gateway workshops, STEM & robotics for youth scouts.
7. WALL-E Hackathon: AI and data-driven environmental challenge addressing industrial pollution in Gabès (UN SDGs 3, 11, 14, 15).
8. Achievements: National winners of the prestigious TN 2056 Challenge at TSYP 12!
9. Community: Integration carnivals, mountain hikes, international summits, annual Ramadan Iftar.
10. Executive Board: Chair, Vice-Chair, Secretary, Treasurer, Webmaster, Media, PR, HR, Logistics leads.
"""

# ==============================================================================
# 2. PHONETIC NORMALIZATION & MULTILINGUAL CONVERSATIONAL VOICE ENGINE
# ==============================================================================

PHONETIC_MAP_AR = [
    (r"\bIEEE ISSAT Sousse\b", "آي تريبل إي عيسات سوسة"),
    (r"\bIEEE\b", "آي تريبل إي"),
    (r"\bISSAT Sousse\b", "عيسات سوسة"),
    (r"\bISSATSO\b", "عيسات سوسة"),
    (r"\bISSAT\b", "عيسات"),
    (r"\bTSYP 14\b", "تي إس واي بي 14"),
    (r"\bTSYP 13\b", "تي إس واي بي 14"),
    (r"\bTSYP 12\b", "تي إس واي بي 12"),
    (r"\bTSYP\b", "تي إس واي بي"),
    (r"\bCS Chapter\b", "شابتر السي إس"),
    (r"\bCS\b", "سي إس"),
    (r"\bRAS\b", "راس"),
    (r"\bPES\b", "بي إي إس"),
    (r"\bIAS\b", "آي إيه إس"),
    (r"\bWIE\b", "دبليو آي إي"),
    (r"\b#wielead\b", "وي ليد"),
    (r"\bSIGHT\b", "سايت"),
    (r"\bUTOPIA\b", "أوتوبيا"),
    (r"\bVecna Algorithm\b", "فيكنا ألغوريثم"),
    (r"\bVecna\b", "فيكنا"),
    (r"\bIEEEXtreme\b", "آي إكستريم"),
    (r"\bNAO\b", "ناو"),
    (r"\bArduino\b", "أردوينو"),
    (r"\bEmbedded Systems\b", "أنظمة مدمجة"),
    (r"\bWorkshops\b", "ورشات"),
    (r"\bworkshops\b", "ورشات"),
    (r"\bCOPX 2\.0\b", "كوب إكس 2.0"),
    (r"\bCOPX\b", "كوب إكس"),
    (r"\bENISo\b", "إينيزو"),
    (r"\bIndustry 4\.0\b", "إندستري 4.0"),
    (r"\bValeo\b", "فاليو"),
    (r"\bPinktober\b", "بينكتوبر"),
    (r"\bAI Gateway\b", "إي آي غايتواي"),
    (r"\bSTEM\b", "ستيم"),
    (r"\bhiking\b", "هايكينغ"),
    (r"\bTN 2056 Challenge\b", "تحدي تونس 2056"),
    (r"\bTN 2056\b", "تونس 2056"),
    (r"\bWALL-E Hackathon\b", "هاكاثون وول إي"),
    (r"\bWall-E Hackathon\b", "هاكاثون وول إي"),
    (r"\bWALL-E\b", "وول إي"),
    (r"\bWall-E\b", "وول إي"),
    (r"\bHackathon\b", "هاكاثون"),
    (r"\bhackathon\b", "هاكاثون"),
    (r"\bAI\b", "ذكاء اصطناعي"),
    (r"\bIoT\b", "إنترنت الأشياء"),
    (r"\bTunisian Innovation Days\b", "تونيزيان إينوفايشن دايز")
]

def clean_for_speech(text, lang="ar"):
    """Strips markdown and normalizes acronyms so voices speak naturally without spelling characters."""
    if not text:
        return ""
    # Strip markdown symbols
    cleaned = re.sub(r"[\*\_#`]", "", text)
    if lang == "ar":
        cleaned = re.sub(r"\([A-Za-z0-9\s\-]+\)", "", cleaned)
        for pattern, replacement in PHONETIC_MAP_AR:
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    elif lang == "en":
        cleaned = re.sub(r"\bIEEE ISSAT Sousse\b", "I-triple-E ISSAT Sousse", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bIEEE\b", "I-triple-E", cleaned)
        cleaned = re.sub(r"\bISSAT Sousse\b", "Issat Sousse", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bISSATSO\b", "Issat Sousse", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bTSYP 14\b", "T-S-Y-P 14", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bTSYP\b", "T-S-Y-P", cleaned)
        cleaned = re.sub(r"\bCS\b", "Computer Society", cleaned)
        cleaned = re.sub(r"\bRAS\b", "Robotics and Automation Society", cleaned)
        cleaned = re.sub(r"\bPES\b", "Power and Energy Society", cleaned)
        cleaned = re.sub(r"\bIAS\b", "Industry Applications Society", cleaned)
        cleaned = re.sub(r"\bWIE\b", "Women in Engineering", cleaned)
        cleaned = re.sub(r"\bSIGHT\b", "Sight", cleaned)
    elif lang == "fr":
        cleaned = re.sub(r"\bl\x27IEEE ISSAT Sousse\b", "l'I triple E ISSAT Sousse", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bl\x27IEEE\b", "l'I triple E", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bIEEE\b", "I triple E", cleaned)
        cleaned = re.sub(r"\bISSAT Sousse\b", "Issat Sousse", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bISSATSO\b", "Issat Sousse", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bTSYP 14\b", "T-S-Y-P 14", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bTSYP\b", "T-S-Y-P", cleaned)
        cleaned = re.sub(r"\bCS\b", "Computer Society", cleaned)
        cleaned = re.sub(r"\bRAS\b", "R-A-S", cleaned)
        cleaned = re.sub(r"\bPES\b", "P-E-S", cleaned)
        cleaned = re.sub(r"\bIAS\b", "I-A-S", cleaned)
        cleaned = re.sub(r"\bWIE\b", "W-I-E", cleaned)
        cleaned = re.sub(r"\bSIGHT\b", "Sight", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()

VOICE_CONFIG = {
    "ar": "ar-TN-HediNeural",
    "en": "en-US-AndrewMultilingualNeural",
    "fr": "fr-FR-VivienneMultilingualNeural"
}

def synthesize_neural_voice(text, lang_suffix="en"):
    """Synthesizes high-fidelity regional speech using edge-tts (Fallback engine)."""
    voice = VOICE_CONFIG.get(lang_suffix, VOICE_CONFIG["en"])
    speech_text = clean_for_speech(text, lang_suffix)

    async def _generate():
        communicate = edge_tts.Communicate(speech_text, voice)
        stream = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                stream.extend(chunk["data"])
        return bytes(stream)

    try:
        loop = asyncio.new_event_loop()
        audio_data = loop.run_until_complete(_generate())
        loop.close()
        if audio_data and len(audio_data) > 0:
            return base64.b64encode(audio_data).decode('utf-8'), "mp3"
    except Exception as e:
        print(f"⚠️ Neural TTS Error ({voice}): {e}")

    return None, None

def synthesize_vertex_gemini_voice(text, lang_suffix="en"):
    """Synthesizes conversational, human-sounding speech using Vertex AI gemini-2.5-flash-tts.
    Voices:
      - Puck: Upbeat, lively, warm conversational podcast/guide style (EN)
      - Aoede: Natural, relaxed, fluent female voice (FR & AR)
    """
    if not vertex_client:
        return None, None
    try:
        voice_map = {
            "en": "Puck",
            "fr": "Aoede",
            "ar": "Aoede"
        }
        voice_name = voice_map.get(lang_suffix, "Puck")
        speech_text = clean_for_speech(text, lang_suffix)
        
        resp = vertex_client.models.generate_content(
            model="gemini-2.5-flash-tts",
            contents=speech_text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                    )
                )
            )
        )
        if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
            raw_pcm = resp.candidates[0].content.parts[0].inline_data.data
            buf = io.BytesIO()
            with wave.open(buf, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(raw_pcm)
            return base64.b64encode(buf.getvalue()).decode('utf-8'), "wav"
    except Exception as e:
        print(f"⚠️ Vertex Gemini Voice error: {e}")
    return None, None

def get_or_generate_audio(text, cache_key, lang_suffix):
    """Retrieves cached audio or generates fresh audio live with zero delay.
    Prioritizes Gemini 2.5 Flash TTS for ultra-natural human conversational voice.
    """
    # 1. Check WAV cache (Gemini-TTS)
    wav_path = os.path.join(CACHE_DIR, f"{cache_key}.wav")
    if os.path.exists(wav_path):
        with open(wav_path, "rb") as f:
            return base64.b64encode(f.read()).decode('utf-8'), "wav"

    # 2. Check MP3 cache
    mp3_path = os.path.join(CACHE_DIR, f"{cache_key}.mp3")
    if os.path.exists(mp3_path):
        with open(mp3_path, "rb") as f:
            return base64.b64encode(f.read()).decode('utf-8'), "mp3"

    # 3. PRIMARY: Google Vertex AI Gemini-TTS
    audio_b64, fmt = synthesize_vertex_gemini_voice(text, lang_suffix)
    if audio_b64:
        with open(wav_path, "wb") as f:
            f.write(base64.b64decode(audio_b64))
        return audio_b64, "wav"

    # 4. FALLBACK: Neural Voice (Edge-TTS)
    audio_b64, fmt = synthesize_neural_voice(text, lang_suffix)
    if audio_b64:
        with open(mp3_path, "wb") as f:
            f.write(base64.b64decode(audio_b64))
        return audio_b64, "mp3"

    return None, None

def preheat_tour_cache():
    """Pre-generates concise 3-5s tour audio for all 14 archipelago nodes using Gemini Flash TTS."""
    print("==================================================")
    print("🚀 INITIALIZING: Audio Tour Pre-warming with Gemini-TTS (14 Nodes)")
    count = 0
    for node_id in CHAPTER_ORDER:
        data = TOUR_DATA[node_id]
        for lang_code in ['en', 'fr', 'ar']:
            key = f"{node_id}_{lang_code}"
            text = data[f"text_{lang_code}"]
            wav_file = os.path.join(CACHE_DIR, f"{key}.wav")
            mp3_file = os.path.join(CACHE_DIR, f"{key}.mp3")
            if not os.path.exists(wav_file) and not os.path.exists(mp3_file):
                print(f"   🎙️ Synthesizing {key} with Gemini-TTS...", end=" ", flush=True)
                audio_b64, _ = get_or_generate_audio(text, key, lang_code)
                if audio_b64:
                    print("✅")
                    count += 1
                else:
                    print("⚠️ Failed")
    print(f"✨ Tour Cache Ready! ({count} ultra-concise files generated).")
    print("==================================================")

# ==============================================================================
# 3. ROUTES & API ENDPOINTS
# ==============================================================================

@app.route('/get_islands', methods=['GET', 'POST'])
@app.route('/get_tour_data', methods=['GET', 'POST'])
def get_tour_data():
    req_data = request.json or {}
    lang = req_data.get('lang', 'en')
    
    suffix = 'en'
    if 'ar' in lang: suffix = 'ar'
    elif 'fr' in lang: suffix = 'fr'

    islands_package = []
    for node_id in CHAPTER_ORDER:
        node = TOUR_DATA[node_id]
        raw_text = node[f"text_{suffix}"]
        cache_key = f"{node_id}_{suffix}"
        
        audio_b64, audio_fmt = get_or_generate_audio(raw_text, cache_key, suffix)
        
        islands_package.append({
            "id": node_id,
            "icon": node.get("icon", "📍"),
            "title": node.get("title", node_id),
            "subtitle": node.get("subtitle", ""),
            "badge": node.get("badge", "NODE"),
            "x": node.get("x", 50),
            "y": node.get("y", 50),
            "text": raw_text,
            "audio": audio_b64,
            "audio_format": audio_fmt or "mp3",
            "images": node.get("images", [])
        })

    return jsonify({"tour": islands_package, "islands": islands_package, "lang": suffix})

@app.route('/chat_router', methods=['POST'])
def chat_router():
    data = request.json or {}
    user_text = data.get('text', '').strip()
    lang = data.get('lang', 'en')
    current_node = data.get('chapter', 'CORE')

    if not user_text:
        return jsonify({"error": "Empty voice input"}), 400

    suffix = 'en'
    if 'ar' in lang: suffix = 'ar'
    elif 'fr' in lang: suffix = 'fr'

    node_info = TOUR_DATA.get(current_node, {})
    current_node_text = node_info.get(f'text_{suffix}', node_info.get('text_en', ''))

    # Strict prompt policy: Concise 1-2 sentences maximum (< 25 words) for natural speech
    lang_instruction = {
        "en": "Answer in exactly 1 to 2 short, punchy sentences in natural conversational English. Never exceed 25 words.",
        "fr": "Répondez en 1 ou 2 phrases courtes et percutantes en français naturel. Moins de 25 mots au total.",
        "ar": """جاوب في جملة أو جملتين قصار برشا بتونسي طبيعي وواضح (تونسي قح ومفهوم). 
أقصى حد 20 كلمة. 
مهم جداً: اكتب أسماء المنظمات والنوادي والمسابقات بالحروف اللاتينية والإنجليزية كما هي (مثال: IEEE, ISSAT Sousse, TSYP 14, CS, RAS, PES, IAS, WIE, SIGHT, AI, NAO, Hackathon) ولا تكتبها بحروف عربية إطلاقاً."""
    }.get(suffix, "Answer in 1 to 2 short conversational sentences.")

    answer_prompt = f"""
    You are the official Interactive AI Guide for IEEE ISSAT Sousse Student Branch at TSYP 14 in 2026.
    
    KNOWLEDGE BASE:
    {FULL_BRANCH_CONTEXT}

    ACTIVE ISLAND / NODE:
    Node: {current_node} ({node_info.get('title', '')})
    Context: "{current_node_text}"

    USER SPOKEN QUERY:
    "{user_text}"

    STRICT CONVERSATIONAL POLICY:
    1. Answer the question accurately and enthusiastically.
    2. STRICT CONSTRAINT: Exactly 1 to 2 short sentences (UNDER 25 WORDS TOTAL). Perfect for spoken audio!
    3. Year is 2026. Event is TSYP 14. 12-Year Anniversary (2014-2026).
    4. ACRONYMS & PROPER NOUNS: ALL organization names, technical terms, and acronyms (IEEE, ISSAT Sousse, TSYP 14, CS, RAS, PES, IAS, WIE, SIGHT, AI, NAO, Hackathon, WALL-E) MUST strictly remain in English/Latin letters. Never transcribe them into Arabic letters.
    5. {lang_instruction}
    """

    ai_reply_text = ""
    if vertex_client:
        try:
            ans_resp = vertex_client.models.generate_content(
                model=BRAIN_MODEL,
                contents=answer_prompt
            )
            if ans_resp.candidates and ans_resp.candidates[0].content and ans_resp.candidates[0].content.parts:
                ai_reply_text = ans_resp.text.strip()
        except Exception as e:
            print(f"Chat generation error: {e}")

    if not ai_reply_text:
        fallbacks = {
            "en": "I'm your IEEE ISSAT Sousse AI Guide at TSYP 14! Ask me about any of our chapters.",
            "fr": "Je suis votre guide IA IEEE ISSAT Sousse à TSYP 14 ! Posez-moi vos questions.",
            "ar": "أنا مرشدك الذكي في IEEE ISSAT Sousse في TSYP 14! اسألني على أي نادي أو مشروع."
        }
        ai_reply_text = fallbacks.get(suffix, fallbacks["en"])

    # Real-Time Live Speech Synthesis (Gemini Conversational Voice as Primary)
    audio_b64, audio_fmt = synthesize_vertex_gemini_voice(ai_reply_text, suffix)
    if not audio_b64:
        audio_b64, audio_fmt = synthesize_neural_voice(ai_reply_text, suffix)

    return jsonify({
        "mode": "CHAT",
        "response": ai_reply_text,
        "audio": audio_b64,
        "audio_format": audio_fmt or "mp3"
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "project": GCP_PROJECT,
        "location": GCP_LOCATION,
        "year": 2026,
        "event": "TSYP 14",
        "total_nodes": len(TOUR_DATA),
        "vertex_ai": vertex_client is not None,
        "neural_tts": True
    })

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    preheat_tour_cache()
    PORT = int(os.getenv("PORT", 5005))
    print(f"🚀 TSYP AI Kiosk running live on: http://localhost:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)