import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function buildNpcSystemPrompt(npc: any, isCombat: boolean) {
  return `Você é um NPC em um jogo de RPG de mesa chamado "NID FOR END".
Seu nome é: ${npc.name || "NPC"}.
Sua personalidade é: ${npc.personality || "Neutro"}.
Seus status atuais são: HP (${npc.current_hp ?? 20}/${npc.max_hp ?? 20}) e Stamina (${npc.current_stamina ?? 10}/${npc.max_stamina ?? 10}).

REGRAS DE INTERPRETAÇÃO:
1. Responda APENAS como ${npc.name || "NPC"}.
2. Leve seus status em consideração (se o HP estiver baixo, aja com dor ou raiva).
${isCombat ? "3. VOCÊ ESTÁ EM COMBATE! Responda de forma ágil, tensa e orientada à ação." : "3. Você está em modo de exploração/diálogo livre."}
Formule respostas curtas de até 3 frases.`;
}

export async function POST(req: Request) {
  try {
    const { npcContext, userMessage, chatHistory = [], isCombat } = await req.json();

    if (!npcContext || !userMessage) {
      return NextResponse.json(
        { error: "Faltando contexto do NPC ou mensagem do usuário." },
        { status: 400 }
      );
    }

    const basePrompt = buildNpcSystemPrompt(npcContext, Boolean(isCombat));

    const systemPrompt = `${basePrompt}

[REGRAS DE MEMÓRIA]:
- LEIA O HISTÓRICO. Se o jogador já se apresentou ou conversou com você, NUNCA pergunte "Quem é você?" ou "O que faz aqui?".`;

    const formattedHistory = Array.isArray(chatHistory)
      ? chatHistory.map((item: any) => ({
          role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: item.content,
        }))
      : [];

    const messagesForGroq = [
      { role: "system" as const, content: systemPrompt },
      ...formattedHistory,
      { role: "user" as const, content: userMessage },
    ];

    const completion = await groq.chat.completions.create({
      messages: messagesForGroq,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 220,
    });

    const reply = completion.choices[0]?.message?.content || "...";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Erro no processamento da IA (Xhenos Mind):", error);
    return NextResponse.json(
      { error: error?.message || "O Xhenos Mind falhou ao processar a resposta." },
      { status: 500 }
    );
  }
}