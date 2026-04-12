const parseIntOrDefault = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseBooleanOrDefault = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (!value) return defaultValue;

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const parseCsv = (value: string | undefined): string[] => {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const requireNonEmpty = (
  value: string | undefined,
  variableName: string
): string => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `[env] Required environment variable missing: ${variableName}`
    );
  }

  return normalized;
};

const isRailwayRuntime =
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.RAILWAY_PROJECT_ID ||
  !!process.env.RAILWAY_SERVICE_ID;

const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "development";
const isProductionLike = nodeEnv === "production" || isRailwayRuntime;

const redisKeyPrefix =
  process.env.REDIS_KEY_PREFIX?.trim() && process.env.REDIS_KEY_PREFIX.trim().length > 0
    ? process.env.REDIS_KEY_PREFIX.trim()
    : "pm";

const rawRedisEnabled = process.env.REDIS_ENABLED;
const redisEnabled = parseBooleanOrDefault(rawRedisEnabled, true);

const rawRedisUrl = process.env.REDIS_URL?.trim();
const redisUrl =
  redisEnabled && isProductionLike
    ? requireNonEmpty(process.env.REDIS_URL, "REDIS_URL")
    : rawRedisUrl && rawRedisUrl.length > 0
      ? rawRedisUrl
      : "redis://127.0.0.1:6379";

const rawNbaEnabled = process.env.NBA_ENABLED;
const rawNbaSeriesIds = process.env.NBA_SERIES_IDS;

const nbaEnabled = parseBooleanOrDefault(rawNbaEnabled, false);
const nbaSeriesIds = parseCsv(rawNbaSeriesIds);

console.log("[env] NODE_ENV=", nodeEnv);
console.log("[env] isRailwayRuntime=", isRailwayRuntime);
console.log("[env] REDIS_ENABLED(raw)=", rawRedisEnabled ?? "undefined");
console.log("[env] REDIS_URL(raw)=", rawRedisUrl ? "[present]" : "undefined");
console.log("[env] redisEnabled(parsed)=", redisEnabled);
console.log(
  "[env] redisUrl(resolved)=",
  redisUrl.includes("127.0.0.1") ? redisUrl : "[non-local-configured]"
);

console.log("[env] NBA_ENABLED(raw)=", rawNbaEnabled ?? "undefined");
console.log("[env] NBA_SERIES_IDS(raw)=", rawNbaSeriesIds ?? "undefined");
console.log("[env] nbaEnabled(parsed)=", nbaEnabled);
console.log("[env] nbaSeriesIds(parsed)=", nbaSeriesIds);

if (nbaEnabled && nbaSeriesIds.length === 0) {
  console.warn(
    "[env] NBA is enabled but NBA_SERIES_IDS is empty or missing. " +
      `NBA_ENABLED=${rawNbaEnabled ?? "undefined"} ` +
      `NBA_SERIES_IDS=${rawNbaSeriesIds ?? "undefined"}`
  );
}

export const env = {
  polymarketGammaBaseUrl:
    process.env.POLYMARKET_GAMMA_BASE_URL?.trim() ??
    "https://gamma-api.polymarket.com",

  polymarketClobBaseUrl:
    process.env.POLYMARKET_CLOB_BASE_URL?.trim() ??
    "https://clob.polymarket.com",

  gammaPageLimit: parseIntOrDefault(process.env.GAMMA_PAGE_LIMIT, 100),
  gammaRequestTimeoutMs: parseIntOrDefault(
    process.env.GAMMA_REQUEST_TIMEOUT_MS,
    15000
  ),
  gammaRetryCount: parseIntOrDefault(process.env.GAMMA_RETRY_COUNT, 3),
  gammaRetryBaseDelayMs: parseIntOrDefault(
    process.env.GAMMA_RETRY_BASE_DELAY_MS,
    1500
  ),

  dataDir: process.env.DATA_DIR?.trim() ?? "data",

  enabledSeriesIds: parseCsv(process.env.POLY_ENABLED_SERIES_IDS),
  enabledSportKeys: parseCsv(process.env.POLY_ENABLED_SPORT_KEYS),

  competitionSeriesIds:
    parseCsv(process.env.POLY_COMPETITION_SERIES_IDS).length > 0
      ? parseCsv(process.env.POLY_COMPETITION_SERIES_IDS)
      : ["10359", "36", "10003", "10193", "10194", "10203", "10195"],

  redisEnabled,
  redisUrl,
  redisKeyPrefix,

  redisFootballQuoteEligibleKey:
    process.env.REDIS_FOOTBALL_QUOTE_ELIGIBLE_KEY?.trim() ??
    `${redisKeyPrefix}:football:quote-eligible:current`,

  redisFootballCatalogStreamKey:
    process.env.REDIS_FOOTBALL_CATALOG_STREAM_KEY?.trim() ??
    `${redisKeyPrefix}:events:catalog`,

  nbaEnabled,
  nbaSeriesIds,

  redisNbaQuoteEligibleKey:
    process.env.REDIS_NBA_QUOTE_ELIGIBLE_KEY?.trim() ??
    `${redisKeyPrefix}:nba:quote-eligible:current`,

  redisNbaCatalogStreamKey:
    process.env.REDIS_NBA_CATALOG_STREAM_KEY?.trim() ??
    `${redisKeyPrefix}:events:nba-catalog`,
};