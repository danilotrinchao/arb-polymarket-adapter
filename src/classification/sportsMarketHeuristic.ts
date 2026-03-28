import { GammaDiscoveredCandidate } from "../types/gammaDiscovery.js";

export interface FootballMarketScopeDecision {
  isFootballMatchMarket: boolean;
  isFutureMarket: boolean;
  reasonCode: string;
  reasonDetail: string;
}

export class FootballMarketScope {
  public evaluateCandidate(
    candidate: Pick<
      GammaDiscoveredCandidate,
      "question" | "title" | "slug" | "homeTeam" | "awayTeam" | "seriesTitle" | "seriesSlug"
    >
  ): FootballMarketScopeDecision {
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
  }): FootballMarketScopeDecision {
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
        isFootballMatchMarket: false,
        isFutureMarket: false,
        reasonCode: "EMPTY_MARKET_TEXT",
        reasonDetail: "Question/title/slug were empty after normalization",
      };
    }

    if (this.looksLikeFutureMarket(fullText)) {
      return {
        isFootballMatchMarket: false,
        isFutureMarket: true,
        reasonCode: "FUTURE_MARKET_OUT_OF_SCOPE",
        reasonDetail:
          "Detected football future/outright/season market outside current match-only scope",
      };
    }

    const hasExplicitTeams =
      normalizedHomeTeam.length > 0 && normalizedAwayTeam.length > 0;

    if (hasExplicitTeams) {
      return {
        isFootballMatchMarket: true,
        isFutureMarket: false,
        reasonCode: "MATCH_MARKET_BY_HOME_AWAY_TEAM",
        reasonDetail:
          "Gamma event contains both homeTeam and awayTeam, indicating a direct match market",
      };
    }

    if (this.looksLikeDirectMatchQuestion(fullText)) {
      return {
        isFootballMatchMarket: true,
        isFutureMarket: false,
        reasonCode: "MATCH_MARKET_BY_QUESTION_PATTERN",
        reasonDetail:
          "Detected direct football match proposition pattern in question/title",
      };
    }

    if (this.looksLikeFixtureSlug(normalizedSlug)) {
      return {
        isFootballMatchMarket: true,
        isFutureMarket: false,
        reasonCode: "MATCH_MARKET_BY_FIXTURE_SLUG",
        reasonDetail:
          "Slug structure looks like a football fixture/event slug",
      };
    }

    return {
      isFootballMatchMarket: false,
      isFutureMarket: false,
      reasonCode: "NOT_MATCH_MARKET_IN_SCOPE",
      reasonDetail:
        "Did not detect a supported football match market for the current scope",
    };
  }

  private looksLikeFutureMarket(text: string): boolean {
    const futurePatterns: RegExp[] = [
      /\bwin the league\b/,
      /\bwin the title\b/,
      /\bwin the cup\b/,
      /\bwin the tournament\b/,
      /\bwin the world cup\b/,
      /\bto win the world cup\b/,
      /\bto win the premier league\b/,
      /\bto win the champions league\b/,
      /\bto win serie a\b/,
      /\bto win la liga\b/,
      /\bto win bundesliga\b/,
      /\bto win ligue 1\b/,
      /\bchampion\b/,
      /\bchampions\b/,
      /\boutright\b/,
      /\bseason\b/,
      /\btop 4\b/,
      /\btop four\b/,
      /\brelegat/,
      /\bqualif/,
      /\badvance\b/,
      /\breach the\b/,
      /\bgroup stage\b/,
      /\bround of 16\b/,
      /\bquarterfinal\b/,
      /\bquarter final\b/,
      /\bsemifinal\b/,
      /\bsemi final\b/,
      /\bfinal\b/,
      /\bgolden boot\b/,
      /\bmost goals\b/,
      /\bpoints total\b/,
      /\bfinish above\b/,
      /\bfinish below\b/,
      /\bfinish in\b/,
      /\btable\b/,
      /\bstandings\b/,
      /\bpromot/,
    ];

    return futurePatterns.some((pattern) => pattern.test(text));
  }

  private looksLikeDirectMatchQuestion(text: string): boolean {
    const directMatchPatterns: RegExp[] = [
      /\bwill .+ beat .+\b/,
      /\bwill .+ win\b/,
      /\bdoes .+ win\b/,
      /\bcan .+ win\b/,
      /\bmatch end in a draw\b/,
      /\bend in a draw\b/,
      /\bfinish in a draw\b/,
      /\bresult in a draw\b/,
      /\bdraw\b/,
    ];

    return directMatchPatterns.some((pattern) => pattern.test(text));
  }

  private looksLikeFixtureSlug(slug: string): boolean {
    if (!slug) {
      return false;
    }

    const parts = slug.split("-").filter((x) => x.length > 0);
    if (parts.length < 4) {
      return false;
    }

    const hasDate = /\b20\d{2}\b/.test(slug);
    if (!hasDate) {
      return false;
    }

    return true;
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