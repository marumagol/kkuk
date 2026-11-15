/* 내 장소 지도는 여행 탭 세계 지도로 합쳤다 (2026-11-15). 예전 링크는 여행 탭으로 */
import { redirect } from "next/navigation";

export default function MyPlacesMap() {
  redirect("/trips");
}
