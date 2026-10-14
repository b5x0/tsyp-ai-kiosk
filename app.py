import os
import io
import json
import base64
import re
import asyncio
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
# 1. KNOWLEDGE BASE & TOUR SCRIPT (IEEE ISSAT Sousse SB - 10 Year History & TSYP 13)
# Authentic Tunisian Derja + Flawless French & English
# ==============================================================================
TOUR_DATA = {
    "GREETING": {
        "title": "Welcome / عسلامة / Bienvenue",
        "subtitle": "Interactive AI Kiosk at TSYP 13 Congress",
        "text_en": "Hello and welcome to the IEEE ISSAT Sousse AI Kiosk! Celebrating a full decade of excellence from 2014 to 2024 at the TSYP 13 Congress. You can say 'Start Tour' to begin the visual presentation, or tap the microphone anytime to ask me anything about our branch and chapters.",
        "text_fr": "Bonjour et bienvenue au kiosque IA de l'IEEE ISSAT Sousse ! Nous célébrons une décennie d'excellence de 2014 à 2024 au congrès TSYP 13. Dites 'Commencer' pour lancer la visite visuelle, ou utilisez le micro pour me poser toutes vos questions.",
        "text_ar": "عسلامة ومرحباً بيكم في كشك الذكاء الاصطناعي لفرع آي تريبل إي عيسات سوسة! نحتفلو مع بعضنا بـ 10 سنين نجاح وريادة من 2014 لـ 2024 في مؤتمر تي إس واي بي 13. تنجم تقول 'ابدأ' بش تشوف الدورة المصورة، ولا تنزل على الميكرو وتسألني على أي حاجة في الفرع والنوادي متاعنا.",
        "images": []
    },
    "FOUNDATION": {
        "title": "Our Foundation (2014)",
        "subtitle": "Come as Students, Leave as Leaders",
        "text_en": "Founded in 2014 at ISSAT Sousse, our student branch was born from a shared dream under the motto: 'Come as students, Leave as leaders'. For 10 years, we have empowered hundreds of engineering students, bridging university learning with real-world leadership and international IEEE networks.",
        "text_fr": "Fondée en 2014 à l'ISSAT Sousse, notre branche étudiante est née avec la devise: 'Venez comme étudiants, partez comme leaders'. Depuis dix ans, nous formons les futurs ingénieurs en reliant l'académie au leadership international.",
        "text_ar": "تأسس فرعنا في سنة 2014 في عيسات سوسة، تحت شعارنا المعروف: أدخل كطالب واخرج كقائد. على مدى عشرة سنين كاملة، ساهمنا في تكوين مئات مهندسي المستقبل وربطنا قراية الجامعة بالقيادة الحقيقية وشبكة آي تريبل إي العالمية.",
        "images": ["assets/slides/page_03_img_1.jpg", "assets/slides/page_04_img_1.jpg", "assets/slides/page_05_img_1.jpg"]
    },
    "CS": {
        "title": "Computer Society (CS)",
        "subtitle": "Code, Algorithms & Global Challenges",
        "text_en": "Welcome to the Computer Society Chapter, where code turns into creative impact. We are famous for Vecna Algorithm, our dark-themed high-stakes hackathon pushing developers to their limits. We also lead IEEEXtreme, the global 24-hour coding challenge competing against the best teams worldwide.",
        "text_fr": "Bienvenue au chapitre Computer Society ! Célèbres pour le hackathon Vecna Algorithm qui pousse les développeurs à leurs limites, nous excellons aussi à l'IEEEXtreme, le défi mondial de programmation de 24 heures en compétition internationale.",
        "text_ar": "مرحباً بيكم في نادي كومبيوتر سوسايتي سي إس! هوني وين البرمجة تتحول لإبداع وتأثير حقيقي. معروفين بهاكاثون فيكنا ألغوريثم الشهير، وديما متميزين في آي إكستريم، أكبر تحدي برمجة عالمي يدوم 24 ساعة بدون انقطاع ضد أقوى جامعات العالم.",
        "images": ["assets/2.png", "assets/3.png"]
    },
    "RAS": {
        "title": "Robotics & Automation Society (RAS)",
        "subtitle": "Humanoids, Embedded Systems & Innovation",
        "text_en": "The Robotics and Automation Society turns theory into moving mechanical reality. Through intensive Arduino and embedded system workshops, members build automated systems from scratch. A milestone achievement was our humanoid NAO robotics project, winning First Edition at Tunisian Innovation Days.",
        "text_fr": "La RAS transforme les idées en systèmes autonomes. De nos ateliers intensifs Arduino aux systèmes embarqués, nous donnons vie aux robots. Une grande fierté: notre projet humanoïde NAO a remporté la 1ère édition des Journées Tunisiennes de l'Innovation.",
        "text_ar": "في نادي الروبوتات والأنظمة الذكية راس، نحولو الأفكار والمعادلات لروبوتات حية تتحرك. من خلال ورشات تطبيقية في أردوينو والأنظمة المدمجة، الأعضاء يصنعو مشاريعهم من الصفر. ومن أكبر إنجازاتنا روبوت ناو البشري اللي توج بالجائزة الأولى في مسابقة تونيزيان إينوفايشن دايز!",
        "images": ["assets/slides/page_07_img_1.jpg", "assets/slides/page_08_img_1.jpg"]
    },
    "PES": {
        "title": "Power & Energy Society (PES)",
        "subtitle": "Green Tech, Renewable Energy & COPX",
        "text_en": "The Power and Energy Society champions sustainable innovation and clean grids. We organized COPX 2.0 at ENISo, exploring AI, IoT, and biodiversity for ecological resilience. We also conduct technical expeditions to renewable wind farms to study clean energy in real environments.",
        "text_fr": "La PES mène l'innovation durable et les énergies propres. Nous avons organisé le grand événement COPX 2.0 à l'ENISo sur l'IA, l'IoT et la biodiversité, et mené des visites techniques sur des parcs éoliens pour l'énergie renouvelable.",
        "text_ar": "نادي باور أند إنرجي سوسايتي بي إي إس هو صوت الطاقات المتجددة والتنمية المستدامة في فرعنا. نظمنا الحدث الكبير كوب إكس 2.0 في إينيزو حول الذكاء الاصطناعي وإنترنت الأشياء، ونعملو زيارات ميدانية لمحطات طاقة الرياح لتشجيع حلول الطاقة الخضراء في تونس.",
        "images": ["assets/slides/page_09_img_1.jpg", "assets/slides/page_10_img_1.jpg"]
    },
    "IAS": {
        "title": "Industry Applications Society (IAS)",
        "subtitle": "Industry 4.0, Smart Automation & Field Trips",
        "text_en": "The Industry Applications Society is our bridge directly into the corporate industrial world. Focusing on Industry 4.0 and digital transformation, we explore smart manufacturing through industrial visits to world leaders like Valeo and interactive automation masterclasses.",
        "text_fr": "L'IAS est le pont direct vers le monde industriel et l'Industrie 4.0. Nous explorons l'automatisation intelligente et la transformation numérique grâce à des visites industrielles chez des géants comme Valeo.",
        "text_ar": "نادي إندستري أبليكيشنز سوسايتي آي إيه إس يمثل القنطرة الحقيقية المباشرة لعالم الصناعة وسوق الشغل. نركزو برشا على تقنيات الثورة الصناعية الرابعة والأتمتة الذكية، وننظمو زيارات ميدانية لكبرى الشركات العالمية كيما مجمع فاليو بش نكتشفو أحدث خطوط الإنتاج الذكي.",
        "images": ["assets/slides/page_13_img_1.jpg", "assets/4.png"]
    },
    "WIE": {
        "title": "Women in Engineering (WIE)",
        "subtitle": "Empowerment, #wielead & Pinktober",
        "text_en": "Women in Engineering is dedicated to empowering female leaders in STEM under our #wielead initiative. We created the Small Business Showcase to boost local female entrepreneurs and artisans, and we mobilize annually for Pinktober raising awareness and support for breast cancer prevention.",
        "text_fr": "WIE soutient le leadership féminin en STEM avec notre initiative #wielead. Nous avons créé le Small Business Showcase pour soutenir les entrepreneuses locales, et nous nous mobilisons chaque année pour la sensibilisation Octobre Rose.",
        "text_ar": "نادي النساء في الهندسة دبليو آي إي يدعم ويثمن دور المرأة المهندسة والقائدة في مجالات العلوم والتكنولوجيا تحت مبادرة وي ليد. نظمنا تظاهرة سمول بيزنس شوكايس لدعم صاحبات المشاريع الحرفية، وديما حاضرين بقوة في حملات بينكتوبر للتوعية والوقاية من سرطان الثدي.",
        "images": ["assets/slides/page_06_img_1.jpg", "assets/slides/page_06_img_2.jpg"]
    },
    "SIGHT": {
        "title": "Humanitarian Technology (SIGHT)",
        "subtitle": "Tech for Good, AI Gateway & Youth STEM",
        "text_en": "SIGHT applies engineering to solve urgent societal and humanitarian challenges. Our AI Gateway workshops demystify artificial intelligence for non-technical audiences, and we actively lead hands-on STEM and robotics sessions for young scouts to inspire the next generation of creators.",
        "text_fr": "SIGHT met la technologie au service de l'humanité. De nos ateliers AI Gateway démystifiant l'IA pour tous, à nos sessions pratiques de robotique et de STEM avec les scouts, nous inspirons la prochaine génération.",
        "text_ar": "مجموعة سايت توظف الهندسة والتكنولوجيا لخدمة الإنسانية والمجتمع. من ورشات إي آي غايتواي اللي نبسطو فيها الذكاء الاصطناعي للجميع، لحصص تدريبية تطبيقية في الروبوتيك والعلوم مع أطفال الكشافة، ديما نسعاو بش نلهمو الجيل الصاعد.",
        "images": ["assets/slides/page_24_img_1.jpg", "assets/15.png"]
    },
    "COMMUNITY": {
        "title": "Campus Life & Family Spirit",
        "subtitle": "Integration, Retreats, Culture & Solidarity",
        "text_en": "More than just engineering, IEEE ISSAT Sousse is a second family. We celebrate campus life through carnival integration days, outdoor mountain hikes, international cultural exchange summits, and our traditional joint Ramadan Iftar gatherings.",
        "text_fr": "Plus qu'une branche technique, l'IEEE ISSAT Sousse est une famille unie. Nous vibrons ensemble lors de journées d'intégration festives, de randonnées en pleine nature, d'échanges culturels mondiaux et de nos iftars conviviaux de Ramadan.",
        "text_ar": "أكثر من مجرد نادي أو فرع علمي، آي تريبل إي عيسات سوسة عائلة دافية تجمعنا روح المحبة والأخوة. نفرحو مع بعضنا في أيام الإدماج الكرنفالية، وخرجات الهايكينغ في الطبيعة، وتظاهرات التبادل الثقافي الدولي، ولمة إفطار رمضان السنوية بين كل أجيال الفرع.",
        "images": ["assets/slides/page_12_img_1.jpg", "assets/slides/page_13_img_2.jpg", "assets/slides/page_14_img_2.jpg", "assets/slides/page_23_img_1.jpg"]
    },
    "ACHIEVEMENTS": {
        "title": "A Decade of Excellence & TSYP Legacy",
        "subtitle": "TSYP 12 Challenge Winners & 10 Years Milestone",
        "text_en": "Our journey is defined by passion and national triumphs. At TSYP 12, our delegation won the prestigious TN 2056 Challenge! In 2024, all our chapters united to celebrate our 10-Year Anniversary, honoring a decade of transformative student leadership.",
        "text_fr": "Une décennie couronnée de triomphes ! À TSYP 12, notre délégation a remporté le prestigieux TN 2056 Challenge. En 2024, tous nos chapitres se sont réunis pour célébrer nos 10 ans d'histoire et de leadership étudiant.",
        "text_ar": "عشر سنين مكللة بالنجاحات والجوائز الوطنية والدولية! في مؤتمر تي إس واي بي 12، وفدنا توج بجدارة بالمرتبة الأولى في تحدي تونس 2056! وفي سنة 2024، تجمعت كل النوادي وعائلتنا الكبيرة للاحتفال بمرور عشرة سنين على تأسيس الفرع وسط فخر كبير.",
        "images": ["assets/slides/page_21_img_1.jpg", "assets/slides/page_21_img_2.jpg", "assets/slides/page_18_img_1.jpg"]
    },
    "UTOPIA": {
        "title": "TSYP 13 Congress: UTOPIA Booth",
        "subtitle": "The Future of AI & Wall-E Environmental Hackathon",
        "text_en": "Welcome to our UTOPIA booth at TSYP 13! Our executive board is here to connect with you. Looking ahead, we are launching the WALL-E Hackathon, an AI and data-driven environmental challenge dedicated to tackling industrial pollution in Gabès aligned with UN Sustainable Development Goals.",
        "text_fr": "Bienvenue sur notre stand UTOPIA à TSYP 13 ! Notre bureau exécutif est ravi de vous accueillir. Nous préparons le Hackathon WALL-E, un défi d'IA et de données pour lutter contre la crise de pollution à Gabès selon les ODD de l'ONU.",
        "text_ar": "مرحباً بيكم في جناح أوتوبيا في مؤتمر تي إس واي بي 13! المكتب التنفيذي للفرع كلو حاضر ومستعد بش يتعرف عليكم ويجاوبكم. ومستقبلنا متواصل مع هاكاثون وول إي البيئي، تحدي ذكاء اصطناعي وداتا موجه لإيجاد حلول حقيقية لأزمة التلوث في قابس تماشياً مع أهداف التنمية المستدامة للأمم المتحدة.",
        "images": ["assets/slides/page_22_img_1.jpg", "assets/hackathon.jpg"]
    }
}

CHAPTER_ORDER = [
    "GREETING", "FOUNDATION", "CS", "RAS", "PES", 
    "IAS", "WIE", "SIGHT", "COMMUNITY", "ACHIEVEMENTS", "UTOPIA"
]

FULL_BRANCH_CONTEXT = """
OVERVIEW & IDENTITY:
- IEEE is the world's largest technical organization for advancing technology for humanity (190+ countries, ~460k members).
- IEEE ISSAT Sousse Student Branch (ISSATSO SB) was founded in 2014 at ISSAT Sousse (Institut Supérieur des Sciences Appliquées et de Technologie de Sousse).
- Celebrating 10-Year Anniversary (2014 - 2024/2025). Motto: "Come as students, Leave as leaders".
- We are currently participating in TSYP 13 (Tunisian Students & Young Professionals Congress) with our theme booth "UTOPIA".

TECHNICAL CHAPTERS & GROUPS:
1. CS (Computer Society Chapter): Focus on computer science, AI, software. Famous for "Vecna Algorithm" (dark-themed hackathon) and annual leadership in IEEEXtreme 24h coding challenge.
2. RAS (Robotics & Automation Society): Focus on robotics, automation, embedded systems, Arduino workshops. Developed humanoid NAO robotics project, won 1st edition at Tunisian Innovation Days.
3. PES (Power & Energy Society): Renewable energy, smart power grids, sustainability. Organized COPX 2.0 at ENISo (AI, IoT & biodiversity), technical visits to wind turbine farms.
4. IAS (Industry Applications Society): Industry 4.0, industrial automation, manufacturing applications, corporate bridge. Conducted industrial visits to Valeo.
5. WIE (Women in Engineering Affinity Group): Female empowerment in STEM (#wielead), Small Business Showcase supporting local women entrepreneurs, annual Pinktober breast cancer awareness campaigns.
6. SIGHT (Special Interest Group on Humanitarian Technology): Humanitarian engineering, technology for social good, AI Gateway workshops for non-technical audiences, STEM and robotics workshops for youth scouts.

BRANCH LEADERSHIP & EXECUTIVE BOARD:
- Chair: Leads the branch, defines overall vision/strategy, represents IEEE ISSATSO externally.
- Vice Chair: Assists the Chair, coordinates internal chapter activities and operations.
- General Secretary: Administrative management, documentation, records, meeting minutes.
- Treasurer: Financial management, budgeting, sponsorships, membership fees.
- Webmaster / IT Lead: Manages digital platforms, website, member database, and technical assets.
- Team Leads: Media (visual branding, photography), PR (public relations, corporate partnerships), HR (human resources, onboarding), Logistics (event organization).

KEY EVENTS & MILESTONES:
- 2014: Official foundation and launch congress at ISSAT Sousse.
- 2016: Tunisian Innovation Days 1st Edition Winner (NAO robot), 4th TSYP Congress in Hammamet.
- 2023-2024: Winner of TN 2056 Challenge at TSYP 12!
- 2024: 10th Anniversary Grand Celebration uniting all technical chapters.
- 2024/2025: TSYP 13 Congress Utopia Booth & upcoming WALL-E Hackathon (AI and data-driven conception challenge targeting industrial pollution in Gabès, aligned with UN SDGs 3, 11, 14, 15).
"""

# ==============================================================================
# 2. PHONETIC NORMALIZATION & TUNISIAN DERJA SPEECH ENGINE
# ==============================================================================

# Phonetic mapping to ensure flawless Tunisian pronunciation of acronyms & terms
PHONETIC_MAP_AR = [
    (r"\bIEEE ISSAT Sousse\b", "آي تريبل إي عيسات سوسة"),
    (r"\bIEEE\b", "آي تريبل إي"),
    (r"\bISSAT Sousse\b", "عيسات سوسة"),
    (r"\bISSATSO\b", "عيسات سوسة"),
    (r"\bISSAT\b", "عيسات"),
    (r"\bTSYP 13\b", "تي إس واي بي 13"),
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
    (r"\bSmall Business Showcase\b", "سمول بيزنس شوكايس"),
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
    """Normalizes acronyms and symbols so neural TTS speaks fluently without spelling letter-by-letter."""
    if not text:
        return ""
    # Strip markdown symbols
    cleaned = re.sub(r"[\*\_#`]", "", text)
    if lang == "ar":
        # Remove redundant Latin parentheticals like (NAO), (IEEE)
        cleaned = re.sub(r"\([A-Za-z0-9\s\-]+\)", "", cleaned)
        for pattern, replacement in PHONETIC_MAP_AR:
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    elif lang == "en":
        cleaned = re.sub(r"\bIEEE\b", "I-triple-E", cleaned)
        cleaned = re.sub(r"\bTSYP\b", "T-S-Y-P", cleaned)
    elif lang == "fr":
        cleaned = re.sub(r"\bl\x27IEEE\b", "l\x27I triple E", cleaned)
        cleaned = re.sub(r"\bIEEE\b", "I triple E", cleaned)
        cleaned = re.sub(r"\bTSYP\b", "T-S-Y-P", cleaned)
    # Collapse multiple whitespaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

# Neural regional voices specifically built for authentic local accents
VOICE_MAPPING_NEURAL = {
    "ar": "ar-TN-HediNeural",                 # Microsoft Dedicated Tunisian Arabic (Derja) Neural Voice
    "en": "en-US-AndrewMultilingualNeural",   # Microsoft Multilingual Warm Conversational English Voice
    "fr": "fr-FR-VivienneMultilingualNeural"  # Microsoft Multilingual Natural French Voice
}

def synthesize_neural_voice(text, lang_suffix="en"):
    """Synthesizes high-fidelity speech using dedicated regional neural models."""
    voice = VOICE_MAPPING_NEURAL.get(lang_suffix, VOICE_MAPPING_NEURAL["en"])
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
            return base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        print(f"⚠️ Edge Neural TTS error ({voice}): {e}")

    return None

def synthesize_gcp_tts(text, lang_suffix="en"):
    """GCP TTS fallback."""
    if not GCP_API_KEY:
        return None

    gcp_voices = {
        "en": {"code": "en-US", "name": "en-US-Journey-F"},
        "fr": {"code": "fr-FR", "name": "fr-FR-Neural2-A"},
        "ar": {"code": "ar-XA", "name": "ar-XA-Wavenet-B"}
    }
    voice_info = gcp_voices.get(lang_suffix, gcp_voices["en"])
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={GCP_API_KEY}"
    speech_text = clean_for_speech(text, lang_suffix)

    payload = {
        "input": {"text": speech_text},
        "voice": {
            "languageCode": voice_info["code"],
            "name": voice_info["name"]
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 1.0,
            "pitch": 0.0
        }
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("audioContent")
    except Exception as e:
        print(f"⚠️ GCP TTS fallback error: {e}")

    return None

def get_or_generate_audio(text, cache_key, lang_suffix):
    """Retrieves cached audio or generates fresh audio live with zero delay."""
    mp3_path = os.path.join(CACHE_DIR, f"{cache_key}.mp3")
    if os.path.exists(mp3_path):
        with open(mp3_path, "rb") as f:
            return base64.b64encode(f.read()).decode('utf-8'), "mp3"

    # 1. Primary: Dedicated Tunisian Neural Voice (edge-tts)
    audio_b64 = synthesize_neural_voice(text, lang_suffix)
    if audio_b64:
        with open(mp3_path, "wb") as f:
            f.write(base64.b64decode(audio_b64))
        return audio_b64, "mp3"

    # 2. Fallback: Google Cloud TTS Live
    audio_b64 = synthesize_gcp_tts(text, lang_suffix)
    if audio_b64:
        with open(mp3_path, "wb") as f:
            f.write(base64.b64decode(audio_b64))
        return audio_b64, "mp3"

    return None, None

def preheat_tour_cache():
    """Pre-generates tour audio files with the authentic Tunisian & Multilingual Neural voices."""
    print("==================================================")
    print("🚀 INITIALIZING: Audio Tour Pre-warming (Authentic Tunisian & Neural Voices)")
    count = 0
    for chapter in CHAPTER_ORDER:
        data = TOUR_DATA[chapter]
        for lang_code in ['en', 'fr', 'ar']:
            key = f"{chapter}_{lang_code}"
            text = data[f"text_{lang_code}"]
            mp3_file = os.path.join(CACHE_DIR, f"{key}.mp3")
            if not os.path.exists(mp3_file):
                print(f"   🎙️ Synthesizing {key}...", end=" ", flush=True)
                audio_b64, _ = get_or_generate_audio(text, key, lang_code)
                if audio_b64:
                    print("✅")
                    count += 1
                else:
                    print("⚠️ Failed")
    print(f"✨ Tour Cache Ready! ({count} high-quality files generated).")
    print("==================================================")

# ==============================================================================
# 3. ROUTES & API ENDPOINTS
# ==============================================================================

@app.route('/get_tour_data', methods=['POST'])
def get_tour_data():
    req_data = request.json or {}
    lang = req_data.get('lang', 'en')
    
    suffix = 'en'
    if 'ar' in lang: suffix = 'ar'
    elif 'fr' in lang: suffix = 'fr'

    tour_package = []
    for chapter_id in CHAPTER_ORDER:
        ch = TOUR_DATA[chapter_id]
        raw_text = ch[f"text_{suffix}"]
        cache_key = f"{chapter_id}_{suffix}"
        
        audio_b64, audio_fmt = get_or_generate_audio(raw_text, cache_key, suffix)
        
        tour_package.append({
            "id": chapter_id,
            "title": ch.get("title", chapter_id),
            "subtitle": ch.get("subtitle", ""),
            "text": raw_text,
            "audio": audio_b64,
            "audio_format": audio_fmt or "mp3",
            "images": ch.get("images", [])
        })

    return jsonify({"tour": tour_package, "lang": suffix})

@app.route('/chat_router', methods=['POST'])
def chat_router():
    data = request.json or {}
    user_text = data.get('text', '').strip()
    lang = data.get('lang', 'en')
    current_chapter = data.get('chapter', 'GREETING')

    if not user_text:
        return jsonify({"error": "Empty input"}), 400

    suffix = 'en'
    if 'ar' in lang: suffix = 'ar'
    elif 'fr' in lang: suffix = 'fr'

    slide_info = TOUR_DATA.get(current_chapter, {})
    current_slide_text = slide_info.get(f'text_{suffix}', slide_info.get('text_en', ''))

    # Step 1: Intent Classification via Vertex AI
    classifier_prompt = f"""
    The user is visiting an interactive museum AI Kiosk for IEEE ISSAT Sousse Student Branch at TSYP 13.
    User Query: "{user_text}"
    Current View: {current_chapter}

    Task: Determine if the user is asking to start/continue the visual tour presentation, OR asking a general/specific question.
    - If user explicitly says words meaning "start tour", "begin presentation", "show slides", "commencer la visite", "lance la présentation", "ebda el tour", "abda", "bda", "joula", classify as TOUR.
    - If user is asking a question, asking for clarification, greeting, or discussing IEEE, chapters, team, robotics, AI, or anything else, classify as CHAT.

    Respond with ONLY one word: TOUR or CHAT.
    """

    decision = "CHAT"
    if vertex_client:
        try:
            c_resp = vertex_client.models.generate_content(
                model=BRAIN_MODEL,
                contents=classifier_prompt
            )
            decision = c_resp.text.strip().upper()
        except Exception as e:
            print(f"Classifier error: {e}")

    if "TOUR" in decision:
        return jsonify({"mode": "TOUR"})

    # Step 2: Intelligent Conversational Response
    lang_instruction = {
        "en": "Answer in clear, engaging, and professional English. Keep acronyms clear.",
        "fr": "Répondez dans un français naturel, dynamique et fluide.",
        "ar": """Answer in 100% authentic, friendly, and natural Tunisian Arabic (Derja / تونسي قح ومفهوم) as spoken by Tunisian engineering students (e.g. عسلامة، مرحباً، برشا، ديما، باهي، يعطيك الصحة، متاعنا، نخدمو).
CRITICAL: When mentioning IEEE, ISSAT Sousse, chapters (CS, RAS, PES, IAS, WIE, SIGHT), or projects (NAO, Vecna, COPX, Wall-E), write them phonetically in Arabic (e.g. آي تريبل إي، عيسات سوسة، تي إس واي بي، روبوت ناو، هاكاثون فيكنا) so the speech engine pronounces them with a native Tunisian accent instead of spelling English letters!"""
    }.get(suffix, "Answer in clear English.")

    answer_prompt = f"""
    You are the official Interactive AI Guide for IEEE ISSAT Sousse Student Branch at the TSYP 13 Congress.
    
    KNOWLEDGE BASE:
    {FULL_BRANCH_CONTEXT}

    CURRENT SLIDE BEING VIEWED BY USER:
    Chapter: {current_chapter}
    Slide Script: "{current_slide_text}"

    USER QUESTION:
    "{user_text}"

    INSTRUCTIONS:
    1. If the user asks about the branch, chapters, history, NAO robot, Vecna Algorithm, COPX, Valeo, TSYP 12 win, or executive board, provide an accurate and inspiring response using the knowledge base.
    2. If the user asks a follow-up about the current slide, explain with high relevance.
    3. Keep your response concise: 2 to 3 sentences maximum. Perfect for spoken audio!
    4. Maintain an enthusiastic, welcoming, and knowledgeable tone.
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
            "en": "I'm here to help! You can ask me about our 10-year history, our chapters like CS and RAS, or say 'Start Tour' to explore.",
            "fr": "Je suis à votre disposition! Vous pouvez me poser des questions sur nos 10 ans d'histoire ou dire 'Commencer' pour la visite.",
            "ar": "أنا لهنا بش نعاونك! تنجم تسألني على تاريخنا ولا الشابترز كيما سي إس و راس، ولا قول 'ابدأ' بش تشوف الدورة."
        }
        ai_reply_text = fallbacks.get(suffix, fallbacks["en"])

    # Step 3: Real-Time Live Speech Synthesis using Dedicated Regional Neural Models
    audio_b64 = synthesize_neural_voice(ai_reply_text, suffix)
    audio_fmt = "mp3"
    if not audio_b64:
        audio_b64 = synthesize_gcp_tts(ai_reply_text, suffix)
        audio_fmt = "mp3"

    return jsonify({
        "mode": "CHAT",
        "response": ai_reply_text,
        "audio": audio_b64,
        "audio_format": audio_fmt
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "project": GCP_PROJECT,
        "location": GCP_LOCATION,
        "vertex_ai": vertex_client is not None,
        "neural_tts": True,
        "gcp_tts": bool(GCP_API_KEY),
        "voices": {
            "ar": VOICE_MAPPING_NEURAL["ar"],
            "en": VOICE_MAPPING_NEURAL["en"],
            "fr": VOICE_MAPPING_NEURAL["fr"]
        }
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