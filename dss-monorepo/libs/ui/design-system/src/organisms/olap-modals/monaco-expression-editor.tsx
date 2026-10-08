'use client';

import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

interface MonacoExpressionEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  minRows: number;
}

export function MonacoExpressionEditor({
  id,
  value,
  onChange,
  minRows,
}: MonacoExpressionEditorProps) {
  const [theme, setTheme] = useState('vs-dark');

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () =>
      setTheme(root.classList.contains('dark') ? 'vs-dark' : 'light');
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={id}
      className="overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50"
      aria-labelledby={`${id}-label`}
    >
      <Editor
        height={`${Math.max(minRows, 6) * 22}px`}
        language="mdx"
        theme={theme}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        options={{
          ariaLabel: 'Editor de expresión MDX',
          automaticLayout: true,
          fontSize: 13,
          lineNumbers: 'on',
          minimap: { enabled: false },
          padding: { top: 12, bottom: 12 },
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
