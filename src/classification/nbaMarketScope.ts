import { GammaDiscoveredCandidate } from "../types/gammaDiscovery.js";

export interface NbaMarketScopeDecision {
  isNbaMatchMarket: boolean;
  isFutureMarket: boolean;
  reasonCode: string;
  reasonDetail: string;
}

export class NbaMarketScope {
  public evaluateCandidate(
    candidate: Pick<
      GammaDiscoveredCandidate,
      "question" | "title" | "slug" | "homeTeam" | "awayTeam" | "seriesTitle" | "seriesSlug"
    >
  ): NbaMarketScopeDecision {
    return this.evaluate({
      question: candidate.question,
      title: candidate.title,
      slug: candidate.slug,
      homeTeam: candidate.homeTeam,
      awayTeam: candidate.awayTeam,
      seriesTitle: candidate.seriesTitle,
      seriesSlug: candidate.seriesSlug,
    });
  }

  public evaluate(input: {
    question?: string | null;
    title?: string | null;
    slug?: string | null;
    homeTeam?: string | null;
    awayTeam?: string | null;
    seriesTitle?: string | null;
    seriesSlug?: string | null;
  }): NbaMarketScopeDecision {
    const question = input.question ?? "";
    const title = input.title ?? "";
    const slug = input.slug ?? "";
    const homeTeam = input.homeTeam ?? "";
    const awayTeam = input.awayTeam ?? "";
    const seriesTitle = input.seriesTitle ?? "";
    const seriesSlug = input.seriesSlug ?? "";

    const normalizedQuestion = this.normalize(question);
    const normalizedTitle = this.normalize(title);
    const normalizedSlug = this.normalizeSlug(slug);
    const normalizedHomeTeam = this.normalize(homeTeam);
    const normalizedAwayTeam = this.normalize(awayTeam);
    const normalizedSeriesTitle = this.normalize(seriesTitle);
    const normalizedSeriesSlug = this.normalize(seriesSlug);

    const fullText = [
      normalizedQuestion,
      normalizedTitle,
      normalizedSlug,
      normalizedSeriesTitle,
      normalizedSeriesSlug,
    ]
      .filter((x) => x.length > 0)
      .join(" ");

    if (fullText.length === 0) {
      return {
        isNbaMatchMarket: false,
        isFutureMarket: false,
        reasonCode: "EMPTY_MARKET_TEXT",
        reasonDetail: "Question/title/slug were empty after normalization",
      };
    }

    if (this.looksLikeNbaFutureMarket(fullText)) {
      return {
        isNbaMatchMarket: false,
        isFutureMarket: true,
        reasonCode: "NBA_FUTURE_MARKET_OUT_OF_SCOPE",
        reasonDetail:
          "Detected NBA futures/season/award market outside current game-only scope",
      };
    }

    const hasExplicitTeams =
      normalizedHomeTeam.length > 0 && normalizedAwayTeam.length > 0;

    if (hasExplicitTeams) {
      return {
        isNbaMatchMarket: true,
        isFutureMarket: false,
        reasonCode: "NBA_GAME_MARKET_BY_HOME_AWAY_TEAM",
        reasonDetail:
          "Gamma event contains both homeTeam and awayTeam, indicating a direct NBA game market",
      };
    }

    if (this.looksLikeDirectGameQuestion(fullText)) {
      return {
        isNbaMatchMarket: true,
        isFutureMarket: false,
        reasonCode: "NBA_GAME_MARKET_BY_QUESTION_PATTERN",
        reasonDetail:
          "Detected direct NBA game proposition pattern in question/title",
      };
    }

    if (this.looksLikeGameSlug(normalizedSlug)) {
      return {
        isNbaMatchMarket: true,
        isFutureMarket: false,
        reasonCode: "NBA_GAME_MARKET_BY_FIXTURE_SLUG",
        reasonDetail: "Slug structure looks like an NBA game/fixture slug",
      };
    }

    return {
      isNbaMatchMarket: false,
      isFutureMarket: false,
      reasonCode: "NOT_NBA_GAME_MARKET_IN_SCOPE",
      reasonDetail:
        "Did not detect a supported NBA game market for the current scope",
    };
  }

  private looksLikeNbaFutureMarket(text: string): boolean {
    const futurePatterns: RegExp[] = [
      /\bnba championship\b/,
      /\bnba finals\b/,
      /\bnba title\b/,
      /\bnba mvp\b/,
      /\bmvp award\b/,
      /\bconference finals\b/,
      /\bconference champion\b/,
      /\bconference title\b/,
      /\bmake the playoffs\b/,
      /\breach the playoffs\b/,
      /\bnba draft\b/,
      /\bscoring title\b/,
      /\bbest record\b/,
      /\btop seed\b/,
      /\bwin the series\b/,
      /\badvance to\b/,
      /\bchampionship series\b/,
      /\bregular season wins\b/,
      /\boutright\b/,
      /\bchampion\b/,
    ];

    return futurePatterns.some((pattern) => pattern.test(text));
  }

  private looksLikeDirectGameQuestion(text: string): boolean {
    const directGamePatterns: RegExp[] = [
      /\bwill .+ beat .+\b/,
      /\bwill .+ win\b/,
      /\bdoes .+ win\b/,
      /\bcan .+ win\b/,
    ];

    return directGamePatterns.some((pattern) => pattern.test(text));
  }

  private looksLikeGameSlug(slug: string): boolean {
    if (!slug) {
      return false;
    }

    const parts = slug.split("-").filter((x) => x.length > 0);
    if (parts.length < 4) {
      return false;
    }

    return /\b20\d{2}\b/.test(slug);
  }

  private normalize(value: string): string {
    return value
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private normalizeSlug(value: string): string {
    return value
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .trim();
  }
}
