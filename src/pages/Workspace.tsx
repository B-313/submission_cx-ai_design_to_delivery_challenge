import { useState } from "react";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import Header from "@/components/workspace/Header";
import SourceLibrary from "@/components/workspace/SourceLibrary";
import RegistrationPanel from "@/components/workspace/RegistrationPanel";
import BriefEditorPanel from "@/components/workspace/BriefEditorPanel";
import PreliminaryPanel from "@/components/workspace/PreliminaryPanel";
import BuilderPanel from "@/components/workspace/BuilderPanel";
import ReviewPanel from "@/components/workspace/ReviewPanel";
import SubmitPanel from "@/components/workspace/SubmitPanel";

const PANELS = [
  RegistrationPanel,   // 0 - register
  BriefEditorPanel,    // 1 - ideation: prompt + guided Q&A
  PreliminaryPanel,    // 2 - brief: generated brief template
  BuilderPanel,        // 3 - choose layout + edit + preview
  ReviewPanel,         // 4 - review and 90% quality gate
  SubmitPanel,         // 5 - submit
];

function WorkspaceInner() {
  const { step } = useWorkspace();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const Panel = PANELS[step] || PANELS[0];
  const showSourceLibrary = step <= 3; // Show sources during ideation, brief gen, builder phases

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_15%_0%,hsl(var(--pf-mist))_0%,hsl(var(--background))_55%)]">
      <Header />
      <main className="flex-1 flex overflow-hidden bg-card/70 backdrop-blur-[1px]">
        {/* Source Library Sidebar */}
        {showSourceLibrary && (
          <SourceLibrary
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            selectedSources={selectedSources}
            onSourceSelect={setSelectedSources}
          />
        )}
        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Panel selectedSources={selectedSources} />
        </div>
      </main>
    </div>
  );
}

const Workspace = () => (
  <WorkspaceProvider>
    <WorkspaceInner />
  </WorkspaceProvider>
);

export default Workspace;
