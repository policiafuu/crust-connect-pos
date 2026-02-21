import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGlobalConfig } from '@/lib/api';

interface TVCallAnimationProps {
  show: boolean;
  tipo: 'ENTREGA' | 'PAGAMENTO';
  nomeMotoboy: string;
  bagNome?: string;
  callPhrase?: string;
  bagPhrase?: string;
  bebidaPhrase?: string;
  hasBebida?: boolean;
  onComplete: () => void;
}

export const TVCallAnimation = ({
  show,
  tipo,
  nomeMotoboy,
  bagNome,
  callPhrase,
  bagPhrase,
  bebidaPhrase,
  hasBebida,
  onComplete,
}: TVCallAnimationProps) => {
  useEffect(() => {
    if (!show) return;

    // 4 segundos de exibição da tela cheia
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [show, onComplete]);

  // Buscar títulos personalizados da configuração
  const { data: entregaTituloCustom } = useQuery({
    queryKey: ['global-config', 'tv_entrega_titulo'],
    queryFn: () => fetchGlobalConfig('tv_entrega_titulo'),
  });

  const { data: pagamentoTituloCustom } = useQuery({
    queryKey: ['global-config', 'tv_pagamento_titulo'],
    queryFn: () => fetchGlobalConfig('tv_pagamento_titulo'),
  });

  const isEntrega = tipo === 'ENTREGA';
  const isPagamento = tipo === 'PAGAMENTO';
  const bgColor = isPagamento
    ? 'from-emerald-900 via-emerald-800 to-emerald-950'
    : 'from-sky-900 via-sky-800 to-sky-950';
  const accentColor = isPagamento ? 'text-emerald-300' : 'text-sky-300';
  const iconBg = isPagamento ? 'bg-emerald-500' : 'bg-sky-500';

  // Usar títulos personalizados ou fallback padrão
  const tituloExibicao = isPagamento
    ? (pagamentoTituloCustom || 'PAGAMENTO CHAMADO')
    : (entregaTituloCustom || 'ENTREGA CHAMADA');

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden animate-fade-in">
      {/* Tela cheia com ícone e mensagem */}
      <div
        className={`animate-scale-in absolute inset-0 bg-gradient-to-br ${bgColor} flex flex-col items-center justify-center px-6 md:px-16 text-center`}
      >
        <div className={`animate-pulse-custom ${iconBg} w-44 h-44 md:w-56 md:h-56 rounded-full flex items-center justify-center mb-10 shadow-2xl`}>
          {isEntrega ? (
            <svg className="w-24 h-24 md:w-32 md:h-32 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          ) : (
            <div className="relative">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-emerald-500/20 flex items-center justify-center animate-scale-in">
                <svg className="w-16 h-16 md:w-20 md:h-20 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              {/* Partículas de dinheiro */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="animate-[float-money_1.8s_ease-in-out_infinite] text-emerald-300 text-2xl md:text-3xl absolute -left-4 top-0">
                  R$
                </div>
                <div className="animate-[float-money_2.1s_ease-in-out_infinite] text-emerald-400 text-xl md:text-2xl absolute right-0 -top-2">
                  $
                </div>
                <div className="animate-[float-money_2.4s_ease-in-out_infinite] text-emerald-200 text-2xl md:text-3xl absolute -right-6 bottom-0">
                  💵
                </div>
              </div>
            </div>
          )}
        </div>

        <h1
          className={`animate-pulse-slow text-[7vw] md:text-[5vw] leading-none font-black ${accentColor} mb-6 tracking-wider`}
        >
          {tituloExibicao}
        </h1>

        <div className="animate-slide-up max-w-5xl mx-auto space-y-4">
          <p className="text-3xl md:text-4xl text-white/80 font-semibold whitespace-pre-line">
            {callPhrase
              || (tipo === 'PAGAMENTO'
                ? `Senha ${nomeMotoboy}\n${nomeMotoboy}, é a sua vez de receber!\nVá até o caixa imediatamente.`
                : `É a sua vez "${nomeMotoboy}"`)}
          </p>
          {isEntrega && (bagPhrase || bagNome) && (
            <p className="text-2xl md:text-3xl text-white/80 font-semibold">
              {bagPhrase || `Pegue a "${bagNome}"`}
            </p>
          )}
          {isEntrega && hasBebida && (
            <div className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-yellow-400/20 border border-yellow-300/70 gap-2 mt-2 animate-pulse mx-auto">
              <span className="text-2xl">🍹</span>
              <span className="text-xl md:text-2xl text-yellow-100 font-semibold">
                {bebidaPhrase || "Tem bebida nas comandas"}
              </span>
            </div>
          )}
          <p className="text-[6vw] md:text-[4.5vw] font-black text-white tracking-wide break-words">
            {nomeMotoboy}
          </p>
        </div>

        <div className={`animate-ping-slow absolute bottom-10 w-24 h-24 md:w-32 md:h-32 ${iconBg} rounded-full opacity-20`} />

        <style>{`
          @keyframes pulse-custom {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.08) rotate(4deg); }
          }
          @keyframes pulse-slow {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.04); }
          }
          @keyframes slide-up {
            0% { transform: translateY(24px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes ping-slow {
            0%, 100% { transform: scale(1); opacity: 0.18; }
            50% { transform: scale(1.25); opacity: 0.45; }
          }
          @keyframes float-money {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
            50% { transform: translateY(-12px) rotate(15deg); opacity: 1; }
          }

          .animate-scale-in {
            animation: fade-in 0.5s ease-out forwards;
          }
          .animate-pulse-custom {
            animation: pulse-custom 2s ease-in-out infinite;
          }
          .animate-pulse-slow {
            animation: pulse-slow 1.5s ease-in-out infinite;
          }
          .animate-slide-up {
            animation: slide-up 0.5s ease-out 0.3s backwards;
          }
          .animate-ping-slow {
            animation: ping-slow 1.2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  );
};
