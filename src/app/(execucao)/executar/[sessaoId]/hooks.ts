"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Relógio que avança sozinho. Começa em 0 e só ganha valor depois de
 * montar: o horário do servidor e o do celular nunca batem, e um valor
 * calculado na renderização do servidor quebraria a hidratação.
 */
export function useAgora(intervaloMs: number): number {
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    setAgora(Date.now());
    const id = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

export type Descanso = { fim: number; total: number };

/**
 * Cronômetro de descanso.
 *
 * Guarda o instante de término, não uma contagem regressiva. Com a tela
 * bloqueada o navegador pausa o JavaScript, mas o término continua certo:
 * ao desbloquear, a conta `fim - agora` já mostra o tempo real. Pelo mesmo
 * motivo sobrevive a recarregar a página — o término fica no localStorage,
 * por sessão de treino.
 */
export function useRestTimer(sessionId: string) {
  const chave = `almore:descanso:${sessionId}`;
  const [descanso, setDescanso] = useState<Descanso | null>(null);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(chave);
      if (!bruto) return;
      const d = JSON.parse(bruto) as Partial<Descanso>;
      // Descanso que acabou há mais de um minuto não interessa mais.
      if (typeof d.fim === "number" && typeof d.total === "number" && d.fim > Date.now() - 60_000) {
        setDescanso({ fim: d.fim, total: d.total });
      } else {
        window.localStorage.removeItem(chave);
      }
    } catch {
      // Armazenamento bloqueado (aba privada): o cronômetro funciona sem persistir.
    }
  }, [chave]);

  const gravar = useCallback(
    (d: Descanso | null) => {
      setDescanso(d);
      try {
        if (d) window.localStorage.setItem(chave, JSON.stringify(d));
        else window.localStorage.removeItem(chave);
      } catch {
        // Idem: sem persistência, mas sem quebrar.
      }
    },
    [chave],
  );

  const iniciar = useCallback((segundos: number) => gravar({ fim: Date.now() + segundos * 1000, total: segundos }), [gravar]);

  const ajustar = useCallback(
    (deltaSegundos: number) => {
      if (!descanso) return;
      const fim = Math.max(Date.now(), descanso.fim + deltaSegundos * 1000);
      gravar({ fim, total: Math.max(1, descanso.total + deltaSegundos) });
    },
    [descanso, gravar],
  );

  const parar = useCallback(() => gravar(null), [gravar]);

  return { descanso, iniciar, ajustar, parar };
}

/**
 * Mantém a tela ligada durante o treino, quando o usuário pede.
 *
 * O navegador solta a trava sozinho quando a aba sai de vista; ao voltar,
 * pedimos de novo se o usuário tinha ligado. Só existe em contexto seguro
 * (HTTPS ou localhost) — fora disso o botão nem aparece.
 */
export function useWakeLock() {
  const [suportado, setSuportado] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const sentinela = useRef<WakeLockSentinel | null>(null);
  const querAtivo = useRef(false);

  const pedir = useCallback(async () => {
    try {
      const s = await navigator.wakeLock.request("screen");
      sentinela.current = s;
      setAtivo(true);
      s.addEventListener("release", () => setAtivo(false));
    } catch {
      // Recusado (bateria fraca, aba em segundo plano): fica desligado.
      setAtivo(false);
    }
  }, []);

  useEffect(() => {
    setSuportado("wakeLock" in navigator);

    function aoVoltar() {
      if (document.visibilityState === "visible" && querAtivo.current) void pedir();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      void sentinela.current?.release();
    };
  }, [pedir]);

  const alternar = useCallback(async () => {
    if (querAtivo.current) {
      querAtivo.current = false;
      await sentinela.current?.release();
      sentinela.current = null;
      setAtivo(false);
    } else {
      querAtivo.current = true;
      await pedir();
    }
  }, [pedir]);

  return { suportado, ativo, alternar };
}

/**
 * Aviso de fim do descanso: vibração e três bipes.
 *
 * O áudio do navegador só toca depois de um toque do usuário, por isso
 * `preparar` é chamado no toque de concluir a série. Com a tela bloqueada
 * nada disso toca — o aviso nesse caso depende do service worker da Fase 9.
 */
export function useAlarme() {
  const contexto = useRef<AudioContext | null>(null);

  const preparar = useCallback(() => {
    try {
      contexto.current ??= new AudioContext();
      void contexto.current.resume();
    } catch {
      // Sem áudio, a vibração ainda avisa.
    }
  }, []);

  const tocar = useCallback(() => {
    if ("vibrate" in navigator) navigator.vibrate([250, 120, 250]);

    const c = contexto.current;
    if (!c) return;
    try {
      for (let i = 0; i < 3; i++) {
        const inicio = c.currentTime + i * 0.3;
        const osc = c.createOscillator();
        const ganho = c.createGain();
        osc.frequency.value = 880;
        ganho.gain.setValueAtTime(0.0001, inicio);
        ganho.gain.exponentialRampToValueAtTime(0.3, inicio + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2);
        osc.connect(ganho).connect(c.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.22);
      }
    } catch {
      // Idem.
    }
  }, []);

  return { preparar, tocar };
}
