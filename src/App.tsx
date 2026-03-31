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
  ChevronRight,
  Mic,
  Square,
  Volume2
} from 'lucide-react';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  role: 'user' | 'model';
  content: string;
  image?: string;
  audio?: string;
}

const SYSTEM_INSTRUCTION = `You are an AI agricultural assistant for small-scale farmers in Kenya.
Your role is to help farmers make decisions about crop health, market prices, and farming practices.

Requirements:
1. Always respond in a mix of simple English, Swahili, and Sheng depending on the user's tone.
2. Keep responses practical, short, and actionable.
3. If a farmer describes crop issues (via text or voice):
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
9. If audio is provided, listen to the farmer's description and respond accordingly.`;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: "Habari mkulima! Mimi ni Mkulima AI. Naweza kukusaidia na mambo ya ukulima, magonjwa ya mimea, au bei ya soko. Una swali gani leo? Unaweza pia kurekodi sauti yako ukinielezea shida yako."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudio(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Samahani, siwezi kutumia microphone yako. Tafadhali angalia permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const clearAudio = () => {
    setRecordedAudio(null);
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage && !recordedAudio) return;

    const userMessage: Message = {
      role: 'user',
      content: input || (recordedAudio ? "Voice message" : ""),
      image: selectedImage || undefined,
      audio: recordedAudio || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const currentImage = selectedImage;
    const currentAudio = recordedAudio;
    setSelectedImage(null);
    setRecordedAudio(null);
    setIsLoading(true);

    try {
      const parts: any[] = [{ text: input || "Sikiliza hii sauti na unisaidie." }];
      
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.split(';')[0].split(':')[1];
        parts.push({ inlineData: { data: base64Data, mimeType } });
      }

      if (currentAudio) {
        const base64Data = currentAudio.split(',')[1];
        const mimeType = currentAudio.split(';')[0].split(':')[1];
        parts.push({ inlineData: { data: base64Data, mimeType } });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        }
      });

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
          <div className="w-10 h-10 bg-[#30B54A] rounded-full flex items-center justify-center text-white">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold serif text-[#30B54A]">Mkulima AI</h1>
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
                <Bot className="w-4 h-4 text-[#30B54A]" />
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
                  ? "bg-[#30B54A] text-white rounded-tr-none" 
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
              {msg.audio && (
                <div className="flex items-center gap-2 mb-3 bg-white/20 p-2 rounded-xl">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Sauti iliyorekodiwa</span>
                  <audio src={msg.audio} controls className="h-8 w-40" />
                </div>
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
        {messages.length < 3 && !isRecording && (
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

        {/* Previews */}
        <div className="flex gap-4 mb-4">
          {selectedImage && (
            <div className="relative inline-block">
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="w-20 h-20 object-cover rounded-xl border-2 border-[#30B54A]"
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
          {recordedAudio && (
            <div className="relative inline-block bg-[#f5f5f0] p-3 rounded-xl border-2 border-[#30B54A] flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#30B54A]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-gray-400">Audio Ready</span>
                <audio src={recordedAudio} controls className="h-6 w-32" />
              </div>
              <button 
                onClick={clearAudio}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          {isRecording ? (
            <div className="flex-1 bg-red-50 rounded-2xl p-3 flex items-center justify-between border border-red-200 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                <span className="text-sm font-bold text-red-600">Recording... {formatTime(recordingTime)}</span>
              </div>
              <button 
                onClick={stopRecording}
                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 bg-[#f5f5f0] rounded-2xl p-2 flex items-end gap-2 border border-gray-200 focus-within:border-[#30B54A] transition-colors">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-[#30B54A] transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                <button 
                  onClick={startRecording}
                  className="p-2 text-gray-400 hover:text-[#30B54A] transition-colors"
                >
                  <Mic className="w-6 h-6" />
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
                  placeholder="Uliza swali au rekodi sauti..."
                  className="flex-1 bg-transparent border-none focus:ring-0 p-2 text-sm resize-none max-h-32 min-h-[40px]"
                  rows={1}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage && !recordedAudio)}
                className={cn(
                  "p-4 rounded-2xl transition-all",
                  isLoading || (!input.trim() && !selectedImage && !recordedAudio)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[#30B54A] text-white shadow-lg hover:scale-105 active:scale-95"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </>
          )}
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
