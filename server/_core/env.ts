// P1: 環境変数バリデーション
// 必須の環境変数が未設定の場合、起動時にエラーを投げる

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] ?? defaultValue;
}

// 本番環境では必須、開発環境ではオプショナル
function requireEnvInProduction(key: string): string {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable in production: ${key}`);
  }
  return value ?? "";
}

export const ENV = {
  appId: requireEnvInProduction("VITE_APP_ID"),
  cookieSecret: requireEnvInProduction("JWT_SECRET"),
  databaseUrl: requireEnvInProduction("DATABASE_URL"),
  oAuthServerUrl: requireEnvInProduction("OAUTH_SERVER_URL"),
  ownerOpenId: optionalEnv("OWNER_OPEN_ID"),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: optionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optionalEnv("BUILT_IN_FORGE_API_KEY"),
  port: parseInt(optionalEnv("PORT", "3000"), 10),
};
