export const ENV = {
  isProd: process.env.NEXT_PUBLIC_APP_ENV === "production",
  isStaging: process.env.NEXT_PUBLIC_APP_ENV === "staging",
  isLocal: process.env.NEXT_PUBLIC_APP_ENV === "local",
};
