'use client';

import { useCallback, useState } from 'react';
import McpAccessCard from '@/components/app/McpAccessCard';
import McpClientTabs from '@/components/app/McpClientTabs';

export default function ConnectPage() {
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const handleUrl = useCallback((url: string | null) => {
    setMcpUrl(url);
  }, []);

  return (
    <section className="mx-auto max-w-5xl space-y-4 pt-2">
      <McpAccessCard onUrl={handleUrl} />
      <McpClientTabs url={mcpUrl} />
    </section>
  );
}
