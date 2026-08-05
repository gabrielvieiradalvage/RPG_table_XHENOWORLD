"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Room {
  id: string;
  name: string;
  system: string;
  description: string;
  banner_url: string;
  invite_code: string;
  owner_id: string;
  plugin_config?: any;
  role?: "mestre" | "jogador";
}

interface RoomInvite {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  room?: Room;
  sender?: {
    username: string;
    avatar_url?: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string>("Aventureiro");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);

  // Convites e Código de Entrada
  const [inviteCode, setInviteCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<RoomInvite[]>([]);

  // Formulário de Criar Sala & Plugin
  const [roomName, setRoomName] = useState("");
  const [systemOption, setSystemOption] = useState("NID FOR END");
  const [loadedPlugin, setLoadedPlugin] = useState<any>(null);
  const [pluginFileName, setPluginFileName] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUser(user);

    // Busca Perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.username) setUsername(profile.username);
    if (profile?.avatar_url) setUserAvatar(profile.avatar_url);

    // Busca Salas e Convites
    await Promise.all([fetchRooms(user.id), fetchPendingInvites(user.id)]);
    setLoading(false);
  };

  // BUSCA SALAS QUE SOU MESTRE OU JOGADOR ACEITO
  const fetchRooms = async (userId: string) => {
    const { data: ownedRooms } = await supabase
      .from("rooms")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    const { data: joinedInvites } = await supabase
      .from("room_invites")
      .select(`
        room_id,
        room:rooms(*)
      `)
      .eq("receiver_id", userId)
      .eq("status", "accepted");

    const mestreRooms: Room[] = (ownedRooms || []).map((r) => ({
      ...r,
      role: "mestre",
    }));

    const jogadorRooms: Room[] = (joinedInvites || [])
      .map((item: any) => item.room)
      .filter((r): r is Room => Boolean(r) && r.owner_id !== userId)
      .map((r) => ({
        ...r,
        role: "jogador",
      }));

    const allRoomsMap = new Map<string, Room>();
    mestreRooms.forEach((r) => allRoomsMap.set(r.id, r));
    jogadorRooms.forEach((r) => {
      if (!allRoomsMap.has(r.id)) {
        allRoomsMap.set(r.id, r);
      }
    });

    setRooms(Array.from(allRoomsMap.values()));
  };

  const fetchPendingInvites = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("room_invites")
        .select(`
          id, room_id, sender_id, receiver_id, status,
          room:rooms(*),
          sender:profiles!sender_id(username, avatar_url)
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending");

      if (!error && data) {
        setPendingInvites(data as any);
      }
    } catch (err) {
      console.log("Central de convites pronta.");
    }
  };

  // LER ARQUIVO .JSON DO COMPUTADOR
  const handlePluginFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.systemName || !parsed.resources || !parsed.attributes) {
          alert("⚠️ O arquivo JSON precisa conter 'systemName', 'resources' e 'attributes'.");
          return;
        }

        setLoadedPlugin(parsed);
        setPluginFileName(file.name);
      } catch (err) {
        alert("❌ Erro ao ler arquivo! Certifique-se de que é um arquivo .json válido.");
      }
    };
    reader.readAsText(file);
  };

  // ENTRAR E SALVAR MESA POR CÓDIGO
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !user) return;

    setJoiningByCode(true);

    const { data: roomData, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("invite_code", inviteCode.trim())
      .single();

    if (error || !roomData) {
      setJoiningByCode(false);
      alert("❌ Código de convite inválido ou mesa não encontrada.");
      return;
    }

    if (roomData.owner_id !== user.id) {
      await supabase.from("room_invites").upsert(
        [
          {
            room_id: roomData.id,
            sender_id: roomData.owner_id,
            receiver_id: user.id,
            status: "accepted",
          },
        ],
        { onConflict: "room_id,receiver_id" }
      );
    }

    setJoiningByCode(false);
    alert(`✨ Sucesso! A mesa "${roomData.name}" foi salva no seu painel.`);
    setIsInvitesOpen(false);
    setInviteCode("");
    await fetchRooms(user.id);
    router.push(`/mesa/${roomData.id}`);
  };

  const handleAcceptInvite = async (invite: RoomInvite) => {
    await supabase
      .from("room_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    await fetchRooms(user.id);

    if (invite.room_id) {
      router.push(`/mesa/${invite.room_id}`);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    await supabase
      .from("room_invites")
      .update({ status: "rejected" })
      .eq("id", inviteId);

    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  // CRIAR MESA COM PLUGIN OU NATIVO
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !user) return;

    setIsCreating(true);

    let parsedPluginConfig = null;
    let finalSystemName = systemOption;

    if (systemOption === "Plugin Personalizado") {
      if (!loadedPlugin) {
        alert("❌ Por favor, envie um arquivo .json para criar a mesa com plugin!");
        setIsCreating(false);
        return;
      }
      parsedPluginConfig = loadedPlugin;
      finalSystemName = loadedPlugin.systemName || "Plugin Customizado";
    }

    const newRoomData = {
      name: roomName.trim(),
      system: finalSystemName,
      description: description.trim(),
      owner_id: user.id,
      invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      banner_url:
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
      plugin_config: parsedPluginConfig,
    };

    const { data, error } = await supabase
      .from("rooms")
      .insert([newRoomData])
      .select()
      .single();

    if (error) {
      alert("Erro ao criar sala: " + error.message);
    } else if (data) {
      const createdRoom: Room = {
        ...data,
        role: "mestre",
      };
      setRooms([createdRoom, ...rooms]);
      setRoomName("");
      setDescription("");
      setLoadedPlugin(null);
      setPluginFileName("");
      setIsModalOpen(false);
    }

    setIsCreating(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080811] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-purple-300 text-sm tracking-wider">
            Carregando o cosmos...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080811] text-white p-4 sm:p-6 md:p-12">
      {/* Topbar / Header do Usuário */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-purple-900/40">
        <div>
          <h1 className="text-3xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 text-center md:text-left">
            XHENOSWORLD
          </h1>
          <p className="text-gray-400 text-xs mt-0.5 text-center md:text-left">
            Painel do Aventureiro
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => router.push("/perfil")}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-[#12131f] hover:bg-purple-950/50 border border-purple-800/50 hover:border-cyan-400 rounded-xl transition cursor-pointer"
            title="Editar Meu Perfil"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={username}
                className="w-7 h-7 rounded-lg object-cover border border-cyan-400"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center font-bold text-xs shadow-md">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-purple-200">
              {username}
            </span>
            <span className="text-xs text-cyan-400 font-bold">⚙️</span>
          </button>

          <button
            onClick={() => router.push("/friends")}
            className="px-4 py-2 bg-[#12131f] hover:bg-purple-900/30 border border-purple-800/50 hover:border-cyan-400/60 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-cyan-300"
          >
            <span>👥</span> Amigos
          </button>

          <button
            onClick={() => setIsInvitesOpen(true)}
            className="relative px-4 py-2 bg-[#12131f] hover:bg-cyan-950/60 border border-cyan-800/50 hover:border-cyan-400 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer text-cyan-300"
          >
            <span>📩</span> Convites
            {pendingInvites.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                {pendingInvites.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold text-xs rounded-xl shadow-lg glow-purple transition hover:scale-105 cursor-pointer"
          >
            + Criar Mesa
          </button>

          <button
            onClick={handleLogout}
            title="Sair da Conta"
            className="px-3.5 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 hover:border-red-600 text-red-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            🚪 Sair
          </button>
        </div>
      </header>

      {/* Lista de Salas */}
      <section className="max-w-7xl mx-auto mt-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-purple-200 flex items-center gap-2">
            <span>🌌</span> Suas Mesas de Jogo
          </h2>
          <span className="text-xs text-gray-500 font-mono">
            Total: {rooms.length}
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[#12131f]/50 border border-purple-900/30 rounded-3xl max-w-xl mx-auto space-y-4">
            <div className="text-5xl">⚔️</div>
            <h3 className="text-lg font-bold text-gray-200">
              Nenhuma mesa encontrada
            </h3>
            <p className="text-gray-400 text-xs max-w-md mx-auto leading-relaxed">
              Você ainda não criou nem entrou em nenhuma mesa de RPG. Cole um código de convite ou crie a sua própria!
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setIsInvitesOpen(true)}
                className="px-4 py-2 bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-700 font-bold text-xs rounded-xl text-cyan-200 transition cursor-pointer"
              >
                📩 Entrar com Código
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold text-xs rounded-xl shadow-lg transition hover:scale-105 cursor-pointer"
              >
                + Criar Primeira Mesa
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="group bg-[#12131f]/80 border border-purple-900/40 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition duration-300 shadow-xl flex flex-col"
              >
                <div className="relative h-36 w-full overflow-hidden">
                  <img
                    src={room.banner_url}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-80"
                  />
                  <span
                    className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md backdrop-blur-md border ${
                      room.role === "mestre"
                        ? "bg-purple-950/80 text-purple-300 border-purple-700"
                        : "bg-cyan-950/80 text-cyan-300 border-cyan-700"
                    }`}
                  >
                    {room.role}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[11px] text-cyan-400 font-semibold uppercase tracking-widest flex items-center gap-1">
                      {room.plugin_config ? "🔌 Plugin: " : "⚔️ "} {room.system}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1 group-hover:text-cyan-300 transition">
                      {room.name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                      {room.description || "Sem descrição disponível."}
                    </p>
                  </div>

                  <a
                    href={`/mesa/${room.id}`}
                    className="w-full py-2.5 text-center bg-[#0b0c16] hover:bg-purple-900/30 border border-purple-800/50 hover:border-cyan-400 text-purple-200 hover:text-cyan-300 text-xs font-bold rounded-xl transition duration-200 block"
                  >
                    Entrar na Mesa →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL: CENTRAL DE CONVITES */}
      {isInvitesOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#12131f] border border-cyan-800/60 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-purple-900/40 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📩</span> Central de Convites & Códigos
              </h3>
              <button
                onClick={() => setIsInvitesOpen(false)}
                className="text-gray-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinByCode} className="bg-[#0b0c16] p-4 rounded-xl border border-purple-800/40 space-y-3">
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                🔑 Possui um Código de Convite?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Cole o código aqui (Ex: X7K9A2)..."
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#12131f] border border-purple-800/50 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={joiningByCode}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {joiningByCode ? "Entrando..." : "Entrar na Mesa"}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <span className="block text-xs font-bold text-purple-300 uppercase tracking-wider">
                📬 Convites Recebidos ({pendingInvites.length})
              </span>

              {pendingInvites.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500 bg-[#0b0c16] rounded-xl border border-dashed border-purple-900/40 p-4">
                  Nenhum convite pendente no momento.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-[#0b0c16] border border-purple-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-950 border border-purple-700 flex items-center justify-center font-bold text-sm text-cyan-300">
                          🏰
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {invite.room?.name || "Mesa de RPG"}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Convocado por <strong className="text-cyan-400">{invite.sender?.username || "um Aliado"}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAcceptInvite(invite)}
                          className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"
                        >
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(invite.id)}
                          className="px-2.5 py-1 bg-red-950 hover:bg-red-800 text-red-300 font-bold text-[10px] rounded-lg transition cursor-pointer"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsInvitesOpen(false)}
              className="w-full py-2 bg-[#0b0c16] hover:bg-purple-900/40 border border-purple-800/40 text-gray-300 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR NOVA MESA COM UPLOAD DE ARQUIVO JSON */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#12131f] border border-purple-800/60 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl glow-purple max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b border-purple-900/40 pb-3">
              <h3 className="text-xl font-bold text-white">Criar Nova Mesa</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">
                  Nome da Mesa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: As Crônicas de NID FOR END"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0b0c16] border border-purple-800/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">
                  Sistema de Jogo
                </label>
                <select
                  value={systemOption}
                  onChange={(e) => {
                    setSystemOption(e.target.value);
                    if (e.target.value !== "Plugin Personalizado") {
                      setLoadedPlugin(null);
                      setPluginFileName("");
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-[#0b0c16] border border-purple-800/50 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition text-sm cursor-pointer"
                >
                  <option value="NID FOR END">⚔️ NID FOR END (Nativo)</option>
                  <option value="Plugin Personalizado">🔌 Plugin Personalizado (.json)</option>
                </select>
              </div>

              {/* ÁREA DE PLUGIN: SELEÇÃO DE ARQUIVO .JSON */}
              {systemOption === "Plugin Personalizado" && (
                <div className="space-y-3 bg-[#0b0c16] p-4 rounded-xl border border-cyan-800/50">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      📁 Selecionar Arquivo do Plugin (.json)
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handlePluginFileUpload}
                      className="w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                    />
                  </div>

                  {/* PRÉVIA DO PLUGIN CARREGADO */}
                  {loadedPlugin ? (
                    <div className="p-3 bg-[#12131f] border border-green-500/60 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-green-400">
                          ✓ Plugin Carregado: {loadedPlugin.systemName}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {pluginFileName}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-300 space-y-0.5 pt-1">
                        <p>❤️ Recursos: <strong className="text-white">{loadedPlugin.resources?.map((r: any) => r.name).join(", ")}</strong></p>
                        <p>📊 Atributos: <strong className="text-white">{loadedPlugin.attributes?.map((a: any) => a.name).join(", ")}</strong></p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-400 font-semibold animate-pulse">
                      ⚠️ Nenhum arquivo selecionado. Por favor, escolha um arquivo .json de plugin.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">
                  Sinopse / Descrição
                </label>
                <textarea
                  rows={3}
                  placeholder="Resumo da história para os seus jogadores..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0b0c16] border border-purple-800/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-purple-900/40">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-white/5 text-gray-400 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? "Criando..." : "Criar Mesa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}