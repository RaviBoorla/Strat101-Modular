// src/lib/env.ts

const APP_ENV = import.meta.env.VITE_APP_ENV;

if (!APP_ENV) {
  // Fail fast if misconfigured
  throw new Error("Missing VITE_APP_ENV in environment variables");
}

export const ENV = {
  raw: APP_ENV,

  isProd: APP_ENV === "production",
  isStaging: APP_ENV === "staging",
  isDev: APP_ENV === "development" || APP_ENV === "dev",

  // Optional convenience flag
  showDevUI: APP_ENV !== "production",
};
