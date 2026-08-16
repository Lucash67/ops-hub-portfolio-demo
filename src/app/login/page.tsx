import { HubLeftPanel } from "@/components/hub/hub-left-panel";
import { HubAuthPanel } from "@/components/hub/hub-auth-panel";
import { LhHubBackground } from "@/components/hub/lh-hub-background";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#050505] lg:h-screen lg:max-h-screen lg:overflow-hidden lg:grid lg:grid-cols-2">
      <LhHubBackground />

      <div className="relative z-10 order-1 min-h-0 lg:order-2 lg:h-full lg:overflow-hidden">
        <HubAuthPanel />
      </div>
      <div className="relative z-10 order-2 min-h-0 lg:order-1 lg:h-full lg:overflow-hidden">
        <HubLeftPanel />
      </div>
    </div>
  );
}
