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

const redisKeyPrefix =
  process.env.REDIS_KEY_PREFIX?.trim() && process.env.REDIS_KEY_PREFIX.trim().length > 0
    ? process.env.REDIS_KEY_PREFIX.trim()
    : "pm";

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

  redisEnabled: parseBooleanOrDefault(process.env.REDIS_ENABLED, true),
  redisUrl: process.env.REDIS_URL?.trim() ?? "redis://127.0.0.1:6379",
  redisKeyPrefix,

  redisFootballQuoteEligibleKey:
    process.env.REDIS_FOOTBALL_QUOTE_ELIGIBLE_KEY?.trim() ??
    `${redisKeyPrefix}:football:quote-eligible:current`,

  redisFootballCatalogStreamKey:
    process.env.REDIS_FOOTBALL_CATALOG_STREAM_KEY?.trim() ??
    `${redisKeyPrefix}:events:catalog`,
};
