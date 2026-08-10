import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  
  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Executado a partir de Server Component, pode ser ignorado no set
            }
          },
        },
      }
    );

    // Troca o código por uma sessão nos cookies
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Força o redirecionamento seguro para o Dashboard baseado na URL da requisição
  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}