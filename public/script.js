const REFRESH_MS = 60_000;
const NEWS_REFRESH_MS = 120_000;
const BRIEF_REFRESH_MS = 300_000;
const ALERT_REFRESH_MS = 60_000;
const API_TIMEOUT_MS = 25_000;
const API_CACHE_PREFIX = "macro-radar:api:";
const ANALYST_CACHE_KEY = "macro-radar:analyst:last";
const LANGUAGE_KEY = "macro-radar:language";
const WATCHLIST_KEY = "macro-radar:watchlist";
const CUSTOM_ALERTS_KEY = "macro-radar:custom-alerts";
const DEFAULT_LANGUAGE = "en";
const WATCHLIST_ASSETS = [
  { id: "SPX", name: "S&P 500", marketId: "spx" },
  { id: "NASDAQ", name: "NASDAQ", providerSymbol: "QQQ" },
  { id: "BTC", name: "Bitcoin", providerSymbol: "BTC-USD" },
  { id: "ETH", name: "Ethereum", providerSymbol: "ETH-USD" },
  { id: "Gold", name: "Gold", marketId: "gold" },
  { id: "Silver", name: "Silver", providerSymbol: "SI=F" },
  { id: "DXY", name: "US Dollar Index", marketId: "dxy" },
  { id: "EURUSD", name: "EUR/USD", providerSymbol: "EURUSD=X" },
  { id: "USDJPY", name: "USD/JPY", providerSymbol: "JPY=X" },
  { id: "WTI", name: "WTI Crude", providerSymbol: "CL=F" },
  { id: "US10Y", name: "US 10Y Treasury", marketId: "tenYear" },
];
const CUSTOM_ALERT_ASSETS = WATCHLIST_ASSETS.filter((asset) =>
  ["Gold", "SPX", "DXY", "US10Y", "BTC", "ETH", "Silver", "WTI", "EURUSD", "USDJPY"].includes(asset.id),
);
const CUSTOM_ALERT_CONDITIONS = new Set([">", "<", ">=", "<="]);
const translations = {
  en: {
    accountCreated: "Account created",
    accountEyebrow: "Account",
    accountHeading: "Your Macro Radar account",
    accountOptional: "Optional",
    authFailed: "Authentication failed",
    actionableInterpretation: "Actionable Interpretation",
    add: "Add",
    addAsset: "+ Add Asset",
    alertsEyebrow: "Macro Alert Engine",
    alertsUnavailable: "Alerts unavailable",
    analysisAppears: "Analysis will appear here.",
    analystEyebrow: "AI Macro Analyst",
    analystErrorStatus: "Analysis could not be generated.",
    analystHeading: "Ask the macro tape",
    analystStatus: "Uses live market data, regime signals, and macro news.",
    bearishFactors: "Bearish Factors",
    brand: "Macro Radar",
    briefEyebrow: "Daily Macro Brief",
    briefHeading: "Today’s Market Briefing",
    briefCouldNotGenerate: "The daily brief could not be generated. The dashboard will retry automatically.",
    briefUnavailable: "Brief unavailable",
    bullishFactors: "Bullish Factors",
    cached: "Cached",
    calculating: "Calculating...",
    cancel: "Cancel",
    chartDataUnavailable: "Chart data unavailable",
    chartsEyebrow: "Interactive Charts",
    chartsHeading: "1D / 1W Asset Moves",
    checkingThresholds: "Checking current macro thresholds.",
    chineseName: "中文",
    confidence: "Confidence",
    confidenceLabel: "confidence",
    connecting: "Connecting...",
    couldNotLoadAlerts: "Could not load macro alerts.",
    couldNotLoadTimeline: "Could not load historical briefs.",
    customAlertsDuplicate: "This alert already exists.",
    customAlertsEmpty: "No custom alerts yet.",
    customAlertsEyebrow: "Custom Alerts",
    customAlertsHeading: "Custom Alerts",
    customAlertsInvalid: "Enter a valid target value.",
    customAlertsWaiting: "waiting",
    currentRegime: "Current Regime",
    dataUnavailable: "Data unavailable",
    dailyBriefCurrentRegime: "Current Regime",
    dailyBriefEyebrow: "AI Daily Brief",
    dailyBriefHeading: "Today’s Macro Read",
    dailyBriefLoading: "Generating from current market signals...",
    dailyBriefMarketMoves: "Market Moves",
    dailyBriefProvider: "Market signals",
    dailyBriefRatesDollarGold: "Rates / Dollar / Gold Read",
    dailyBriefRiskSummary: "Risk Summary",
    dailyBriefWatchNext: "Watch Next",
    defensiveDemand: "Defensive demand",
    defensiveDemandText: "Gold remains bid while investors monitor inflation and geopolitical risk.",
    disclaimer: "For educational and research purposes only. Not financial advice.",
    email: "Email",
    enterQuestion: "Enter a macro or market question first.",
    error: "Error",
    englishName: "English",
    feedRetry: "The feed will retry automatically.",
    fetchingNews: "Fetching live news feed",
    forecastBearishScenario: "Bearish Case",
    forecastBullishScenario: "Bullish Case",
    forecastCouldNotLoad: "Market outlook unavailable.",
    forecastEyebrow: "Market Outlook",
    forecastHeading: "Forecast Engine",
    forecastInvalidatingSignals: "Invalidated If",
    forecastKeyTriggers: "Watch Triggers",
    forecastLoading: "Generating market outlook...",
    forecastOutlook: "Outlook",
    forecastSubtitle: "Scenario-based outlook using live market signals. Not a price forecast.",
    generated: "Generated",
    generateAnalysis: "Generate Analysis",
    generating: "Generating",
    generatingAnalysis: "Generating analysis",
    generatingCopy: "Combining market moves, regime data, and macro headlines.",
    generatingTheme: "Generating today’s market theme...",
    heroSubtitle:
      "Monitor market regimes, track macro signals, and generate investment-oriented research from live market data and news.",
    heroTitle: "AI-powered macroeconomic intelligence platform",
    hoverEnabled: "Hover Enabled",
    keyDrivers: "Key Drivers",
    keySignals: "Key Signals",
    keySignalsEyebrow: "Key Signals",
    language: "Language",
    live: "Live",
    liveAlerts: "Live Alerts",
    liveNewsUnavailable: "Live macro news is temporarily unavailable.",
    loading: "Loading",
    loadingAlerts: "Loading alerts...",
    loadingChart: "Loading chart",
    loadingHeadline: "Loading macro headline...",
    loadingLiveQuote: "Loading live quote",
    loadingMarketData: "Loading live market data...",
    loadingTimeline: "Loading timeline...",
    logout: "Logout",
    localModel: "Local model",
    mainRisks: "Main Risks",
    marketDataUnavailable:
      "Live market data is temporarily unavailable. The dashboard will retry automatically every 60 seconds.",
    marketPulse: "Market Pulse",
    newsEyebrow: "Live Macro News",
    newsHeading: "Headlines Moving the Tape",
    newsUnavailable: "News unavailable",
    newAlert: "+ New Alert",
    offlineSnapshot: "Offline snapshot",
    offlineSnapshotShown: "Offline snapshot shown. Reconnect to generate fresh analysis.",
    fallbackData: "Fallback data",
    scenarioOutlook: "Scenario Outlook",
    overallView: "Overall View",
    password: "Password",
    promptDollar: "What does a stronger dollar mean for equities?",
    promptGold: "Is gold bullish over the next 3 months?",
    promptRegime: "What is today’s macro risk regime?",
    promptYields: "How should investors read rising Treasury yields?",
    questionLabel: "Macro or market question",
    questionPlaceholder: "Ask a macro or market question...",
    ratesAnchor: "Rates anchor",
    ratesAnchorText: "The 10Y yield is near the mid-4% area, keeping valuation pressure visible.",
    readingBriefs: "Reading saved daily briefs.",
    readingSignals: "Reading live macro signals...",
    regimeEyebrow: "Market Regime Engine",
    researchMode: "Research mode",
    retryAfterRefresh: "Try again after the live data refresh completes.",
    retryAutomatically: "The dashboard will retry automatically.",
    alertAsset: "Asset",
    alertCondition: "Condition",
    alertTarget: "Target value",
    alertTriggered: "TRIGGERED",
    riskAppetite: "Risk appetite",
    riskAppetiteText: "Equities are firm, supported by earnings momentum and AI capital spending.",
    signal: "Signal",
    signalsUsed: "Signals Used",
    summaryEyebrow: "AI Summary",
    timelineEyebrow: "Historical Timeline",
    timelineHeading: "Past Regimes & Briefs",
    timelineUnavailable: "Timeline unavailable",
    unavailable: "Unavailable",
    updated: "Updated",
    watchlist: "Watchlist",
    watchlistEmpty: "No favorite assets yet.",
    watchlistEyebrow: "Watchlist",
    watchlistHeading: "Favorite Assets",
    watchingNext: "Watching Next",
    waitingAssetMoves: "Waiting for asset moves",
    waitingForHistory: "Waiting for history...",
    waitingForMarketData: "Waiting for market data API...",
    waitingForQuestion: "Waiting for question",
    waitingQuestion: "Waiting for question",
    waitingLiveMacroData: "Waiting for live macro data.",
    waitingMacroHeadlines: "Waiting for macro headlines",
    waitingMacroSignals: "Waiting for live macro signals.",
    waitingRiskSignals: "Waiting for risk signals",
    removeAsset: "Remove asset",
    saveAlert: "Save Alert",
    searchAssets: "Search assets",
    signedIn: "Signed in",
    signedOut: "Signed out",
    signIn: "Sign In",
    signUp: "Sign Up",
  },
  zh: {
    accountCreated: "账户已创建",
    accountEyebrow: "账户",
    accountHeading: "你的 Macro Radar 账户",
    accountOptional: "可选",
    authFailed: "认证失败",
    actionableInterpretation: "可操作解读",
    add: "添加",
    addAsset: "+ 添加资产",
    alertsEyebrow: "宏观预警引擎",
    alertsUnavailable: "预警不可用",
    analysisAppears: "分析结果将在这里显示。",
    analystEyebrow: "AI 宏观分析师",
    analystErrorStatus: "无法生成分析。",
    analystHeading: "提问宏观市场",
    analystStatus: "使用实时市场数据、市场状态信号和宏观新闻。",
    bearishFactors: "利空因素",
    brand: "Macro Radar",
    briefEyebrow: "每日宏观简报",
    briefHeading: "今日市场简报",
    briefCouldNotGenerate: "无法生成每日简报。仪表盘将自动重试。",
    briefUnavailable: "简报不可用",
    bullishFactors: "利好因素",
    cached: "缓存",
    calculating: "计算中...",
    cancel: "取消",
    chartDataUnavailable: "图表数据不可用",
    chartsEyebrow: "交互图表",
    chartsHeading: "1日 / 1周资产走势",
    checkingThresholds: "正在检查当前宏观阈值。",
    chineseName: "中文",
    confidence: "置信度",
    confidenceLabel: "置信度",
    connecting: "连接中...",
    couldNotLoadAlerts: "无法加载宏观预警。",
    couldNotLoadTimeline: "无法加载历史简报。",
    customAlertsDuplicate: "该提醒已存在。",
    customAlertsEmpty: "还没有自定义提醒。",
    customAlertsEyebrow: "自定义提醒",
    customAlertsHeading: "自定义提醒",
    customAlertsInvalid: "请输入有效的目标值。",
    customAlertsWaiting: "等待中",
    currentRegime: "当前市场状态",
    dataUnavailable: "数据不可用",
    dailyBriefCurrentRegime: "当前市场状态",
    dailyBriefEyebrow: "AI 每日简报",
    dailyBriefHeading: "今日宏观解读",
    dailyBriefLoading: "正在根据当前市场信号生成...",
    dailyBriefMarketMoves: "市场走势",
    dailyBriefProvider: "市场信号",
    dailyBriefRatesDollarGold: "利率 / 美元 / 黄金解读",
    dailyBriefRiskSummary: "风险摘要",
    dailyBriefWatchNext: "继续关注",
    defensiveDemand: "防御性需求",
    defensiveDemandText: "黄金保持支撑，投资者继续关注通胀与地缘风险。",
    disclaimer: "仅供教育和研究用途。不构成投资建议。",
    email: "邮箱",
    enterQuestion: "请先输入一个宏观或市场问题。",
    error: "错误",
    englishName: "English",
    feedRetry: "新闻流将自动重试。",
    fetchingNews: "正在获取实时新闻",
    forecastBearishScenario: "利空情形",
    forecastBullishScenario: "利多情形",
    forecastCouldNotLoad: "市场展望不可用。",
    forecastEyebrow: "市场展望",
    forecastHeading: "预测引擎",
    forecastInvalidatingSignals: "失效条件",
    forecastKeyTriggers: "观察触发因素",
    forecastLoading: "正在生成市场展望...",
    forecastOutlook: "展望",
    forecastSubtitle: "基于实时市场信号的情景展望，不是价格预测。",
    generated: "已生成",
    generateAnalysis: "生成分析",
    generating: "生成中",
    generatingAnalysis: "正在生成分析",
    generatingCopy: "正在整合市场波动、状态数据和宏观新闻。",
    generatingTheme: "正在生成今日市场主题...",
    heroSubtitle: "监控市场状态、追踪宏观信号，并基于实时市场数据和新闻生成投资研究分析。",
    heroTitle: "AI 驱动的宏观经济情报平台",
    hoverEnabled: "支持悬停",
    keyDrivers: "关键驱动",
    keySignals: "关键信号",
    keySignalsEyebrow: "关键信号",
    language: "语言",
    live: "实时",
    liveAlerts: "实时预警",
    liveNewsUnavailable: "实时宏观新闻暂时不可用。",
    loading: "加载中",
    loadingAlerts: "正在加载预警...",
    loadingChart: "正在加载图表",
    loadingHeadline: "正在加载宏观新闻...",
    loadingLiveQuote: "正在加载实时报价",
    loadingMarketData: "正在加载实时市场数据...",
    loadingTimeline: "正在加载时间线...",
    logout: "退出登录",
    localModel: "本地模型",
    mainRisks: "主要风险",
    marketDataUnavailable: "实时市场数据暂时不可用。仪表盘将在 60 秒后自动重试。",
    marketPulse: "市场脉搏",
    newsEyebrow: "实时宏观新闻",
    newsHeading: "影响市场的头条",
    newsUnavailable: "新闻不可用",
    newAlert: "+ 新建提醒",
    offlineSnapshot: "离线快照",
    offlineSnapshotShown: "已显示离线快照。重新连接后可生成最新分析。",
    fallbackData: "备用数据",
    scenarioOutlook: "情景展望",
    overallView: "总体观点",
    password: "密码",
    promptDollar: "美元走强对股票意味着什么？",
    promptGold: "未来 3 个月黄金是否偏多？",
    promptRegime: "今天的宏观风险状态是什么？",
    promptYields: "投资者应如何解读美债收益率上升？",
    questionLabel: "宏观或市场问题",
    questionPlaceholder: "输入一个宏观或市场问题...",
    ratesAnchor: "利率锚",
    ratesAnchorText: "10年期美债收益率接近 4% 中段，估值压力仍然可见。",
    readingBriefs: "正在读取已保存的每日简报。",
    readingSignals: "正在读取实时宏观信号...",
    regimeEyebrow: "市场状态引擎",
    researchMode: "研究模式",
    retryAfterRefresh: "请等待实时数据刷新后重试。",
    retryAutomatically: "仪表盘将自动重试。",
    alertAsset: "资产",
    alertCondition: "条件",
    alertTarget: "目标值",
    alertTriggered: "已触发",
    riskAppetite: "风险偏好",
    riskAppetiteText: "股票表现稳健，受到盈利动能和 AI 资本开支支撑。",
    signal: "信号",
    signalsUsed: "使用的信号",
    summaryEyebrow: "AI 摘要",
    timelineEyebrow: "历史时间线",
    timelineHeading: "过去市场状态与简报",
    timelineUnavailable: "时间线不可用",
    unavailable: "不可用",
    updated: "已更新",
    watchlist: "观察列表",
    watchlistEmpty: "还没有收藏资产。",
    watchlistEyebrow: "观察列表",
    watchlistHeading: "收藏资产",
    watchingNext: "继续关注",
    waitingAssetMoves: "等待资产走势",
    waitingForHistory: "等待历史数据...",
    waitingForMarketData: "等待市场数据 API...",
    waitingForQuestion: "等待问题",
    waitingQuestion: "等待问题",
    waitingLiveMacroData: "等待实时宏观数据。",
    waitingMacroHeadlines: "等待宏观新闻",
    waitingMacroSignals: "等待实时宏观信号。",
    waitingRiskSignals: "等待风险信号",
    removeAsset: "移除资产",
    saveAlert: "保存提醒",
    searchAssets: "搜索资产",
    signedIn: "已登录",
    signedOut: "已退出",
    signIn: "登录",
    signUp: "注册",
  },
};
const chartPeriods = {};
let latestMarkets = [];
let latestWatchlistQuotes = {};
let watchlistAssetIds = readStoredWatchlist();
let customAlerts = readStoredCustomAlerts();
let currentLanguage = readStoredLanguage();
let currentUser = null;
let accountMessageKey = "";
let accountMessageText = "";
let accountMessageIsError = false;

async function configureNativeStatusBar() {
  const statusBar = window.Capacitor?.Plugins?.StatusBar;
  if (!statusBar) return;

  try {
    await statusBar.setOverlaysWebView({ overlay: false });
    await statusBar.setStyle({ style: "DARK" });
    await statusBar.setBackgroundColor({ color: "#08111F" });
  } catch (error) {
    console.error("Status bar configuration failed", error);
  }
}

function readStoredLanguage() {
  try {
    const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
    return translations[storedLanguage] ? storedLanguage : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function saveLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Language choice is nice to have; the app should keep working without storage.
  }
}

function readStoredWatchlist() {
  try {
    const supportedIds = new Set(WATCHLIST_ASSETS.map((asset) => asset.id));
    const parsed = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id, index) => supportedIds.has(id) && parsed.indexOf(id) === index)
      : [];
  } catch {
    return [];
  }
}

function saveWatchlist() {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlistAssetIds));
  } catch {
    // Watchlist persistence is local-only; rendering should continue if storage fails.
  }
}

function readStoredCustomAlerts() {
  try {
    const supportedIds = new Set(CUSTOM_ALERT_ASSETS.map((asset) => asset.id));
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_ALERTS_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (alert) =>
              alert &&
              supportedIds.has(alert.assetId) &&
              CUSTOM_ALERT_CONDITIONS.has(alert.condition) &&
              Number.isFinite(Number(alert.target)),
          )
          .map((alert) => ({
            id: alert.id || customAlertId(alert.assetId, alert.condition, alert.target),
            assetId: alert.assetId,
            condition: alert.condition,
            target: Number(alert.target),
            triggered: Boolean(alert.triggered),
          }))
      : [];
  } catch {
    return [];
  }
}

function saveCustomAlerts() {
  try {
    localStorage.setItem(CUSTOM_ALERTS_KEY, JSON.stringify(customAlerts));
  } catch {
    // Custom alerts are local-only; the dashboard should keep rendering without storage.
  }
}

function watchlistAssetById(id) {
  return WATCHLIST_ASSETS.find((asset) => asset.id === id);
}

function customAlertAssetById(id) {
  return CUSTOM_ALERT_ASSETS.find((asset) => asset.id === id);
}

function customAlertId(assetId, condition, target) {
  return `${assetId}:${condition}:${Number(target)}`;
}

function setWatchlistPicker(open) {
  const picker = document.querySelector("#watchlistPicker");
  const toggle = document.querySelector("#watchlistToggle");
  if (!picker || !toggle) return;

  picker.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    document.querySelector("#watchlistSearch")?.focus();
  }
}

function addWatchlistAsset(id) {
  if (watchlistAssetIds.includes(id) || !watchlistAssetById(id)) return;
  watchlistAssetIds = [...watchlistAssetIds, id];
  saveWatchlist();
  renderWatchlist();
  renderWatchlistOptions();
  renderCustomAlerts();
}

function removeWatchlistAsset(id) {
  watchlistAssetIds = watchlistAssetIds.filter((assetId) => assetId !== id);
  saveWatchlist();
  renderWatchlist();
  renderWatchlistOptions();
}

function t(key) {
  return translations[currentLanguage]?.[key] || translations[DEFAULT_LANGUAGE][key] || key;
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage === "zh" ? "zh-Hans" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-prompt]").forEach((element) => {
    element.dataset.examplePrompt = t(element.dataset.i18nPrompt);
  });

  const languageButton = document.querySelector("#languageMenuButton");
  if (languageButton) {
    languageButton.setAttribute("aria-label", t("language"));
  }

  document.querySelectorAll("[data-language-choice]").forEach((option) => {
    const isActive = option.dataset.languageChoice === currentLanguage;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-current", isActive ? "true" : "false");
    const check = option.querySelector(".language-check");
    if (check) {
      check.textContent = isActive ? "✓" : "";
    }
  });

  const refreshPill = document.querySelector("#refreshStatus");
  const refreshStatus = refreshPill?.querySelector("span:last-child");
  if (refreshPill && refreshStatus) {
    if (refreshPill.classList.contains("status-loading")) {
      refreshStatus.textContent = t("connecting");
    } else if (refreshPill.classList.contains("status-fallback")) {
      refreshStatus.textContent = t("fallbackData");
    } else if (refreshPill.classList.contains("status-error")) {
      refreshStatus.textContent = t("dataUnavailable");
    } else if (refreshPill.classList.contains("status-live")) {
      const time = refreshStatus.textContent.match(/\d{1,2}:\d{2}(?:\s?[AP]M)?/i)?.[0];
      if (time) {
        refreshStatus.textContent = `${t("live")} • ${t("updated")} ${time}`;
      }
    }
  }

  const analystProvider = document.querySelector("#analystProvider");
  if (
    analystProvider &&
    [translations.en.researchMode, translations.zh.researchMode].includes(analystProvider.textContent.trim())
  ) {
    analystProvider.textContent = t("researchMode");
  }

  renderAccount(currentUser);
  if (accountMessageText || accountMessageKey) {
    setAccountMessage(accountMessageText || accountMessageKey, accountMessageIsError, Boolean(accountMessageText));
  }
  renderWatchlist();
  renderWatchlistOptions();
}

function setAccountLoading(isLoading) {
  ["#accountEmail", "#accountPassword", "#accountSignUp", "#accountSignIn", "#accountSignOut"].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.disabled = isLoading;
    }
  });

  const status = document.querySelector("#accountStatus");
  if (status) {
    status.textContent = isLoading ? t("loading") : t("accountOptional");
  }
}

function setAccountMessage(message, isError = false, isRawMessage = false) {
  accountMessageKey = isRawMessage ? "" : message;
  accountMessageText = isRawMessage ? message : "";
  accountMessageIsError = isError;
  const messageElement = document.querySelector("#accountMessage");
  if (!messageElement) return;

  messageElement.textContent = isRawMessage ? message : t(message);
  messageElement.classList.toggle("error", isError);
}

function getAuthErrorMessage(error) {
  return error?.message || window.MacroRadarAuth?.getLastError?.() || t("authFailed");
}

function renderAccount(user = null) {
  currentUser = user;
  const form = document.querySelector("#accountForm");
  const session = document.querySelector("#accountSession");
  const greeting = document.querySelector("#accountGreeting");
  if (!form || !session || !greeting) return;

  form.hidden = Boolean(user);
  session.hidden = !user;
  if (user) {
    greeting.textContent = `Hi, ${user.email || "Macro Radar"}`;
  }

  setAccountLoading(false);
}

async function initializeAccount() {
  renderAccount(null);
  if (!window.MacroRadarAuth) {
    setAccountMessage("authFailed", true);
    return;
  }

  try {
    setAccountLoading(true);
    const user = await window.MacroRadarAuth.getCurrentUser();
    renderAccount(user);
    if (!user && window.MacroRadarAuth.getLastError?.()) {
      setAccountMessage(window.MacroRadarAuth.getLastError(), true, true);
    }
    await window.MacroRadarAuth.onAuthStateChange((nextUser) => {
      renderAccount(nextUser);
    });
  } catch (error) {
    console.error("Account initialization failed", error);
    setAccountMessage(getAuthErrorMessage(error), true, true);
    renderAccount(null);
  }
}

async function handleAccountAction(action) {
  const email = document.querySelector("#accountEmail")?.value.trim() || "";
  const password = document.querySelector("#accountPassword")?.value || "";
  if (!email || !password) {
    setAccountMessage(t("authFailed"), true, true);
    return;
  }

  try {
    setAccountLoading(true);
    const result = action === "signup"
      ? await window.MacroRadarAuth.signUp(email, password)
      : await window.MacroRadarAuth.signIn(email, password);
    const user = result.user || (await window.MacroRadarAuth.getCurrentUser());
    renderAccount(user);
    setAccountMessage(action === "signup" ? "accountCreated" : "signedIn");
  } catch (error) {
    console.error(action === "signup" ? "Supabase sign up error:" : "Supabase sign in error:", error);
    setAccountMessage(getAuthErrorMessage(error), true, true);
  } finally {
    setAccountLoading(false);
  }
}

async function handleSignOut() {
  try {
    setAccountLoading(true);
    await window.MacroRadarAuth.signOut();
    renderAccount(null);
    setAccountMessage("signedOut");
  } catch (error) {
    console.error("Sign out failed", error);
    setAccountMessage(getAuthErrorMessage(error), true, true);
  } finally {
    setAccountLoading(false);
  }
}

function setLanguage(language) {
  if (!translations[language]) return;
  currentLanguage = language;
  saveLanguage(currentLanguage);
  applyLanguage();
}

function closeLanguageDropdown() {
  const menu = document.querySelector("#languageMenu");
  const button = document.querySelector("#languageMenuButton");
  const dropdown = document.querySelector("#languageDropdown");
  if (!menu || !button || !dropdown) return;

  menu.classList.remove("open");
  button.setAttribute("aria-expanded", "false");
  dropdown.hidden = true;
}

function toggleLanguageDropdown() {
  const menu = document.querySelector("#languageMenu");
  const button = document.querySelector("#languageMenuButton");
  const dropdown = document.querySelector("#languageDropdown");
  if (!menu || !button || !dropdown) return;

  const willOpen = !menu.classList.contains("open");
  menu.classList.toggle("open", willOpen);
  button.setAttribute("aria-expanded", willOpen ? "true" : "false");
  dropdown.hidden = !willOpen;

  if (willOpen) {
    const activeOption = dropdown.querySelector(`[data-language-choice="${currentLanguage}"]`);
    activeOption?.focus();
  }
}

function readCachedPayload(key) {
  try {
    const cached = localStorage.getItem(`${API_CACHE_PREFIX}${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function writeCachedPayload(key, payload) {
  try {
    localStorage.setItem(`${API_CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing; the live app should continue.
  }
}

function addSafeListener(selector, eventName, handler) {
  const element = document.querySelector(selector);
  if (!element) {
    console.warn(`Skipping ${eventName} listener for missing element: ${selector}`);
    return null;
  }

  element.addEventListener(eventName, handler);
  return element;
}

async function fetchJsonWithSnapshot(url, cacheKey, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: options.signal || controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `${url} returned ${response.status}`);
    }
    writeCachedPayload(cacheKey, payload);
    return { payload, fromCache: false };
  } catch (error) {
    const cached = readCachedPayload(cacheKey);
    if (cached) {
      return { payload: cached, fromCache: true, error };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function sparklinePath(values) {
  const width = 280;
  const height = 72;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function chartCoordinates(points, width = 520, height = 180) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = points.length > 1 ? width / (points.length - 1) : width;

  return points.map((point, index) => ({
    ...point,
    x: points.length > 1 ? index * xStep : width / 2,
    y: height - ((point.value - min) / range) * (height - 24) - 12,
  }));
}

function chartPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function renderCharts(marketData) {
  latestMarkets = marketData;
  const grid = document.querySelector("#chartsGrid");

  grid.innerHTML = marketData
    .map((item) => {
      const period = chartPeriods[item.id] || "1D";
      const points = item.charts?.[period] || [];
      if (!points.length) {
        return `
          <article class="chart-card" style="--accent: ${item.accent}" data-chart-id="${item.id}">
            <div class="chart-top">
              <div>
                <p class="metric-label">${escapeHtml(item.label)}</p>
                <div class="chart-value">${escapeHtml(item.value)}</div>
              </div>
            </div>
            <div class="chart-stage empty-chart">${t("chartDataUnavailable")}</div>
          </article>
        `;
      }
      const coordinates = chartCoordinates(points);
      const first = points.at(0)?.value;
      const last = points.at(-1)?.value;
      const change = Number.isFinite(first) && Number.isFinite(last) && first !== 0
        ? ((last - first) / first) * 100
        : 0;
      const activePoint = points.at(-1);

      return `
        <article class="chart-card" style="--accent: ${item.accent}" data-chart-id="${item.id}">
          <div class="chart-top">
            <div>
              <p class="metric-label">${escapeHtml(item.label)}</p>
              <div class="chart-value">${escapeHtml(activePoint?.display || item.value)}</div>
            </div>
            <div class="period-toggle" aria-label="${escapeHtml(item.label)} chart range">
              <button class="${period === "1D" ? "active" : ""}" data-chart-period="1D" type="button">1D</button>
              <button class="${period === "1W" ? "active" : ""}" data-chart-period="1W" type="button">1W</button>
            </div>
          </div>
          <div class="chart-stage">
            <svg class="asset-chart" viewBox="0 0 520 180" preserveAspectRatio="none" aria-hidden="true">
              <path class="chart-area" d="${chartPath([
                { ...coordinates[0], y: 180 },
                ...coordinates,
                { ...coordinates.at(-1), y: 180 },
              ])}"></path>
              <path class="chart-line" d="${chartPath(coordinates)}"></path>
              ${coordinates
                .map(
                  (point, index) => `
                    <circle
                      class="chart-point"
                      cx="${point.x.toFixed(1)}"
                      cy="${point.y.toFixed(1)}"
                      r="5"
                      tabindex="0"
                      data-point-index="${index}"
                    ></circle>
                  `,
                )
                .join("")}
            </svg>
          </div>
          <div class="chart-readout" data-chart-readout>
            <span>${escapeHtml(activePoint?.label || period)}</span>
            <strong>${escapeHtml(activePoint?.display || "--")}</strong>
            <em class="${change < 0 ? "down" : ""}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</em>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateChartReadout(card, pointIndex) {
  const market = latestMarkets.find((item) => item.id === card.dataset.chartId);
  if (!market) return;

  const period = chartPeriods[market.id] || "1D";
  const point = market.charts?.[period]?.[pointIndex];
  if (!point) return;

  const readout = card.querySelector("[data-chart-readout]");
  readout.innerHTML = `
    <span>${escapeHtml(point.label)}</span>
    <strong>${escapeHtml(point.display)}</strong>
    <em>${period}</em>
  `;
}

function renderMetrics(marketData) {
  const grid = document.querySelector("#metricsGrid");
  grid.innerHTML = marketData
    .map(
      (item) => `
        <article class="metric-card" style="--accent: ${item.accent}">
          <div class="metric-top">
            <div>
              <p class="metric-label">${item.label}</p>
              <div class="metric-value">${item.value}</div>
              <span class="metric-change ${item.down ? "down" : ""}">${item.change}</span>
            </div>
            <div class="metric-icon">${item.icon}</div>
          </div>
          <svg class="sparkline" viewBox="0 0 280 72" preserveAspectRatio="none" aria-hidden="true">
            <path d="${sparklinePath(item.trend)}"></path>
          </svg>
          <p class="metric-foot">${item.detail}</p>
        </article>
      `,
    )
    .join("");
}

function watchlistQuote(asset) {
  const market = asset.marketId ? findMarket(latestMarkets, asset.marketId) : null;
  if (market) {
    return {
      value: market.value,
      change: market.change,
      down: Boolean(market.down),
      unavailable: false,
    };
  }

  const quote = latestWatchlistQuotes[asset.id];
  if (quote && !quote.unavailable) {
    return {
      value: quote.value,
      change: quote.change,
      down: Boolean(quote.down),
      unavailable: false,
    };
  }

  return {
    value: "--",
    change: "--",
    down: false,
    unavailable: true,
  };
}

function numericQuoteValue(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function customAlertQuote(assetId) {
  const asset = customAlertAssetById(assetId);
  if (!asset) return null;
  const quote = watchlistQuote(asset);
  const numericValue = numericQuoteValue(quote.value);
  if (!Number.isFinite(numericValue)) return null;
  return { ...quote, numericValue };
}

function isCustomAlertTriggered(alert) {
  const quote = customAlertQuote(alert.assetId);
  if (!quote) return false;

  if (alert.condition === ">") return quote.numericValue > alert.target;
  if (alert.condition === "<") return quote.numericValue < alert.target;
  if (alert.condition === ">=") return quote.numericValue >= alert.target;
  if (alert.condition === "<=") return quote.numericValue <= alert.target;
  return false;
}

function evaluateCustomAlerts() {
  let changed = false;
  customAlerts = customAlerts.map((alert) => {
    if (alert.triggered || !isCustomAlertTriggered(alert)) return alert;
    changed = true;
    return { ...alert, triggered: true };
  });
  if (changed) saveCustomAlerts();
}

function renderWatchlist() {
  const grid = document.querySelector("#watchlistGrid");
  if (!grid) return;

  if (!watchlistAssetIds.length) {
    grid.innerHTML = `
      <article class="watchlist-empty">
        <strong>${t("watchlistEmpty")}</strong>
      </article>
    `;
    return;
  }

  grid.innerHTML = watchlistAssetIds
    .map((id) => {
      const asset = watchlistAssetById(id);
      if (!asset) return "";
      const quote = watchlistQuote(asset);
      return `
        <article class="watchlist-card ${quote.down ? "down" : ""} ${quote.unavailable ? "unavailable" : ""}">
          <div>
            <span>${escapeHtml(asset.id)}</span>
            <strong>${escapeHtml(asset.name)}</strong>
          </div>
          <div class="watchlist-quote">
            <strong>${escapeHtml(quote.value)}</strong>
            <em>${escapeHtml(quote.change)}</em>
          </div>
          <button type="button" data-remove-watchlist="${escapeHtml(asset.id)}" aria-label="${t("removeAsset")} ${escapeHtml(asset.name)}">×</button>
        </article>
      `;
    })
    .join("");
}

function renderCustomAlerts() {
  const grid = document.querySelector("#customAlertsGrid");
  if (!grid) return;

  evaluateCustomAlerts();

  if (!customAlerts.length) {
    grid.innerHTML = `
      <article class="custom-alert-empty">
        <strong>${t("customAlertsEmpty")}</strong>
      </article>
    `;
    return;
  }

  grid.innerHTML = customAlerts
    .map((alert) => {
      const asset = customAlertAssetById(alert.assetId);
      if (!asset) return "";
      const quote = customAlertQuote(alert.assetId);
      const status = alert.triggered ? t("alertTriggered") : t("customAlertsWaiting");
      return `
        <article class="custom-alert-card ${alert.triggered ? "triggered" : ""}">
          <div>
            <span>${escapeHtml(asset.name)}</span>
            <strong>${escapeHtml(alert.assetId)} ${escapeHtml(alert.condition)} ${escapeHtml(alert.target)}</strong>
            <p>${escapeHtml(quote?.value || "--")}</p>
          </div>
          <div class="custom-alert-status">${escapeHtml(status)}</div>
          <button type="button" data-delete-custom-alert="${escapeHtml(alert.id)}" aria-label="Delete alert">×</button>
        </article>
      `;
    })
    .join("");
}

function renderCustomAlertAssetOptions() {
  const select = document.querySelector("#customAlertAsset");
  if (!select) return;
  select.innerHTML = CUSTOM_ALERT_ASSETS.map(
    (asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`,
  ).join("");
}

function setCustomAlertModal(open) {
  const modal = document.querySelector("#customAlertModal");
  const toggle = document.querySelector("#customAlertToggle");
  if (!modal || !toggle) return;

  modal.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  document.querySelector("#customAlertError").textContent = "";
  if (open) {
    renderCustomAlertAssetOptions();
    document.querySelector("#customAlertAsset")?.focus();
  }
}

function addCustomAlert({ assetId, condition, target }) {
  const numericTarget = Number(target);
  if (!customAlertAssetById(assetId) || !CUSTOM_ALERT_CONDITIONS.has(condition) || !Number.isFinite(numericTarget)) {
    return { error: t("customAlertsInvalid") };
  }

  const id = customAlertId(assetId, condition, numericTarget);
  if (customAlerts.some((alert) => alert.id === id)) {
    return { error: t("customAlertsDuplicate") };
  }

  customAlerts = [...customAlerts, { id, assetId, condition, target: numericTarget, triggered: false }];
  saveCustomAlerts();
  renderCustomAlerts();
  return { ok: true };
}

function renderWatchlistOptions() {
  const options = document.querySelector("#watchlistOptions");
  const search = document.querySelector("#watchlistSearch");
  if (!options) return;

  const query = (search?.value || "").trim().toLowerCase();
  const assets = WATCHLIST_ASSETS.filter((asset) => {
    const isSelected = watchlistAssetIds.includes(asset.id);
    const matches = `${asset.id} ${asset.name}`.toLowerCase().includes(query);
    return !isSelected && matches;
  });

  options.innerHTML = assets.length
    ? assets
        .map(
          (asset) => `
            <button type="button" role="option" data-add-watchlist="${escapeHtml(asset.id)}">
              <span>${escapeHtml(asset.id)}</span>
              <strong>${escapeHtml(asset.name)}</strong>
              <em>${t("add")}</em>
            </button>
          `,
        )
        .join("")
    : `<div class="watchlist-option-empty">${t("watchlistEmpty")}</div>`;
}

function renderSummary(summary, summaryPoints, provider) {
  document.querySelector("#marketSummary").textContent = summary;
  document.querySelector("#summaryTag").textContent =
    provider === "openai" ? "OpenAI" : t("generated");
  document.querySelector("#summaryPoints").innerHTML = summaryPoints
    .map(
      ([title, text]) => `
        <div class="point">
          <strong>${title}</strong>
          <p>${text}</p>
        </div>
      `,
    )
    .join("");
}

function findMarket(markets, id) {
  return markets.find((market) => market.id === id);
}

function marketMoveLine(market) {
  if (!market) return null;
  return `${market.label}: ${market.value} (${market.change})`;
}

function renderDailyBriefList(selector, items) {
  const safeItems = items.filter(Boolean);
  document.querySelector(selector).innerHTML = safeItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderDailyBrief(payload) {
  if (payload.aiDailyBrief) {
    const brief = payload.aiDailyBrief;
    document.querySelector("#dailyBriefProvider").textContent =
      brief.provider === "openai" ? "OpenAI" : t("generated");
    document.querySelector("#dailyBriefRegime").textContent =
      brief.currentRegime || t("waitingMacroSignals");
    renderDailyBriefList("#dailyBriefMoves", brief.marketMoves || []);
    renderDailyBriefList("#dailyBriefRates", brief.ratesDollarGoldRead || []);
    renderDailyBriefList("#dailyBriefWatch", brief.watchNext || []);
    document.querySelector("#dailyBriefRisk").textContent =
      brief.riskSummary || t("waitingRiskSignals");
    return;
  }

  const markets = payload.markets || [];
  const spx = findMarket(markets, "spx");
  const gold = findMarket(markets, "gold");
  const dxy = findMarket(markets, "dxy");
  const tenYear = findMarket(markets, "tenYear");
  const regime = payload.regime;
  const summaryPoints = payload.summaryPoints || [];
  const provider = payload.summaryProvider === "openai" ? "OpenAI" : t("generated");

  document.querySelector("#dailyBriefProvider").textContent = provider;
  document.querySelector("#dailyBriefRegime").textContent = regime
    ? `${regime.label} / ${regime.confidence}% ${t("confidenceLabel")}. ${regime.explanation}`
    : t("waitingMacroSignals");

  renderDailyBriefList(
    "#dailyBriefMoves",
    [spx, gold, dxy, tenYear].map(marketMoveLine),
  );

  renderDailyBriefList("#dailyBriefRates", [
    tenYear ? `Rates: US10Y is ${tenYear.value}, ${tenYear.change}.` : null,
    dxy ? `Dollar: ${dxy.label} is ${dxy.value}, ${dxy.change}.` : null,
    gold ? `Gold: ${gold.label} is ${gold.value}, ${gold.change}.` : null,
  ]);

  const watchItems = summaryPoints.length
    ? summaryPoints.map(([title, text]) => `${title}: ${text}`).slice(0, 3)
    : [
        spx ? `Risk appetite through ${spx.label} follow-through.` : null,
        tenYear ? `Treasury yield direction around ${tenYear.value}.` : null,
        dxy && gold ? `Dollar and gold confirmation: ${dxy.change} vs ${gold.change}.` : null,
      ];
  renderDailyBriefList("#dailyBriefWatch", watchItems);

  document.querySelector("#dailyBriefRisk").textContent =
    payload.summary || regime?.explanation || t("waitingMacroSignals");
}

function forecastList(items = []) {
  return items.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderForecast(payload) {
  const provider = t("scenarioOutlook");
  document.querySelector("#forecastProvider").textContent = provider;
  document.querySelector("#forecastGrid").innerHTML = (payload.items || [])
    .map(
      (item) => `
        <article class="forecast-card ${escapeHtml(item.outlook).toLowerCase()}">
          <div class="forecast-top">
            <div>
              <span class="result-kicker">${escapeHtml(item.asset)}</span>
              <strong>${escapeHtml(item.outlook)}</strong>
            </div>
            <div class="forecast-confidence">
              <span>${t("confidence")}</span>
              <strong>${Number(item.confidence)}%</strong>
            </div>
          </div>
          <div class="forecast-scenarios">
            <div>
              <h3>${t("forecastBullishScenario")}</h3>
              <p>${escapeHtml(item.bullishScenario)}</p>
            </div>
            <div>
              <h3>${t("forecastBearishScenario")}</h3>
              <p>${escapeHtml(item.bearishScenario)}</p>
            </div>
          </div>
          <div class="forecast-lists">
            <div>
              <h3>${t("forecastKeyTriggers")}</h3>
              <ul>${forecastList(item.keyTriggers)}</ul>
            </div>
            <div>
              <h3>${t("forecastInvalidatingSignals")}</h3>
              <ul>${forecastList(item.invalidatingSignals)}</ul>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderForecastLoading() {
  document.querySelector("#forecastProvider").textContent = t("loading");
  document.querySelector("#forecastGrid").innerHTML = `
    <article class="forecast-empty loading-card">
      <strong>${t("forecastLoading")}</strong>
    </article>
  `;
}

function renderRegime(regime) {
  if (!regime) return;

  document.querySelector("#regimeLabel").textContent = regime.label;
  document.querySelector("#regimeConfidence").textContent = `${regime.confidence}% ${t("confidenceLabel")}`;
  document.querySelector("#regimeExplanation").textContent = regime.explanation;
  document.querySelector("#regimeInputs").innerHTML = [
    ["S&P 500", regime.inputs.spxMove],
    ["DXY", regime.inputs.dxyMove],
    ["Gold", regime.inputs.goldMove],
    ["US10Y", regime.inputs.tenYearMove],
  ]
    .map(
      ([label, value]) => `
        <div class="regime-input">
          <span>${label}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderList(selector, items) {
  document.querySelector(selector).innerHTML = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function analystList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderAnalystLoading() {
  document.querySelector("#analystProvider").textContent = t("generating");
  document.querySelector("#analystStatus").textContent = t("readingSignals");
  document.querySelector("#analystResult").className = "analyst-result empty loading-card";
  document.querySelector("#analystResult").innerHTML = `
    <div>
      <span class="result-kicker">${t("generatingAnalysis")}</span>
      <strong>${t("generatingCopy")}</strong>
    </div>
  `;
}

function renderAnalystError(message) {
  document.querySelector("#analystProvider").textContent = t("unavailable");
  document.querySelector("#analystStatus").textContent = t("analystErrorStatus");
  document.querySelector("#analystResult").className = "analyst-result error";
  document.querySelector("#analystResult").innerHTML = `
    <div>
      <span class="result-kicker">${t("error")}</span>
      <strong>${escapeHtml(message)}</strong>
      <p>${t("retryAfterRefresh")}</p>
    </div>
  `;
}

function renderAnalystResult(analysis) {
  document.querySelector("#analystProvider").textContent =
    analysis.provider === "openai" ? "OpenAI" : t("localModel");
  document.querySelector("#analystStatus").textContent = t("disclaimer");
  document.querySelector("#analystResult").className = "analyst-result";
  document.querySelector("#analystResult").innerHTML = `
    <div class="result-top">
      <article class="view-card">
        <span class="result-kicker">${t("overallView")}</span>
        <strong>${escapeHtml(analysis.overallView)}</strong>
        <p>${escapeHtml(analysis.explanation)}</p>
      </article>
      <article class="confidence-card">
        <span class="result-kicker">${t("confidence")}</span>
        <strong>${Number(analysis.confidence)}%</strong>
      </article>
    </div>
    <div class="result-grid">
      <article class="result-section">
        <h3>${t("keyDrivers")}</h3>
        <ul>${analystList(analysis.keyDrivers)}</ul>
      </article>
      <article class="result-section">
        <h3>${t("bullishFactors")}</h3>
        <ul>${analystList(analysis.bullishFactors)}</ul>
      </article>
      <article class="result-section">
        <h3>${t("bearishFactors")}</h3>
        <ul>${analystList(analysis.bearishFactors)}</ul>
      </article>
      <article class="result-section">
        <h3>${t("watchingNext")}</h3>
        <ul>${analystList(analysis.watchNext)}</ul>
      </article>
    </div>
    <article class="signals-card">
      <h3>${t("signalsUsed")}</h3>
      <ul>
        <li><span>Regime</span>${escapeHtml(analysis.signalsUsed.regime)}</li>
        <li><span>S&P 500</span>${escapeHtml(analysis.signalsUsed.spx)}</li>
        <li><span>Gold</span>${escapeHtml(analysis.signalsUsed.gold)}</li>
        <li><span>DXY</span>${escapeHtml(analysis.signalsUsed.dxy)}</li>
        <li><span>US10Y</span>${escapeHtml(analysis.signalsUsed.tenYear)}</li>
      </ul>
    </article>
  `;
}

async function generateAnalysis(question) {
  const submitButton = document.querySelector("#analystSubmit");
  submitButton.disabled = true;
  renderAnalystLoading();

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Analyze API returned ${response.status}`);
    }

    writeCachedPayload(ANALYST_CACHE_KEY, payload);
    renderAnalystResult(payload);
  } catch (error) {
    const cached = readCachedPayload(ANALYST_CACHE_KEY);
    if (cached) {
      renderAnalystResult(cached);
      document.querySelector("#analystStatus").textContent =
        t("offlineSnapshotShown");
      document.querySelector("#analystProvider").textContent = t("cached");
    } else {
      renderAnalystError(error.message);
    }
    console.error(error);
  } finally {
    submitButton.disabled = false;
  }
}

function renderBrief(brief) {
  document.querySelector("#briefStatus").textContent = `Saved ${brief.date}`;
  document.querySelector(
    "#briefRegime",
  ).textContent = `${brief.regime.label} / ${brief.regime.confidence}%`;
  document.querySelector("#briefTheme").textContent = brief.marketTheme;
  renderList("#briefRisks", brief.mainRisks);
  renderList("#briefDrivers", brief.keyDrivers);
  renderList("#briefWatching", brief.watchingNext);
  document.querySelector("#briefInterpretation").textContent = brief.actionableInterpretation;
}

function renderTimeline(payload) {
  document.querySelector("#timelineStatus").textContent = `${payload.count} saved`;
  const list = document.querySelector("#timelineList");

  if (!payload.items.length) {
    list.innerHTML = `
      <article class="timeline-empty">
        <strong>No historical briefs yet.</strong>
        <p>Daily briefs will appear here after they are generated and saved locally.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = payload.items
    .map(
      (item) => `
        <article class="timeline-item">
          <div class="timeline-date">
            <span>${escapeHtml(item.date)}</span>
            <strong>${escapeHtml(item.regime.label)}</strong>
            <em>${item.regime.confidence}%</em>
          </div>
          <div class="timeline-copy">
            <p>${escapeHtml(item.marketTheme)}</p>
            <div class="timeline-columns">
              <div>
                <span>Main Risks</span>
                <ul>${item.mainRisks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
              </div>
              <div>
                <span>Key Drivers</span>
                <ul>${item.keyDrivers.map((driver) => `<li>${escapeHtml(driver)}</li>`).join("")}</ul>
              </div>
            </div>
            <div class="timeline-interpretation">
              ${escapeHtml(item.actionableInterpretation)}
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAlerts(payload) {
  const alerts = payload.history.slice(0, 8);
  document.querySelector("#alertsStatus").textContent = `${payload.count} stored`;

  if (!alerts.length) {
    document.querySelector("#alertsList").innerHTML = `
      <article class="alert-empty">
        <strong>No macro alerts triggered.</strong>
        <p>The engine is monitoring gold, DXY, US10Y, regime changes, and risk sentiment.</p>
      </article>
    `;
    return;
  }

  document.querySelector("#alertsList").innerHTML = alerts
    .map((alert) => {
      const timestamp = new Date(alert.timestamp);
      const time = Number.isNaN(timestamp.getTime())
        ? "--:--"
        : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `
        <article class="alert-item ${escapeHtml(alert.severity)}">
          <div class="alert-severity">${escapeHtml(alert.severity)}</div>
          <div class="alert-copy">
            <div>
              <h3>${escapeHtml(alert.title)}</h3>
              <time>${time}</time>
            </div>
            <p>${escapeHtml(alert.explanation)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLoading() {
  renderForecastLoading();
  renderWatchlist();
  renderWatchlistOptions();
  renderCustomAlerts();

  document.querySelector("#metricsGrid").innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <article class="metric-card loading-card">
          <div class="metric-label">${t("loadingLiveQuote")}</div>
          <div class="metric-value">--</div>
          <p class="metric-foot">${t("waitingForMarketData")}</p>
        </article>
      `,
    )
    .join("");

  document.querySelector("#chartsGrid").innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <article class="chart-card loading-card">
          <div class="metric-label">${t("loadingChart")}</div>
          <div class="chart-value">--</div>
          <div class="chart-stage empty-chart">${t("waitingForHistory")}</div>
        </article>
      `,
    )
    .join("");

  document.querySelector("#regimeLabel").textContent = t("calculating");
  document.querySelector("#regimeConfidence").textContent = `-- ${t("confidenceLabel")}`;
  document.querySelector("#regimeExplanation").textContent = t("waitingMacroSignals");
  document.querySelector("#regimeInputs").innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <div class="regime-input loading-card">
          <span>${t("signal")}</span>
          <strong>--</strong>
        </div>
      `,
    )
    .join("");

  document.querySelector("#dailyBriefProvider").textContent = t("loading");
  document.querySelector("#dailyBriefRegime").textContent = t("dailyBriefLoading");
  renderDailyBriefList("#dailyBriefMoves", [t("waitingAssetMoves")]);
  renderDailyBriefList("#dailyBriefRates", [t("waitingMacroSignals")]);
  renderDailyBriefList("#dailyBriefWatch", [t("waitingMacroHeadlines")]);
  document.querySelector("#dailyBriefRisk").textContent = t("waitingRiskSignals");

  document.querySelector("#briefStatus").textContent = t("loading");
  document.querySelector("#briefRegime").textContent = "--";
  document.querySelector("#briefTheme").textContent = t("generatingTheme");
  renderList("#briefRisks", [t("waitingRiskSignals")]);
  renderList("#briefDrivers", [t("waitingAssetMoves")]);
  renderList("#briefWatching", [t("waitingMacroHeadlines")]);
  document.querySelector("#briefInterpretation").textContent = t("waitingLiveMacroData");

  document.querySelector("#timelineStatus").textContent = t("loading");
  document.querySelector("#timelineList").innerHTML = `
    <article class="timeline-empty loading-card">
      <strong>${t("loadingTimeline")}</strong>
      <p>${t("readingBriefs")}</p>
    </article>
  `;

  document.querySelector("#alertsStatus").textContent = t("loading");
  document.querySelector("#alertsList").innerHTML = `
    <article class="alert-empty loading-card">
      <strong>${t("loadingAlerts")}</strong>
      <p>${t("checkingThresholds")}</p>
    </article>
  `;
}

function renderNewsLoading() {
  document.querySelector("#topicStrip").innerHTML = [
    "Federal Reserve",
    "Inflation",
    "Gold",
    "Treasury yields",
    "US dollar",
    "S&P 500",
  ]
    .map((topic) => `<span>${topic}</span>`)
    .join("");

  document.querySelector("#newsList").innerHTML = Array.from({ length: 5 })
    .map(
      () => `
        <article class="news-item loading-news">
          <span class="news-time">--:--</span>
          <div>
            <h3>${t("loadingHeadline")}</h3>
            <p>${t("fetchingNews")}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderNews(payload) {
  document.querySelector("#topicStrip").innerHTML = payload.queryTopics
    .map((topic) => `<span>${escapeHtml(topic)}</span>`)
    .join("");

  document.querySelector("#newsList").innerHTML = payload.headlines
    .map((item) => {
      const published = new Date(item.publishedAt);
      const time = Number.isNaN(published.getTime())
        ? "--:--"
        : published.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const topics = item.topics
        .map((topic) => `<span class="news-topic">${escapeHtml(topic)}</span>`)
        .join("");

      return `
        <article class="news-item">
          <span class="news-time">${time}</span>
          <div class="news-copy">
            <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">
              ${escapeHtml(item.title)}
            </a>
            <div class="news-source">
              <span>${escapeHtml(item.source)}</span>
              <div>${topics}</div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelector("#newsStatus").textContent = `${t("updated")} ${new Date(
    payload.updatedAt,
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function setStatus(text, state = "loading") {
  const pill = document.querySelector("#refreshStatus");
  const label = pill?.querySelector("span:last-child");
  if (!pill || !label) return;

  pill.classList.remove("status-loading", "status-live", "status-fallback", "status-error");
  pill.classList.add(`status-${state}`);
  label.textContent = text;
}

async function refreshMarkets() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/markets", "markets");
    latestWatchlistQuotes = payload.watchlistQuotes || {};
    renderMetrics(payload.markets);
    renderCharts(payload.markets);
    renderWatchlist();
    renderCustomAlerts();
    renderRegime(payload.regime);
    renderSummary(payload.summary, payload.summaryPoints, payload.summaryProvider);
    renderDailyBrief(payload);
    const isFallback = fromCache || payload.degraded || payload.providerStatus?.marketData === "fallback";
    const updatedTime = new Date(payload.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setStatus(isFallback ? t("fallbackData") : `${t("live")} • ${t("updated")} ${updatedTime}`, isFallback ? "fallback" : "live");
    console.log("markets loaded");
  } catch (error) {
    setStatus(latestMarkets.length ? t("fallbackData") : t("dataUnavailable"), latestMarkets.length ? "fallback" : "error");
    if (!latestMarkets.length) {
      document.querySelector("#marketSummary").textContent =
        t("marketDataUnavailable");
    }
    console.error(error);
  }
}

async function refreshForecast() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/forecast", "forecast");
    renderForecast(payload);
    if (fromCache) {
      document.querySelector("#forecastProvider").textContent = t("offlineSnapshot");
    }
    console.log("forecast loaded");
  } catch (error) {
    document.querySelector("#forecastProvider").textContent = t("unavailable");
    document.querySelector("#forecastGrid").innerHTML = `
      <article class="forecast-empty">
        <strong>${t("forecastCouldNotLoad")}</strong>
        <p>${t("retryAutomatically")}</p>
      </article>
    `;
    console.error(error);
  }
}

async function refreshNews() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/news", "news");
    renderNews(payload);
    if (fromCache) {
      document.querySelector("#newsStatus").textContent = t("offlineSnapshot");
    }
  } catch (error) {
    document.querySelector("#newsStatus").textContent = t("newsUnavailable");
    document.querySelector("#newsList").innerHTML = `
      <article class="news-item">
        <span class="news-time">--:--</span>
        <div class="news-copy">
          <h3>${t("liveNewsUnavailable")}</h3>
          <p>${t("feedRetry")}</p>
        </div>
      </article>
    `;
    console.error(error);
  }
}

async function refreshBrief() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/brief", "brief");
    renderBrief(payload);
    if (fromCache) {
      document.querySelector("#briefStatus").textContent = t("offlineSnapshot");
    }
    try {
      await refreshTimeline();
    } catch (error) {
      console.error(error);
    }
  } catch (error) {
    document.querySelector("#briefStatus").textContent = t("briefUnavailable");
    document.querySelector("#briefTheme").textContent =
      t("briefCouldNotGenerate");
    console.error(error);
  }
}

async function refreshTimeline() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/timeline", "timeline");
    renderTimeline(payload);
    if (fromCache) {
      document.querySelector("#timelineStatus").textContent = t("offlineSnapshot");
    }
  } catch (error) {
    document.querySelector("#timelineStatus").textContent = t("timelineUnavailable");
    document.querySelector("#timelineList").innerHTML = `
      <article class="timeline-empty">
        <strong>${t("couldNotLoadTimeline")}</strong>
        <p>${t("retryAutomatically")}</p>
      </article>
    `;
    console.error(error);
  }
}

async function refreshAlerts() {
  try {
    const { payload, fromCache } = await fetchJsonWithSnapshot("/api/alerts", "alerts");
    renderAlerts(payload);
    if (fromCache) {
      document.querySelector("#alertsStatus").textContent = t("offlineSnapshot");
    }
    console.log("alerts loaded");
  } catch (error) {
    document.querySelector("#alertsStatus").textContent = t("alertsUnavailable");
    document.querySelector("#alertsList").innerHTML = `
      <article class="alert-empty">
        <strong>${t("couldNotLoadAlerts")}</strong>
        <p>${t("retryAutomatically")}</p>
      </article>
    `;
    console.error(error);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-period]");
  if (!button) return;

  const card = button.closest("[data-chart-id]");
  if (!card) return;

  chartPeriods[card.dataset.chartId] = button.dataset.chartPeriod;
  renderCharts(latestMarkets);
});

document.addEventListener("mouseover", (event) => {
  const point = event.target.closest("[data-point-index]");
  const card = event.target.closest("[data-chart-id]");
  if (!point || !card) return;

  updateChartReadout(card, Number(point.dataset.pointIndex));
});

document.addEventListener("focusin", (event) => {
  const point = event.target.closest("[data-point-index]");
  const card = event.target.closest("[data-chart-id]");
  if (!point || !card) return;

  updateChartReadout(card, Number(point.dataset.pointIndex));
});

addSafeListener("#accountForm", "submit", (event) => {
  event.preventDefault();
  if (!window.MacroRadarAuth) {
    setAccountMessage("authFailed", true);
    return;
  }
  handleAccountAction("signin");
});

addSafeListener("#accountSignUp", "click", () => {
  if (!window.MacroRadarAuth) {
    setAccountMessage("authFailed", true);
    return;
  }
  handleAccountAction("signup");
});

addSafeListener("#accountSignOut", "click", () => {
  if (!window.MacroRadarAuth) {
    setAccountMessage("authFailed", true);
    return;
  }
  handleSignOut();
});

addSafeListener("#analystForm", "submit", (event) => {
  event.preventDefault();
  const question = document.querySelector("#analystQuestion")?.value.trim() || "";
  if (!question) {
    renderAnalystError(t("enterQuestion"));
    return;
  }

  generateAnalysis(question);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-example-prompt]");
  if (!button) return;

  const analystQuestion = document.querySelector("#analystQuestion");
  if (!analystQuestion) return;

  analystQuestion.value = button.dataset.examplePrompt;
  analystQuestion.focus();
});

addSafeListener("#watchlistToggle", "click", () => {
  const picker = document.querySelector("#watchlistPicker");
  setWatchlistPicker(Boolean(picker?.hidden));
  renderWatchlistOptions();
});

addSafeListener("#watchlistSearch", "input", renderWatchlistOptions);

addSafeListener("#watchlistOptions", "click", (event) => {
  const option = event.target.closest("[data-add-watchlist]");
  if (!option) return;

  addWatchlistAsset(option.dataset.addWatchlist);
  const search = document.querySelector("#watchlistSearch");
  if (search) {
    search.value = "";
  }
  setWatchlistPicker(false);
});

addSafeListener("#watchlistGrid", "click", (event) => {
  const removeButton = event.target.closest("[data-remove-watchlist]");
  if (!removeButton) return;

  removeWatchlistAsset(removeButton.dataset.removeWatchlist);
});

addSafeListener("#customAlertToggle", "click", () => {
  setCustomAlertModal(true);
});

addSafeListener("#customAlertClose", "click", () => {
  setCustomAlertModal(false);
});

addSafeListener("#customAlertCancel", "click", () => {
  setCustomAlertModal(false);
});

addSafeListener("#customAlertModal", "click", (event) => {
  if (event.target.id === "customAlertModal") {
    setCustomAlertModal(false);
  }
});

addSafeListener("#customAlertForm", "submit", (event) => {
  event.preventDefault();
  const result = addCustomAlert({
    assetId: document.querySelector("#customAlertAsset")?.value,
    condition: document.querySelector("#customAlertCondition")?.value,
    target: document.querySelector("#customAlertTarget")?.value,
  });

  if (result.error) {
    const errorLabel = document.querySelector("#customAlertError");
    if (errorLabel) {
      errorLabel.textContent = result.error;
    }
    return;
  }

  document.querySelector("#customAlertForm")?.reset();
  setCustomAlertModal(false);
});

addSafeListener("#customAlertsGrid", "click", (event) => {
  const deleteButton = event.target.closest("[data-delete-custom-alert]");
  if (!deleteButton) return;

  customAlerts = customAlerts.filter((alert) => alert.id !== deleteButton.dataset.deleteCustomAlert);
  saveCustomAlerts();
  renderCustomAlerts();
});

addSafeListener("#languageMenuButton", "click", (event) => {
  event.stopPropagation();
  toggleLanguageDropdown();
});

addSafeListener("#languageDropdown", "click", (event) => {
  const option = event.target.closest("[data-language-choice]");
  if (!option) return;

  setLanguage(option.dataset.languageChoice);
  closeLanguageDropdown();
  document.querySelector("#languageMenuButton")?.focus();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#languageMenu")) {
    closeLanguageDropdown();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLanguageDropdown();
    setCustomAlertModal(false);
    document.querySelector("#languageMenuButton")?.focus();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

async function initializeApp() {
  try {
    configureNativeStatusBar();
    applyLanguage();
    initializeAccount();
    renderLoading();
    renderNewsLoading();
  } catch (error) {
    console.error("Initialization setup failed", error);
  }

  await Promise.allSettled([
    refreshMarkets(),
    refreshForecast(),
    refreshNews(),
    refreshBrief(),
    refreshAlerts(),
  ]);
  console.log("initialization complete");

  setInterval(refreshMarkets, REFRESH_MS);
  setInterval(refreshForecast, BRIEF_REFRESH_MS);
  setInterval(refreshNews, NEWS_REFRESH_MS);
  setInterval(refreshBrief, BRIEF_REFRESH_MS);
  setInterval(refreshTimeline, BRIEF_REFRESH_MS);
  setInterval(refreshAlerts, ALERT_REFRESH_MS);
}

initializeApp();
