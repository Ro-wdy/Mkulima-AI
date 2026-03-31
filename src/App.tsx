/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Leaf, 
  TrendingUp, 
  Camera, 
  Image as ImageIcon, 
  X, 
  Loader2,
  User,
  Bot,
  ChevronRight
} from 'lucide-react';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  role: 'user' | 'model';
  content: string;
  image?: string;
}

const SYSTEM_INSTRUCTION = `You are an AI agricultural assistant for small-scale farmers in Kenya.
Your role is to help farmers make decisions about crop health, market prices, and farming practices.

Requirements:
1. Always respond in a mix of simple English, Swahili, and Sheng depending on the user's tone.
2. Keep responses practical, short, and actionable.
3. If a farmer describes crop issues:
   - Identify the possible disease or problem
   - Explain the cause in simple terms
   - Suggest affordable local solutions (e.g., wood ash, neem oil, crop rotation)
4. If a farmer asks about selling crops:
   - Suggest the best time to sell
   - Estimate a fair price based on general market trends in Kenya (e.g., Nairobi, Mombasa, Kisumu)
   - Give negotiation tips
5. If unsure, ask a follow-up question instead of guessing.
6. Always prioritize low-cost and locally available solutions.
7. Use a friendly, supportive, and farmer-focused tone.
8. If an image is provided, analyze it for crop diseases or pests.

Example interactions:
User: Mahindi yangu ina yellow leaves, shida ni nini?
AI: Inaweza kuwa nitrogen deficiency ama disease kama maize streak virus. Jaribu kuongeza fertilizer kama CAN. Also check if kuna pests.

User: Niuzaje nyanya leo?
AI: Leo bei inaweza kuwa low kidogo. If possible, ngoja kesho or sell early morning. Target price: around KES 80–100 per kilo depending on market.`;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: "Habari mkulima! Mimi ni Mkulima AI. Naweza kukusaidia na mambo ya ukulima, magonjwa ya mimea, au bei ya soko. Una swali gani leo?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      });

      let response;
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.split(';')[0].split(':')[1];
        
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: input || "Analyze this crop image for issues." },
              { inlineData: { data: base64Data, mimeType } }
            ]
          },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          }
        });
      } else {
        response = await chat.sendMessage({ message: input });
      }

      const modelResponse: Message = {
        role: 'model',
        content: response.text || "Pole, sijapata jibu sahihi. Unaweza kuuliza tena?"
      };

      setMessages(prev => [...prev, modelResponse]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        content: "Samahani, kuna shida kidogo na mtandao. Jaribu tena baadaye."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Bei ya Nyanya", icon: <TrendingUp className="w-4 h-4" />, query: "Niuzaje nyanya leo Nairobi?" },
    { label: "Magonjwa ya Mahindi", icon: <Leaf className="w-4 h-4" />, query: "Mahindi yangu ina yellow leaves, shida ni nini?" },
    { label: "Kupanda Sukuma", icon: <ChevronRight className="w-4 h-4" />, query: "Tips za kupanda sukuma wiki?" },
  ];

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-[#f5f5f0]">
      {/* Header */}
      <header className="p-6 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold serif text-[#5A5A40]">Mkulima AI</h1>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Agricultural Assistant</p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "flex flex-col max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {msg.role === 'model' ? (
                <Bot className="w-4 h-4 text-[#5A5A40]" />
              ) : (
                <User className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">
                {msg.role === 'model' ? 'Mkulima AI' : 'Mkulima'}
              </span>
            </div>
            
            <div
              className={cn(
                "p-4 rounded-2xl shadow-sm",
                msg.role === 'user' 
                  ? "bg-[#5A5A40] text-white rounded-tr-none" 
                  : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
              )}
            >
              {msg.image && (
                <img 
                  src={msg.image} 
                  alt="Uploaded crop" 
                  className="w-full max-w-xs rounded-lg mb-3 object-cover aspect-video"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="markdown-body">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium italic">Mkulima AI anafikiria...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-200">
        {/* Quick Actions */}
        {messages.length < 3 && (
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => setInput(action.query)}
                className="flex items-center gap-2 px-4 py-2 bg-[#f5f5f0] border border-gray-200 rounded-full text-xs font-medium whitespace-nowrap hover:bg-gray-100 transition-colors"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Image Preview */}
        {selectedImage && (
          <div className="relative inline-block mb-4">
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="w-20 h-20 object-cover rounded-xl border-2 border-[#5A5A40]"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 bg-[#f5f5f0] rounded-2xl p-2 flex items-end gap-2 border border-gray-200 focus-within:border-[#5A5A40] transition-colors">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-[#5A5A40] transition-colors"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Uliza swali..."
              className="flex-1 bg-transparent border-none focus:ring-0 p-2 text-sm resize-none max-h-32 min-h-[40px]"
              rows={1}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className={cn(
              "p-4 rounded-2xl transition-all",
              isLoading || (!input.trim() && !selectedImage)
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-[#5A5A40] text-white shadow-lg hover:scale-105 active:scale-95"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageSelect} 
          accept="image/*" 
          className="hidden" 
        />
        <p className="text-[10px] text-center text-gray-400 mt-4 font-medium uppercase tracking-widest">
          Mkulima AI • Helping Kenya Grow
        </p>
      </footer>
    </div>
  );
}
