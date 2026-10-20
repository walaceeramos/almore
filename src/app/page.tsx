import { redirect } from "next/navigation";

/** Sem login: o início decide, e manda para as boas-vindas quem ainda não tem perfil. */
export default function RootPage() {
  redirect("/inicio");
}
