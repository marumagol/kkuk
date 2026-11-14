/* S16 함께하는 사람 (2단계) : 목록, 초대 링크(주인), 권한 바꾸기/내보내기/주인 넘기기(주인), 나가기 */
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { loadMembers } from "@/lib/trips";
import { PlaceShell } from "../places/place-shell";
import { MembersPanel } from "@/components/members-panel";

export const metadata = { title: "함께하는 사람" };

export default async function Members({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/members`);
  const view = await loadMembers(viewer, id);
  if (!view) notFound();
  return (
    <PlaceShell tripId={id} title="함께하는 사람" back={`/trips/${id}`}>
      <MembersPanel view={view} />
    </PlaceShell>
  );
}
