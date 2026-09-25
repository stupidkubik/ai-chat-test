import ChatExperience from "./chat-experience";
import { DEMO_STATES, type DemoState } from "./chat-types";

function isDemoState(value: unknown): value is DemoState {
  return typeof value === "string" && DEMO_STATES.some((state) => state === value);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    return <ChatExperience initialState="empty" showDemoControls={false} />;
  }

  const params = await searchParams;

  return (
    <ChatExperience
      initialState={isDemoState(params.state) ? params.state : "empty"}
      showDemoControls={params.demo === "1"}
    />
  );
}
