import { corsHeaders, getClientIp, json, supabaseAdmin } from "../_shared/recovery.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { email, reason } = await req.json();

    if (!email || typeof email !== "string") {
      return json({ error: "invalid_request" }, 400);
    }

    const normalized = email.trim().toLowerCase();
    const genericResponse = {
      ok: true,
      message: "Solicitacao recebida. Caso a conta exista, ela sera analisada pela equipe de suporte.",
    };

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, email, full_name")
      .eq("email", normalized)
      .maybeSingle();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabaseAdmin
      .from("account_recovery_requests")
      .select("id")
      .eq("requested_identifier", normalized)
      .eq("status", "pending")
      .gte("opened_at", since)
      .maybeSingle();

    if (existingPending) {
      console.log("Pedido pendente recente ja existe para:", normalized);
      return json(genericResponse, 200);
    }

    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from("account_recovery_requests")
      .insert({
        user_id: usuario?.id ?? null,
        requested_identifier: normalized,
        status: "pending",
        reason: typeof reason === "string" ? reason : null,
        ip: getClientIp(req),
        user_agent: req.headers.get("user-agent"),
      })
      .select("id")
      .single();

    if (requestError) {
      console.error("Erro criando pedido:", requestError);
      return json(genericResponse, 200);
    }

    await supabaseAdmin.from("account_recovery_audit").insert({
      request_id: requestRow.id,
      user_id: usuario?.id ?? null,
      action: "manual_recovery_requested",
      metadata: { ip: getClientIp(req), email_known: !!usuario },
    });

    const { data: admins } = await supabaseAdmin
      .from("internal_profiles")
      .select("user_id")
      .eq("nivel_acesso", "admin");

    if (admins?.length) {
      const message = usuario
        ? `Novo pedido de redefinicao de senha de ${usuario.full_name ?? normalized} (${normalized}).`
        : `Novo pedido de redefinicao de senha para o e-mail ${normalized} (conta nao encontrada - verificar manualmente).`;

      await supabaseAdmin.from("notificacoes").insert(
        admins.map((admin) => ({
          user_id: admin.user_id,
          titulo: "Pedido de redefinicao de senha",
          mensagem: message,
          tipo: "seguranca",
          link: "/admin/recuperacoes",
        })),
      );
    }

    return json(genericResponse, 200);
  } catch (error) {
    console.error("Erro em request-manual-recovery:", error);

    return json(
      {
        ok: true,
        message: "Solicitacao recebida. Caso a conta exista, ela sera analisada pela equipe de suporte.",
      },
      200,
    );
  }
});
