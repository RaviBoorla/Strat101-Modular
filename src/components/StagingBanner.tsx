// src/components/StagingBanner.tsx

import { ENV } from "../lib/env";

export default function StagingBanner() {
  // Nothing should show in production
  if (ENV.isProd) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        backgroundColor: "#facc15", // yellow-400
        color: "#000",
        textAlign: "center",
        padding: "8px",
        fontWeight: 600,
        zIndex: 9999,
        fontSize: "14px",
      }}
    >
      {ENV.isStaging ? "🚧 STAGING ENVIRONMENT" : "⚠️ DEVELOPMENT ENVIRONMENT"}
    </div>
  );
}
