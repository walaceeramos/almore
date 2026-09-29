import { redirect } from "next/navigation";

/** O middleware já decide entre /entrar e /inicio; isto é a rede de segurança. */
export default function RootPage() {
  redirect("/inicio");
}
