import { prisma } from "../db/prisma.js";

type SearchProvider = "serper" | "tavily";

type ObjectiveSearchInput = {
  objective: string;
  country?: string;
  language?: string;
  audience?: string;
  limit?: number;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: SearchProvider;
};

const serperBaseUrl = "https://google.serper.dev";
const tavilyBaseUrl = "https://api.tavily.com";
const aiProvidersSettingsKey = "ai-providers";

type SearchProviderRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  source: "database" | "env" | "none";
};

export function getSearchIntelligenceConfig() {
  return {
    providers: {
      serper: {
        name: "Serper",
        role: "decouverte Google: prospects, lieux, news, images, concurrents",
        apiKeyConfigured: Boolean(process.env.SERPER_API_KEY),
        baseUrl: serperBaseUrl,
        endpoints: ["search", "places", "news", "images"],
        bestFor: ["sourcing", "local_leads", "seo_keywords", "competitor_discovery"]
      },
      tavily: {
        name: "Tavily",
        role: "comprehension web: recherche IA, extraction, analyse de pages",
        apiKeyConfigured: Boolean(process.env.TAVILY_API_KEY),
        baseUrl: tavilyBaseUrl,
        endpoints: ["search", "extract"],
        bestFor: ["research", "summaries", "site_analysis", "night_report"]
      }
    },
    agentAccess: [
      "autonomous",
      "prospection",
      "sales",
      "web",
      "ai-builder",
      "marketing",
      "report"
    ],
    workflow: [
      "Serper decouvre les opportunites et resultats Google",
      "Tavily lit et extrait les pages importantes",
      "L'agent score, resume et cree les actions CRM/marketing",
      "HITL valide avant tout contact ou diffusion sensible"
    ]
  };
}

export async function getSearchProviderStatus() {
  const [serper, tavily] = await Promise.all([
    getSearchProviderRuntimeConfig("serper"),
    getSearchProviderRuntimeConfig("tavily")
  ]);

  return {
    serper: {
      configured: serper.enabled && Boolean(serper.apiKey),
      source: serper.source,
      baseUrl: serper.baseUrl
    },
    tavily: {
      configured: tavily.enabled && Boolean(tavily.apiKey),
      source: tavily.source,
      baseUrl: tavily.baseUrl
    }
  };
}

export async function researchObjective(input: ObjectiveSearchInput) {
  const objective = input.objective.trim();
  const limit = Math.min(Number(input.limit ?? 5), 10);
  const country = input.country ?? "Cote d'Ivoire";
  const language = input.language ?? "fr";
  const query = buildObjectiveQuery({ ...input, objective, country, language });

  const [serperResults, tavilyResults] = await Promise.all([
    searchSerper({ query, limit, country, language }),
    searchTavily({ query, limit, language })
  ]);

  const results = dedupeResults([...serperResults.results, ...tavilyResults.results]).slice(0, limit);

  return {
    objective,
    query,
    country,
    language,
    providers: {
      serper: {
        configured: serperResults.configured,
        mode: serperResults.mode
      },
      tavily: {
        configured: tavilyResults.configured,
        mode: tavilyResults.mode
      }
    },
    results,
    actions: buildActions(objective, results),
    generatedAt: new Date().toISOString()
  };
}

export async function searchSerper({
  query,
  limit = 5,
  country = "Cote d'Ivoire",
  language = "fr"
}: {
  query: string;
  limit?: number;
  country?: string;
  language?: string;
}) {
  const config = await getSearchProviderRuntimeConfig("serper");
  if (!config.enabled || !config.apiKey) {
    return {
      configured: false,
      mode: "waiting_api",
      results: []
    };
  }

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey
    },
    body: JSON.stringify({
      q: query,
      gl: countryCode(country),
      hl: language,
      num: limit
    })
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return {
    configured: true,
    mode: "live",
    results:
      payload.organic?.slice(0, limit).map((item) => ({
        title: item.title ?? "Resultat Google",
        url: item.link ?? "",
        snippet: item.snippet ?? "",
        source: "serper" as const
      })) ?? []
  };
}

export async function searchTavily({
  query,
  limit = 5,
  language = "fr"
}: {
  query: string;
  limit?: number;
  language?: string;
}) {
  const config = await getSearchProviderRuntimeConfig("tavily");
  if (!config.enabled || !config.apiKey) {
    return {
      configured: false,
      mode: "waiting_api",
      results: []
    };
  }

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: config.apiKey,
      query,
      search_depth: "basic",
      max_results: limit,
      include_answer: false,
      include_raw_content: false,
      topic: "general",
      language
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return {
    configured: true,
    mode: "live",
    results:
      payload.results?.slice(0, limit).map((item) => ({
        title: item.title ?? "Resultat Tavily",
        url: item.url ?? "",
        snippet: item.content ?? "",
        source: "tavily" as const
      })) ?? []
  };
}

export async function extractPageContent(url: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const config = await getSearchProviderRuntimeConfig("tavily");
  if (!config.enabled || !config.apiKey) return null;

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: config.apiKey,
        urls: [url]
      })
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      results?: Array<{ url?: string; raw_content?: string }>;
    };

    const raw = payload.results?.[0]?.raw_content;
    if (!raw || typeof raw !== "string") return null;

    return raw.replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch {
    return null;
  }
}

function buildObjectiveQuery(input: Required<Pick<ObjectiveSearchInput, "objective" | "country" | "language">> & ObjectiveSearchInput) {
  const parts = [input.objective, input.audience, input.country].filter(Boolean);
  return parts.join(" ");
}

function buildActions(objective: string, results: SearchResult[]) {
  return [
    {
      agent: "prospection",
      action: "creer_prospects_crm",
      description: `Transformer les meilleurs resultats en fiches CRM pour: ${objective}`,
      count: results.length
    },
    {
      agent: "marketing",
      action: "preparer_angles_campagne",
      description: "Extraire les angles, douleurs clients et mots-cles publicitaires."
    },
    {
      agent: "sales",
      action: "preparer_message_hilt",
      description: "Rediger un message de contact, puis demander validation humaine avant envoi."
    }
  ];
}

function dedupeResults(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url || `${result.source}:${result.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getSearchProviderRuntimeConfig(providerId: SearchProvider): Promise<SearchProviderRuntimeConfig> {
  const envApiKey = providerId === "serper" ? process.env.SERPER_API_KEY ?? "" : process.env.TAVILY_API_KEY ?? "";
  const fallbackBaseUrl = providerId === "serper" ? serperBaseUrl : tavilyBaseUrl;

  const stored = await prisma.appSetting.findUnique({ where: { key: aiProvidersSettingsKey } }).catch(() => null);
  const providers: unknown[] = Array.isArray(stored?.value) ? stored.value : [];
  const provider = providers.find((item: unknown) => {
    if (!item || typeof item !== "object" || !("id" in item)) return false;
    return (item as { id?: unknown }).id === providerId;
  }) as { apiKey?: unknown; baseUrl?: unknown; enabled?: unknown } | undefined;

  const databaseApiKey = typeof provider?.apiKey === "string" ? provider.apiKey.trim() : "";
  const apiKey = databaseApiKey || envApiKey;
  const baseUrl = typeof provider?.baseUrl === "string" && provider.baseUrl.trim() ? provider.baseUrl.trim() : fallbackBaseUrl;
  const enabled = typeof provider?.enabled === "boolean" ? provider.enabled : Boolean(apiKey);

  return {
    apiKey,
    baseUrl,
    enabled,
    source: databaseApiKey ? "database" : envApiKey ? "env" : "none"
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function countryCode(country: string) {
  const normalized = country.toLowerCase();
  if (normalized.includes("cote") || normalized.includes("ivoire")) return "ci";
  if (normalized.includes("senegal")) return "sn";
  if (normalized.includes("mali")) return "ml";
  if (normalized.includes("burkina")) return "bf";
  if (normalized.includes("france")) return "fr";
  return "ci";
}
