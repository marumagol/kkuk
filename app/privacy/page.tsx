import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/lib/legal";

export const metadata = { title: "개인정보 처리방침" };

export default function Privacy() {
  return <LegalPage doc={PRIVACY} />;
}
