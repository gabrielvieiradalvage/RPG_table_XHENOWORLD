"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface FriendProfile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface ConvidarAmigosProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ConvidarAmigos({ roomId, isOpen, onClose }: ConvidarAmigosProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUser(user);

    // 1. Busca amizades aceitas
    const { data: friendshipsData, error: friendError } = await supabase
      .from("friendships")
      .select(`
        id, sender_id, receiver_id, status,
        sender:profiles!sender_id(id, username, avatar_url),
        receiver:profiles!receiver_id(id, username, avatar_url)
      `)
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!friendError && friendshipsData) {
      const friendList: FriendProfile[] = friendshipsData.map((f: any) => {
        return f.sender_id === user.id ? f.receiver : f.sender;
      });
      setFriends(friendList);
    }

    // 2. Busca convites já existentes para esta mesa
    const { data: invitesData } = await supabase
      .from("room_invites")
      .select("receiver_id")
      .eq("room_id", roomId);

    if (invitesData) {
      setInvitedIds(invitesData.map((i: any) => i.receiver_id));
    }

    setLoading(false);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/mesa/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // ENVIAR OU REENVIAR CONVITE
  const handleInviteFriend = async (friend: FriendProfile, isResend = false) => {
    if (!currentUser) return;

    setSendingId(friend.id);

    const { error } = await supabase.from("room_invites").upsert(
      [
        {
          room_id: roomId,
          sender_id: currentUser.id,
          receiver_id: friend.id,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "room_id,receiver_id" }
    );

    setSendingId(null);

    if (error) {
      alert("Erro ao enviar convite: " + error.message);
    } else {
      if (!invitedIds.includes(friend.id)) {
        setInvitedIds((prev) => [...prev, friend.id]);
      }
      
      const link = `${window.location.origin}/mesa/${roomId}`;
      navigator.clipboard.writeText(link);

      alert(
        isResend
          ? `🔄 Convite reenviado com sucesso para ${friend.username}!`
          : `🚀 Convite enviado! ${friend.username} receberá a notificação no Dashboard dele.`
      );
    }
  };

  // CANCELAR / REMOVER CONVITE TRAVADO
  const handleCancelInvite = async (friendId: string, friendName: string) => {
    if (!confirm(`Deseja cancelar a convocação de ${friendName}?`)) return;

    setSendingId(friendId);

    const { error } = await supabase
      .from("room_invites")
      .delete()
      .eq("room_id", roomId)
      .eq("receiver_id", friendId);

    setSendingId(null);

    if (error) {
      alert("Erro ao cancelar convite: " + error.message);
    } else {
      setInvitedIds((prev) => prev.filter((id) => id !== friendId));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#12131f] border border-cyan-800/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
        
        {/* Header do Modal */}
        <div className="flex justify-between items-center border-b border-purple-900/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📩</span>
            <h3 className="text-base font-bold text-white">Convidar para a Mesa</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Copiar Link Direto */}
        <div className="bg-[#0b0c16] p-3 rounded-xl border border-purple-800/40 space-y-2">
          <label className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
            🔗 Link de Acesso Direto à Sala
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/mesa/${roomId}`}
              className="flex-1 bg-[#12131f] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? "✓ Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Lista de Amigos para Convidar */}
        <div className="space-y-3">
          <span className="block text-[10px] font-bold text-purple-300 uppercase tracking-wider">
            👥 Seus Aliados Conectados ({friends.length})
          </span>

          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">Carregando lista de aliados...</div>
          ) : friends.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 bg-[#0b0c16] rounded-xl border border-dashed border-purple-900/40 p-4">
              Você ainda não tem amigos adicionados.<br />Vá até o menu <strong>Amigos</strong> no Dashboard para adicionar jogadores!
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-purple-900">
              {friends.map((friend) => {
                const isInvited = invitedIds.includes(friend.id);
                const isSending = sendingId === friend.id;
                const initial = friend.username ? friend.username.charAt(0).toUpperCase() : "A";

                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-2.5 bg-[#0b0c16] border border-purple-900/40 rounded-xl hover:border-cyan-500/50 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.username}
                          className="w-8 h-8 rounded-full object-cover border border-cyan-400"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white border border-cyan-400">
                          {initial}
                        </div>
                      )}
                      <span className="text-xs font-bold text-gray-200">{friend.username}</span>
                    </div>

                    {isInvited ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleInviteFriend(friend, true)}
                          disabled={isSending}
                          className="px-2.5 py-1 bg-cyan-900/60 hover:bg-cyan-700 text-cyan-200 border border-cyan-700 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Reenviar Notificação de Convite"
                        >
                          🔄 Reenviar
                        </button>
                        <button
                          onClick={() => handleCancelInvite(friend.id, friend.username)}
                          disabled={isSending}
                          className="px-2 py-1 bg-red-950 hover:bg-red-800 text-red-300 border border-red-800 text-[10px] font-bold rounded-lg transition cursor-pointer"
                          title="Cancelar Convite"
                        >
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInviteFriend(friend)}
                        disabled={isSending}
                        className="px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-md disabled:opacity-50"
                      >
                        {isSending ? "Enviando..." : "+ Convidar"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="w-full py-2 bg-[#0b0c16] hover:bg-purple-900/40 border border-purple-800/40 text-gray-300 text-xs font-bold rounded-xl transition cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}