import { cn } from "@/core/utils/cn";

/**
 * Marca do SériePro.
 *
 * O símbolo são três barras inclinadas que montam um "S". As três barras
 * são as séries — que é o dado em torno do qual o app inteiro gira — e a
 * inclinação dá a leitura de progressão.
 *
 * Desenhado em `currentColor` para servir também em monocromático, que é
 * o que o ícone maskable do Android e o favicon pedem. A opacidade
 * decrescente das barras cria a profundidade sem depender de uma segunda
 * cor, então a versão branca sobre fundo escuro continua funcionando.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-7 text-brand", className)}
    >
      {/* Barra de cima: recuada à esquerda, como o topo de um "S". */}
      <path d="M12.4 5h14.2l-4.6 7.2H7.8L12.4 5Z" fill="currentColor" />
      {/* Barra do meio: centrada, é a diagonal que fecha a leitura. */}
      <path d="M9.1 12.4h14.2l-4.6 7.2H4.5l4.6-7.2Z" fill="currentColor" opacity="0.85" />
      {/* Barra de baixo: avança à direita, fechando o "S". */}
      <path d="M5.4 19.8h14.2L15 27H0.8l4.6-7.2Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/**
 * Marca completa: símbolo em verde-limão, "Série" em branco e "Pro" em
 * verde, como na identidade. O contraste entre as duas metades é o que
 * sustenta a leitura do nome — sem ele viraria uma palavra só.
 */
export function Logo({ className, symbolOnly = false }: { className?: string; symbolOnly?: boolean }) {
  if (symbolOnly) return <LogoMark className={className} />;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-condensed text-2xl font-bold tracking-tight text-body">
        Série<span className="text-brand">Pro</span>
      </span>
    </span>
  );
}
