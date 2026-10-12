import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getHomeRouteForRole } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect(getHomeRouteForRole(session.user.role));
}
