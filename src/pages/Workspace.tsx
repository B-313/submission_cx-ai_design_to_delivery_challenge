import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import Header from "@/components/workspace/Header";
import LeftSidebar from "@/components/workspace/LeftSidebar";
import RegistrationPanel from "@/components/workspace/RegistrationPanel";
import BriefEditorPanel from "@/components/workspace/BriefEditorPanel";
import DesignPickerPanel from "@/components/workspace/DesignPickerPanel";
import BuilderPanel from "@/components/workspace/BuilderPanel";
import SubmitPanel from "@/components/workspace/SubmitPanel";

const PANELS = [
  RegistrationPanel,   // 0
  BriefEditorPanel,    // 1 - lego Q&A → censor → brief → approve → AI review
  DesignPickerPanel,   // 2 - layout + style
  BuilderPanel,        // 3 - edit + preview + final check
  SubmitPanel,         // 4
];

function WorkspaceInner() {
  const { step } = useWorkspace();
  const Panel = PANELS[step] || PANELS[0];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Panel />
        </main>
      </div>
    </div>
  );
}

const Workspace = () => (
  <WorkspaceProvider>
    <WorkspaceInner />
  </WorkspaceProvider>
);

export default Workspace;
