from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google import genai
from google.genai import types
import io, os, wave, base64, json, time
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY: raise ValueError("No API_KEY found!")

app = Flask(__name__, static_folder='.')
CORS(app)

client = genai.Client(api_key=API_KEY)

# --- CONFIGURATION ---
BRAIN_MODEL = "gemini-2.0-flash" 
# REVERTING TO THE ONLY WORKING AUDIO MODEL
VOICE_MODEL = "gemini-2.5-flash-preview-tts" 
VOICE_NAME = "Kore"

# Ensure cache directory exists
CACHE_DIR = "audio_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# ==========================================
# 1. THE TOUR SCRIPT (Detailed ~20s Versions)
# ==========================================
TOUR_DATA = {
    "GREETING": {
        "text_en": "Hello! I am ready to help. You can ask me questions, or say 'Start Tour' to begin the visual presentation.",
        "text_fr": "Bonjour! Je suis prêt. Posez-moi vos questions, ou dites 'Commencer' pour lancer la visite visuelle.",
        "text_ar": "عسلامة. أنا حاضر. تنجم تسألني، ولا قول ابدأ بش تبدا الدورة.",
        "images": [] # No images for greeting
    },
    "INTRO": {
        "text_en": "Welcome to TSYP! I am your AI Guide for the IEEE ISSAT Sousse Student Branch, celebrating our journey from 2015 to 2025. We are more than just a technical chapter; we are a family driven by passion, support, and innovation. I can take you on a visual tour of our history, explain our upcoming Wall-E Hackathon, or answer your questions about Green Tech. Let's begin!",
        "text_fr": "Bienvenue à TSYP! Je suis votre guide IA pour la branche étudiante IEEE ISSAT Sousse, célébrant notre parcours de 2015 à 2025. Plus qu'un simple chapitre technique, nous sommes une famille unie par la passion et l'innovation. Je peux vous faire visiter notre histoire, vous expliquer le Hackathon Wall-E, ou répondre à vos questions. Commençons!",
        "text_ar": "عسلامة ومرحباً بيك في TSYP! أنا هو الـ AI Guide متاع فرع IEEE ISSAT Sousse، نحتفلو بمشوارنا من 2015 لـ 2025. أحنا أكثر من مجرد شابتر تقني، أحنا عائلة تجمعنا الشغف والابتكار. نجم نعملك دورة في تاريخنا، نحكيلك على WALL-E Hackathon، ولا نجاوبك على أي سؤال على الـ Green Tech. هيا نبـداو!",
        "images": ["assets/1.png"]
    },
    "CS": {
        "text_en": "Welcome to the Computer Society Chapter, where code meets pure creativity. We are famous for Vecna Algorithm, our dark-themed hackathon that pushes developers to their limits. We also host IEEEXtreme, the global 24-hour coding challenge where our teams compete against the world. It is a place of intense focus and innovation.",
        "text_fr": "Bienvenue au chapitre Computer Society, où le code rencontre la créativité. Nous sommes célèbres pour Vecna Algorithm, un hackathon intense qui pousse les développeurs à leurs limites. Nous organisons aussi IEEEXtreme, le défi mondial de 24 heures. C'est un lieu d'innovation pure.",
        "text_ar": "مرحباً بيك في CS Chapter، وين الكود يتلاقى بالإبداع. أحنا معروفين بـ Vecna Algorithm الهاكاثون المشهور متاعنا، اللي يتحدى المطورين لأقصى حد. نظمنا زادة IEEEXtreme، التحدي العالمي بو 24 ساعة. هوني وين التركيز والابتكار يصيرو.",
        "images": ["assets/2.png", "assets/3.png"]
    },
    "IAS": {
        "text_en": "The Industry Applications Society is our bridge to the professional world, focusing heavily on Industry 4.0. We explored smart automation and digital transformation deeply. A highlight was our industrial visit to Valeo, where we saw the future of automotive manufacturing and sustainable mobility in action.",
        "text_fr": "La société Industry Applications est notre pont vers le monde professionnel, axée sur l'Industrie 4.0. Nous avons exploré l'automatisation intelligente et la transformation digitale. Notre visite à Valeo nous a montré l'avenir de la fabrication automobile.",
        "text_ar": "الـ IAS هي القنطرة متاعنا للعالم المهني، نركزو برشا على الـ Industry 4.0. اكتشفنا الـ Automation الذكية والتحول الرقمي. زرنا شركات كبار كيما Valeo بش نشوفو مستقبل صناعة الكراهب والتنقل الذكي في تونس.",
        "images": ["assets/4.png", "assets/5.png"]
    },
    "RAS": {
        "text_en": "The Robotics and Automation Society is where we turn abstract ideas into moving reality. Through our intensive Arduino workshops, we empower members to build their own embedded systems from scratch. Whether it is a simple circuit or a complex robot, this is where engineering comes to life.",
        "text_fr": "La RAS est l'endroit où nous transformons les idées abstraites en réalité. Grâce à nos ateliers Arduino intensifs, nous apprenons aux membres à construire leurs propres systèmes embarqués. C'est ici que l'ingénierie prend vie.",
        "text_ar": "في RAS، نحولو الأفكار لحقيقة تتحرك. بالـ Workshops متاع الـ Arduino، نعلمو الأعضاء كيفاش يبنيو الـ Systèmes متاعهم من الصفر. سواء كانت Circuit بسيطة ولا روبو معقد، هوني وين الهندسة تولي حقيقة.",
        "images": ["assets/6.png"]
    },
    "PES": {
        "text_en": "The Power and Energy Society hosted the massive COPX 2.0 event at ENISo. It was a gathering of brilliant minds discussing the intersection of AI, IoT, and biodiversity. We are committed to finding sustainable energy solutions that protect our planet for future generations.",
        "text_fr": "La PES a organisé l'événement majeur COPX 2.0 à l'ENISo. C'était un rassemblement d'esprits brillants discutant de l'IA, de l'IoT et de la biodiversité. Nous nous engageons à trouver des solutions énergétiques durables.",
        "text_ar": "PES نظمت الـ Event الكبير COPX 2.0 في ENISo. لمينا فيه الخبراء بش نحكيو على الـ AI والـ IoT والبيئة. أحنا نلوجو على حلول طاقة نظيفة بش نحافظو على الأرض للأجيال الجاية.",
        "images": ["assets/7.png", "assets/8.png"]
    },
    "WIE": {
        "text_en": "Women in Engineering is about empowerment and community impact. We hosted the Small Business Showcase to support local creators selling art and jewelry. We also stood strong for Pinktober, raising awareness and support for breast cancer research with a dedicated stall.",
        "text_fr": "Women in Engineering, c'est l'autonomisation et l'impact communautaire. Nous avons soutenu les créateurs locaux avec le Small Business Showcase. Nous avons aussi soutenu Pinktober pour la sensibilisation au cancer du sein.",
        "text_ar": "WIE هي قوة النساء في الهندسة. عاونا المشاريع الصغيرة بـ Small Business Showcase وين باعو الفن والمجوهرات. وزادة وقفنا مع Pinktober بش نعاونو في التوعية ضد سرطان الثدي.",
        "images": ["assets/9.png", "assets/10.png", "assets/11.png", "assets/12.png", "assets/13.png", "assets/14.png"]
    },
    "SIGHT": {
        "text_en": "SIGHT focuses on humanitarian technology—using our skills to help others. Our AI Gateway Workshop was designed to demystify artificial intelligence for non-technical people, showing them how these powerful tools can be used for social good and problem-solving.",
        "text_fr": "SIGHT se concentre sur la technologie humanitaire. Notre atelier AI Gateway a été conçu pour démystifier l'intelligence artificielle pour les non-techniciens, montrant comment utiliser ces outils pour le bien social.",
        "text_ar": "SIGHT تركز على التكنولوجيا الإنسانية. الـ AI Gateway Workshop متاعنا كان بش يفهم العباد العاديين شنوة الـ AI، وكيفاش نجمو نستعملوه للخير وحلان المشاكل الاجتماعية.",
        "images": ["assets/15.png", "assets/16.png"]
    },
    "WALLE": {
        "text_en": "Finally, let's talk about the Future: The WALL-E Hackathon. Inspired by the movie, this event tackles the pollution crisis in Gabès. It is a conception-based challenge using AI and Data—no robots required. It directly aligns with UN SDGs 3, 11, 14, and 15. Do you have any questions about it?",
        "text_fr": "Enfin, parlons du futur: le Hackathon WALL-E. Inspiré du film, il s'attaque à la pollution à Gabès. C'est un défi de conception utilisant l'IA et les données, aligné sur les ODD de l'ONU. Avez-vous des questions?",
        "text_ar": "أخيراً، نحكيو على المستقبل: WALL-E Hackathon. مستوحي من الفيلم، بش نحاربو التلوث في قابس. هو Challenge متاع Conception بالـ AI والـ Data، ويتبع أهداف الأمم المتحدة للتنمية المستدامة. عندكشي أي سؤال عليه؟",
        "images": ["assets/hackathon.jpg"]
    }
}

# ==========================================
# 2. THE CACHING SYSTEM (STRICT SAFETY)
# ==========================================
def raw_to_wav(pcm_data):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(24000)
        wav_file.writeframes(pcm_data)
    return buffer.getvalue()

def get_audio_cached_safe(text, filename_key):
    filepath = os.path.join(CACHE_DIR, f"{filename_key}.wav")
    
    # 1. Check Cache
    if os.path.exists(filepath):
        with open(filepath, "rb") as f:
            wav_data = f.read()
        return base64.b64encode(wav_data).decode('utf-8')

    # 2. Generate
    print(f"   🎙️ Generating: {filename_key}...", end=" ", flush=True)
    
    # STRICT SAFETY: 10 seconds sleep = 6 requests per minute.
    # This guarantees we stay under the 10 RPM limit.
    time.sleep(10)
    
    try:
        resp = client.models.generate_content(
            model=VOICE_MODEL, contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"], 
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE_NAME)
                    )
                )
            )
        )
        if resp.candidates:
            raw_audio = resp.candidates[0].content.parts[0].inline_data.data
            wav_data = raw_to_wav(raw_audio)
            
            with open(filepath, "wb") as f:
                f.write(wav_data)
            
            print("✅ Done.")
            return base64.b64encode(wav_data).decode('utf-8')
        else:
            print("❌ Blocked.")
            return None
    except Exception as e:
        print(f"⚠️ Error: {e}")
    
    return None

def cache_everything_on_startup():
    print("=======================================")
    print("💿 STARTUP: Verifying Audio Cache")
    print("⚠️  Mode: Strict Safety (10s delay/file)")
    print("⏳ This will take about 6 minutes.")
    print("=======================================")
    
    files_generated = 0
    
    for chapter, data in TOUR_DATA.items():
        langs = [('en', data['text_en']), ('fr', data['text_fr']), ('ar', data['text_ar'])]
        
        for lang_code, text in langs:
            file_key = f"{chapter}_{lang_code}"
            
            if not os.path.exists(os.path.join(CACHE_DIR, f"{file_key}.wav")):
                get_audio_cached_safe(text, file_key)
                files_generated += 1
            else:
                get_audio_cached_safe(text, file_key)

    print(f"\n✅ SYSTEM READY. {files_generated} new files generated.")
    print("=======================================")

# ==========================================
# 3. ROUTES & LOGIC
# ==========================================

# KNOWLEDGE BASE
HISTORY_CONTEXT = """
CHAPTER 1: IEEE ISSATSO SB (Intro)
"IEEE ISSATSO SB (2015 - 2025) is a family. We believe in empowering each other."
CHAPTER 2: CS Chapter (Computer Society)
"Vecna Algorithm is our dark-themed hackathon. IEEEXtreme is our 24h challenge."
CHAPTER 3: IAS (Industry Applications Society)
"Focused on Industry 4.0 and Smart Automation. Visited Valeo."
CHAPTER 4: RAS (Robotics & Automation Society)
"Workshops on Arduino and embedded systems."
CHAPTER 5: PES (Power & Energy Society)
"Organized COPX 2.0 about AI, IoT, and Biodiversity."
CHAPTER 6: WIE (Women In Engineering)
"Small Business Showcase and Pinktober awareness."
CHAPTER 7: SIGHT (Humanitarian Technology)
"AI Gateway Workshop for social good."
"""
FUTURE_CONTEXT = """
CHAPTER FUTURE: WALL-E Hackathon
"Environmental innovation event for Gabès pollution using AI/Data."
"""

@app.route('/get_tour_data', methods=['POST'])
def get_tour_data():
    lang = request.json.get('lang', 'en')
    suffix = 'en'
    if 'ar' in lang: suffix = 'ar'
    elif 'fr' in lang: suffix = 'fr'
    
    tour_package = []
    chapter_order = ["GREETING", "INTRO", "CS", "IAS", "RAS", "PES", "WIE", "SIGHT", "WALLE"]
    
    for chapter in chapter_order:
        raw_text = TOUR_DATA[chapter][f'text_{suffix}']
        audio_b64 = get_audio_cached_safe(raw_text, f"{chapter}_{suffix}")
        
        tour_package.append({
            "id": chapter,
            "text": raw_text,
            "audio": audio_b64,
            "images": TOUR_DATA[chapter]['images']
        })
        
    return jsonify({"tour": tour_package})

@app.route('/chat_router', methods=['POST'])
def chat_router():
    data = request.json
    user_text = data.get('text', '')
    lang = data.get('lang', 'en')
    current_chapter = data.get('chapter', 'GENERAL') 
    
    # 0. GET CONTEXT (Short-term memory of the slide)
    # This helps the AI answer "What did you just say?"
    context_text = TOUR_DATA.get(current_chapter, {}).get('text_en', '')

    # 1. CLASSIFY INTENT
    sys_prompt = f"""
    User Input: "{user_text}"
    Current View: {current_chapter}
    Slide Info: "{context_text}"
    
    Knowledge:
    {HISTORY_CONTEXT}
    {FUTURE_CONTEXT}
    
    Task: Classify Intent.
    - "TOUR": If user EXPLICITLY asks to start the presentation.
      Keywords: "start", "begin", "show me history", "commencer", "visite", "abda", "ebda", "bda", "joula".
      
    - "CHAT": If user asks a question about the current slide, the club, or details.
    
    Output only: TOUR or CHAT
    """
    
    try:
        # Ask Brain: "What does the user want?"
        resp = client.models.generate_content(model=BRAIN_MODEL, contents=sys_prompt)
        decision = resp.text.strip().upper().replace(" ", "")
    except:
        decision = "CHAT"
    
    # 2. ACT ON DECISION
    # If Brain says TOUR, we STOP here and tell the frontend to switch modes.
    if "TOUR" in decision:
        return jsonify({"mode": "TOUR"})
    
    # 3. GENERATE CHAT ANSWER (Only if it wasn't a Tour)
    answer_prompt = f"""
    You are the AI Guide for IEEE ISSAT Sousse.
    
    CONTEXT: The user is currently looking at the '{current_chapter}' slide.
    
    [WHAT YOU JUST TOLD THE USER (Slide Script)]:
    "{context_text}"
    
    [Specific Knowledge]:
    {HISTORY_CONTEXT}
    {FUTURE_CONTEXT}
    
    INSTRUCTIONS:
    1. If the user asks about something mentioned in the [Slide Script], explain it further.
    2. If the question is General (e.g., "What is AI?"), use your own knowledge.
    
    User Question: "{user_text}"
    Language: {lang} (Use Arabizi if 'ar').
    Constraint: Answer in 2 short sentences. Be helpful and confident.
    """
    
    try:
        # A. Get Text Answer
        chat_resp = client.models.generate_content(model=BRAIN_MODEL, contents=answer_prompt)
        
        # Safety Check for Empty Content
        if not chat_resp.candidates or not chat_resp.candidates[0].content or not chat_resp.candidates[0].content.parts:
            ai_text = "Désolé, je ne peux pas répondre." if lang == 'fr' else "Sorry, I cannot answer that."
        else:
            ai_text = chat_resp.text

        # B. Get Audio
        audio_b64 = None
        try:
            t_resp = client.models.generate_content(
                model=VOICE_MODEL, contents=ai_text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"], 
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE_NAME)
                        )
                    )
                )
            )
            # CRITICAL FIX: Check if content actually exists before accessing .parts
            if (t_resp.candidates and t_resp.candidates[0].content and t_resp.candidates[0].content.parts):
                raw_audio = t_resp.candidates[0].content.parts[0].inline_data.data
                audio_b64 = base64.b64encode(raw_to_wav(raw_audio)).decode('utf-8')
        except Exception as e:
            print(f"TTS Error: {e}")

        return jsonify({"mode": "CHAT", "response": ai_text, "audio": audio_b64})

    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/')
def serve_index(): return send_from_directory('.', 'index.html')
@app.route('/<path:path>')
def serve_static(path): return send_from_directory('.', path)

if __name__ == '__main__':
    cache_everything_on_startup()
    app.run(port=5000, debug=True)