import { useState, useRef, useEffect, FormEvent } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2, Info, Volume2, BookOpen, X, Play, Music, VolumeX, Globe, ExternalLink } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY ?? '' });

/** Returns true when the key looks like a real key (not missing/placeholder) */
function isApiKeyConfigured() {
  return !!GEMINI_API_KEY && GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && GEMINI_API_KEY.length > 10;
}

const SYSTEM_INSTRUCTION = `
You are "Ibuye," a specialized AI assistant designed for the Gemini Hack Kigali. Your goal is to help Rwandan citizens understand and navigate government services (like ID applications, land titles, or birth certificates).

**Your Core Personas:**
1. **Bilingual Expert:** You must be able to switch seamlessly between English and Kinyarwanda. If a user asks in Kinyarwanda, respond in Kinyarwanda.
2. **Simplified Guide:** Government jargon is hard. Break down requirements into simple, numbered steps.
3. **Local Context:** You understand the Rwandan administrative hierarchy (Village, Cell, Sector, District).

**Instructions for the MVP:**
- When a user asks about a service (e.g., "How do I get a new ID?"), provide:
  1. **Prerequisites:** What documents or info do they need (e.g., Application number, witness details)?
  2. **Estimated Cost:** Mention the price in RWF if known.
  3. **The 'Next Step':** Tell them exactly which button to look for on the Irembo website.
- If the user's request is vague, ask clarifying questions like "Do you already have an Irembo account?" or "Is this for a renewal or a new application?"
- ALWAYS maintain a helpful, polite, and patriotic tone suitable for a public service assistant.

**Constraints:**
- Do NOT hallucinate fees. If unsure, say "Please check the latest fee on the official Irembo portal."
- Avoid long walls of text. Use bullet points.
`;

const FAQ_SYSTEM_INSTRUCTION = `
You are the Irembo Knowledge Base. 
When providing FAQ content, you must always return a JSON array of objects. 
Each object must contain:
- "id": a unique number
- "category": the service type (e.g., "ID Card", "Transport")
- "question": The question in English and Kinyarwanda
- "answer": The detailed steps in both languages.
`;

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

type FAQ = {
  id: number;
  category: string;
  question: string;
  answer: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Muraho! Welcome to Ibuye. How can I help you with Rwandan government services today? (Ukeneye ubufasha bw\'Irembo?)',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicGreeting, setDynamicGreeting] = useState<string | null>(null);
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);
  
  // FAQ State
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isFaqLoading, setIsFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState(false);

  // Rwanda Info State
  const [isRwandaOpen, setIsRwandaOpen] = useState(false);
  
  const [hasStarted, setHasStarted] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Create chat instance
  const chatRef = useRef(
    ai.chats.create({
      model: 'gemini-2.0-flash-lite',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    })
  );

  /** Re-creates the chat session — called after errors to avoid a broken session */
  const resetChat = () => {
    chatRef.current = ai.chats.create({
      model: 'gemini-2.0-flash-lite',
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 },
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStart = () => {
    setHasStarted(true);
    if (audioRef.current) {
      audioRef.current.volume = 0.1; // 10% volume for background music
      audioRef.current.play().catch(console.error);
      setIsMusicPlaying(true);
    }
    triggerDynamicGreeting();
  };

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsMusicPlaying(!isMusicPlaying);
    }
  };

  const triggerDynamicGreeting = async () => {
    setIsGreetingLoading(true);
    try {
      // 1. Get current Kigali Time
      const kigaliTime = new Intl.DateTimeFormat('en-GB', {
        timeStyle: 'short',
        timeZone: 'Africa/Kigali',
      }).format(new Date());

      // 2. Ask Gemini for the greeting
      const prompt = `The current time in Kigali is ${kigaliTime}. Generate a dynamic welcome greeting for Ibuye. It should be welcoming, mention the time of day appropriately, and be bilingual (English/Kinyarwanda).`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              voice_text: {
                type: Type.STRING,
                description: 'The text to be spoken aloud. Keep it simple and phonetic for English TTS.',
              },
              display_text: {
                type: Type.STRING,
                description: 'The text to be displayed on the screen.',
              },
            },
            required: ['voice_text', 'display_text'],
          },
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        // Speak it (best-effort — may be silent if browser blocks autoplay)
        try {
          const speech = new SpeechSynthesisUtterance(data.voice_text);
          speech.lang = 'en-US';
          window.speechSynthesis.speak(speech);
        } catch (_) {
          // TTS unavailable — display text still shown
        }
        setDynamicGreeting(data.display_text);
      } else {
        throw new Error('Empty response from Gemini');
      }
    } catch (error) {
      console.error('Failed to generate dynamic greeting:', error);
      // Fallback: show a static greeting so something is always visible
      const kigaliHour = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Africa/Kigali' })
      ).getHours();
      const timeOfDay = kigaliHour < 12 ? 'morning' : kigaliHour < 17 ? 'afternoon' : 'evening';
      setDynamicGreeting(`Good ${timeOfDay}! Muraho! Welcome to Ibuye — your guide to Rwandan government services. / Murakaza neza kuri Ibuye!`);
    } finally {
      setIsGreetingLoading(false);
    }
  };

  const loadFaqs = async () => {
    setIsFaqOpen(true);
    if (faqs.length > 0) return; // Already loaded

    setIsFaqLoading(true);
    setFaqError(false);
    try {
      const prompt = `Generate 5 common FAQ items for Irembo services (e.g., National ID, Driving License, Birth Certificate, Land Titles, Criminal Record).`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: FAQ_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          // Gemini requires an object as the root schema — array is wrapped in { faqs: [...] }
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              faqs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                  },
                  required: ['id', 'category', 'question', 'answer'],
                },
              },
            },
            required: ['faqs'],
          },
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        setFaqs(data.faqs ?? []);
      }
    } catch (error) {
      console.error('Failed to load FAQs:', error);
      setFaqError(true);
    } finally {
      setIsFaqLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', text: userMessage },
    ]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMessage });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response.text || 'Sorry, I could not process that request.',
        },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Extract a readable error message to show in the chat
      const errMsg = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `⚠️ **Error:** ${errMsg}\n\nIf this says _API key not valid_, please check that your \`.env\` file contains a real Gemini API key.`,
        },
      ]);
      // Reset the chat session so future messages aren't stuck in a broken state
      resetChat();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans relative">
      {!hasStarted && (
        <div className="absolute inset-0 bg-rwanda-blue flex flex-col items-center justify-center text-white z-50">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/17/Flag_of_Rwanda.svg" alt="Rwanda Flag" className="w-32 h-auto mb-8 rounded shadow-lg border border-white/20" />
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-center tracking-tight">Ibuye</h1>
          <p className="text-xl mb-12 text-blue-100 text-center max-w-md px-4">Your reliable AI guide to Rwandan government services</p>
          <button 
            onClick={handleStart}
            className="bg-rwanda-yellow text-gray-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-400 transition-all hover:scale-105 flex items-center gap-3 shadow-xl"
          >
            <Play className="w-6 h-6 fill-current" />
            Start Experience / Tangira
          </button>
        </div>
      )}

      <audio ref={audioRef} src="https://upload.wikimedia.org/wikipedia/commons/3/34/Sound_of_African_Drums.ogg" loop />

      {/* Header */}
      <header className="bg-rwanda-blue text-white shadow-md z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-4 py-1.5 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-rwanda-blue font-extrabold text-xl tracking-tight">Ibuye</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Ibuye</h1>
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/1/17/Flag_of_Rwanda.svg" 
                  alt="Flag of Rwanda" 
                  className="h-4 w-6 object-cover rounded-sm shadow-sm border border-white/20"
                />
              </div>
              <p className="text-xs text-blue-100 font-medium hidden sm:block">Your reliable AI guide to Rwandan government services</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsRwandaOpen(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-full text-sm font-medium"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Rwanda</span>
            </button>
            <button 
              onClick={loadFaqs}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-full text-sm font-medium"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Knowledge Base</span>
            </button>
            <button 
              onClick={toggleMusic}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-full text-sm font-medium"
              title="Toggle Background Music"
            >
              {isMusicPlaying ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button 
              onClick={triggerDynamicGreeting}
              disabled={isGreetingLoading}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {isGreetingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">Play Greeting</span>
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm bg-blue-800/30 px-3 py-1.5 rounded-full border border-blue-400/30">
              <div className="w-2 h-2 rounded-full bg-rwanda-yellow animate-pulse"></div>
              <span>EN/RW</span>
            </div>
          </div>
        </div>
        {/* Rwandan Flag Accent */}
        <div className="flex h-1.5 w-full">
          <div className="bg-rwanda-blue flex-1"></div>
          <div className="bg-rwanda-yellow flex-[0.5]"></div>
          <div className="bg-rwanda-green flex-[0.5]"></div>
        </div>
      </header>

      {/* API Key Warning Banner */}
      {!isApiKeyConfigured() && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-center text-sm font-medium text-red-700">
          ⚠️ <strong>API key not configured.</strong> Add your <code className="bg-red-100 px-1 rounded">GEMINI_API_KEY</code> to the <code className="bg-red-100 px-1 rounded">.env</code> file and restart the dev server.{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-semibold">Get a free key →</a>
        </div>
      )}

      {/* Dynamic Greeting Banner */}
      {dynamicGreeting && (
        <div className="bg-rwanda-yellow/20 border-b border-rwanda-yellow/40 px-4 py-3 text-center text-sm font-medium text-gray-800 animate-in slide-in-from-top-2 fade-in duration-300">
          {dynamicGreeting}
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-800 shadow-sm">
            <Info className="w-5 h-5 text-rwanda-blue shrink-0 mt-0.5" />
            <p>
              This is Ibuye, an AI assistant designed to help you navigate Irembo. It provides guidance on prerequisites, costs, and steps. Always verify final details on the official <a href="https://irembo.gov.rw" target="_blank" rel="noreferrer" className="font-semibold underline hover:text-rwanda-blue">Irembo portal</a>.
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-6 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                  msg.role === 'user' ? "bg-rwanda-green text-white" : "bg-white border-2 border-rwanda-blue text-rwanda-blue"
                )}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={24} />}
                </div>

                {/* Message Bubble */}
                <div className={cn(
                  "rounded-2xl px-5 py-4 shadow-sm",
                  msg.role === 'user' 
                    ? "bg-rwanda-green text-white rounded-tr-sm" 
                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                )}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-4 max-w-[85%]">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-rwanda-blue text-rwanda-blue flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={24} />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-rwanda-blue animate-spin" />
                  <span className="text-sm text-gray-500 font-medium">Processing request...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="flex items-end gap-2 bg-gray-50 border border-gray-300 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-rwanda-blue/50 focus-within:border-rwanda-blue transition-all"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask about an Irembo service (e.g., 'How do I renew my ID?')"
              className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-gray-800 placeholder:text-gray-400"
              rows={1}
              style={{ height: 'auto' }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-rwanda-blue hover:bg-blue-600 text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center h-[44px] w-[44px]"
              aria-label="Send message"
            >
              <Send size={20} className={cn(input.trim() && !isLoading ? "translate-x-0.5 -translate-y-0.5" : "", "transition-transform")} />
            </button>
          </form>
          <div className="text-center mt-2">
            <p className="text-xs text-gray-400">
              Press <kbd className="font-sans px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px]">Enter</kbd> to send, <kbd className="font-sans px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px]">Shift + Enter</kbd> for new line
            </p>
          </div>
          <div className="text-center mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Built for{' '}
              <a
                href="https://gemini-hack-kigali.devpost.com/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-rwanda-blue hover:underline"
              >
                Gemini Hack Kigali
              </a>
              {' '}· April 1, 2026 · Built by <span className="font-medium text-gray-500">Vee (Srividya Narayanan)</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Rwanda Info Modal */}
      {isRwandaOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <img src="https://upload.wikimedia.org/wikipedia/commons/1/17/Flag_of_Rwanda.svg" alt="Rwanda Flag" className="h-5 w-7 object-cover rounded-sm border border-gray-200" />
                <h2 className="font-semibold text-lg text-gray-900">Rwanda & Irembo Services</h2>
              </div>
              <button onClick={() => setIsRwandaOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">

              {/* Quick Facts */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">About Rwanda's Digital Government</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Capital', value: 'Kigali' },
                    { label: 'Language', value: 'Kinyarwanda, English, French' },
                    { label: 'E-Gov Platform', value: 'Irembo' },
                    { label: 'Currency', value: 'Rwandan Franc (RWF)' },
                    { label: 'Population', value: '≈ 14 million' },
                    { label: 'Services Online', value: '100+ via Irembo' },
                  ].map(f => (
                    <div key={f.label} className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-rwanda-blue font-semibold mb-0.5">{f.label}</p>
                      <p className="text-sm text-gray-800 font-medium">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Links */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Key Irembo Service Links</h3>
                <div className="space-y-2">
                  {[
                    {
                      category: '🪪 Identity & Civil Status',
                      links: [
                        { label: 'National ID Application / Renewal', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Birth Certificate', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Marriage Certificate', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Death Certificate', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                      ]
                    },
                    {
                      category: '🚗 Transport',
                      links: [
                        { label: 'Driving License (New / Renewal)', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Vehicle Registration', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Vehicle Inspection', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                      ]
                    },
                    {
                      category: '🏡 Land Services',
                      links: [
                        { label: 'Land Title / Transfer', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Land Plot Search', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                      ]
                    },
                    {
                      category: '⚖️ Justice & Security',
                      links: [
                        { label: 'Criminal Record (Icyemezo cy\'Ubuzima bw\'Amategeko)', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                        { label: 'Good Conduct Certificate', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                      ]
                    },
                    {
                      category: '🏥 Health',
                      links: [
                        { label: 'Mutuelle de Santé (CBHI) Registration', url: 'https://irembo.gov.rw/home/citizen/all_services' },
                      ]
                    },
                  ].map(section => (
                    <div key={section.category} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">{section.category}</div>
                      <div className="divide-y divide-gray-50">
                        {section.links.map(link => (
                          <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors group"
                          >
                            <span className="text-sm text-gray-700 group-hover:text-rwanda-blue transition-colors">{link.label}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-rwanda-blue shrink-0 ml-2 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Official Portal CTA */}
              <a
                href="https://irembo.gov.rw"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-rwanda-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
              >
                <Globe className="w-4 h-4" />
                Open Official Irembo Portal
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {isFaqOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2 text-rwanda-blue">
                <BookOpen className="w-5 h-5" />
                <h2 className="font-semibold text-lg">Ibuye Knowledge Base</h2>
              </div>
              <button 
                onClick={() => setIsFaqOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isFaqLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
                  <Loader2 className="w-8 h-8 text-rwanda-blue animate-spin" />
                  <p>Loading frequently asked questions...</p>
                </div>
              ) : faqError ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                  <p className="text-red-500 font-medium">Failed to load the knowledge base.</p>
                  <p className="text-sm text-gray-400">Check your API key or internet connection.</p>
                  <button
                    onClick={() => { setFaqError(false); setFaqs([]); loadFaqs(); }}
                    className="mt-2 px-4 py-2 bg-rwanda-blue text-white text-sm rounded-full hover:bg-blue-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {faqs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400 text-sm">
                      <p>No results found. Try closing and reopening.</p>
                    </div>
                  ) : faqs.map((faq) => (
                    <div key={faq.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="inline-block px-2 py-1 bg-blue-50 text-rwanda-blue text-xs font-semibold rounded-md mb-3">
                        {faq.category}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg leading-snug">
                        {faq.question}
                      </h3>
                      <div className="text-gray-600 text-sm whitespace-pre-wrap">
                        {faq.answer}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
