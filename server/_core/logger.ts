// P11: 構造化ログ
import pino from "pino";
import { ENV } from "./env";

export const logger = pino({
  level: ENV.isProduction ? "info" : "debug",
  transport: ENV.isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
});
