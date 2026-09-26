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
    return <ChatExperience />;
  }

  const params = await searchParams;
  if (params.demo !== "1") return <ChatExperience />;

  // The fixtures load on the server and only in development, so the client bundle never contains them.
  const { demoMessages } = await import("./demo-fixtures");
  return (
    <ChatExperience
      demo={{
        initialState: isDemoState(params.state) ? params.state : "empty",
        messages: demoMessages,
      }}
    />
  );
}
