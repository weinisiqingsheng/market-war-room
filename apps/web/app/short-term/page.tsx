import type { Metadata } from "next";
import { ShortTermLab } from "@/features/short-term/ShortTermLab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Short-Term Intelligence Lab — Market War Room",
  description: "Standalone mock Jev research workspace for short-term strategy evaluation.",
};

export default function ShortTermPage() {
  return <ShortTermLab />;
}

