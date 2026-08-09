interface FooterProps {
  clientCount: number;
}

export function Footer({ clientCount }: FooterProps) {
  return (
    <footer className="h-8 bg-gray-950 border-t border-gray-800 px-4 flex items-center justify-between text-[11px] text-gray-500">
      <div>WebCrawlServer Management Console v1.0.0</div>
      <div>활성 노드 세션: {clientCount} 개 기기</div>
    </footer>
  );
}
