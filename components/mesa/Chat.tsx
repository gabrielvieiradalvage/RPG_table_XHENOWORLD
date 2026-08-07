"use client";

import { useState, useEffect, useRef } from "react";
import Turnos from "./Turnos";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  type: "chat" | "dice" | "npc";
  timestamp: string;
}

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, isNpcIa?: boolean) => void;
  onRollDice: (sides: number) => void;
  isNpcThinking?: boolean;
  roomId: string;
  isMestre: boolean;
  currentUserId?: string;
}

export default function Chat({
  messages,
  onSendMessage,
  onRollDice,
  isNpcThinking,
  roomId,
  isMestre,
  currentUserId,
}: ChatProps) {
  const [chatInput, setChatInput] = useState("");
  const [customDie, setCustomDie] = useState("");
  const [talkToIa, setTalkToIa] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isNpcThinking]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    onSendMessage(chatInput, talkToIa);
    setChatInput("");
  };

  const handleCustomRoll = (e: React.FormEvent) => {
    e.preventDefault();
    const sides = parseInt(customDie);
    if (!isNaN(sides) && sides > 0) {
      onRollDice(sides);
      setCustomDie("");
    }
  };

  return (
    <aside className="w-full md:w-80 bg-[#12131f]/95 border-r border-purple-900/40 flex flex-col z-10 h-full overflow-hidden">
      {/* 1. PAINEL DE TURNOS INTEGRADO NO TOPO DO CHAT */}
      <Turnos roomId={roomId} isMestre={isMestre} currentUserId={currentUserId} />

      {/* 2. HEADER DO CHAT DA MESA */}
      <div className="p-2.5 sm:p-3 bg-[#0b0c16] border-b border-purple-900/40 flex justify-between items-center shrink-0">
        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          💬 Chat da Mesa
        </span>
        <button
          type="button"
          onClick={() => setTalkToIa(!talkToIa)}
          className={`px-2 py-1 text-[10px] font-bold rounded-full border transition cursor-pointer ${
            talkToIa
              ? "bg-green-950 border-green-500 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
              : "bg-[#12131f] border-purple-800/40 text-gray-400 hover:text-white"
          }`}
          title="Ativar para mandar a mensagem diretamente para a IA"
        >
          {talkToIa ? "🤖 Modo IA: LIGADO" : "🤖 Modo IA: DESLIGADO"}
        </button>
      </div>

      {/* 3. FEED DE MENSAGENS */}
      <div className="flex-1 p-2.5 sm:p-3 overflow-y-auto space-y-2.5">
        {messages.map((msg) => {
          const isMasterSender = msg.sender.includes("(mestre)");
          const isMemberSender = msg.sender.includes("(membro)");

          return (
            <div
              key={msg.id}
              className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                msg.type === "npc"
                  ? "bg-emerald-950/40 border-emerald-500/70 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                  : msg.type === "dice"
                  ? "bg-purple-950/40 border-purple-700/60 text-purple-200"
                  : "bg-[#0b0c16] border-purple-900/40 text-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-bold text-[11px] ${msg.type === "npc" ? "text-emerald-400" : isMasterSender ? "text-purple-400" : "text-cyan-400"}`}>
                    {msg.sender.replace("(mestre)", "").replace("(membro)", "")}
                  </span>

                  {isMasterSender && (
                    <span className="text-[8px] bg-purple-950 text-purple-300 border border-purple-700 px-1 py-0.2 rounded font-mono font-bold uppercase">
                      👑 Mestre
                    </span>
                  )}

                  {isMemberSender && (
                    <span className="text-[8px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1 py-0.2 rounded font-mono font-bold uppercase">
                      🛡️ Membro
                    </span>
                  )}

                  {msg.type === "npc" && (
                    <span className="text-[8px] bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 px-1.5 py-0.2 rounded font-mono font-bold">
                      🧠 Xhenos IA
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-gray-500 shrink-0">{msg.timestamp}</span>
              </div>
              <p className="font-mono whitespace-pre-wrap break-words">{msg.text}</p>
            </div>
          );
        })}

        {/* Indicador de IA Pensando */}
        {isNpcThinking && (
          <div className="p-2 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-emerald-300 text-[10px] animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping shrink-0" />
            <span>Xhenos Mind está formulando resposta do NPC...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 4. PAINEL DE DADOS E INPUT */}
      <div className="p-2.5 sm:p-3 bg-[#0b0c16] border-t border-purple-900/40 space-y-2 shrink-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-400 text-center">
          Mesa de Dados
        </span>

        {/* Botões Rápidos de Dados */}
        <div className="grid grid-cols-3 gap-1.5">
          {[6, 10, 20, 25, 50, 100].map((sides) => (
            <button
              key={sides}
              type="button"
              onClick={() => onRollDice(sides)}
              className="py-1.5 bg-[#12131f] active:bg-purple-800/60 hover:bg-purple-800/40 border border-purple-800/40 hover:border-cyan-400 text-cyan-300 hover:text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              🎲 d{sides}
            </button>
          ))}
        </div>

        {/* Dado Personalizado */}
        <form onSubmit={handleCustomRoll} className="flex gap-1.5">
          <input
            type="number"
            placeholder="Ex: 12 (dX)"
            value={customDie}
            onChange={(e) => setCustomDie(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-[#12131f] border border-purple-800/40 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 active:opacity-80 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            Rolar
          </button>
        </form>

        {/* Input de Texto */}
        <form onSubmit={handleSend} className="space-y-1.5 pt-0.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder={talkToIa ? "Falar com o NPC (Xhenos IA)..." : "Digite algo no chat..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className={`flex-1 px-3 py-2 bg-[#12131f] border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition ${
                talkToIa
                  ? "border-green-500/80 focus:border-green-400"
                  : "border-purple-800/40 focus:border-cyan-400"
              }`}
            />
            <button
              type="submit"
              className={`px-3 py-2 font-bold text-xs rounded-xl transition cursor-pointer text-white shrink-0 ${
                talkToIa
                  ? "bg-emerald-600 active:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  : "bg-cyan-600 active:bg-cyan-500"
              }`}
            >
              {talkToIa ? "🤖 IA" : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}