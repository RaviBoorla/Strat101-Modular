import { ENV } from "@/lib/env";

export default function StagingBanner() {
  if (ENV.isProd) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-yellow-500 text-black text-center py-2 z-50">
      🚧 This is a {ENV.isStaging ? "STAGING" : "LOCAL"} environment
    </div>
  );
}
