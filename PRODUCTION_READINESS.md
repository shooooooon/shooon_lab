# SHooon Lab 本番VPS運用 改善指示書

> **レビュー日:** 2026-01-30
> **対象:** プロダクション環境へのデプロイ準備
> **レビュアー:** Claude Code

---

## 概要

ビジネスロジック・入力バリデーション・認証認可の実装は堅実だが、
本番VPS運用に必要なインフラ・セキュリティ・運用基盤が欠落している。
本文書では、デプロイ前に必須の改善項目を優先度順に記載する。

---

## 致命的（デプロイ前に必須）

### P1. 環境変数のバリデーション

**ファイル:** `server/_core/env.ts` L1-10

**問題:**
全環境変数が `?? ""` で空文字にフォールバックしており、未設定でもサーバーが起動する。
`JWT_SECRET` が空の場合、認証トークンの署名が無効な状態で本番稼働する。

**現状のコード:**
```typescript
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",      // 空で起動できてしまう
  databaseUrl: process.env.DATABASE_URL ?? "",      // DB接続なしで起動
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
```

**改善方法:**
必須の環境変数が未設定の場合、起動時にエラーを投げる。

```typescript
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

export const ENV = {
  appId: requireEnv("VITE_APP_ID"),
  cookieSecret: requireEnv("JWT_SECRET"),
  databaseUrl: requireEnv("DATABASE_URL"),
  oAuthServerUrl: requireEnv("OAUTH_SERVER_URL"),
  ownerOpenId: requireEnv("OWNER_OPEN_ID"),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: optionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optionalEnv("BUILT_IN_FORGE_API_KEY"),
};
```

また、`.env.example` をプロジェクトルートに作成する。

```env
# .env.example
VITE_APP_ID=your-app-id
JWT_SECRET=your-secret-key-min-32-chars
DATABASE_URL=mysql://user:password@localhost:3306/shooon_lab
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-owner-open-id
PORT=3000

# Optional
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

---

### P2. セキュリティヘッダー（helmet）

**ファイル:** `server/_core/index.ts` L30-45

**問題:**
セキュリティ関連のHTTPヘッダーが一切設定されていない。
X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Content-Security-Policy等がすべて欠落。

**改善方法:**

```bash
pnpm add helmet
```

```typescript
// server/_core/index.ts
import helmet from "helmet";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // セキュリティヘッダー
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // TailwindCSS用
        imgSrc: ["'self'", "data:", "https:"],     // 外部画像URL対応
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,  // 外部画像読み込み対応
  }));

  app.use(express.json({ limit: "50mb" }));
  // ...
}
```

---

### P3. レート制限

**ファイル:** `server/_core/index.ts`

**問題:**
APIエンドポイントにレート制限がなく、ブルートフォース攻撃やDDoSに対して無防備。

**改善方法:**

```bash
pnpm add express-rate-limit
```

```typescript
// server/_core/index.ts
import rateLimit from "express-rate-limit";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 本番環境でリバースプロキシ（nginx）の背後で動作する場合
  if (ENV.isProduction) {
    app.set("trust proxy", 1);
  }

  // API全体のレート制限
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15分
    max: 100,                   // 1IPあたり100リクエスト
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });

  // OAuth認証のレート制限（より厳しく）
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
  });

  app.use("/api/trpc", apiLimiter);
  app.use("/api/oauth", authLimiter);
  // ...
}
```

---

### P4. Cookie `sameSite` 設定

**ファイル:** `server/_core/cookies.ts` L42-47

**問題:**
`sameSite: "none"` はサードパーティCookieのシナリオ（別ドメインからのiframe埋め込み等）でのみ使うべき設定。
同一サイトでの運用ではCSRF攻撃のリスクがある。

**現状のコード:**
```typescript
return {
  httpOnly: true,
  path: "/",
  sameSite: "none",       // ← CSRF攻撃に対して脆弱
  secure: isSecureRequest(req),
};
```

**改善方法:**
```typescript
return {
  httpOnly: true,
  path: "/",
  sameSite: "lax",        // 同一サイト運用では "lax" が適切
  secure: isSecureRequest(req),
};
```

`"lax"` はトップレベルナビゲーション（リンククリック）でのみCookieを送信し、
POSTリクエストやiframeからは送信しない。OAuthコールバックはGETリダイレクトなので `"lax"` で動作する。

---

### P5. グレースフルシャットダウン

**ファイル:** `server/_core/index.ts` L60-65

**問題:**
SIGTERM/SIGINTハンドラがなく、デプロイ時にプロセスが即時強制終了される。
処理中のリクエストが途中で切断され、DBトランザクションが中途半端に残る可能性がある。

**現状のコード:**
```typescript
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}/`);
});
```

**改善方法:**
```typescript
const httpServer = server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}/`);
});

function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Starting graceful shutdown...`);
  httpServer.close(() => {
    console.log("HTTP server closed. Exiting.");
    process.exit(0);
  });

  // 強制終了のタイムアウト（10秒）
  setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
```

---

### P6. `trust proxy` の設定

**ファイル:** `server/_core/index.ts` / `server/_core/cookies.ts`

**問題:**
`cookies.ts` で `x-forwarded-proto` ヘッダーを参照して HTTPS 判定をしているが、
Express に `trust proxy` が設定されていない。
悪意あるクライアントが `X-Forwarded-Proto: https` を偽装できてしまう。

**改善方法:**
VPSでnginxの背後で動作する場合：

```typescript
// server/_core/index.ts
if (ENV.isProduction) {
  app.set("trust proxy", 1);  // 直前のプロキシ1段のみ信頼
}
```

---

## 高（運用に支障）

### P7. プロセス管理（PM2）

**問題:**
Node.jsプロセスがクラッシュした場合、自動復旧の仕組みがない。

**改善方法:**
PM2 ecosystem ファイルを作成する。

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "shooon-lab",
    script: "dist/index.js",
    env: {
      NODE_ENV: "production",
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: "512M",
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  }],
};
```

```bash
# デプロイ手順
pnpm build
pnpm db:push
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # OS起動時に自動起動
```

---

### P8. リバースプロキシ（nginx）設定

**問題:**
HTTPS終端、静的ファイルキャッシュ、gzip圧縮の仕組みがない。

**改善方法:**
nginx設定ファイルの例を作成する。

```nginx
# /etc/nginx/sites-available/shooon-lab
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # gzip圧縮
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # 静的ファイルのキャッシュ
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # APIとSPA
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### P9. DB接続プーリング設定

**ファイル:** `server/db.ts` L14

**問題:**
Drizzle初期化に接続プール設定が渡されていない。
同時接続数が増えるとコネクション枯渇が発生する。

**現状のコード:**
```typescript
const db = process.env.DATABASE_URL ? drizzle(process.env.DATABASE_URL) : null;
```

**改善方法:**
mysql2のプールオプションを明示的に設定する。

```typescript
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const pool = process.env.DATABASE_URL
  ? mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
  : null;

const db = pool ? drizzle(pool) : null;
```

---

### P10. ヘルスチェックのDB疎通確認

**ファイル:** `server/_core/systemRouter.ts` L6-14

**問題:**
ヘルスチェックが `{ ok: true }` を返すだけで、DB接続状態を確認していない。
ロードバランサやモニタリングツールがDBダウンを検知できない。

**現状のコード:**
```typescript
health: publicProcedure
  .input(z.object({ timestamp: z.number().min(0) }))
  .query(() => ({ ok: true })),
```

**改善方法:**
```typescript
import { sql } from "drizzle-orm";
import { getDbOrNull } from "../db";

health: publicProcedure
  .input(z.object({ timestamp: z.number().min(0) }))
  .query(async () => {
    const db = getDbOrNull();
    if (!db) {
      return { ok: false, db: false };
    }
    try {
      await db.execute(sql`SELECT 1`);
      return { ok: true, db: true };
    } catch {
      return { ok: false, db: false };
    }
  }),
```

---

### P11. 構造化ログ

**ファイル:** 全体

**問題:**
`console.log` / `console.warn` / `console.error` のみ使用されており、
本番環境での障害調査に必要な構造化ログ・ログレベル・タイムスタンプがない。

**改善方法:**

```bash
pnpm add pino pino-http
pnpm add -D pino-pretty
```

```typescript
// server/_core/logger.ts
import pino from "pino";
import { ENV } from "./env";

export const logger = pino({
  level: ENV.isProduction ? "info" : "debug",
  transport: ENV.isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
});
```

```typescript
// server/_core/index.ts
import pinoHttp from "pino-http";
import { logger } from "./logger";

async function startServer() {
  const app = express();

  // リクエストログ
  app.use(pinoHttp({ logger }));
  // ...
}
```

各所の `console.log`/`console.error` を `logger.info`/`logger.error` に置換する。

---

## 中（品質向上）

### P12. 静的ファイルのキャッシュヘッダー

**ファイル:** `server/_core/vite.ts` L50-67

**問題:**
`express.static()` でキャッシュヘッダー（`Cache-Control`, `ETag`）が明示されていない。

**改善方法:**
```typescript
export function serveStatic(app: Express) {
  const distPath = /* ... */;

  // Viteビルドのハッシュ付きアセットは長期キャッシュ
  app.use("/assets", express.static(path.resolve(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  // その他の静的ファイル
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
  }));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
```

---

### P13. gzip圧縮

**ファイル:** `server/_core/index.ts`

**問題:**
レスポンスの圧縮ミドルウェアがない。nginxで圧縮する場合は不要だが、
Node.js単体で動作させる場合はレスポンスサイズが大きくなる。

**改善方法:**
nginx使用時は不要（P8で対応）。Node.js単体の場合：

```bash
pnpm add compression
pnpm add -D @types/compression
```

```typescript
import compression from "compression";

app.use(compression());
```

---

### P14. マイグレーション自動化

**問題:**
`db:push` を手動実行する必要があり、デプロイ手順の漏れでスキーマ不整合が発生しうる。

**改善方法:**
startスクリプトにマイグレーション実行を組み込む。

```json
{
  "scripts": {
    "start": "node dist/migrate.js && NODE_ENV=production node dist/index.js",
    "build": "vite build && esbuild server/_core/index.ts server/migrate.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
  }
}
```

```typescript
// server/migrate.ts
import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL!);
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied successfully");
process.exit(0);
```

---

## 改善優先度まとめ

| 優先度 | # | 項目 | 工数目安 |
|--------|---|------|----------|
| **致命的** | P1 | 環境変数バリデーション | 小 |
| **致命的** | P2 | helmet（セキュリティヘッダー） | 小 |
| **致命的** | P3 | レート制限 | 小 |
| **致命的** | P4 | Cookie sameSite修正 | 極小 |
| **致命的** | P5 | グレースフルシャットダウン | 小 |
| **致命的** | P6 | trust proxy設定 | 極小 |
| **高** | P7 | PM2プロセス管理 | 小 |
| **高** | P8 | nginx設定 | 中 |
| **高** | P9 | DB接続プーリング | 小 |
| **高** | P10 | ヘルスチェックDB疎通 | 小 |
| **高** | P11 | 構造化ログ | 中 |
| **中** | P12 | 静的ファイルキャッシュ | 小 |
| **中** | P13 | gzip圧縮 | 極小 |
| **中** | P14 | マイグレーション自動化 | 小 |
