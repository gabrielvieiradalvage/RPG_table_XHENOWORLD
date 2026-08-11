"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Chat, { ChatMessage } from "@/components/mesa/Chat";
import Mapas, { RoomMap } from "@/components/mesa/Mapas";
import Audio, { RoomAudio } from "@/components/mesa/Audio";
import Ficha from "@/components/mesa/Ficha";
import Tokens from "@/components/mesa/Tokens";
import Loja from "@/components/mesa/Loja";
import FerramentasDoMestre from "@/components/mesa/FerramentasDoMestre";
import IaPersonagens from "@/components/mesa/IaPersonagens";
import ConvidarAmigos from "@/components/mesa/ConvidarAmigos";
import BolsaItens from "@/components/mesa/BolsaItens";

interface MapToken {
  id: string;
  name: string;
  avatar_url?: string | null;
  token_shape: string;
  is_npc: boolean;
  personality?: string;
  current_hp: number;
  max_hp: number;
  current_stamina: number;
  max_stamina: number;
  on_map: boolean;
  pos_x: number;
  pos_y: number;
  scale: number;
}

interface PendingMove {
  targetX: number;
  targetY: number;
  meters: number;
  staminaCost: number;
}

interface CombatZone {
  shape: "circulo" | "quadrado" | "triangulo" | "hexagono";
  size: number;
  x: number;
  y: number;
}

export default function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [username, setUsername] = useState<string>("Jogador");
  const [isMestre, setIsMestre] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modais e Visibilidade Mobile
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "mapa" | "painel">("mapa");

  // Abas do Painel
  const [activeTab, setActiveTab] = useState<"ficha" | "tokens" | "loja" | "mapas" | "audio" | "ia" | "mestre">("ficha");

  // Redimensionamento do Painel Direito (Desktop)
  const [sidebarWidth, setSidebarWidth] = useState<number>(340);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Mapas, Zoom e Tokens Ativos
  const [maps, setMaps] = useState<RoomMap[]>([]);
  const [activeMapUrl, setActiveMapUrl] = useState<string | null>(null);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const [mapTokens, setMapTokens] = useState<MapToken[]>([]);
  const [mapScale, setMapScale] = useState<number>(100);
  const [mapFitMode, setMapFitMode] = useState<"contain" | "cover" | "stretch">("contain");

  // ESTADO SINCRONIZADO DA MESA
  const [gameMode, setGameMode] = useState<"exploracao" | "combate">("exploracao");
  const [gridType, setGridType] = useState<"quadrado" | "hexagono" | "circulo" | "nenhum">("quadrado");
  const [combatZone, setCombatZone] = useState<CombatZone>({ shape: "circulo", size: 150, x: 50, y: 50 });

  // MOVIMENTAÇÃO TÁTICA E TOUCH DRAG
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [touchDraggingTokenId, setTouchDraggingTokenId] = useState<string | null>(null);

  // ÁUDIO E SINCRONIZAÇÃO EM TEMPO REAL
  const [playlist, setPlaylist] = useState<RoomAudio[]>([]);
  const [currentAudio, setCurrentAudio] = useState<RoomAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChannelRef = useRef<any>(null);

  // Chat & IA
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isNpcThinking, setIsNpcThinking] = useState(false);
  const [activeIaNpc, setActiveIaNpc] = useState<MapToken | null>(null);

  // Ref para acessar o canal de Realtime do Chat
  const chatChannelRef = useRef<any>(null);

  useEffect(() => {
    initRoom();
  }, []);

  // CANAL EM TEMPO REAL DO CHAT
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_chat_${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "new_chat_message" }, ({ payload }: { payload: ChatMessage }) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      })
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // CANAL EM TEMPO REAL DE ÁUDIO
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_audio_${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "play_audio" }, ({ payload }: { payload: { track: RoomAudio } }) => {
        setCurrentAudio(payload.track);
        setIsPlaying(true);
      })
      .on("broadcast", { event: "stop_audio" }, () => {
        setIsPlaying(false);
        setCurrentAudio(null);
      })
      .subscribe();

    audioChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // REPRODUÇÃO GLOBAL DO PLAYER DE ÁUDIO
  useEffect(() => {
    if (!audioRef.current) return;

    if (currentAudio && isPlaying) {
      if (audioRef.current.src !== currentAudio.audio_url) {
        audioRef.current.src = currentAudio.audio_url;
      }
      audioRef.current.play().catch((err) => {
        console.warn("Autoplay bloqueado pelo navegador:", err);
      });
    } else {
      audioRef.current.pause();
    }
  }, [currentAudio, isPlaying]);

  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => {
      fetchMapTokens();
      fetchRoomSettings();
    }, 2000);
    return () => clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(260, Math.min(600, window.innerWidth - e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const initRoom = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUser(user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profile?.username) {
      setUsername(profile.username);
    } else if (user.email) {
      setUsername(user.email.split("@")[0]);
    }

    const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (roomData) {
      setIsMestre(roomData.owner_id === user.id);
      if (roomData.game_mode) setGameMode(roomData.game_mode);
      if (roomData.grid_type) setGridType(roomData.grid_type);
      if (roomData.combat_zone) setCombatZone(roomData.combat_zone);
    }

    const { data: mapsData } = await supabase.from("room_maps").select("*").eq("room_id", roomId);
    if (mapsData) {
      setMaps(mapsData);
      const active = mapsData.find((m) => m.is_active);
      if (active) setActiveMapUrl(active.image_url);
    }

    const { data: audiosData } = await supabase.from("room_audios").select("*").eq("room_id", roomId);
    if (audiosData) setPlaylist(audiosData);

    await fetchMapTokens();
    setLoading(false);
  };

  const fetchMapTokens = async () => {
    const { data, error } = await supabase.from("characters").select("*").eq("room_id", roomId).eq("on_map", true);
    if (error || !data) return;

    setMapTokens(data as MapToken[]);
    setActiveIaNpc((prev) => (prev ? data.find((t) => t.id === prev.id) || prev : data.find((t) => t.is_npc) || null));
  };

  const fetchRoomSettings = async () => {
    const { data: roomData } = await supabase.from("rooms").select("game_mode, grid_type, combat_zone").eq("id", roomId).single();
    if (roomData) {
      if (roomData.game_mode) setGameMode(roomData.game_mode);
      if (roomData.grid_type) setGridType(roomData.grid_type);
      if (roomData.combat_zone) setCombatZone(roomData.combat_zone);
    }
  };

  const broadcastChatMessage = (msg: ChatMessage) => {
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: "broadcast",
        event: "new_chat_message",
        payload: msg,
      });
    }
  };

  const handlePlayTrack = (track: RoomAudio) => {
    setCurrentAudio(track);
    setIsPlaying(true);

    if (audioChannelRef.current) {
      audioChannelRef.current.send({
        type: "broadcast",
        event: "play_audio",
        payload: { track },
      });
    }
  };

  const handleStopTrack = () => {
    setIsPlaying(false);
    setCurrentAudio(null);

    if (audioChannelRef.current) {
      audioChannelRef.current.send({
        type: "broadcast",
        event: "stop_audio",
      });
    }
  };

  const togglePlayPause = () => {
    if (!currentAudio) return;
    if (isPlaying) {
      handleStopTrack();
    } else {
      handlePlayTrack(currentAudio);
    }
  };

  // DESKTOP DRAG AND DROP
  const handleDragStart = (e: React.DragEvent, tokenId: string) => {
    if (gameMode !== "exploracao") return;
    e.dataTransfer.setData("tokenId", tokenId);
  };

  const handleDropOnMap = async (e: React.DragEvent) => {
    if (gameMode !== "exploracao") return;
    e.preventDefault();

    const tokenId = e.dataTransfer.getData("tokenId");
    if (!tokenId) return;

    const mapRect = e.currentTarget.getBoundingClientRect();
    const targetX = Math.max(0, Math.min(100, ((e.clientX - mapRect.left) / mapRect.width) * 100));
    const targetY = Math.max(0, Math.min(100, ((e.clientY - mapRect.top) / mapRect.height) * 100));

    const token = mapTokens.find((t) => t.id === tokenId);
    setMapTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, pos_x: targetX, pos_y: targetY } : t)));

    await supabase.from("characters").update({ pos_x: targetX, pos_y: targetY }).eq("id", tokenId);
    if (token) handleSendMessage(`🗺️ ${token.name} se moveu.`);
  };

  // MOBILE TOUCH DRAGGING (MODO EXPLORAÇÃO)
  const handleTouchStartToken = (e: React.TouchEvent, tokenId: string) => {
    if (gameMode !== "exploracao") return;
    e.stopPropagation();
    setTouchDraggingTokenId(tokenId);
  };

  const handleTouchMoveMap = (e: React.TouchEvent) => {
    if (gameMode !== "exploracao" || !touchDraggingTokenId || !mapRef.current) return;

    const touch = e.touches[0];
    const mapRect = mapRef.current.getBoundingClientRect();
    const targetX = Math.max(0, Math.min(100, ((touch.clientX - mapRect.left) / mapRect.width) * 100));
    const targetY = Math.max(0, Math.min(100, ((touch.clientY - mapRect.top) / mapRect.height) * 100));

    setMapTokens((prev) =>
      prev.map((t) => (t.id === touchDraggingTokenId ? { ...t, pos_x: targetX, pos_y: targetY } : t))
    );
  };

  const handleTouchEndMap = async () => {
    if (gameMode !== "exploracao" || !touchDraggingTokenId) return;

    const token = mapTokens.find((t) => t.id === touchDraggingTokenId);
    if (token) {
      await supabase
        .from("characters")
        .update({ pos_x: token.pos_x, pos_y: token.pos_y })
        .eq("id", token.id);
      handleSendMessage(`🗺️ ${token.name} se moveu.`);
    }

    setTouchDraggingTokenId(null);
  };

  // SELEÇÃO E NAVEGAÇÃO NO MODO COMBATE
  const handleSelectToken = (e: React.MouseEvent | React.TouchEvent, tokenId: string) => {
    e.stopPropagation();
    if (gameMode === "exploracao") return;
    setSelectedTokenId(selectedTokenId === tokenId ? null : tokenId);
    setPendingMove(null);
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameMode === "exploracao" || !selectedTokenId) return;

    const selectedToken = mapTokens.find((t) => t.id === selectedTokenId);
    if (!selectedToken) return;

    const mapRect = e.currentTarget.getBoundingClientRect();
    const targetX = Math.max(0, Math.min(100, ((e.clientX - mapRect.left) / mapRect.width) * 100));
    const targetY = Math.max(0, Math.min(100, ((e.clientY - mapRect.top) / mapRect.height) * 100));

    const dx = targetX - (selectedToken.pos_x ?? 50);
    const dy = targetY - (selectedToken.pos_y ?? 50);
    const meters = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 2.5));
    const staminaCost = meters * 2;

    setPendingMove({ targetX, targetY, meters, staminaCost });
  };

  const handleConfirmMove = async () => {
    if (!selectedTokenId || !pendingMove) return;

    const token = mapTokens.find((t) => t.id === selectedTokenId);
    if (!token) return;

    const isExhausted = token.current_stamina < pendingMove.staminaCost;
    const newStamina = Math.max(0, token.current_stamina - pendingMove.staminaCost);

    setMapTokens((prev) =>
      prev.map((t) => (t.id === selectedTokenId ? { ...t, pos_x: pendingMove.targetX, pos_y: pendingMove.targetY, current_stamina: newStamina } : t))
    );

    await supabase.from("characters").update({ pos_x: pendingMove.targetX, pos_y: pendingMove.targetY, current_stamina: newStamina }).eq("id", selectedTokenId);

    const statusMsg = isExhausted ? ` ⚡ [Causou EXAUSTÃO! Stamina zerou: 0 / ${token.max_stamina}]` : ` (Stamina: ${newStamina} / ${token.max_stamina})`;
    handleSendMessage(`🏃 ${token.name} andou ${pendingMove.meters}m (-${pendingMove.staminaCost}⚡ Stamina)${statusMsg}`);

    setSelectedTokenId(null);
    setPendingMove(null);
  };

  const updateTokenConfig = async (tokenId: string, updates: Partial<MapToken>) => {
    setMapTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, ...updates } : t)));
    await supabase.from("characters").update(updates).eq("id", tokenId);
  };

  const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isMestre) return;

    setIsUploadingMap(true);
    const fileName = `${roomId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("mapas").upload(fileName, file);

    if (!error) {
      const { data: urlData } = supabase.storage.from("mapas").getPublicUrl(fileName);
      const newMap = { room_id: roomId, name: file.name.replace(/\.[^/.]+$/, ""), image_url: urlData.publicUrl, is_active: maps.length === 0 };
      const { data: insertedMap } = await supabase.from("room_maps").insert([newMap]).select().single();
      if (insertedMap) {
        setMaps((prev) => [...prev, insertedMap]);
        if (insertedMap.is_active) setActiveMapUrl(insertedMap.image_url);
      }
    }
    setIsUploadingMap(false);
  };

  const handleDeleteMap = async (mapToDelete: RoomMap) => {
    if (!confirm(`Deseja apagar o mapa "${mapToDelete.name}"?`)) return;
    await supabase.from("room_maps").delete().eq("id", mapToDelete.id);
    setMaps((prev) => prev.filter((m) => m.id !== mapToDelete.id));
    if (activeMapUrl === mapToDelete.image_url) setActiveMapUrl(null);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isMestre) return;

    setIsUploadingAudio(true);
    const fileName = `${roomId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("musicas").upload(fileName, file);

    if (!error) {
      const { data: urlData } = supabase.storage.from("musicas").getPublicUrl(fileName);
      const newTrack = { room_id: roomId, title: file.name.replace(/\.[^/.]+$/, ""), audio_url: urlData.publicUrl };
      const { data: insertedAudio } = await supabase.from("room_audios").insert([newTrack]).select().single();
      if (insertedAudio) setPlaylist((prev) => [...prev, insertedAudio]);
    }
    setIsUploadingAudio(false);
  };

  const handleDeleteAudio = async (trackToDelete: RoomAudio) => {
    if (!confirm(`Deseja apagar a música "${trackToDelete.title}"?`)) return;
    await supabase.from("room_audios").delete().eq("id", trackToDelete.id);
    setPlaylist((prev) => prev.filter((a) => a.id !== trackToDelete.id));
    if (currentAudio?.id === trackToDelete.id) {
      handleStopTrack();
    }
  };

  const handleSendMessage = async (text: string, isNpcIa?: boolean) => {
    const senderTag = isMestre ? `${username}(mestre)` : `${username}(membro)`;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: senderTag,
      text,
      type: "chat",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    broadcastChatMessage(userMsg);

    if (isNpcIa) {
      setIsNpcThinking(true);
      try {
        const targetNpc = activeIaNpc || mapTokens.find((t) => t.is_npc) || {
          name: "Guardião Anônimo",
          personality: "Guerreiro hostil.",
          current_hp: 20, max_hp: 20, current_stamina: 10, max_stamina: 10,
        };

        const chatHistory = messages
          .filter((m) => m.type === "chat" || m.type === "npc")
          .slice(-15)
          .map((m) => ({
            role: m.type === "npc" ? "assistant" : "user",
            content: `${m.sender}: ${m.text}`,
          }));

        const response = await fetch("/api/npc/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcContext: targetNpc,
            userMessage: text,
            chatHistory,
            isCombat: gameMode === "combate",
          }),
        });

        const data = await response.json();
        if (data.reply) {
          const npcMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: targetNpc.name,
            text: data.reply,
            type: "npc",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };

          setMessages((prev) => [...prev, npcMsg]);
          broadcastChatMessage(npcMsg);
        }
      } catch (err) {
        console.error("Erro no Xhenos Mind:", err);
      } finally {
        setIsNpcThinking(false);
      }
    }
  };

  const handleRollDice = (sides: number, bonus?: number, label?: string) => {
    const senderTag = isMestre ? `${username}(mestre)` : `${username}(membro)`;

    if (sides === 0) {
      const infoMsg: ChatMessage = { id: Date.now().toString(), sender: senderTag, text: `✨ ${label}`, type: "dice", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      setMessages((prev) => [...prev, infoMsg]);
      broadcastChatMessage(infoMsg);
      return;
    }

    const result = Math.floor(Math.random() * sides) + 1;
    let resultText = `Rolou d${sides} (${label || "Ação"}): 🎲 [ ${result} ]`;
    if (bonus && bonus > 0) resultText += ` + ${bonus} = ${result + bonus}`;
    if (sides === 20 && result === 20) resultText += " 🔥 CRÍTICO!";
    if (sides === 20 && result === 1) resultText += " 💀 FALHA CRÍTICA!";

    const diceMsg: ChatMessage = { id: Date.now().toString(), sender: senderTag, text: resultText, type: "dice", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages((prev) => [...prev, diceMsg]);
    broadcastChatMessage(diceMsg);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-screen bg-[#080811] text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedToken = mapTokens.find((t) => t.id === selectedTokenId);

  return (
    <div className="h-[100dvh] w-screen bg-[#080811] text-white flex flex-col overflow-hidden select-none touch-none">
      <audio ref={audioRef} loop />

      <ConvidarAmigos roomId={roomId} isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      
      {/* COMPONENTE FLUTUANTE DA BOLSA DE ITENS */}
      {currentUser?.id && <BolsaItens roomId={roomId} currentUserId={currentUser.id} />}

      {/* HEADER DA MESA */}
      <header className="h-12 sm:h-14 bg-[#12131f]/90 border-b border-purple-900/40 px-3 sm:px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => router.push("/dashboard")} className="px-2.5 py-1 bg-[#0b0c16] hover:bg-purple-900/40 border border-purple-800/40 rounded-lg text-xs font-semibold text-purple-300 transition cursor-pointer">
            ←
          </button>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xs sm:text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 truncate max-w-[100px] sm:max-w-none">
              Mesa Virtual
            </h1>
            {isMestre && <span className="text-[9px] sm:text-[10px] bg-purple-950 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded-full font-bold uppercase">👑 MESTRE</span>}
          </div>
          <button onClick={() => setIsInviteOpen(true)} className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs rounded-lg shadow-md transition cursor-pointer flex items-center gap-1">
            <span>📩</span>
            <span className="hidden md:inline">Convidar</span>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-[#0b0c16] px-2.5 py-1 border border-purple-800/40 rounded-xl">
          <span className="text-xs text-purple-300 animate-pulse">🎵</span>
          <span className="text-[10px] sm:text-xs text-gray-300 font-medium max-w-[80px] sm:max-w-[140px] truncate">{currentAudio ? currentAudio.title : "Sem som"}</span>
          {currentAudio && (
            <button onClick={togglePlayPause} className="text-[10px] sm:text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 rounded font-bold cursor-pointer">
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL (VIEW SWITCHER NO MOBILE) */}
      <div className="flex-1 flex overflow-hidden relative w-full h-full">

        {/* 1. PAINEL ESQUERDO: CHAT E DADOS */}
        <div className={`h-full md:w-[320px] shrink-0 border-r border-purple-900/40 transition-all ${mobileView === "chat" ? "block w-full" : "hidden md:block"}`}>
          <div className="w-full h-full [&>aside]:!w-full [&>aside]:!border-none">
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              onRollDice={(sides) => handleRollDice(sides)}
              isNpcThinking={isNpcThinking}
              roomId={roomId}
              isMestre={isMestre}
              currentUserId={currentUser?.id}
            />
          </div>
        </div>

        {/* 2. CENTRO: CANVAS DO MAPA */}
        <main className={`flex-1 bg-[#05050a] relative overflow-hidden flex-col items-center justify-center ${mobileView === "mapa" ? "flex" : "hidden md:flex"}`}>
          <div className="absolute inset-0 opacity-20 pointer-events-none z-0" style={{ backgroundImage: "radial-gradient(#9D4EDD 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

          {activeMapUrl ? (
            <div
              ref={mapRef}
              onTouchMove={handleTouchMoveMap}
              onTouchEnd={handleTouchEndMap}
              className={`relative inline-block shadow-2xl rounded-lg overflow-hidden touch-none ${gameMode === "combate" ? "cursor-crosshair" : "cursor-default"}`}
              onClick={handleMapClick}
              onDragOver={(e) => gameMode === "exploracao" && e.preventDefault()}
              onDrop={handleDropOnMap}
            >
              <img
                src={activeMapUrl}
                alt="Mapa da Mesa"
                draggable={false}
                style={{
                  transform: `scale(${mapScale / 100})`,
                  transformOrigin: "center center",
                  objectFit: mapFitMode === "stretch" ? "fill" : mapFitMode,
                  width: mapFitMode === "stretch" ? "100%" : "auto",
                  height: mapFitMode === "stretch" ? "100%" : "auto",
                }}
                className="max-w-[100vw] max-h-[75vh] md:max-w-[80vw] md:max-h-[85vh] select-none rounded-lg block transition-transform duration-200"
              />

              {/* OVERLAY DE GRID TÁTICA */}
              {gridType === "quadrado" && <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: "linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />}
              {gridType === "circulo" && <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: "radial-gradient(circle, transparent 55%, rgba(255, 255, 255, 0.25) 56%, transparent 58%)", backgroundSize: "50px 50px" }} />}
              {gridType === "hexagono" && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-30">
                  <pattern id="hex-grid" width="40" height="69.282" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 20 11.547 L 0 0 L 0 23.094 L 20 34.641 L 40 23.094 Z M 0 34.641 L 20 46.188 L 0 57.735 L 0 80.829 L 20 92.376 L 40 80.829 L 40 57.735 L 20 46.188 Z" fill="none" stroke="#ffffff" strokeWidth="1" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#hex-grid)" />
                </svg>
              )}

              {/* ZONA DE COMBATE VERMELHA */}
              {gameMode === "combate" && combatZone && (
                <div
                  className="absolute z-15 pointer-events-none transition-all duration-300 bg-red-600/35 border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse flex items-center justify-center"
                  style={{
                    left: `${combatZone.x}%`,
                    top: `${combatZone.y}%`,
                    width: `${combatZone.size}px`,
                    height: `${combatZone.size}px`,
                    transform: "translate(-50%, -50%)",
                    borderRadius: combatZone.shape === "circulo" ? "50%" : combatZone.shape === "quadrado" ? "8px" : "0",
                    clipPath: combatZone.shape === "triangulo" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : combatZone.shape === "hexagono" ? "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" : "none",
                  }}
                >
                  <span className="text-[9px] font-black uppercase text-red-100 tracking-wider bg-black/70 px-2 py-0.5 rounded border border-red-500/50">
                    ⚔️ ZONA DE COMBATE
                  </span>
                </div>
              )}

              {/* TRAJETÓRIA SVG */}
              {gameMode === "combate" && selectedToken && pendingMove && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
                  <line x1={`${selectedToken.pos_x ?? 50}%`} y1={`${selectedToken.pos_y ?? 50}%`} x2={`${pendingMove.targetX}%`} y2={`${pendingMove.targetY}%`} stroke="#22d3ee" strokeWidth="4" strokeDasharray="8 4" />
                  <circle cx={`${selectedToken.pos_x ?? 50}%`} cy={`${selectedToken.pos_y ?? 50}%`} r="5" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={`${pendingMove.targetX}%`} cy={`${pendingMove.targetY}%`} r="10" fill="#22d3ee" fillOpacity="0.4" stroke="#ffffff" strokeWidth="2" className="animate-ping" />
                </svg>
              )}

              {/* CONFIRMAÇÃO DE MOVIMENTO */}
              {gameMode === "combate" && selectedToken && pendingMove && (
                <div className="absolute z-50 bg-[#0b0c16]/95 border-2 border-cyan-400 p-2.5 rounded-xl shadow-2xl text-xs space-y-1.5 -translate-x-1/2 -translate-y-1/2 min-w-[170px]" style={{ left: `${pendingMove.targetX}%`, top: `${pendingMove.targetY}%` }} onClick={(e) => e.stopPropagation()}>
                  <div className="font-bold text-cyan-300 text-[11px] border-b border-purple-900/40 pb-1 flex justify-between items-center">
                    <span>🏃 Mover {selectedToken.name}</span>
                  </div>
                  <div className="text-[10px] space-y-0.5 text-gray-300">
                    <p>📏 Distância: <strong className="text-white">{pendingMove.meters}m</strong></p>
                    <p>⚡ Custo: <strong className="text-amber-400">{pendingMove.staminaCost} Stamina</strong></p>
                    <p>🔋 Atual: <strong className="text-cyan-400">{selectedToken.current_stamina} / {selectedToken.max_stamina}⚡</strong></p>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <button onClick={handleConfirmMove} className="flex-1 py-1 bg-cyan-600 text-white font-bold text-[10px] rounded cursor-pointer">Confirmar</button>
                    <button onClick={() => { setSelectedTokenId(null); setPendingMove(null); }} className="py-1 px-2 bg-red-950 text-red-300 font-bold text-[10px] rounded cursor-pointer">✕</button>
                  </div>
                </div>
              )}

              {/* TOKENS NO MAPA */}
              {mapTokens.map((token) => {
                const hpPercent = Math.max(0, Math.min(100, (token.current_hp / (token.max_hp || 1)) * 100));
                const stPercent = Math.max(0, Math.min(100, (token.current_stamina / (token.max_stamina || 1)) * 100));
                const tokenScale = token.scale || 60;
                const isSelected = gameMode === "combate" && selectedTokenId === token.id;
                const posX = token.pos_x ?? 50;
                const posY = token.pos_y ?? 50;
                const initialLetter = token.name ? token.name.charAt(0).toUpperCase() : "T";

                return (
                  <div
                    key={token.id}
                    draggable={gameMode === "exploracao"}
                    onDragStart={(e) => handleDragStart(e, token.id)}
                    onTouchStart={(e) => handleTouchStartToken(e, token.id)}
                    onClick={(e) => handleSelectToken(e, token.id)}
                    className={`absolute group/token transition-all duration-300 ${gameMode === "exploracao" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isSelected ? "z-40 scale-110" : "z-20 hover:z-30"}`}
                    style={{ left: `${posX}%`, top: `${posY}%`, transform: "translate(-50%, -50%)", width: `${tokenScale}px`, height: `${tokenScale}px` }}
                  >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-14 space-y-0.5 opacity-80 group-hover/token:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-full bg-red-950 h-1.5 rounded-full overflow-hidden border border-black relative">
                        <div className="bg-gradient-to-r from-red-600 to-rose-400 h-full transition-all duration-300" style={{ width: `${hpPercent}%` }} />
                      </div>
                      <div className="w-full bg-amber-950 h-1 rounded-full overflow-hidden border border-black relative">
                        <div className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full transition-all duration-300" style={{ width: `${stPercent}%` }} />
                      </div>
                    </div>

                    {token.avatar_url ? (
                      <img src={token.avatar_url} alt={token.name} draggable={false} className={`w-full h-full object-cover border-2 shadow-black/80 shadow-md transition-all ${isSelected ? "border-cyan-300 ring-4 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.8)]" : token.is_npc ? "border-red-500" : "border-cyan-500"} ${token.token_shape === "circle" ? "rounded-full" : "rounded-md"}`} />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-extrabold text-white border-2 shadow-black/80 shadow-md transition-all ${isSelected ? "border-cyan-300 ring-4 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.8)]" : token.is_npc ? "bg-gradient-to-tr from-red-900 via-rose-700 to-amber-600 border-red-500" : "bg-gradient-to-tr from-purple-700 via-indigo-600 to-cyan-500 border-cyan-500"} ${token.token_shape === "circle" ? "rounded-full" : "rounded-md"}`} style={{ fontSize: `${Math.max(12, tokenScale * 0.4)}px` }}>
                        {initialLetter}
                      </div>
                    )}

                    {isMestre && (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover/token:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); updateTokenConfig(token.id, { scale: Math.max(30, tokenScale - 10) }); }} className="w-5 h-5 bg-black/80 border border-purple-500 text-white rounded text-[10px] font-bold">-</button>
                        <button onClick={(e) => { e.stopPropagation(); updateTokenConfig(token.id, { scale: Math.min(200, tokenScale + 10) }); }} className="w-5 h-5 bg-black/80 border border-purple-500 text-white rounded text-[10px] font-bold">+</button>
                        <button onClick={(e) => { e.stopPropagation(); updateTokenConfig(token.id, { on_map: false }); }} className="w-5 h-5 bg-red-900/80 border border-red-500 text-white rounded text-[10px] font-bold">✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative border-2 border-purple-900/40 rounded-2xl bg-[#0d0e18] p-8 sm:p-12 text-center max-w-sm sm:max-w-lg">
              <span className="text-4xl sm:text-5xl block mb-3">🗺️</span>
              <h3 className="text-base sm:text-lg font-bold text-purple-200">Nenhum Mapa Ativo</h3>
              <p className="text-xs text-gray-400 mt-2">{isMestre ? "Acesse a aba 'Mapas' para carregar um cenário." : "Aguarde o Mestre definir o mapa."}</p>
            </div>
          )}

          {/* DOCK TÁTICA DE AÇÕES RÁPIDAS NO CELULAR */}
          <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#0b0c16]/90 border border-purple-800/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 shadow-2xl z-30">
            <button
              onClick={() => handleRollDice(20)}
              className="px-2.5 py-1 bg-purple-600 active:bg-purple-500 text-white font-bold text-[10px] rounded-full shadow"
            >
              🎲 d20
            </button>
            <button
              onClick={() => handleRollDice(6)}
              className="px-2.5 py-1 bg-cyan-600 active:bg-cyan-500 text-white font-bold text-[10px] rounded-full shadow"
            >
              🎲 d6
            </button>
            <button
              onClick={() => setMobileView("painel")}
              className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-[10px] rounded-full shadow"
            >
              📜 Ficha
            </button>
          </div>
        </main>

        {/* 3. PAINEL DIREITO: FICHA, TOKENS, LOJA, MAPAS, ÁUDIO, IA E 👑 MESTRE */}
        <aside
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${sidebarWidth}px` : '100%' }}
          className={`h-full bg-[#12131f] border-l border-purple-900/40 flex-col shrink-0 transition-all ${mobileView === "painel" ? "flex w-full" : "hidden md:flex"}`}
        >
          {/* ZONA INTERATIVA REDIMENSIONÁVEL (DESKTOP) */}
          <div
            onMouseDown={() => setIsResizing(true)}
            className="hidden md:flex absolute -left-1.5 top-0 bottom-0 w-3 bg-cyan-500/20 hover:bg-cyan-400/80 cursor-col-resize z-50 transition-colors flex-col items-center justify-center group"
            title="Arraste para redimensionar ou clique no botão para esticar"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSidebarWidth(sidebarWidth > 340 ? 320 : 420);
              }}
              className="w-4 h-9 bg-cyan-950 border border-cyan-400 hover:bg-cyan-600 text-cyan-300 hover:text-white text-[9px] font-black rounded-sm flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
              title={sidebarWidth > 340 ? "Recolher Painel" : "Expandir Painel"}
            >
              {sidebarWidth > 340 ? "»" : "«"}
            </button>
          </div>

          {/* FECHAR NO MOBILE */}
          <div className="md:hidden flex justify-between items-center p-3 bg-[#0b0c16] border-b border-purple-900/40 shrink-0">
            <span className="text-xs font-bold text-cyan-400">📜 Painel de Controle</span>
            <button onClick={() => setMobileView("mapa")} className="text-gray-400 hover:text-white font-bold text-sm px-2 cursor-pointer">✕ Voltar ao Mapa</button>
          </div>

          {/* BARRA DE ABAS */}
          <div className="flex border-b border-purple-900/40 bg-[#0b0c16] w-full overflow-x-auto scrollbar-none shrink-0">
            {(["ficha", "tokens", "loja", "mapas", "audio", "ia", "mestre"] as const).map((tab) => {
              if ((tab === "audio" || tab === "mestre" || tab === "ia") && !isMestre) return null;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-1 py-2.5 text-[10px] sm:text-[11px] font-bold capitalize transition border-b-2 text-center truncate cursor-pointer ${
                    activeTab === tab ? "border-cyan-400 text-cyan-400 bg-purple-950/30" : "border-transparent text-gray-400 hover:text-white"
                  }`}
                  title={tab === "mestre" ? "Mestre" : tab === "ia" ? "IA" : tab === "loja" ? "Loja" : tab}
                >
                  {tab === "mestre" ? "👑 Mestre" : tab === "ia" ? "🧠 IA" : tab === "loja" ? "🏪 Loja" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
            {activeTab === "ficha" && (
              <Ficha
                roomId={roomId}
                userId={currentUser?.id}
                isMestre={isMestre}
                onRollDice={handleRollDice}
                onOpenChat={() => setMobileView("chat")}
              />
            )}
            {activeTab === "tokens" && <Tokens roomId={roomId} />}
            {activeTab === "loja" && (
              <Loja
                roomId={roomId}
                isMestre={isMestre}
                currentUserId={currentUser?.id}
                onSendMessage={handleSendMessage}
              />
            )}
            {activeTab === "mapas" && <Mapas isMestre={isMestre} maps={maps} activeMapUrl={activeMapUrl} isUploadingMap={isUploadingMap} onMapUpload={handleMapUpload} onSelectMap={(map) => setActiveMapUrl(map.image_url)} onDeleteMap={handleDeleteMap} mapScale={mapScale} onMapScaleChange={setMapScale} mapFitMode={mapFitMode} onFitModeChange={(mode) => setMapFitMode(mode)} />}
            {activeTab === "audio" && (
              <Audio
                isMestre={isMestre}
                playlist={playlist}
                isUploadingAudio={isUploadingAudio}
                currentTrack={currentAudio}
                isPlaying={isPlaying}
                onAudioUpload={handleAudioUpload}
                onPlayTrack={handlePlayTrack}
                onStopTrack={handleStopTrack}
                onDeleteTrack={handleDeleteAudio}
              />
            )}
            {activeTab === "ia" && isMestre && <IaPersonagens roomId={roomId} mapTokens={mapTokens} activeNpcId={activeIaNpc?.id || null} onSelectActiveNpc={(npc) => setActiveIaNpc(npc)} />}
            {activeTab === "mestre" && isMestre && <FerramentasDoMestre roomId={roomId} />}
          </div>
        </aside>
      </div>

      {/* BOTTOM NAVIGATION BAR (FIXO NO CELULAR) */}
      <nav className="md:hidden h-14 bg-[#0b0c16] border-t border-purple-900/50 flex items-center justify-around z-50 shrink-0 relative">
        <button onClick={() => setMobileView("chat")} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition ${mobileView === "chat" ? "text-cyan-400" : "text-gray-500"}`}>
          <span className="text-base">💬</span>
          <span>Chat</span>
        </button>

        <button onClick={() => setMobileView("mapa")} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition ${mobileView === "mapa" ? "text-cyan-400" : "text-gray-500"}`}>
          <span className="text-base">🗺️</span>
          <span>Mapa</span>
        </button>

        <button onClick={() => setMobileView("painel")} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition ${mobileView === "painel" ? "text-cyan-400" : "text-gray-500"}`}>
          <span className="text-base">📜</span>
          <span>Ficha</span>
        </button>
      </nav>
    </div>
  );
}