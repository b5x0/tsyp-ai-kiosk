import os
import json
import re
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

# ==============================================================================
# 1. 14 ARCHIPELAGO ISLANDS / NODES (TSYP 14 CONGRESS - YEAR 2026)
# ==============================================================================
TOUR_DATA = {
    "CORE": {
        "icon": "🌟",
        "title": "UTOPIA Sanctuary",
        "subtitle": "TSYP 14 Congress • 2026",
        "badge": "MAIN HUB",
        "x": 50, "y": 44,
        "text_en": "Welcome to the IEEE ISSAT Sousse AI Sanctuary at TSYP 14! Explore our chapters, 12-year history, and world-class innovations.",
        "text_fr": "Bienvenue au sanctuaire IA de l'IEEE ISSAT Sousse à TSYP 14 ! Découvrez nos chapitres, 12 ans d'histoire et nos innovations.",
        "text_ar": "عسلامة ومرحباً بيكم في جناح IEEE ISSAT Sousse في TSYP 14! تفضلوا باكتشاف نوادينا وإنجازاتنا على مدار 12 سنة.",
        "images": ["assets/icon.png", "assets/slides/page_22_img_1.jpg"]
    },
    "FOUNDATION": {
        "icon": "🏛️",
        "title": "Genesis & 12 Years",
        "subtitle": "Founded 2014 • 12-Year Legacy (2026)",
        "badge": "LEGACY",
        "x": 25, "y": 26,
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
        "x": 75, "y": 22,
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
        "x": 85, "y": 38,
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
        "x": 76, "y": 56,
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
        "x": 63, "y": 68,
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
        "x": 37, "y": 68,
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
        "x": 22, "y": 56,
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
        "x": 14, "y": 40,
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
        "x": 34, "y": 14,
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
        "x": 66, "y": 14,
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
        "x": 50, "y": 58,
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
        "x": 32, "y": 44,
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
        "x": 68, "y": 44,
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
# 2. ROUTES & API ENDPOINTS (LIGHTWEIGHT & ULTRA-FAST)
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
        
        islands_package.append({
            "id": node_id,
            "icon": node.get("icon", "📍"),
            "title": node.get("title", node_id),
            "subtitle": node.get("subtitle", ""),
            "badge": node.get("badge", "NODE"),
            "x": node.get("x", 50),
            "y": node.get("y", 50),
            "text": raw_text,
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
        return jsonify({"error": "Empty question"}), 400

    suffix = 'en'
    if 'ar' in lang: suffix = 'ar'
    elif 'fr' in lang: suffix = 'fr'

    node_info = TOUR_DATA.get(current_node, {})
    current_node_text = node_info.get(f'text_{suffix}', node_info.get('text_en', ''))

    lang_instruction = {
        "en": "Answer in 1 to 2 clear, engaging sentences in natural English. Keep it under 35 words.",
        "fr": "Répondez en 1 ou 2 phrases claires et dynamiques en français. Moins de 35 mots.",
        "ar": """جاوب في جملة أو جملتين واضحة ومباشرة بالدارجة التونسية المفهومة.
أقصى حد 30 كلمة.
مهم جداً: اكتب أسماء المنظمات والنوادي والمسابقات والمصطلحات التقنية بالحروف اللاتينية والإنجليزية كما هي (مثال: IEEE, ISSAT Sousse, TSYP 14, CS, RAS, PES, IAS, WIE, SIGHT, AI, NAO, Hackathon, WALL-E) ولا تكتبها بحروف عربية إطلاقاً."""
    }.get(suffix, "Answer in 1 to 2 short conversational sentences.")

    answer_prompt = f"""
    You are the official Interactive Digital AI Curator for IEEE ISSAT Sousse Student Branch at TSYP 14 in 2026.
    
    KNOWLEDGE BASE:
    {FULL_BRANCH_CONTEXT}

    ACTIVE ISLAND / NODE:
    Node: {current_node} ({node_info.get('title', '')})
    Context: "{current_node_text}"

    VISITOR QUESTION:
    "{user_text}"

    STRICT CONVERSATIONAL POLICY:
    1. Answer the question accurately, concisely, and enthusiastically.
    2. STRICT CONSTRAINT: Exactly 1 to 2 short sentences (UNDER 35 WORDS TOTAL) formatted for on-screen digital display.
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
            "en": "IEEE ISSAT Sousse celebrates 12 years of excellence at TSYP 14! Explore our technical achievements and projects.",
            "fr": "L'IEEE ISSAT Sousse célèbre 12 ans d'excellence à TSYP 14 ! Découvrez nos projets et nos réussites.",
            "ar": "أنا مرشدك الذكي في IEEE ISSAT Sousse في TSYP 14! اسألني على أي نادي أو مشروع."
        }
        ai_reply_text = fallbacks.get(suffix, fallbacks["en"])

    return jsonify({
        "mode": "CHAT",
        "response": ai_reply_text
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
        "mode": "text_kiosk"
    })

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    PORT = int(os.getenv("PORT", 5005))
    print(f"🚀 TSYP AI Kiosk running live on: http://localhost:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)