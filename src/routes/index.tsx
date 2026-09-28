import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setScreen, type ScreenKey } from "@/lib/assistantContext";
import LandingPage from "@/components/LandingPage";
import BusinessDashboard from "@/components/BusinessDashboard";
import ProDashboard from "@/components/ProDashboard";
import PersonalDashboard from "@/components/PersonalDashboard";
import EnginesLab from "@/components/EnginesLab";
import TrendRadar from "@/components/TrendRadar";
import SuppliersBoard from "@/components/SuppliersBoard";
import ContractorsBoard from "@/components/ContractorsBoard";
import SignageStudio from "@/components/SignageStudio";
import VisualStudio from "@/components/features/VisualStudio";
import type { AppMode } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ديكور AI — تصميم الواجهات والديكور الداخلي بالذكاء الاصطناعي" },
      {
        name: "description",
        content:
          "ارفع صورة واجهتك أو غرفتك واكتب طلبك بالعربية لتحصل على تصميم جديد فوراً: واجهات، كلادنج، نيون، وتجديد المنازل.",
      },
      { property: "og:title", content: "ديكور AI — تصميم بالذكاء الاصطناعي" },
      {
        property: "og:description",
        content: "تصميم واجهات المحال وتجديد المنازل بنقرة واحدة، بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [showLab, setShowLab] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [showContractors, setShowContractors] = useState(false);
  const [showSignage, setShowSignage] = useState(false);
  const [showVision, setShowVision] = useState(false);

  const screen: ScreenKey = showVision
    ? "vision"
    : showSignage
      ? "signage"
      : showSuppliers
        ? "suppliers"
        : showContractors
          ? "contractors"
          : showRadar
            ? "radar"
            : showLab
              ? "lab"
              : mode
                ? mode
                : "landing";

  useEffect(() => {
    setScreen(screen);
  }, [screen]);

  if (showVision) return <VisualStudio onBack={() => setShowVision(false)} />;
  if (showSignage) return <SignageStudio onBack={() => setShowSignage(false)} />;
  if (showSuppliers) return <SuppliersBoard onBack={() => setShowSuppliers(false)} />;
  if (showContractors) return <ContractorsBoard onBack={() => setShowContractors(false)} />;
  if (showRadar) return <TrendRadar onBack={() => setShowRadar(false)} />;
  if (showLab) return <EnginesLab onBack={() => setShowLab(false)} />;
  if (mode === "business") return <BusinessDashboard onBack={() => setMode(null)} />;
  if (mode === "pro") return <ProDashboard onBack={() => setMode(null)} />;
  if (mode === "personal") return <PersonalDashboard onBack={() => setMode(null)} />;

  return (
    <LandingPage
      onSelect={setMode}
      onOpenLab={() => setShowLab(true)}
      onOpenRadar={() => setShowRadar(true)}
      onOpenSuppliers={() => setShowSuppliers(true)}
      onOpenContractors={() => setShowContractors(true)}
      onOpenSignage={() => setShowSignage(true)}
      onOpenVision={() => setShowVision(true)}
    />
  );
}
