# 🤖 TSYP 13 AI Kiosk - Interactive Digital Museum & Voice Guide

![Status](https://img.shields.io/badge/Status-Completed-success)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![GCP](https://img.shields.io/badge/GCP-Vertex%20AI%20%2B%20Cloud%20TTS-green)
![Gemini](https://img.shields.io/badge/Brain-Gemini%202.5%20Flash-orange)
![License](https://img.shields.io/badge/License-MIT-green)

An interactive, voice-activated AI Kiosk developed for the **IEEE ISSAT Sousse Student Branch** at the **TSYP 13 Congress** (Booth: **UTOPIA**). Celebrating a full decade of leadership, innovation, and achievements (**2014 – 2024**).

---

## ✨ Key Upgrades & Features

* **🏛️ 10-Year Comprehensive Archive (2014–2024):** Fully rebuilt from official branch archives, featuring 11 interactive museum chapters and 36 genuine high-resolution event photos:
  1. **Welcome & Instructions**
  2. **Foundation (2014):** *"Come as students, Leave as leaders"*
  3. **Computer Society (CS):** Vecna Algorithm hackathon & IEEEXtreme
  4. **Robotics & Automation Society (RAS):** Humanoid NAO robot & Tunisian Innovation Days champions
  5. **Power & Energy Society (PES):** COPX 2.0, Green Tech & renewable wind farm expeditions
  6. **Industry Applications Society (IAS):** Industry 4.0, smart automation & Valeo visits
  7. **Women in Engineering (WIE):** #wielead, Small Business Showcase & Pinktober
  8. **Humanitarian Technology (SIGHT):** AI Gateway & Youth Scouts STEM education
  9. **Community Life:** Campus integration carnivals, hikes, cultural nights & Ramadan Iftars
  10. **A Decade of Achievements:** TSYP 12 TN 2056 Challenge winners & 10th anniversary milestone
  11. **TSYP 13 UTOPIA Booth & The Future:** Executive board connections & WALL-E environmental AI hackathon for Gabès
* **⚡ GCP Vertex AI & Cloud TTS Live:**
  - **Brain:** Vertex AI `gemini-2.5-flash` running on Google Cloud Project `callout6` for sub-second intent classification and conversational answers.
  - **Voice:** Production-grade Google Cloud Text-to-Speech API (`Journey-F`, `Neural2-A`, `Wavenet-B`) generating studio-quality MP3 speech live with zero rate-limit delay.
* **🌍 Trilingual Speech & Text:** Full support for **English**, **Français**, and **Tunisian Arabic (Derja / تونس)**.
* **✨ Futuristic Glassmorphic UI:** Cosmic starfall animations, dynamic sound-reactive glowing orb, audio equalizer waveform, chapter scrubber dots, and quick-topic question chips.
* **🛡️ Anti-Zombie Microphone Architecture:** Clean hardware release and silence detection preventing audio feedback loops in noisy congress halls.

---

## 🛠️ Tech Stack

* **Backend:** Python 3.14 / Flask / Flask-CORS
* **Cloud & AI:** Google Cloud Platform (Project `callout6`), Vertex AI SDK, Google Cloud TTS API
* **Frontend:** HTML5, CSS3 (Glassmorphism & Cyberpunk Neon tokens), Vanilla JavaScript
* **Audio:** HTML5 Audio API (MP3 / base64) + Web Speech API for voice recognition

---

## 🚀 Quickstart

1. **Activate Virtual Environment**
   ```bash
   source .venv/bin/activate
   ```

2. **Configure Environment Variables (`.env`)**
   ```env
   GCP_PROJECT=callout6
   GCP_LOCATION=us-central1
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/callout6-sa-key.json
   GCP_API_KEY=your_gcp_api_key
   PORT=5005
   ```

3. **Start the Application**
   ```bash
   python app.py
   ```
   Open your browser at `http://localhost:5005`.

---

## 🤝 Acknowledgments

Built with ❤️ for **IEEE ISSAT Sousse Student Branch** at the **TSYP 13 Congress**.

*Created by Mohamed Attia*