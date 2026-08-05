"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  sender: Profile;
  receiver: Profile;
}

export default function FriendsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const [friendships, setFriendships] = useState<Friendship[]>([]);

  useEffect(() => {
    loadUserAndFriends();
  }, []);

  const loadUserAndFriends = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUser(user);
    await fetchFriendships(user.id);
    setLoading(false);
  };

  // Buscar todas as amizades (Enviadas e Recebidas)
  const fetchFriendships = async (userId: string) => {
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        id, sender_id, receiver_id, status,
        sender:profiles!sender_id(id, username, avatar_url),
        receiver:profiles!receiver_id(id, username, avatar_url)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (!error && data) {
      setFriendships(data as any);
    }
  };

  // Buscar jogadores pelo Nickname
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUser) return;
    setSearching(true);

    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${searchQuery}%`)
      .neq("id", currentUser.id)
      .limit(10);

    setSearchResults(data || []);
    setSearching(false);
  };

  // Enviar Pedido
  const sendRequest = async (receiverId: string) => {
    const { error } = await supabase
      .from("friendships")
      .insert([{ sender_id: currentUser.id, receiver_id: receiverId, status: "pending" }]);

    if (!error) {
      alert("Pedido de amizade enviado!");
      fetchFriendships(currentUser.id);
    } else {
      alert("Erro ao enviar pedido ou pedido já existente.");
    }
  };

  // Aceitar Pedido
  const acceptRequest = async (friendshipId: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    fetchFriendships(currentUser.id);
  };

  // Recusar ou Cancelar Pedido / Desfazer Amizade
  const removeFriendship = async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    fetchFriendships(currentUser.id);
  };

  // Filtros de listas
  const friends = friendships.filter((f) => f.status === "accepted");
  const pendingReceived = friendships.filter((f) => f.status === "pending" && f.receiver_id === currentUser?.id);
  const pendingSent = friendships.filter((f) => f.status === "pending" && f.sender_id === currentUser?.id);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080811] text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080811] text-white p-4 sm:p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-900/40 pb-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-3.5 py-2 bg-[#12131f] hover:bg-cyan-950/60 border border-cyan-800/50 hover:border-cyan-500 rounded-xl text-xs font-semibold text-cyan-300 transition cursor-pointer"
          >
            ← Voltar ao Dashboard
          </button>
          <h1 className="text-xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            REDE DE AVENTUREIROS
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* LADO ESQUERDO: BUSCA E PEDIDOS ENVIADOS */}
          <div className="space-y-6">
            <div className="bg-[#12131f] border border-purple-900/40 rounded-2xl p-6 shadow-xl">
              <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">
                🔍 Encontrar Jogador
              </h2>
              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Buscar pelo Nickname..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-[#0b0c16] border border-purple-800/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 text-sm"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  {searching ? "Buscando..." : "Buscar"}
                </button>
              </form>

              {/* Resultados da Busca */}
              <div className="space-y-2">
                {searchResults.map((profile) => {
                  const alreadyFriend = friendships.find((f) => f.receiver_id === profile.id || f.sender_id === profile.id);
                  const initialLetter = profile.username ? profile.username.charAt(0).toUpperCase() : "A";

                  return (
                    <div key={profile.id} className="flex items-center justify-between p-3 bg-[#0b0c16] border border-purple-900/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.username}
                            className="w-10 h-10 rounded-full object-cover border border-cyan-500"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white border border-cyan-500 shadow-md">
                            {initialLetter}
                          </div>
                        )}
                        <span className="text-sm font-bold text-gray-200">{profile.username}</span>
                      </div>
                      
                      {!alreadyFriend ? (
                        <button
                          onClick={() => sendRequest(profile.id)}
                          className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-700 border border-cyan-700 text-cyan-300 text-[10px] font-bold rounded-lg transition cursor-pointer"
                        >
                          + Adicionar
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold bg-[#12131f] px-2 py-1 rounded-md border border-gray-800">
                          {alreadyFriend.status === "accepted" ? "Já são amigos" : "Pedido Pendente"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pedidos Enviados */}
            {pendingSent.length > 0 && (
              <div className="bg-[#12131f] border border-purple-900/40 rounded-2xl p-6 shadow-xl">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  📤 Pedidos Enviados ({pendingSent.length})
                </h2>
                <div className="space-y-2">
                  {pendingSent.map((req) => {
                    const initialLetter = req.receiver?.username ? req.receiver.username.charAt(0).toUpperCase() : "A";

                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-[#0b0c16] border border-gray-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          {req.receiver?.avatar_url ? (
                            <img
                              src={req.receiver.avatar_url}
                              alt={req.receiver.username}
                              className="w-8 h-8 rounded-full object-cover border border-gray-600"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center font-bold text-xs text-white border border-gray-600">
                              {initialLetter}
                            </div>
                          )}
                          <span className="text-xs font-bold text-gray-300">{req.receiver?.username}</span>
                        </div>
                        <button
                          onClick={() => removeFriendship(req.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* LADO DIREITO: PEDIDOS RECEBIDOS E LISTA DE AMIGOS */}
          <div className="space-y-6">
            
            {/* Pedidos Recebidos */}
            {pendingReceived.length > 0 && (
              <div className="bg-[#1a120b] border border-amber-700/50 rounded-2xl p-6 shadow-[0_0_15px_rgba(217,119,6,0.15)]">
                <h2 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 animate-pulse">
                  📥 Novos Pedidos de Amizade ({pendingReceived.length})
                </h2>
                <div className="space-y-2">
                  {pendingReceived.map((req) => {
                    const initialLetter = req.sender?.username ? req.sender.username.charAt(0).toUpperCase() : "A";

                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-[#0f0a07] border border-amber-900/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          {req.sender?.avatar_url ? (
                            <img
                              src={req.sender.avatar_url}
                              alt={req.sender.username}
                              className="w-10 h-10 rounded-full object-cover border border-amber-500"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-red-600 flex items-center justify-center font-bold text-sm text-white border border-amber-500 shadow-md">
                              {initialLetter}
                            </div>
                          )}
                          <span className="text-sm font-bold text-gray-200">{req.sender?.username}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptRequest(req.id)}
                            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-[10px] font-bold rounded-lg transition cursor-pointer shadow-lg"
                          >
                            Aceitar
                          </button>
                          <button
                            onClick={() => removeFriendship(req.id)}
                            className="px-3 py-1.5 bg-red-950 hover:bg-red-800 text-red-300 text-[10px] font-bold rounded-lg transition cursor-pointer"
                          >
                            Recusar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lista de Amigos */}
            <div className="bg-[#12131f] border border-purple-900/40 rounded-2xl p-6 shadow-xl flex-1">
              <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4">
                🤝 Seus Aliados ({friends.length})
              </h2>
              
              {friends.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs border border-dashed border-purple-900/40 rounded-xl">
                  Você ainda não tem amigos na sua lista.<br />Use a busca ao lado para encontrar aventureiros!
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friendship) => {
                    const friend = friendship.sender_id === currentUser.id ? friendship.receiver : friendship.sender;
                    const initialLetter = friend?.username ? friend.username.charAt(0).toUpperCase() : "A";
                    
                    return (
                      <div key={friendship.id} className="flex items-center justify-between p-3 bg-[#0b0c16] border border-purple-800/50 rounded-xl hover:border-cyan-500/50 transition">
                        <div className="flex items-center gap-3">
                          {friend?.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={friend.username}
                              className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center font-bold text-base text-white border-2 border-purple-500 shadow-md">
                              {initialLetter}
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-bold text-gray-200 block">{friend?.username}</span>
                            <span className="text-[9px] text-green-400 bg-green-950/50 px-1.5 py-0.5 rounded border border-green-800/50">Online</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if(confirm(`Tem certeza que deseja desfazer amizade com ${friend?.username}?`)) removeFriendship(friendship.id);
                          }}
                          className="text-[10px] text-gray-500 hover:text-red-400 transition cursor-pointer px-2"
                          title="Desfazer Amizade"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}