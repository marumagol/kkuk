/* S06 여행 만들기 */
import { redirect } from "next/navigation";
import { AppShell } from "@/components/screen";
import { TripCreate } from "@/components/trip-create";
import { getViewer } from "@/lib/viewer";
import { todayKST } from "@/lib/mock";

export const metadata = { title: "여행 만들기" };

export default async function NewTrip() {
  const v = await getViewer();
  if (v.kind === "guest") redirect("/login?next=/trips/new");
  return (
    <AppShell bottomGap={false}>
      <TripCreate today={todayKST()} />
    </AppShell>
  );
}
