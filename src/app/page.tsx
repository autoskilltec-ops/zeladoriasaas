import { redirect } from "next/navigation"

// Redireciona para o app — o layout de (app) cuida da auth
export default function RootPage() {
  redirect("/inspecao")
}
