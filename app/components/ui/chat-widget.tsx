"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, Send } from "lucide-react";

type Message = { id: number; role: "bot" | "user"; text: string };

const GREETING =
  "Halo! Butuh bantuan? Tanya aturan perusahaan, SOP, atau IM, saya siap bantu jawab.";

const WIP_REPLY =
  "Terima kasih atas pertanyaannya! Fitur ini sedang dalam proses pengembangan. Nantikan update selanjutnya ya! 🚀";

export function ChatWidget() {
  const [isOpen, setIsOpen]   = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "bot", text: GREETING },
  ]);
  const [input, setInput]     = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "bot", text: WIP_REPLY },
      ]);
      setThinking(false);
    }, 900);
  };

  return (
    <>
      {/* ── Chat popup ─────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-24 right-2 left-2 sm:left-auto sm:right-6 sm:w-[380px] z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ maxHeight: "480px" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 flex-shrink-0">
              <Image src="/eurobot1.png" alt="EuroBot" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Portal Assistant</p>
              <p className="text-blue-200 text-xs">by Euromedica · Beta</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "bot" && (
                  <div className="w-7 h-7 flex-shrink-0 mt-0.5">
                    <Image src="/eurobot1.png" alt="bot" width={28} height={28} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {/* Thinking dots */}
            {thinking && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                  <Image src="/eurobot1.png" alt="bot" width={28} height={28} className="w-full h-full object-cover" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-3 shadow-sm">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ketik pertanyaan Anda..."
              disabled={thinking}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={!input.trim() || thinking}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating button ────────────────────────────── */}
      <div className={`fixed right-6 z-50 transition-all duration-300 ${isOpen ? "bottom-6" : "bottom-10"}`}>
        {/* Pulse indicator (hanya saat chat tertutup) */}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 z-10 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white" />
          </span>
        )}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className={`transition-all duration-300 ease-in-out hover:scale-110 active:scale-95 focus:outline-none bg-transparent border-none ${
            isOpen ? "w-[60px] h-[60px]" : "w-[150px] h-[150px]"
          }`}
          aria-label="Buka Portal Assistant"
        >
          <Image
            src="/eurobot1.png"
            alt="EuroBot"
            width={150}
            height={150}
            priority
            className="w-full h-full object-contain drop-shadow-xl"
          />
        </button>
      </div>
    </>
  );
}
