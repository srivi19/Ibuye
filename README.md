# Ibuye — Your AI Guide to Rwandan Government Services

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/1/17/Flag_of_Rwanda.svg" alt="Rwanda Flag" width="120" />

  <h3>AI-powered assistant for navigating Irembo government services</h3>

  <p>
    <strong>Muraho!</strong> Ibuye helps Rwandan citizens understand and navigate government services (ID applications, land titles, birth certificates, and more) in both <strong>English</strong> and <strong>Kinyarwanda</strong>.
  </p>
</div>

---

## ✨ Features

- 🤖 **Bilingual AI Chat** — Responds in English or Kinyarwanda based on your question
- 📋 **Step-by-step Guidance** — Clear prerequisites, costs (RWF), and next steps for any Irembo service
- 📚 **Knowledge Base** — AI-generated FAQ for common services (ID, Driving License, Birth Certificate, Land Titles, Criminal Record)
- 🔊 **Dynamic Voice Greeting** — Time-aware bilingual welcome using Web Speech API
- 🎵 **Ambient Background Music** — Optional ambient audio for a pleasant experience

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| AI | Google Gemini 2.0 Flash (`@google/genai`) |
| Icons | Lucide React |

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ibuye.git
   cd ibuye
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set your API key**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API key
   # Get one free at: https://aistudio.google.com/app/apikey
   ```

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## 🌍 Deployment

Build the production bundle:
```bash
npm run build
```
The `dist/` folder can be served by any static hosting provider (Vercel, Netlify, GitHub Pages, etc.).

> **Note:** Set the `GEMINI_API_KEY` environment variable in your hosting platform's settings.

## 📄 License

MIT
