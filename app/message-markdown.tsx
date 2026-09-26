import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// No rehype-raw: HTML from the model stays escaped text, and react-markdown drops unsafe URLs.
const components: Components = {
  a: ({ href, title, children }) => (
    <a href={href} rel="noopener noreferrer" target="_blank" title={title}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),
};

/** Memoized so that while one answer streams, earlier answers are not parsed again. */
export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown components={components} remarkPlugins={[remarkGfm]}>
        {text}
      </Markdown>
    </div>
  );
});
