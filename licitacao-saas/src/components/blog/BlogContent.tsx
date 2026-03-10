"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function BlogContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-slate max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:text-indigo-300 prose-strong:text-white prose-li:text-slate-300 prose-th:text-slate-300 prose-td:text-slate-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
