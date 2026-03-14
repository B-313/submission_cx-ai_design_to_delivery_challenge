import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import Header from "@/components/workspace/Header";
import LeftSidebar from "@/components/workspace/LeftSidebar";
import RegistrationPanel from "@/components/workspace/RegistrationPanel";
import PreliminaryPanel from "@/components/workspace/PreliminaryPanel";
import BriefEditorPanel from "@/components/workspace/BriefEditorPanel";
import BuilderPanel from "@/components/workspace/BuilderPanel";
import ReviewPanel from "@/components/workspace/ReviewPanel";
import SubmitPanel from "@/components/workspace/SubmitPanel";

const PANELS = [
  RegistrationPanel,
  PreliminaryPanel,
  BriefEditorPanel,
  BuilderPanel,
  ReviewPanel,
  SubmitPanel,
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
