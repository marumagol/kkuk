import { LegalPage } from "@/components/legal-page";
import { TERMS } from "@/lib/legal";

export const metadata = { title: "이용약관" };

export default function Terms() {
  return <LegalPage doc={TERMS} />;
}
