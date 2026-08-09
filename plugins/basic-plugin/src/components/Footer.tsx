// plugins/basic-plugin/src/components/Footer.tsx

import { PLUGIN_CONFIG } from '../config/pluginConfig';

interface FooterProps {
  clientId: string;
}

export function Footer({ clientId }: FooterProps) {
  return (
    <div className="popup-footer">
      <div className="footer-item">
        <span className="footer-label">노드 ID:</span>
        <span className="footer-value font-mono text-[10px]">{clientId}</span>
      </div>
      <div className="footer-item">
        <span className="footer-label">포트:</span>
        <span className="footer-value font-mono">{PLUGIN_CONFIG.server.port}</span>
      </div>
    </div>
  );
}