import ChatExperience, { type DemoState } from "./chat-experience";

const demoStates: DemoState[] = ["empty", "message", "streaming", "stopped", "error"];

function isDemoState(value: string | string[] | undefined): value is DemoState {
  return typeof value === "string" && demoStates.includes(value as DemoState);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const localDemo = process.env.NODE_ENV === "development";
  const state = localDemo && isDemoState(params.state) ? params.state : "empty";

  return (
    <ChatExperience
      initialState={state}
      showDemoControls={localDemo && params.demo === "1"}
    />
  );
}
