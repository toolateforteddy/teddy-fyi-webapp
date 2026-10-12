/**
 * Application environment configuration and validation.
 */

const getEnvVar = (key: string, fallback = ''): string => {
  const value = import.meta.env[key];
  if (value === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[Env] Missing environment variable: ${key}. Using fallback: "${fallback}"`);
    }
    return fallback;
  }
  return value as string;
};

export const env = {
  isDev: !!import.meta.env.DEV,
  isProd: !!import.meta.env.PROD,
  GOOGLE_CLIENT_ID: getEnvVar('VITE_GOOGLE_CLIENT_ID', 'dummy-client-id.apps.googleusercontent.com'),
  API_BASE_URL: getEnvVar('VITE_API_BASE_URL', 'https://api-rust.teddy.fyi'),
} as const;
