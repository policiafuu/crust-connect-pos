import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CriarCobrancaPayload {
  franquiaId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Variáveis de ambiente do backend não configuradas");
      return new Response(JSON.stringify({ error: "Configuração do backend ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as CriarCobrancaPayload;

    if (!body?.franquiaId) {
      return new Response(JSON.stringify({ error: "franquiaId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega dados da franquia, incluindo configuração de pagamento e descontos
    const { data: franquia, error: franquiaError } = await supabase
      .from("franquias")
      .select("id, nome_franquia, config_pagamento, cpf_cnpj, desconto_tipo, desconto_valor, desconto_percentual, desconto_recorrente")
      .eq("id", body.franquiaId)
      .maybeSingle();

    if (franquiaError || !franquia) {
      console.error("Erro ao buscar franquia:", franquiaError);
      return new Response(JSON.stringify({ error: "Franquia não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = (franquia.config_pagamento as any) || {};
    const planoId = cfg.plano_id as string | undefined;
    const valorPlanoConfig = cfg.valor_plano as number | undefined;

    // Configuração global de gateway (API Key única para todas as franquias)
    const { data: billingGatewayRow, error: billingConfigError } = await supabase
      .from('global_config')
      .select('config_value')
      .eq('config_key', 'billing_gateway')
      .maybeSingle();

    if (billingConfigError) {
      console.error('Erro ao carregar configuração global de gateway:', billingConfigError);
      return new Response(JSON.stringify({ error: 'Erro ao carregar configuração de cobrança' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let gatewayConfig: any = {};
    if (billingGatewayRow?.config_value) {
      try {
        gatewayConfig = JSON.parse(billingGatewayRow.config_value as string);
      } catch (e) {
        console.error('Erro ao parsear config_value de billing_gateway:', e);
      }
    }

    const provider = gatewayConfig.provider as string | undefined;
    const apiKey = gatewayConfig.api_key as string | undefined;

    if (!provider || !apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Configuração de pagamento global incompleta. Defina o gateway e a API Key na sessão de configuração ao lado do financeiro.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Busca plano e, se existir, pacote comercial correspondente para determinar valor base
    let valorCobranca: number | null = null;

    if (planoId) {
      const { data: plano, error: planoError } = await supabase
        .from('planos')
        .select('id, nome, valor_base')
        .eq('id', planoId)
        .maybeSingle();

      if (planoError) {
        console.error('Erro ao buscar plano:', planoError);
      }

      if (plano) {
        // 1) Tenta encontrar um pacote comercial com mesmo nome do plano (ex.: "Pacote Completo")
        const { data: pacote, error: pacoteError } = await supabase
          .from('pacotes_comerciais')
          .select('id, nome, preco_total')
          .eq('nome', plano.nome)
          .eq('ativo', true)
          .maybeSingle();

        if (pacoteError && pacoteError.code !== 'PGRST116') {
          console.error('Erro ao buscar pacote comercial vinculado ao plano:', pacoteError);
        }

        if (pacote?.preco_total != null) {
          valorCobranca = Number(pacote.preco_total);
        } else if (plano.valor_base != null) {
          // 2) Se não houver pacote, usa o valor_base do plano
          valorCobranca = Number(plano.valor_base);
        }
      }
    }

    // 3) Se ainda não tiver valor definido (ou não houver plano), usa valor configurado direto na franquia como fallback legado
    if (!valorCobranca && valorPlanoConfig != null) {
      valorCobranca = Number(valorPlanoConfig);
    }

    // Soma dos módulos ativos (preço mensal configurado no admin geral)
    const modulosAtivos = (cfg.modulos_ativos as string[] | undefined) || [];
    if (modulosAtivos.length > 0) {
      const { data: modulosRows, error: modulosError } = await supabase
        .from('modulos')
        .select('codigo, preco_mensal')
        .in('codigo', modulosAtivos)
        .eq('ativo', true);

      if (modulosError) {
        console.error('Erro ao buscar módulos para cobrança:', modulosError);
      } else if (modulosRows) {
        const adicionais = (modulosRows as any[]).reduce((acc, m) => {
          const v = m.preco_mensal != null ? Number(m.preco_mensal) : 0;
          return acc + (Number.isNaN(v) ? 0 : v);
        }, 0);
        valorCobranca = (valorCobranca || 0) + adicionais;
      }
    }

    // Aplicar descontos configurados na franquia
    const descontoTipo = (franquia as any).desconto_tipo as string | null;
    const descontoRecorrente = ((franquia as any).desconto_recorrente as boolean | null) ?? false;

    if (descontoTipo === 'fixo') {
      const descontoValor = Number((franquia as any).desconto_valor || 0);
      if (descontoValor > 0) {
        valorCobranca = (valorCobranca || 0) - descontoValor;
        console.log(`Aplicando desconto fixo de R$ ${descontoValor.toFixed(2)}. Recorrente: ${descontoRecorrente}`);
        
        // Se não é recorrente, limpar após aplicar
        if (!descontoRecorrente) {
          await supabase
            .from('franquias')
            .update({
              desconto_tipo: 'nenhum',
              desconto_valor: 0,
              desconto_percentual: 0,
            })
            .eq('id', franquia.id);
        }
      }
    } else if (descontoTipo === 'percentual') {
      const descontoPercentual = Number((franquia as any).desconto_percentual || 0);
      if (descontoPercentual > 0 && descontoPercentual <= 100) {
        const valorDesconto = (valorCobranca || 0) * (descontoPercentual / 100);
        valorCobranca = (valorCobranca || 0) - valorDesconto;
        console.log(`Aplicando desconto percentual de ${descontoPercentual}% (R$ ${valorDesconto.toFixed(2)}). Recorrente: ${descontoRecorrente}`);
        
        // Se não é recorrente, limpar após aplicar
        if (!descontoRecorrente) {
          await supabase
            .from('franquias')
            .update({
              desconto_tipo: 'nenhum',
              desconto_valor: 0,
              desconto_percentual: 0,
            })
            .eq('id', franquia.id);
        }
      }
    }

    if (!valorCobranca || valorCobranca <= 0) {
      return new Response(
        JSON.stringify({
          error:
            'Valor do plano não configurado ou zerado após descontos. Verifique o valor base, módulos ativos e descontos da franquia.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    let checkoutUrl: string | null = null;
    let externalId: string | null = null;

    if (provider === 'asas') {
      const asaasBaseUrl = "https://api.asaas.com/v3";

      const cpfCnpj = (franquia as any).cpf_cnpj as string | null | undefined;
      if (!cpfCnpj || !cpfCnpj.trim()) {
        return new Response(
          JSON.stringify({
            error:
              "Para criar a cobrança no Asaas é obrigatório informar o CPF ou CNPJ da franquia. Preencha o campo CPF/CNPJ na tela de Franquias e tente novamente.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const asaasBaseHeaders = {
        "Content-Type": "application/json",
        access_token: apiKey,
      } as const;

      const createAsaasPayment = async (effectiveCustomerId: string) => {
        const payload = {
          customer: effectiveCustomerId,
          billingType: "PIX",
          value: valorCobranca,
          dueDate: new Date().toISOString().slice(0, 10),
          description: `Renovação da franquia ${franquia.nome_franquia}`,
          externalReference: franquia.id,
        };

        const resp = await fetch(`${asaasBaseUrl}/payments`, {
          method: "POST",
          headers: asaasBaseHeaders,
          body: JSON.stringify(payload),
        });

        const bodyText = await resp.text();

        if (!resp.ok) {
          return { ok: false as const, bodyText, json: null as any };
        }

        let json: any;
        try {
          json = JSON.parse(bodyText);
        } catch (e) {
          console.error("Erro ao parsear resposta de pagamento Asaas:", e, bodyText);
          throw new Error("Erro inesperado ao processar resposta do Asaas.");
        }

        return { ok: true as const, bodyText, json };
      };

      const createAsaasCustomer = async () => {
        const digitsCpfCnpj = cpfCnpj.replace(/\D/g, "");

        // 1) Tenta reutilizar um cliente existente pelo CPF/CNPJ
        try {
          const existingResp = await fetch(
            `${asaasBaseUrl}/customers?cpfCnpj=${encodeURIComponent(digitsCpfCnpj)}`,
            {
              method: "GET",
              headers: asaasBaseHeaders,
            },
          );

          const existingBodyText = await existingResp.text();

          if (existingResp.ok) {
            let existingJson: any;
            try {
              existingJson = JSON.parse(existingBodyText);
            } catch (e) {
              console.error("Erro ao parsear resposta de listagem de clientes Asaas:", e, existingBodyText);
            }

            const existingCustomerId = existingJson?.data?.[0]?.id as string | undefined;
            if (existingCustomerId) {
              const newConfig = { ...cfg, customer_id: existingCustomerId };
              const { error: updateExistingError } = await supabase
                .from("franquias")
                .update({ config_pagamento: newConfig })
                .eq("id", franquia.id);

              if (updateExistingError) {
                console.error(
                  "Erro ao atualizar config_pagamento com customer_id existente do Asaas:",
                  updateExistingError,
                );
              }

              return existingCustomerId;
            }
          } else {
            console.warn("Falha ao listar clientes Asaas para reutilização:", existingBodyText);
          }
        } catch (e) {
          console.error("Erro ao tentar reutilizar cliente Asaas existente:", e);
        }

        // 2) Se não encontrou cliente, cria um novo
        const customerPayload: Record<string, unknown> = {
          name: franquia.nome_franquia,
          cpfCnpj: digitsCpfCnpj,
        };

        const resp = await fetch(`${asaasBaseUrl}/customers`, {
          method: "POST",
          headers: asaasBaseHeaders,
          body: JSON.stringify(customerPayload),
        });

        const bodyText = await resp.text();

        if (!resp.ok) {
          console.error("Erro ao criar cliente no Asaas:", bodyText);
          throw new Error("Erro ao criar cliente no Asaas. Verifique o CPF/CNPJ informado.");
        }

        let customerData: any;
        try {
          customerData = JSON.parse(bodyText);
        } catch (e) {
          console.error("Erro ao parsear resposta de criação de cliente Asaas:", e, bodyText);
          throw new Error("Erro inesperado ao criar cliente no Asaas.");
        }

        const newCustomerId = customerData.id as string | undefined;
        if (!newCustomerId) {
          console.error("Resposta de criação de cliente Asaas sem id:", customerData);
          throw new Error("Cliente criado no Asaas sem ID retornado.");
        }

        const newConfig = { ...cfg, customer_id: newCustomerId };
        const { error: updateError } = await supabase
          .from("franquias")
          .update({ config_pagamento: newConfig })
          .eq("id", franquia.id);

        if (updateError) {
          console.error("Erro ao atualizar config_pagamento com novo customer_id:", updateError);
        }

        return newCustomerId;
      };

      let effectiveCustomerId = (cfg.customer_id as string | undefined) ?? '';
      let paymentResult = await createAsaasPayment(effectiveCustomerId);

      if (!paymentResult.ok) {
        console.error("Erro ao criar cobrança no Asaas (1ª tentativa):", paymentResult.bodyText);

        let errorJson: any = null;
        try {
          errorJson = JSON.parse(paymentResult.bodyText);
        } catch (e) {
          console.error("Erro ao parsear corpo de erro do Asaas:", e);
        }

        const isInvalidCustomer = Array.isArray(errorJson?.errors)
          && errorJson.errors.some((err: any) => String(err?.code || "").startsWith("invalid_customer"));

        if (isInvalidCustomer) {
          const newCustomerId = await createAsaasCustomer();
          effectiveCustomerId = newCustomerId;
          paymentResult = await createAsaasPayment(effectiveCustomerId);
        }
      }

      if (!paymentResult.ok) {
        console.error("Erro ao criar cobrança no Asaas (tentativa final):", paymentResult.bodyText);
        return new Response(
          JSON.stringify({
            error: "Erro ao criar cobrança no Asaas",
            details: paymentResult.bodyText,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const asaasData = paymentResult.json;
      externalId = asaasData.id as string;
      checkoutUrl =
        (asaasData.invoiceUrl as string | undefined) || (asaasData.bankSlipUrl as string | undefined) || null;

      if (externalId) {
        const { error: insertError } = await supabase.from("franquia_cobrancas").insert({
          franquia_id: franquia.id,
          gateway: "asas",
          external_id: externalId,
          status: asaasData.status ?? "PENDING",
          valor: valorCobranca,
          vencimento: asaasData.dueDate ? new Date(asaasData.dueDate).toISOString() : null,
          payload: asaasData,
        });

        if (insertError) {
          console.error("Erro ao registrar cobrança localmente:", insertError);
        }
      }
    } else if (provider === "seabra") {
      // Aqui entraria a chamada real para o gateway Seabra.
      // Como as APIs variam entre clientes, deixamos o comportamento como genérico.
      console.log("Gateway Seabra configurado, mas integração direta ainda não implementada.");
      return new Response(
        JSON.stringify({
          error:
            "Integração direta com Seabra ainda não implementada. Use Asaas ou entre em contato com o suporte.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      return new Response(JSON.stringify({ error: "Gateway de pagamento não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkoutUrl) {
      return new Response(
        JSON.stringify({
          error:
            "Cobrança criada, mas o gateway não retornou uma URL de pagamento. Verifique o painel do gateway.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ checkoutUrl, externalId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função criar-cobranca-franquia:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
