# 🤖 TSYP AI Kiosk - Interactive Voice Guide

![Status](https://img.shields.io/badge/Status-Completed-success)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Gemini](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-orange)
![License](https://img.shields.io/badge/License-MIT-green)

An interactive, voice-activated AI Kiosk developed for the **IEEE ISSAT Sousse Student Branch** at the **TSYP 13 Congress**. This system serves as a virtual museum guide, providing real-time, bilingual (English & Tunisian Arabic) tours of the branch's 10-year history.

## ✨ Features

* **🎙️ Real-Time Speech-to-Speech:** Powered by Google's **Gemini 2.0 Flash**, offering near-instant conversational responses.
* **🌍 Bilingual Support:** Native support for **English** and **Tunisian Arabic (Tounsi)**, enabling accessible interaction for local attendees.
* **🧠 Context-Aware Intelligence:** The AI understands "Tour Mode" vs. "Chat Mode" and knows exactly which visual slide the user is viewing, allowing for follow-up questions like *"Tell me more about this hackathon."*
* **🛑 Anti-Hallucination & Safety:** Robust error handling ensures the AI falls back gracefully if audio generation fails or inputs are unclear.
* **🔊 "Anti-Zombie" Microphone Logic:** Custom JavaScript engineering to prevent echo loops and microphone lock-ups in noisy event environments.

## 🛠️ Tech Stack

* **Backend:** Python (Flask)
* **AI Engine:** Google GenAI SDK (Gemini 2.0 Flash for logic + Gemini 2.5 Flash for TTS)
* **Frontend:** HTML5, CSS3 (Neon/Cyberpunk Style), Vanilla JavaScript
* **Audio:** Browser Web Speech API + Server-side PCM-to-WAV processing

## 🚀 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/tsyp-ai-kiosk.git](https://github.com/YOUR_USERNAME/tsyp-ai-kiosk.git)
    cd tsyp-ai-kiosk
    ```

2.  **Create a Virtual Environment**
    ```bash
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # Mac/Linux
    source .venv/bin/activate
    ```

3.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure API Key**
    * Rename `.env.example` to `.env`
    * Add your Google Gemini API Key:
        ```text
        GEMINI_API_KEY=your_key_here
        ```

5.  **Run the Application**
    ```bash
    python app.py
    ```
    * Open your browser and go to `http://localhost:5000`

## 🧠 How It Works

1.  **The "Brain":** A Flask backend routes user audio transcripts to Gemini 2.0.
2.  **The Router:** A custom logic layer determines if the user wants to start a "Tour" (scripted visual presentation) or "Chat" (Q&A).
3.  **The Voice:** Responses are converted to high-quality audio using Gemini's TTS capabilities and streamed back to the browser in base64.
4.  **The Interface:** A responsive frontend manages state (Listening, Thinking, Speaking) with visual feedback via a glowing animated orb.

## 🤝 Acknowledgments

Built with ❤️ for **IEEE ISSAT Sousse SB** and the **Tunisian Student & Young Professional (TSYP) Congress**.

---
*Created by Mohamed Attia*