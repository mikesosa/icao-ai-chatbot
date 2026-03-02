import React, { memo } from 'react';

import Link from 'next/link';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { CodeBlock } from './code-block';

const components: Partial<Components> = {
  // @ts-expect-error: CodeBlock component props don't match exact ReactMarkdown component type
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  p: ({ node: _node, children, ...props }) => {
    return (
      <p className="leading-relaxed break-words" {...props}>
        {children}
      </p>
    );
  },
  ol: ({ node: _node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node: _node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node: _node, children, ...props }) => {
    return (
      <ul className="list-disc list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node: _node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node: _node, children, ...props }) => {
    return (
      // @ts-expect-error: Link component props don't perfectly match ReactMarkdown anchor component type
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node: _node, children, ...props }) => {
    return (
      <h1 className="mt-6 mb-2 text-2xl font-semibold sm:text-3xl" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node: _node, children, ...props }) => {
    return (
      <h2 className="mt-6 mb-2 text-xl font-semibold sm:text-2xl" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node: _node, children, ...props }) => {
    return (
      <h3 className="mt-6 mb-2 text-lg font-semibold sm:text-xl" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node: _node, children, ...props }) => {
    return (
      <h4 className="mt-6 mb-2 text-base font-semibold sm:text-lg" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node: _node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node: _node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
  table: ({ node: _node, children, ...props }) => {
    return (
      <div className="my-3 w-full overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
