import { Home, Dumbbell, History, TrendingUp, MoreHorizontal, Target, Scale, Settings, BookOpen } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Ainda não implementado: aparece, mas marcado. */
  soon?: boolean;
};

/** Cinco destinos na barra inferior do celular. */
export const primaryNav: NavItem[] = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/treinos", label: "Treinos", icon: Dumbbell, soon: true },
  { href: "/historico", label: "Histórico", icon: History, soon: true },
  { href: "/progresso", label: "Progresso", icon: TrendingUp, soon: true },
];

/** Agrupados sob "Mais" no celular, visíveis na lateral no desktop. */
export const secondaryNav: NavItem[] = [
  { href: "/exercicios", label: "Exercícios", icon: BookOpen },
  { href: "/metas", label: "Metas", icon: Target, soon: true },
  { href: "/corpo", label: "Peso e medidas", icon: Scale, soon: true },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export const moreIcon = MoreHorizontal;
export const allNav = [...primaryNav, ...secondaryNav];
