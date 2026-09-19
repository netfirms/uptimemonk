import type { SupportedLocale } from "./locales";

export interface Translations {
  // Navigation & Brand
  navFeatures: string;
  navDemo: string;
  navAlerts: string;
  navPricing: string;
  navFaq: string;
  probesLive: string;
  logIn: string;
  startFree: string;
  dashboardBtn: string;

  // Hero Section
  heroTag: string;
  heroTitle1: string;
  heroTitleHighlight: string;
  heroTitle2: string;
  heroDesc: string;
  heroPlaceholder: string;
  heroStartBtn: string;
  continueWithGoogle: string;
  continueWithGithub: string;
  signUpWithEmail: string;
  heroConnecting: string;
  featureIntervals: string;
  featureSsl: string;
  featureNoCard: string;
  pillHttp: string;
  pillSsl: string;
  pillPing: string;
  pillCron: string;
  pillStatusPage: string;

  // Sandbox / Live Demo
  demoTag: string;
  demoTitle: string;
  demoDesc: string;
  tabHttp: string;
  tabSsl: string;
  tabPorts: string;
  tabHeartbeat: string;
  demoWorkerLocation: string;
  demoUptime30d: string;
  demoSslValid: string;
  demoSslExpiring: string;
  demoPortOpen: string;
  demoResolved: string;
  demoHealthy: string;
  demoLastPing: string;
  demoCronSnippet: string;

  // Alerts Showcase
  alertsTag: string;
  alertsTitle: string;
  alertsDesc: string;
  alertDownTitle: string;
  alertRecoveredTitle: string;
  alertReason: string;
  alertClosed: string;

  // Features Grid / Why
  whyTag: string;
  whyTitle: string;
  whyDesc: string;
  why1Title: string;
  why1Desc: string;
  why2Title: string;
  why2Desc: string;
  why3Title: string;
  why3Desc: string;
  why4Title: string;
  why4Desc: string;

  // Capacity Pricing
  pricingTag: string;
  pricingTitle: string;
  pricingLede: string;
  freeForeverLabel: string;
  checksPerDay: string;
  freeDesc: string;
  coffeeAddsLabel: string;
  checksUnit: string;
  coffeeDesc: string;
  buyCoffeeBtn: string;
  coffeeNotice: string;
  ifCreditRunsOutLabel: string;
  nothingDeletedFigure: string;
  graceDesc: string;
  whyCapacityExplanation: string;

  // FAQ
  faqTag: string;
  faqTitle: string;
  faqDesc: string;
  faq1Q: string;
  faq1A: string;
  faq2Q: string;
  faq2A: string;
  faq3Q: string;
  faq3A: string;
  faq4Q: string;
  faq4A: string;
  faq5Q: string;
  faq5A: string;

  // Bottom CTA
  ctaTag: string;
  ctaTitle: string;
  ctaDesc: string;
  startFreeMonitoring: string;
  ctaFooterNotice: string;

  // Footer
  footerTagline: string;
  backToTop: string;

  // Auth Modal
  authWelcomeBack: string;
  authStartMonitoring: string;
  authResetPassword: string;
  authSubtitleSignIn: string;
  authSubtitleSignUp: string;
  authSubtitleReset: string;
  authCreateAccountTab: string;
  authSignInTab: string;
  authOrContinueEmail: string;
  authYourName: string;
  authWorkEmail: string;
  authPassword: string;
  authForgotPassword: string;
  authCreateFreeAccountBtn: string;
  authSignInDashboardBtn: string;
  authSendResetBtn: string;
  authProcessing: string;
  authNoAccountPrompt: string;
  authSignUpFreeLink: string;
  authHaveAccountPrompt: string;
  authSignInLink: string;
  authBackToSignIn: string;
  pwdGreat: string;
  pwdDecent: string;
  pwdTooShort: string;

  // Dashboard Header & Navigation
  dashWorkspace: string;
  dashEditUsername: string;
  dashChecksLeft: string;
  dashBuyCoffee: string;
  dashAlerts: string;
  dashSignOut: string;
  dashSignedIn: string;

  // Dashboard Metrics & Status
  dashOverallUptime: string;
  dashUpMonitors: string;
  dashDownMonitors: string;
  dashPausedMonitors: string;
  dashAllOperational: string;
  dashIncidentsActive: string;
  dashChecksToday: string;
  dashFreeAllowance: string;

  // Dashboard Filters & Actions
  dashSearchPlaceholder: string;
  dashFilterAll: string;
  dashFilterUp: string;
  dashFilterDown: string;
  dashFilterPaused: string;
  dashNewMonitor: string;

  // Dashboard Public Status Page
  dashStatusPageLive: string;
  dashViewStatusPage: string;

  // Dashboard Monitor Cards
  dashNeverChecked: string;
  dashUptime30d: string;
  dashCopyHeartbeat: string;
  dashCopied: string;
  dashEdit: string;
  dashPause: string;
  dashResume: string;
  dashDelete: string;
  dashConfirmDelete: string;
  dashStatusUp: string;
  dashStatusDown: string;
  dashStatusPending: string;
  dashStatusPaused: string;
  dashMaintenance: string;
  dashCertExpired: string;
  dashCertExpiresToday: string;
  dashCertExpiresTomorrow: string;
  dashCertDays: string;

  // Dashboard Empty States
  dashNoMonitorsTitle: string;
  dashNoMonitorsDesc: string;
  dashAddFirstMonitor: string;
  dashNoMatchingMonitors: string;

  // Dashboard - Form (Create / Edit Monitor)
  formNewTitle: string;
  formEditTitle: string;
  formMonitorType: string;
  formFriendlyName: string;
  formFriendlyNamePlaceholder: string;
  formTargetUrl: string;
  formTargetHost: string;
  formTargetIp: string;
  formPort: string;
  formInterval: string;
  formAlertContacts: string;
  formSelectContacts: string;
  formAllContacts: string;
  formNoContactsNotice: string;
  formAdvancedOptions: string;
  formKeyword: string;
  formKeywordPlaceholder: string;
  formInvertedKeyword: string;
  formCustomStatus: string;
  formStatusPlaceholder: string;
  formHttpHeaders: string;
  formRecordType: string;
  formExpectedValue: string;
  formHeartbeatGrace: string;
  formPublicStatus: string;
  formPublicStatusDesc: string;
  formMuteAlerts: string;
  formMuteAlertsDesc: string;
  formCreateBtn: string;
  formSaveBtn: string;
  formCancelBtn: string;
  formCreating: string;
  formSaving: string;

  // Dashboard - Detail Modal
  detailTitle: string;
  detailTabOverview: string;
  detailTabIncidents: string;
  detailTabResponseTime: string;
  detailTabSettings: string;
  detailCurrentStatus: string;
  detailUptime: string;
  detailAvgResponse: string;
  detailIncidentsRecorded: string;
  detailNoIncidents: string;
  detailIncidentOngoing: string;
  detailIncidentResolved: string;
  detailIncidentDuration: string;
  detailDeleteMonitor: string;
  detailDeleteWarning: string;

  // Dashboard - Alert Contacts Modal
  contactsTitle: string;
  contactsSubtitle: string;
  contactsAddNew: string;
  contactsChannel: string;
  contactsName: string;
  contactsDestination: string;
  contactsAddBtn: string;
  contactsVerified: string;
  contactsPending: string;
  contactsResend: string;
  contactsTestAlert: string;
  contactsSending: string;
  contactsDelete: string;
  contactsNoContacts: string;

  // Dashboard - Org Settings Modal
  settingsTitle: string;
  settingsWorkspaceName: string;
  settingsStatusPageTitle: string;
  settingsSlug: string;
  settingsPageTitle: string;
  settingsPageDesc: string;
  settingsSave: string;

  // Dashboard - Support Modal
  supportTitle: string;
  supportSubtitle: string;
  supportUsedToday: string;
  supportDailyBudget: string;
  supportRemainingCredit: string;
  supportBuyCoffee: string;
  supportDonateBtn: string;

  // Dashboard - Profile Modal
  profileTitle: string;
  profileUsername: string;
  profileEmail: string;
  profileSave: string;
  profileSaving: string;

  // AI & Onboarding Enhancements
  heroAiBadge: string;
  heroAiHeadline: string;
  heroAiSubtext: string;
  presetAiApi: string;
  presetWebApp: string;
  presetSsl: string;
  presetHeartbeat: string;
  onboardingJourneyTag: string;
  onboardingJourneyTitle: string;
  onboardingStep1: string;
  onboardingStep1Desc: string;
  onboardingStep2: string;
  onboardingStep2Desc: string;
  onboardingStep3: string;
  onboardingStep3Desc: string;
  tabAi: string;
  demoAiEndpoint: string;
  demoAiLatency: string;
  demoAiStatus: string;
  onboardTitle: string;
  onboardSubtitle: string;
  onboardStep1Title: string;
  onboardStep1Desc: string;
  onboardStep2Title: string;
  onboardStep2Desc: string;
  onboardStep3Title: string;
  onboardStep3Desc: string;
  presetAiTitle: string;
  presetAiDesc: string;
}

export const TRANSLATIONS: Record<SupportedLocale, Translations> = {
  // ==========================================
  // ENGLISH (DEFAULT)
  // ==========================================
  en: {
    navFeatures: "Features",
    navDemo: "Live Demo",
    navAlerts: "Alerts",
    navPricing: "Pricing",
    navFaq: "FAQ",
    probesLive: "Probes Live",
    logIn: "Log In",
    startFree: "Start Free",
    dashboardBtn: "Dashboard",

    heroTag: "Sub-Minute Edge Checks · 100% Free Forever",
    heroTitle1: "Keep your websites & APIs ",
    heroTitleHighlight: "online",
    heroTitle2: ".",
    heroDesc:
      "Continuous HTTP, SSL expiry, TCP ping, and cron heartbeat monitoring with sub-minute checks and instant multi-channel alerts before your users notice downtime.",
    heroPlaceholder: "Enter your website or API (e.g. example.com)",
    heroStartBtn: "Start Monitoring",
    continueWithGoogle: "Continue with Google",
    continueWithGithub: "Continue with GitHub",
    signUpWithEmail: "Sign up with Email",
    heroConnecting: "Connecting…",
    featureIntervals: "⚡ 60s Check Intervals",
    featureSsl: "🔒 Free SSL Expiry Alerts",
    featureNoCard: "🚫 No Credit Card Required",
    pillHttp: "HTTP(S) & APIs",
    pillSsl: "SSL Expiry (30d/14d/7d)",
    pillPing: "Ping (ICMP) & TCP",
    pillCron: "Cron Heartbeats",
    pillStatusPage: "Public Status Pages",

    demoTag: "Interactive Sandbox",
    demoTitle: "See How UptimeMonke Probes Your Stack",
    demoDesc:
      "Real-time edge probes dispatched from AWS Lightsail Singapore with sub-minute resolution.",
    tabHttp: "HTTP & APIs",
    tabSsl: "SSL Certificates",
    tabPorts: "TCP & DNS",
    tabHeartbeat: "Cron Heartbeats",
    demoWorkerLocation: "Worker: sg-1 (ap-southeast-1a)",
    demoUptime30d: "30-Day Uptime: 99.99%",
    demoSslValid: "Valid (84 days)",
    demoSslExpiring: "Expiring in 4 days",
    demoPortOpen: "PORT OPEN",
    demoResolved: "RESOLVED",
    demoHealthy: "HEALTHY",
    demoLastPing: "Last ping: 4m ago · Expected interval: 24h · Grace: 30m",
    demoCronSnippet: "Simple cron integration:",

    alertsTag: "Instant Incident Notification",
    alertsTitle: "Alert Your Team Before Customers Complain",
    alertsDesc:
      "Zero-delay alert dispatch across the tools your engineering team already lives in.",
    alertDownTitle: "Production API is DOWN",
    alertRecoveredTitle: "Production API has RECOVERED",
    alertReason: "Reason: HTTP 502 Bad Gateway (Response time: 10,024 ms)",
    alertClosed: "Status: 200 OK (32 ms) · Incident closed. Downtime duration: 2m 14s.",

    whyTag: "Engineered for Developers",
    whyTitle: "Why Teams Choose UptimeMonke",
    whyDesc:
      "No artificial paywalls, no bloated enterprise contracts. Just fast, dependable infrastructure monitoring.",
    why1Title: "Sub-Minute Edge Checks",
    why1Desc:
      "Traditional monitoring platforms lock free accounts to 5-minute intervals. UptimeMonke lets you run sub-minute checks right out of the box so you know about failures instantly.",
    why2Title: "SSRF-Hardened Cloud Fleet",
    why2Desc:
      "Engineered with strict RFC1918 link-local defense, AWS IMDSv2 metadata attack prevention, and DNS rebinding guards. Safe for corporate internal targets.",
    why3Title: "Branded Public Status Pages",
    why3Desc:
      "Publish a clean status page at /status/:slug with 90-day historical uptime bars and active incident feeds. Keeps your customers informed during outages.",
    why4Title: "Multi-Channel Alerts",
    why4Desc:
      "Deliver alerts to Slack, Discord, Telegram, custom Webhooks, and Mailgun emails with zero configuration pain. Verified contacts prevent alert spoofing.",

    pricingTag: "Zero Subscriptions",
    pricingTitle: "There Is No Paid Plan",
    pricingLede:
      "Every single feature works on a free account — all check types, sub-minute intervals, public status pages, and alerting. What an optional donation pays for is capacity, because that is the only part that costs real server resources.",
    freeForeverLabel: "Free, forever",
    checksPerDay: "checks a day",
    freeDesc:
      "Ten monitors at one minute. Or fifty at five minutes. Or one at six seconds — it is the exact same compute load, so it is the exact same free price.",
    coffeeAddsLabel: "One $2.99 coffee adds",
    checksUnit: "checks",
    coffeeDesc:
      "Around a month of twenty monitors at one minute, or ten at thirty seconds. Unused capacity rolls over with zero subscriptions — buy another whenever you run low.",
    buyCoffeeBtn: "Buy me a coffee",
    coffeeNotice:
      "Sign-in first, so capacity lands on your workspace rather than disappearing.",
    ifCreditRunsOutLabel: "If credit runs out",
    nothingDeletedFigure: "Nothing",
    graceDesc:
      "A week of grace at full capacity, then a seamless fallback to the free 14,400 daily allowance. Your monitors keep running throughout.",
    whyCapacityExplanation:
      "Why checks and not monitors? A five-second check is twelve times the work of a one-minute one. Charging per monitor would price those the same — and it would stop a free account running a single fast check that costs no more than ten slow ones.",

    faqTag: "Frequently Asked Questions",
    faqTitle: "Everything You Need to Know",
    faqDesc: "Honest answers to common developer questions about UptimeMonke.",
    faq1Q: "Is UptimeMonke really free? Do I need a credit card?",
    faq1A:
      "Yes, completely free. Every account receives 14,400 checks every day forever, and no credit card is ever required.",
    faq2Q: "How is this different from UptimeRobot or competitors?",
    faq2A:
      "Traditional competitors restrict free tiers to 5-minute intervals and charge monthly subscriptions for SSL and cron monitoring. UptimeMonke provides sub-minute checks, SSL alerts, and cron heartbeats 100% free forever, funded only by optional coffee donations.",
    faq3Q: "Where are the monitoring probes dispatched from?",
    faq3A:
      "Probes originate from our dedicated worker fleet in AWS Lightsail Singapore (ap-southeast-1a). Keep-alive is deliberately disabled so we accurately measure cold-socket connection latency for first-time visitors.",
    faq4Q: "What happens if my workspace runs out of credit?",
    faq4A:
      "Nothing is ever deleted. If donated capacity is exhausted, a 7-day grace window opens before smoothly falling back to the permanent free tier of 14,400 checks/day. Your checks never stop.",
    faq5Q: "Can I create public status pages for my users?",
    faq5A:
      "Yes. Every workspace can publish a clean status page at /status/:slug featuring 90-day historical uptime bars and incident logs out of the box.",

    ctaTag: "Get Started Today",
    ctaTitle: "Ready to Never Miss an Outage Again?",
    ctaDesc:
      "Join developers keeping their critical websites, APIs, and microservices online. Set up your first monitor in under 30 seconds.",
    startFreeMonitoring: "Start Free Monitoring →",
    ctaFooterNotice: "14,400 checks/day free · No credit card required · Instant setup",

    footerTagline: "UptimeMonke · Fast, dependable infrastructure monitoring",
    backToTop: "Back to top ↑",

    authWelcomeBack: "Welcome back",
    authStartMonitoring: "Start monitoring in seconds",
    authResetPassword: "Reset password",
    authSubtitleSignIn: "Access your monitors, incidents, and public status pages.",
    authSubtitleSignUp: "14,400 free checks every single day forever. No credit card required.",
    authSubtitleReset: "Enter your email to receive password reset instructions.",
    authCreateAccountTab: "Create Account",
    authSignInTab: "Sign In",
    authOrContinueEmail: "Or continue with email",
    authYourName: "Your name",
    authWorkEmail: "Work email",
    authPassword: "Password",
    authForgotPassword: "Forgot password?",
    authCreateFreeAccountBtn: "Create Free Account →",
    authSignInDashboardBtn: "Sign In to Dashboard →",
    authSendResetBtn: "Send Reset Instructions",
    authProcessing: "Processing…",
    authNoAccountPrompt: "Don't have an account yet?",
    authSignUpFreeLink: "Sign up for free",
    authHaveAccountPrompt: "Already have an account?",
    authSignInLink: "Sign in here",
    authBackToSignIn: "← Back to sign in",
    pwdGreat: "Great password",
    pwdDecent: "Decent password",
    pwdTooShort: "Too short (min 6 characters)",

    // Dashboard Header & Navigation
    dashWorkspace: "Workspace",
    dashEditUsername: "Edit Username",
    dashChecksLeft: "checks left",
    dashBuyCoffee: "Buy me a coffee",
    dashAlerts: "Alerts",
    dashSignOut: "Sign out",
    dashSignedIn: "Signed in",

    // Dashboard Metrics & Status
    dashOverallUptime: "Overall Uptime (24h)",
    dashUpMonitors: "Up Monitors",
    dashDownMonitors: "Down Monitors",
    dashPausedMonitors: "Paused",
    dashAllOperational: "All systems operational",
    dashIncidentsActive: "incidents active",
    dashChecksToday: "checks today",
    dashFreeAllowance: "14.4k/day free",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "Search monitors by name or URL…",
    dashFilterAll: "All",
    dashFilterUp: "Up",
    dashFilterDown: "Down",
    dashFilterPaused: "Paused",
    dashNewMonitor: "New Monitor",

    // Dashboard Public Status Page
    dashStatusPageLive: "Public status page is live at",
    dashViewStatusPage: "View Status Page",

    // Dashboard Monitor Cards
    dashNeverChecked: "never checked",
    dashUptime30d: "30d uptime",
    dashCopyHeartbeat: "Copy ping URL",
    dashCopied: "Copied!",
    dashEdit: "Edit",
    dashPause: "Pause",
    dashResume: "Resume",
    dashDelete: "Delete",
    dashConfirmDelete: "Delete monitor?",
    dashStatusUp: "UP",
    dashStatusDown: "DOWN",
    dashStatusPending: "PENDING",
    dashStatusPaused: "PAUSED",
    dashMaintenance: "MAINTENANCE",
    dashCertExpired: "cert expired",
    dashCertExpiresToday: "cert expires today",
    dashCertExpiresTomorrow: "cert expires tomorrow",
    dashCertDays: "cert {days}d",

    // Dashboard Empty States
    dashNoMonitorsTitle: "No monitors yet",
    dashNoMonitorsDesc: "Get started by adding your first monitor.",
    dashAddFirstMonitor: "Add your first monitor",
    dashNoMatchingMonitors: "No monitors match your filter",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "Create New Monitor",
    formEditTitle: "Edit Monitor",
    formMonitorType: "Monitor Type",
    formFriendlyName: "Friendly Name",
    formFriendlyNamePlaceholder: "e.g. Production API",
    formTargetUrl: "URL to Monitor",
    formTargetHost: "Host / Domain",
    formTargetIp: "IP Address or Host",
    formPort: "Port",
    formInterval: "Monitoring Interval",
    formAlertContacts: "Alert Contacts",
    formSelectContacts: "Select who gets alerted",
    formAllContacts: "All verified contacts",
    formNoContactsNotice: "No verified contacts. Add one in Alerts.",
    formAdvancedOptions: "Advanced Options",
    formKeyword: "Expected Keyword",
    formKeywordPlaceholder: "Keyword or phrase that must appear in body",
    formInvertedKeyword: "Alert if keyword is present (inverted)",
    formCustomStatus: "Accepted HTTP Status Codes",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "Custom HTTP Headers",
    formRecordType: "DNS Record Type",
    formExpectedValue: "Expected DNS Value",
    formHeartbeatGrace: "Grace Period",
    formPublicStatus: "Public Status Page",
    formPublicStatusDesc: "Show this monitor on your public status page",
    formMuteAlerts: "Mute Alerts",
    formMuteAlertsDesc: "Do not send notifications when this monitor fails",
    formCreateBtn: "Create Monitor",
    formSaveBtn: "Save Changes",
    formCancelBtn: "Cancel",
    formCreating: "Creating…",
    formSaving: "Saving…",

    // Dashboard - Detail Modal
    detailTitle: "Monitor Details",
    detailTabOverview: "Overview",
    detailTabIncidents: "Incidents",
    detailTabResponseTime: "Response Time",
    detailTabSettings: "Settings",
    detailCurrentStatus: "Current Status",
    detailUptime: "Uptime",
    detailAvgResponse: "Avg Response Time",
    detailIncidentsRecorded: "Incident History",
    detailNoIncidents: "No incidents recorded in this timeframe",
    detailIncidentOngoing: "Ongoing Incident",
    detailIncidentResolved: "Resolved",
    detailIncidentDuration: "Duration",
    detailDeleteMonitor: "Delete this monitor",
    detailDeleteWarning:
      "This action cannot be undone. All check history and incidents will be permanently deleted.",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "Alert Contacts",
    contactsSubtitle: "Choose who gets notified when monitors go down",
    contactsAddNew: "Add Contact",
    contactsChannel: "Channel",
    contactsName: "Contact Name (optional)",
    contactsDestination: "Destination / Webhook URL",
    contactsAddBtn: "Add Contact",
    contactsVerified: "Verified",
    contactsPending: "Pending Confirmation",
    contactsResend: "Resend Link",
    contactsTestAlert: "Send Test Alert",
    contactsSending: "Sending…",
    contactsDelete: "Remove",
    contactsNoContacts: "No alert contacts configured yet.",

    // Dashboard - Org Settings Modal
    settingsTitle: "Workspace Settings",
    settingsWorkspaceName: "Workspace Name",
    settingsStatusPageTitle: "Public Status Page",
    settingsSlug: "Status Page URL Slug",
    settingsPageTitle: "Status Page Title",
    settingsPageDesc: "Status Page Description",
    settingsSave: "Save Changes",

    // Dashboard - Support Modal
    supportTitle: "Capacity & Donations",
    supportSubtitle: "UptimeMonke runs with zero subscriptions",
    supportUsedToday: "Used Checks Today",
    supportDailyBudget: "Daily Free Budget",
    supportRemainingCredit: "Remaining Donated Checks",
    supportBuyCoffee: "Buy me a coffee",
    supportDonateBtn: "Donate",

    // Dashboard - Profile Modal
    profileTitle: "Account & Profile",
    profileUsername: "Username",
    profileEmail: "Email Address",
    profileSave: "Update Profile",
    profileSaving: "Updating…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 AI App & API Gateway Monitoring",
    heroAiHeadline: "Monitor your AI app with UptimeMonke",
    heroAiSubtext: "Keep your LLM agents, OpenAI & Anthropic proxies, FastAPI backends, and web apps fast and available with sub-minute edge probes.",
    presetAiApi: "🤖 AI / LLM API",
    presetWebApp: "🌐 Web App",
    presetSsl: "🔒 SSL Certificate",
    presetHeartbeat: "⚡ Cron Job",
    onboardingJourneyTag: "Simple 3-Step Setup",
    onboardingJourneyTitle: "Up and running in less than 30 seconds",
    onboardingStep1: "1. Choose Target",
    onboardingStep1Desc: "Enter your AI endpoint, web API, SSL domain, or background cron worker.",
    onboardingStep2: "2. 1-Click Sign In",
    onboardingStep2Desc: "Instant authentication with Google or passwordless email. No credit card required.",
    onboardingStep3: "3. Real-Time Edge Checks",
    onboardingStep3Desc: "Our global probe fleet begins checking immediately, paging Slack, Discord, or Email if anything fails.",
    tabAi: "AI / LLM API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (TTFT SLA)",
    demoAiStatus: "Active Stream",
    onboardTitle: "Welcome to UptimeMonke",
    onboardSubtitle: "Complete these steps to set up high-reliability monitoring for your stack.",
    onboardStep1Title: "Create your first monitor",
    onboardStep1Desc: "Configure an AI inference endpoint, HTTP service, or background heartbeat.",
    onboardStep2Title: "Add alert contacts",
    onboardStep2Desc: "Connect Slack, Discord, Email, or Webhooks for immediate incident pages.",
    onboardStep3Title: "Publish your Status Page",
    onboardStep3Desc: "Give your users transparency with a public, real-time status page.",
    presetAiTitle: "AI App / LLM Gateway",
    presetAiDesc: "Monitors inference endpoints, streaming latency SLAs, and model availability.",
  },

  // ==========================================
  // CHINESE (简体中文)
  // ==========================================
  zh: {
    navFeatures: "功能特性",
    navDemo: "实时演示",
    navAlerts: "告警系统",
    navPricing: "用量与赞助",
    navFaq: "常见问题",
    probesLive: "探针运行中",
    logIn: "登录",
    startFree: "免费开始",
    dashboardBtn: "控制台",

    heroTag: "亚分钟级边缘探测 · 永久 100% 免费",
    heroTitle1: "守护您的网站与 API ",
    heroTitleHighlight: "稳定在线",
    heroTitle2: "。",
    heroDesc:
      "持续进行 HTTP、SSL 证书过期、TCP 与 Cron 心跳监控，具备亚分钟级检测频率，并在故障发生的第一时间向您发送多渠道即时告警。",
    heroPlaceholder: "输入您的网站或 API 地址 (例如 example.com)",
    heroStartBtn: "开始监控",
    continueWithGoogle: "使用 Google 继续",
    continueWithGithub: "使用 GitHub 继续",
    signUpWithEmail: "使用邮箱注册",
    heroConnecting: "连接中…",
    featureIntervals: "⚡ 60秒检测间隔",
    featureSsl: "🔒 免费 SSL 过期预警",
    featureNoCard: "🚫 无需信用卡",
    pillHttp: "HTTP(S) 与 API",
    pillSsl: "SSL 过期检测 (30天/14天/7天)",
    pillPing: "Ping (ICMP) 与 TCP",
    pillCron: "Cron 心跳检测",
    pillStatusPage: "公开状态页",

    demoTag: "交互式沙盒",
    demoTitle: "亲身体验 UptimeMonke 探针技术",
    demoDesc: "来自 AWS 新加坡边缘节点的实时探测，亚分钟级高敏分辨率。",
    tabHttp: "HTTP 与 API",
    tabSsl: "SSL 证书",
    tabPorts: "TCP 与 DNS",
    tabHeartbeat: "Cron 心跳",
    demoWorkerLocation: "工作节点: sg-1 (ap-southeast-1a)",
    demoUptime30d: "30天可用率: 99.99%",
    demoSslValid: "有效 (剩余 84 天)",
    demoSslExpiring: "4天后到期",
    demoPortOpen: "端口开放",
    demoResolved: "已解析",
    demoHealthy: "正常运行",
    demoLastPing: "上次心跳: 4分钟前 · 期望间隔: 24小时 · 容差: 30分钟",
    demoCronSnippet: "简单 Cron 集成示例:",

    alertsTag: "即时故障通知",
    alertsTitle: "在用户投诉之前掌控故障",
    alertsDesc: "通过您的工程团队日常使用的即时通讯工具第一时间触达通知。",
    alertDownTitle: "生产环境 API 发生故障",
    alertRecoveredTitle: "生产环境 API 已恢复正常",
    alertReason: "原因: HTTP 502 Bad Gateway (响应时间: 10,024 ms)",
    alertClosed: "状态: 200 OK (32 ms) · 事件已关闭。停机时长: 2分14秒。",

    whyTag: "专为开发者打造",
    whyTitle: "为什么选择 UptimeMonke",
    whyDesc:
      "没有虚设的功能付费墙，拒绝冗余的企业销售套路。专注于极速、可靠的基础设施监控。",
    why1Title: "亚分钟级边缘检测",
    why1Desc:
      "传统平台对免费账户限制 5 分钟检测间隔。UptimeMonke 开箱即享亚分钟级探测，故障即发即知。",
    why2Title: "防 SSRF 强化的云端探针",
    why2Desc:
      "内置严苛的 RFC1918 局域网防御、AWS IMDSv2 元数据防线和 DNS 重绑定防护，企业内网目标同样安全。",
    why3Title: "精美品牌公开状态页",
    why3Desc:
      "在 /status/:slug 即刻发布包含 90 天历史可用率条形图与实时事件流的状态页，对客户始终透明。",
    why4Title: "多渠道即时告警",
    why4Desc:
      "无痛推送告警至 Slack、Discord、Telegram、自定义 Webhook 及 Mailgun 邮件。严格验证联系人防骚扰。",

    pricingTag: "零订阅模式",
    pricingTitle: "没有付费套餐",
    pricingLede:
      "所有功能在免费账户上完全开放 — 包含所有探测类型、高频检测、公开状态页与告警。随心赞助仅用于扩充检测额度。",
    freeForeverLabel: "永久免费",
    checksPerDay: "次检测 / 每天",
    freeDesc:
      "10个1分钟监控，或50个5分钟监控，或1个6秒极速监控 — 它们的算力消耗相同，因而同样免费。",
    coffeeAddsLabel: "赞助一杯 $2.99 咖啡即可增加",
    checksUnit: "次检测",
    coffeeDesc:
      "约相当于 20 个 1 分钟监控整月运行，或 10 个 30 秒监控。未用完额度永久保留，无任何循环扣费。",
    buyCoffeeBtn: "请我喝杯咖啡",
    coffeeNotice: "请先登录，以便检测额度精准充入您的工作区。",
    ifCreditRunsOutLabel: "如果额度用完了",
    nothingDeletedFigure: "零删除",
    graceDesc:
      "享受 1 周的全额缓冲宽限期，之后无缝回归每日 14,400 次免费额度。监控全程不中断。",
    whyCapacityExplanation:
      "为什么按检测次数而非监控数计费？5秒检测的算力消耗是1分钟的12倍。按监控计费既不公平，也会限制免费账户使用高频监控。",

    faqTag: "常见问题",
    faqTitle: "解答您的所有疑问",
    faqDesc: "关于 UptimeMonke 开发者关心的真实解答。",
    faq1Q: "UptimeMonke 真的免费吗？需要信用卡吗？",
    faq1A:
      "完全免费。每个账户每天永久享有 14,400 次检测额度，注册和使用均无需绑定信用卡。",
    faq2Q: "它与 UptimeRobot 等传统工具有何不同？",
    faq2A:
      "传统工具将免费版严格锁在 5 分钟，SSL 告警和 Cron 还要高昂订阅。UptimeMonke 全功能免费开放，仅靠咖啡赞助维系容量。",
    faq3Q: "探针从哪里发出请求？",
    faq3A:
      "部署在 AWS 新加坡 (ap-southeast-1a)。我们主动关闭了 HTTP keep-alive，确保测出真实访客的握手与延迟。",
    faq4Q: "赞助的额度消耗完了会停机吗？",
    faq4A:
      "绝不删除任何监控。您有 7 天宽限期，随后自动平滑回归每日 14,400 次免费基础额度继续运行。",
    faq5Q: "可以为用户建立公开状态页吗？",
    faq5A:
      "可以。在 /status/:slug 上即可生成包含 90 天运行历史条和事件历史的公开状态页，开箱即用。",

    ctaTag: "立即开始",
    ctaTitle: "准备好杜绝无声的停机事故了吗？",
    ctaDesc:
      "加入全球开发者的行列，让关键网站与 API 随时处于严密保护之下。只需 30 秒即可完成设置。",
    startFreeMonitoring: "开始免费监控 →",
    ctaFooterNotice: "每天 14,400 次免费检测 · 无需信用卡 · 立即生效",

    footerTagline: "UptimeMonke · 极速、可靠的基础设施与网站监控平台",
    backToTop: "返回顶部 ↑",

    authWelcomeBack: "欢迎回来",
    authStartMonitoring: "数秒内开启全天候监控",
    authResetPassword: "重置密码",
    authSubtitleSignIn: "查看并管理您的监控器、事故记录与公开状态页。",
    authSubtitleSignUp: "每天永久享有 14,400 次免费检测额度，无需信用卡。",
    authSubtitleReset: "输入您的注册邮箱，我们将向您发送密码重置链接。",
    authCreateAccountTab: "注册账户",
    authSignInTab: "登录",
    authOrContinueEmail: "或使用邮箱继续",
    authYourName: "您的姓名",
    authWorkEmail: "工作邮箱",
    authPassword: "密码",
    authForgotPassword: "忘记密码？",
    authCreateFreeAccountBtn: "创建免费账户 →",
    authSignInDashboardBtn: "进入控制台 →",
    authSendResetBtn: "发送重置邮件",
    authProcessing: "处理中…",
    authNoAccountPrompt: "还没有账户？",
    authSignUpFreeLink: "免费注册",
    authHaveAccountPrompt: "已有账户？",
    authSignInLink: "点此登录",
    authBackToSignIn: "← 返回登录",
    pwdGreat: "密码强度极佳",
    pwdDecent: "密码强度良好",
    pwdTooShort: "密码过短 (至少 6 位)",

    // Dashboard Header & Navigation
    dashWorkspace: "工作区",
    dashEditUsername: "修改用户名",
    dashChecksLeft: "次剩余检测",
    dashBuyCoffee: "请我喝杯咖啡",
    dashAlerts: "告警通知",
    dashSignOut: "退出登录",
    dashSignedIn: "已登录",

    // Dashboard Metrics & Status
    dashOverallUptime: "整体可用率 (24小时)",
    dashUpMonitors: "正常监控器",
    dashDownMonitors: "故障监控器",
    dashPausedMonitors: "已暂停",
    dashAllOperational: "所有监控系统运行正常",
    dashIncidentsActive: "起活跃事件",
    dashChecksToday: "次今日检测",
    dashFreeAllowance: "每天1.44万次免费",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "按名称或 URL 搜索监控器…",
    dashFilterAll: "全部",
    dashFilterUp: "正常",
    dashFilterDown: "故障",
    dashFilterPaused: "已暂停",
    dashNewMonitor: "新建监控",

    // Dashboard Public Status Page
    dashStatusPageLive: "公开状态页已发布于",
    dashViewStatusPage: "查看状态页",

    // Dashboard Monitor Cards
    dashNeverChecked: "从未检测",
    dashUptime30d: "30天可用率",
    dashCopyHeartbeat: "复制 Ping URL",
    dashCopied: "已复制！",
    dashEdit: "编辑",
    dashPause: "暂停",
    dashResume: "恢复",
    dashDelete: "删除",
    dashConfirmDelete: "确定删除此监控器？",
    dashStatusUp: "正常",
    dashStatusDown: "故障",
    dashStatusPending: "检测中",
    dashStatusPaused: "已暂停",
    dashMaintenance: "维护中",
    dashCertExpired: "证书已过期",
    dashCertExpiresToday: "证书今天到期",
    dashCertExpiresTomorrow: "证书明天到期",
    dashCertDays: "证书剩余 {days} 天",

    // Dashboard Empty States
    dashNoMonitorsTitle: "暂无监控项目",
    dashNoMonitorsDesc: "添加您的第一个监控项目以开启严密守护。",
    dashAddFirstMonitor: "添加首个监控",
    dashNoMatchingMonitors: "没有符合筛选条件的监控器",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "创建新监控",
    formEditTitle: "编辑监控",
    formMonitorType: "监控类型",
    formFriendlyName: "监控名称",
    formFriendlyNamePlaceholder: "例如: 生产环境 API",
    formTargetUrl: "监控目标 URL",
    formTargetHost: "主机名 / 域名",
    formTargetIp: "IP 地址或主机",
    formPort: "端口",
    formInterval: "检测间隔",
    formAlertContacts: "告警联系人",
    formSelectContacts: "选择故障时通知的对象",
    formAllContacts: "所有已验证联系人",
    formNoContactsNotice: "暂无已验证联系人，请在告警设置中添加。",
    formAdvancedOptions: "高级选项",
    formKeyword: "期望关键字",
    formKeywordPlaceholder: "响应正文中必须包含的文本或短语",
    formInvertedKeyword: "反向告警（当文本出现时告警）",
    formCustomStatus: "允许的 HTTP 状态码",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "自定义 HTTP 请求头",
    formRecordType: "DNS 记录类型",
    formExpectedValue: "期望解析值",
    formHeartbeatGrace: "容差时间",
    formPublicStatus: "公开状态页",
    formPublicStatusDesc: "在您的公开状态页上展示此监控器",
    formMuteAlerts: "静音告警",
    formMuteAlertsDesc: "此监控器故障时不发送任何告警通知",
    formCreateBtn: "创建监控",
    formSaveBtn: "保存修改",
    formCancelBtn: "取消",
    formCreating: "正在创建…",
    formSaving: "正在保存…",

    // Dashboard - Detail Modal
    detailTitle: "监控详情",
    detailTabOverview: "概览",
    detailTabIncidents: "事件记录",
    detailTabResponseTime: "响应延迟",
    detailTabSettings: "设置",
    detailCurrentStatus: "当前状态",
    detailUptime: "可用率",
    detailAvgResponse: "平均响应延迟",
    detailIncidentsRecorded: "故障事件历史",
    detailNoIncidents: "此时间范围内无故障记录",
    detailIncidentOngoing: "持续中故障",
    detailIncidentResolved: "已恢复",
    detailIncidentDuration: "持续时长",
    detailDeleteMonitor: "删除此监控器",
    detailDeleteWarning:
      "此操作无法撤销。该监控器的所有历史检测数据和事件记录都将被永久删除。",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "告警联系人",
    contactsSubtitle: "选择当监控发生故障时接收通知的渠道与人员",
    contactsAddNew: "添加联系人",
    contactsChannel: "通知渠道",
    contactsName: "联系人备注（可选）",
    contactsDestination: "接收地址 / Webhook URL",
    contactsAddBtn: "添加联系人",
    contactsVerified: "已验证",
    contactsPending: "等待验证",
    contactsResend: "重发验证链接",
    contactsTestAlert: "发送测试告警",
    contactsSending: "发送中…",
    contactsDelete: "移除",
    contactsNoContacts: "尚未配置任何告警联系人。",

    // Dashboard - Org Settings Modal
    settingsTitle: "工作区设置",
    settingsWorkspaceName: "工作区名称",
    settingsStatusPageTitle: "公开状态页",
    settingsSlug: "状态页 URL 标识 (Slug)",
    settingsPageTitle: "状态页主标题",
    settingsPageDesc: "状态页副标题描述",
    settingsSave: "保存修改",

    // Dashboard - Support Modal
    supportTitle: "用量额度与赞助",
    supportSubtitle: "UptimeMonke 坚持零订阅，以纯粹用量驱动",
    supportUsedToday: "今日已用检测",
    supportDailyBudget: "每日免费额度",
    supportRemainingCredit: "剩余赞助检测额度",
    supportBuyCoffee: "请我喝杯咖啡",
    supportDonateBtn: "赞助",

    // Dashboard - Profile Modal
    profileTitle: "个人资料与账户",
    profileUsername: "用户名",
    profileEmail: "电子邮箱",
    profileSave: "更新个人资料",
    profileSaving: "正在更新…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 AI 应用与大模型 API 网关监控",
    heroAiHeadline: "用 UptimeMonke 全面监控你的 AI 应用",
    heroAiSubtext: "为你的 LLM 智能体、OpenAI/Claude 代理网关、FastAPI 后端及 Web 应用提供秒级边缘探针检测与实时故障告警。",
    presetAiApi: "🤖 AI / 大模型 API",
    presetWebApp: "🌐 网站应用",
    presetSsl: "🔒 SSL 证书",
    presetHeartbeat: "⚡ Cron 心跳",
    onboardingJourneyTag: "极简 3 步即可就绪",
    onboardingJourneyTitle: "30 秒内轻松上线监控",
    onboardingStep1: "1. 填入监控目标",
    onboardingStep1Desc: "输入你的 AI 接口、API 服务、SSL 域名或后台定时任务。",
    onboardingStep2: "2. 一键免密登录",
    onboardingStep2Desc: "支持 Google 或邮箱一键登录，完全免费，无需绑定信用卡。",
    onboardingStep3: "3. 开启实时边缘探测",
    onboardingStep3Desc: "全球探针机群立即开始巡检，异常秒级推送至飞书/Slack/Discord/邮件。",
    tabAi: "AI / 大模型 API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (首字耗时 SLA)",
    demoAiStatus: "流式推理正常",
    onboardTitle: "欢迎使用 UptimeMonke",
    onboardSubtitle: "完成以下设置，为你的应用与服务开启高可用监控。",
    onboardStep1Title: "创建第一个监控器",
    onboardStep1Desc: "配置 AI 推理接口、HTTP 网站或后台定时任务心跳。",
    onboardStep2Title: "添加告警联系渠道",
    onboardStep2Desc: "配置 Slack、Discord、邮件或 Webhook，以便故障时秒级响应。",
    onboardStep3Title: "发布公开状态页",
    onboardStep3Desc: "生成实时透明的服务公开状态页，提升用户与团队信任度。",
    presetAiTitle: "AI 应用 / 大模型网关",
    presetAiDesc: "监控模型推理接口、流式延迟 SLA 与可用性状态。",
  },

  // ==========================================
  // JAPANESE (日本語)
  // ==========================================
  ja: {
    navFeatures: "機能",
    navDemo: "ライブデモ",
    navAlerts: "アラート",
    navPricing: "料金",
    navFaq: "よくある質問",
    probesLive: "プローブ稼働中",
    logIn: "ログイン",
    startFree: "無料で始める",
    dashboardBtn: "ダッシュボード",

    heroTag: "1分未満のエッジ監視 · 完全永久無料",
    heroTitle1: "WebサイトとAPIを常に",
    heroTitleHighlight: "オンライン",
    heroTitle2: "に維持します。",
    heroDesc:
      "HTTP、SSL証明書有効期限、TCP ping、cronハートビートを1分未満間隔で継続監視。ユーザーがダウンタイムに気づく前にマルチチャネルで即座に通知します。",
    heroPlaceholder: "WebサイトまたはAPIのURL (例: example.com)",
    heroStartBtn: "監視を開始",
    continueWithGoogle: "Googleで続ける",
    continueWithGithub: "GitHubで続ける",
    signUpWithEmail: "メールアドレスで登録",
    heroConnecting: "接続中…",
    featureIntervals: "⚡ 60秒チェック間隔",
    featureSsl: "🔒 SSL期限切れ無料通知",
    featureNoCard: "🚫 クレジットカード不要",
    pillHttp: "HTTP(S) & API監視",
    pillSsl: "SSL期限 (30日/14日/7日)",
    pillPing: "Ping (ICMP) & TCP",
    pillCron: "Cronハートビート",
    pillStatusPage: "公開ステータスページ",

    demoTag: "インタラクティブ・サンドボックス",
    demoTitle: "スタックを監視する仕組み",
    demoDesc: "AWS Lightsailシンガポールから1分未満の高精度でリアルタイムプローブを実行します。",
    tabHttp: "HTTP & API",
    tabSsl: "SSL証明書",
    tabPorts: "TCP & DNS",
    tabHeartbeat: "Cronハートビート",
    demoWorkerLocation: "ワーカー: sg-1 (ap-southeast-1a)",
    demoUptime30d: "30日間稼働率: 99.99%",
    demoSslValid: "有効 (残り84日)",
    demoSslExpiring: "4日後に失効",
    demoPortOpen: "ポート開放中",
    demoResolved: "解決完了",
    demoHealthy: "正常",
    demoLastPing: "最終Ping: 4分前 · 期待間隔: 24時間 · 許容枠: 30分",
    demoCronSnippet: "シンプルなCron連携:",

    alertsTag: "即時インシデント通知",
    alertsTitle: "顧客からのクレーム前にチームへ即時警告",
    alertsDesc: "エンジニアリングチームが普段使うツールへ遅延ゼロでアラートを配信します。",
    alertDownTitle: "本番APIがダウンしています",
    alertRecoveredTitle: "本番APIが復旧しました",
    alertReason: "理由: HTTP 502 Bad Gateway (応答時間: 10,024 ms)",
    alertClosed: "ステータス: 200 OK (32 ms) · インシデント解決。ダウンタイム: 2分14秒",

    whyTag: "開発者のために設計",
    whyTitle: "UptimeMonkeが選ばれる理由",
    whyDesc: "人為的な課金障壁や無駄な法人契約は不要。迅速で信頼できるインフラ監視を提供します。",
    why1Title: "1分未満のエッジ監視",
    why1Desc: "従来の監視ツールは無料枠を5分間隔に制限しています。UptimeMonkeは最初から1分未満の高速チェックが可能で、障害を即座に検知します。",
    why2Title: "SSRF対策済みの堅牢なクラウド",
    why2Desc: "RFC1918プライベート保護、AWS IMDSv2メタデータ攻撃防止、DNSリバインディングガードを標準装備。社内システム監視も安全です。",
    why3Title: "カスタム公開ステータスページ",
    why3Desc: "/status/:slug で90日間の稼働履歴バーとリアルタイム障害情報を含むステータスページを公開できます。障害時も顧客の信頼を保ちます。",
    why4Title: "マルチチャネル通知",
    why4Desc: "Slack、Discord、Telegram、Webhook、メールに即時配信。検証済み連絡先機能でアラートのなりすましを防ぎます。",

    pricingTag: "サブスクリプション不要",
    pricingTitle: "有料プランはありません",
    pricingLede: "すべての機能が無料アカウントで利用可能。任意の寄付はサーバーリソースを消費する「キャパシティ（実行回数）」にのみ充当されます。",
    freeForeverLabel: "永久無料",
    checksPerDay: "回/日のチェック",
    freeDesc: "1分間隔なら10台。5分間隔なら50台。6秒間隔なら1台。計算負荷は全く同じなので、すべて無料です。",
    coffeeAddsLabel: "$2.99のコーヒー1杯で追加",
    checksUnit: "回のチェック",
    coffeeDesc: "20台を1分間隔で約1ヶ月分。未使用の枠は繰り越され、月額課金はありません。少なくなったら追加するだけです。",
    buyCoffeeBtn: "コーヒーをおごる",
    coffeeNotice: "クレジットを確実に付与するため、先にサインインしてください。",
    ifCreditRunsOutLabel: "クレジットがなくなっても",
    nothingDeletedFigure: "削除なし",
    graceDesc: "全機能が使える7日間の猶予期間後、1日14,400回の無料枠に自動移行。監視が止まることはありません。",
    whyCapacityExplanation: "なぜモニター数ではなくチェック数なのか？5秒チェックは1分チェックの12倍の負荷です。モニター単位課金では不公平が生じるため、実行回数に応じた合理的な仕組みにしています。",

    faqTag: "よくある質問",
    faqTitle: "疑問にお答えします",
    faqDesc: "UptimeMonkeに関する開発者の疑問への誠実な回答です。",
    faq1Q: "本当に無料ですか？クレジットカードは必要ですか？",
    faq1A: "はい！すべてのアカウントに毎日永久に14,400回の無料チェックが付与されます。クレジットカード登録は一切不要です。",
    faq2Q: "従来のUptimeRobot等のツールとの違いは何ですか？",
    faq2A: "従来のサービスは無料枠を5分間隔に制限し、SSL通知やCronハートビートを有料化しています。UptimeMonkeはこれらをすべて無料枠で提供し、月額課金ではなく単発のコーヒー寄付で運営されています。",
    faq3Q: "監視プローブはどこから送信されますか？",
    faq3A: "AWS Lightsailシンガポールリージョン（ap-southeast-1a）から送信されます。HTTP Keep-Aliveを無効化し、実際の訪問者が体験する初回収束時間（DNS+TCP+TLS）を正確に計測します。",
    faq4Q: "寄付したクレジットが切れたらどうなりますか？",
    faq4A: "監視対象が勝手に削除されたり停止することはありません。7日間の猶予期間の後、自動的に毎日14,400回の無料枠へスムーズに移行します。",
    faq5Q: "顧客向けの公開ステータスページは作れますか？",
    faq5A: "はい。/status/:slug ですぐに共有可能なステータスページを作成できます。90日間の稼働バーとインシデント履歴を安全に公開できます。",

    ctaTag: "今すぐ始めましょう",
    ctaTitle: "検知できないダウンタイムをゼロにしませんか？",
    ctaDesc: "大切なWebアプリとAPIを保護するエンジニアの輪に参加しましょう。設定は30秒以内で完了します。",
    startFreeMonitoring: "無料で監視を始める →",
    ctaFooterNotice: "毎日14,400回の無料チェック · クレジットカード不要 · 即時セットアップ",

    footerTagline: "UptimeMonke · 軽量で堅牢なインフラストラクチャ監視",
    backToTop: "ページ上部へ戻る ↑",

    authWelcomeBack: "おかえりなさい",
    authStartMonitoring: "数秒で監視を開始",
    authResetPassword: "パスワードの再設定",
    authSubtitleSignIn: "モニター、インシデント、ステータスページにアクセス。",
    authSubtitleSignUp: "毎日14,400回チェック無料。クレジットカード不要。",
    authSubtitleReset: "登録したメールアドレスを入力して再設定リンクを受信します。",
    authCreateAccountTab: "アカウント作成",
    authSignInTab: "サインイン",
    authOrContinueEmail: "またはメールアドレスで継続",
    authYourName: "お名前",
    authWorkEmail: "メールアドレス",
    authPassword: "パスワード",
    authForgotPassword: "パスワードをお忘れですか？",
    authCreateFreeAccountBtn: "無料アカウントを作成 →",
    authSignInDashboardBtn: "ダッシュボードにサインイン →",
    authSendResetBtn: "再設定案内を送信",
    authProcessing: "処理中…",
    authNoAccountPrompt: "アカウントをお持ちでないですか？",
    authSignUpFreeLink: "無料で新規登録",
    authHaveAccountPrompt: "すでにアカウントをお持ちですか？",
    authSignInLink: "ログインはこちら",
    authBackToSignIn: "← ログイン画面に戻る",
    pwdGreat: "強力なパスワードです",
    pwdDecent: "良好なパスワードです",
    pwdTooShort: "短すぎます（最低6文字）",

    // Dashboard Header & Navigation
    dashWorkspace: "ワークスペース",
    dashEditUsername: "ユーザー名を編集",
    dashChecksLeft: "回分残存",
    dashBuyCoffee: "コーヒーをおごる",
    dashAlerts: "アラート",
    dashSignOut: "ログアウト",
    dashSignedIn: "ログイン中",

    // Dashboard Metrics & Status
    dashOverallUptime: "全体稼働率 (24時間)",
    dashUpMonitors: "稼働中",
    dashDownMonitors: "停止中",
    dashPausedMonitors: "一時停止中",
    dashAllOperational: "すべてのシステムが正常稼働中",
    dashIncidentsActive: "件の障害発生中",
    dashChecksToday: "回本日チェック",
    dashFreeAllowance: "1日14,400回無料",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "名前またはURLでモニターを検索…",
    dashFilterAll: "すべて",
    dashFilterUp: "稼働中",
    dashFilterDown: "停止中",
    dashFilterPaused: "一時停止中",
    dashNewMonitor: "新規モニター",

    // Dashboard Public Status Page
    dashStatusPageLive: "公開ステータスページ公開中:",
    dashViewStatusPage: "ステータスページを表示",

    // Dashboard Monitor Cards
    dashNeverChecked: "未チェック",
    dashUptime30d: "30日稼働率",
    dashCopyHeartbeat: "Ping用URLをコピー",
    dashCopied: "コピー完了！",
    dashEdit: "編集",
    dashPause: "一時停止",
    dashResume: "再開",
    dashDelete: "削除",
    dashConfirmDelete: "このモニターを削除しますか？",
    dashStatusUp: "稼働中",
    dashStatusDown: "停止中",
    dashStatusPending: "待機中",
    dashStatusPaused: "一時停止中",
    dashMaintenance: "メンテナンス中",
    dashCertExpired: "証明書期限切れ",
    dashCertExpiresToday: "証明書本日失効",
    dashCertExpiresTomorrow: "証明書明日失効",
    dashCertDays: "証明書あと{days}日",

    // Dashboard Empty States
    dashNoMonitorsTitle: "モニターがありません",
    dashNoMonitorsDesc: "最初のモニターを追加して監視を開始しましょう。",
    dashAddFirstMonitor: "最初のモニターを追加",
    dashNoMatchingMonitors: "条件に一致するモニターがありません",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "新規モニター作成",
    formEditTitle: "モニター編集",
    formMonitorType: "監視タイプ",
    formFriendlyName: "モニター名",
    formFriendlyNamePlaceholder: "例: 本番環境API",
    formTargetUrl: "監視URL",
    formTargetHost: "ホスト / ドメイン",
    formTargetIp: "IPアドレスまたはホスト",
    formPort: "ポート番号",
    formInterval: "監視間隔",
    formAlertContacts: "アラート連絡先",
    formSelectContacts: "障害通知先を選択",
    formAllContacts: "すべての確認済み連絡先",
    formNoContactsNotice: "確認済み連絡先がありません。アラート設定から追加してください。",
    formAdvancedOptions: "詳細オプション",
    formKeyword: "期待するキーワード",
    formKeywordPlaceholder: "レスポンス本文に含まれるべき文字列",
    formInvertedKeyword: "反転検知（文字列が存在する場合にアラート）",
    formCustomStatus: "許容HTTPステータスコード",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "カスタムHTTPヘッダー",
    formRecordType: "DNSレコードタイプ",
    formExpectedValue: "期待するDNS値",
    formHeartbeatGrace: "猶予期間",
    formPublicStatus: "公開ステータスページ",
    formPublicStatusDesc: "公開ステータスページにこのモニターを表示する",
    formMuteAlerts: "アラート消音",
    formMuteAlertsDesc: "このモニターの障害発生時に通知を送信しない",
    formCreateBtn: "モニターを作成",
    formSaveBtn: "変更を保存",
    formCancelBtn: "キャンセル",
    formCreating: "作成中…",
    formSaving: "保存中…",

    // Dashboard - Detail Modal
    detailTitle: "モニター詳細",
    detailTabOverview: "概要",
    detailTabIncidents: "インシデント",
    detailTabResponseTime: "応答時間",
    detailTabSettings: "設定",
    detailCurrentStatus: "現在の状態",
    detailUptime: "稼働率",
    detailAvgResponse: "平均応答時間",
    detailIncidentsRecorded: "インシデント履歴",
    detailNoIncidents: "この期間のインシデントはありません",
    detailIncidentOngoing: "発生中のインシデント",
    detailIncidentResolved: "復旧済み",
    detailIncidentDuration: "停止時間",
    detailDeleteMonitor: "このモニターを削除",
    detailDeleteWarning: "この操作は取り消せません。すべてのチェック履歴とインシデントが完全に削除されます。",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "アラート連絡先",
    contactsSubtitle: "モニター停止時に通知を受け取る連絡先を選択",
    contactsAddNew: "連絡先を追加",
    contactsChannel: "通知チャンネル",
    contactsName: "連絡先名（任意）",
    contactsDestination: "送信先 / Webhook URL",
    contactsAddBtn: "連絡先を追加",
    contactsVerified: "確認済み",
    contactsPending: "確認待ち",
    contactsResend: "リンク再送",
    contactsTestAlert: "テスト通知送信",
    contactsSending: "送信中…",
    contactsDelete: "削除",
    contactsNoContacts: "アラート連絡先がまだ設定されていません。",

    // Dashboard - Org Settings Modal
    settingsTitle: "ワークスペース設定",
    settingsWorkspaceName: "ワークスペース名",
    settingsStatusPageTitle: "公開ステータスページ",
    settingsSlug: "ステータスページURLスラッグ",
    settingsPageTitle: "ステータスページタイトル",
    settingsPageDesc: "ステータスページ説明",
    settingsSave: "変更を保存",

    // Dashboard - Support Modal
    supportTitle: "容量と寄付",
    supportSubtitle: "UptimeMonkeはサブスクリプションなしで運営されています",
    supportUsedToday: "本日の使用チェック数",
    supportDailyBudget: "1日の無料枠",
    supportRemainingCredit: "残存寄付チェック数",
    supportBuyCoffee: "コーヒーをおごる",
    supportDonateBtn: "寄付する",

    // Dashboard - Profile Modal
    profileTitle: "アカウントとプロフィール",
    profileUsername: "ユーザー名",
    profileEmail: "メールアドレス",
    profileSave: "プロフィールを更新",
    profileSaving: "更新中…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 AIアプリ＆APIゲートウェイ監視",
    heroAiHeadline: "UptimeMonkeでAIアプリを確実に監視",
    heroAiSubtext: "LLMエージェント、OpenAI/Anthropicプロキシ、FastAPIバックエンド、Webアプリを秒単位のエッジプローブで監視します。",
    presetAiApi: "🤖 AI / LLM API",
    presetWebApp: "🌐 Webアプリ",
    presetSsl: "🔒 SSL証明書",
    presetHeartbeat: "⚡ Cronハートビート",
    onboardingJourneyTag: "簡単3ステップ",
    onboardingJourneyTitle: "30秒以内に監視を開始",
    onboardingStep1: "1. 監視対象を入力",
    onboardingStep1Desc: "AIエンドポイント、Web API、SSLドメイン、Cronジョブを入力します。",
    onboardingStep2: "2. 1クリックログイン",
    onboardingStep2Desc: "Googleまたはメールで即座にサインイン。クレジットカード不要。",
    onboardingStep3: "3. リアルタイム監視",
    onboardingStep3Desc: "エッジワーカーが即時チェックを開始し、障害発生時にSlackやDiscordに通知します。",
    tabAi: "AI / LLM API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (TTFT SLA)",
    demoAiStatus: "ストリーミング正常",
    onboardTitle: "UptimeMonkeへようこそ",
    onboardSubtitle: "ステップを完了して、スタックの高信頼性監視を設定しましょう。",
    onboardStep1Title: "最初のモニターを作成",
    onboardStep1Desc: "AI推論エンドポイント、HTTPサービス、またはCronを設定します。",
    onboardStep2Title: "アラート連絡先を追加",
    onboardStep2Desc: "Slack、Discord、メール、またはWebhookに接続します。",
    onboardStep3Title: "ステータスページを公開",
    onboardStep3Desc: "リアルタイムの公開ステータスページで透明性を提供します。",
    presetAiTitle: "AIアプリ / LLMゲートウェイ",
    presetAiDesc: "推論エンドポイント、ストリーミングSLA、モデルの可用性を監視。",
  },

  // ==========================================
  // KOREAN (한국어)
  // ==========================================
  ko: {
    navFeatures: "기능",
    navDemo: "라이브 데모",
    navAlerts: "알림",
    navPricing: "요금제",
    navFaq: "자주 묻는 질문",
    probesLive: "프로브 작동 중",
    logIn: "로그인",
    startFree: "무료로 시작하기",
    dashboardBtn: "대시보드",

    heroTag: "1분 미만 엣지 모니터링 · 영구 완전 무료",
    heroTitle1: "웹사이트와 API를 언제나 ",
    heroTitleHighlight: "온라인",
    heroTitle2: " 상태로 유지하세요.",
    heroDesc:
      "HTTP, SSL 인증서 만료, TCP 핑, cron 하트비트를 1분 미만 주기로 지속 모니터링합니다. 사용자가 장애를 알아채기 전에 멀티채널로 즉각 알림을 전송합니다.",
    heroPlaceholder: "웹사이트 또는 API 주소 입력 (예: example.com)",
    heroStartBtn: "모니터링 시작",
    continueWithGoogle: "Google 계정으로 계속하기",
    continueWithGithub: "GitHub 계정으로 계속하기",
    signUpWithEmail: "이메일로 회원가입",
    heroConnecting: "연결 중…",
    featureIntervals: "⚡ 60초 점검 주기",
    featureSsl: "🔒 무료 SSL 만료 알림",
    featureNoCard: "🚫 신용카드 필요 없음",
    pillHttp: "HTTP(S) 및 API",
    pillSsl: "SSL 만료 (30일/14일/7일)",
    pillPing: "핑(ICMP) 및 TCP",
    pillCron: "Cron 하트비트",
    pillStatusPage: "공개 상태 페이지",

    demoTag: "인터랙티브 샌드박스",
    demoTitle: "인프라를 프로빙하는 방식 확인하기",
    demoDesc: "AWS Lightsail 싱가포르 리전에서 1분 미만 정밀도로 실시간 엣지 프로브를 발송합니다.",
    tabHttp: "HTTP 및 API",
    tabSsl: "SSL 인증서",
    tabPorts: "TCP 및 DNS",
    tabHeartbeat: "Cron 하트비트",
    demoWorkerLocation: "워커: sg-1 (ap-southeast-1a)",
    demoUptime30d: "30일 가동률: 99.99%",
    demoSslValid: "유효 (84일 남음)",
    demoSslExpiring: "4일 후 만료",
    demoPortOpen: "포트 열림",
    demoResolved: "해석 완료",
    demoHealthy: "정상",
    demoLastPing: "마지막 핑: 4분 전 · 주기: 24시간 · 유예: 30분",
    demoCronSnippet: "간편한 Cron 연동:",

    alertsTag: "실시간 장애 알림",
    alertsTitle: "고객이 불평하기 전에 팀에 즉각 알림 전송",
    alertsDesc: "엔지니어링 팀이 이미 사용하는 협업 도구로 지연 없이 알림을 발송합니다.",
    alertDownTitle: "운영 API가 다운되었습니다",
    alertRecoveredTitle: "운영 API가 정상 복구되었습니다",
    alertReason: "원인: HTTP 502 Bad Gateway (응답 시간: 10,024 ms)",
    alertClosed: "상태: 200 OK (32 ms) · 장애 종료. 총 장애 시간: 2분 14초",

    whyTag: "개발자를 위한 설계",
    whyTitle: "개발팀이 UptimeMonke를 선택하는 이유",
    whyDesc: "인위적인 유료 제한이나 복잡한 기업 계약 없음. 빠르고 신뢰할 수 있는 모니터링을 제공합니다.",
    why1Title: "1분 미만 엣지 점검",
    why1Desc: "기존 서비스는 무료 계정을 5분 간격으로 제한합니다. UptimeMonke는 기본적으로 1분 미만 점검을 제공하여 장애를 즉각 감지합니다.",
    why2Title: "SSRF 방어 클라우드 플릿",
    why2Desc: "RFC1918 사설망 보호, AWS IMDSv2 메타데이터 공격 방지 및 DNS 리바인딩 가드를 탑재하여 사내망 주소도 안전하게 모니터링합니다.",
    why3Title: "브랜드 맞춤 공개 상태 페이지",
    why3Desc: "/status/:slug 주소로 90일 가동 기록 바와 실시간 장애 현황을 제공하는 깔끔한 상태 페이지를 게시할 수 있습니다.",
    why4Title: "멀티채널 알림 전송",
    why4Desc: "Slack, Discord, Telegram, Webhook, 이메일로 손쉽게 전송. 인증된 연락처 체계로 알림 위조를 원천 차단합니다.",

    pricingTag: "구독료 없음",
    pricingTitle: "유료 플랜이 없습니다",
    pricingLede: "모든 기능이 무료 계정에서 작동합니다. 자발적 후원은 서버 리소스를 사용하는 '실행 용량'에만 적용됩니다.",
    freeForeverLabel: "평생 무료",
    checksPerDay: "일일 점검 횟수",
    freeDesc: "1분 주기 10개, 5분 주기 50개, 6초 주기 1개 — 서버 연산 부하가 동일하므로 모두 동일하게 무료입니다.",
    coffeeAddsLabel: "$2.99 커피 한 잔으로 추가",
    checksUnit: "회 점검 추가",
    coffeeDesc: "20개 모니터를 1분 주기로 한 달 동안 실행 가능한 용량. 미사용 용량은 소멸되지 않고 이월됩니다.",
    buyCoffeeBtn: "커피 한 잔 후원하기",
    coffeeNotice: "용량이 계정에 정상 반영되도록 먼저 로그인해 주세요.",
    ifCreditRunsOutLabel: "크레딧이 소진되어도",
    nothingDeletedFigure: "삭제되지 않음",
    graceDesc: "7일간의 풀 서비스 유예 기간 후, 일일 14,400회 무료 제공량으로 안전하게 자동 전환됩니다.",
    whyCapacityExplanation: "왜 모니터 개수가 아닌 점검 횟수인가요? 5초 점검은 1분 점검보다 12배 많은 부하를 발생시킵니다. 실행 횟수 기반 요금제가 가장 공정합니다.",

    faqTag: "자주 묻는 질문",
    faqTitle: "궁금한 모든 것",
    faqDesc: "UptimeMonke에 대해 자주 묻는 질문에 대한 정직한 답변입니다.",
    faq1Q: "정말 무료인가요? 신용카드가 필요한가요?",
    faq1A: "네! 모든 계정에 매일 14,400회의 점검이 평생 무료로 제공됩니다. 신용카드 정보는 절대 요구하지 않습니다.",
    faq2Q: "UptimeRobot 같은 기존 도구와 어떻게 다른가요?",
    faq2A: "기존 서비스는 무료 계정을 5분 간격으로 제한하고 SSL 경고나 Cron 하트비트를 월 구독 뒤에 숨겨둡니다. UptimeMonke는 이를 무료로 제공하며 일회성 커피 후원으로 운영됩니다.",
    faq3Q: "모니터링 프로브는 어디서 발송되나요?",
    faq3A: "AWS Lightsail 싱가포르 리전(ap-southeast-1a)에서 발송됩니다. HTTP Keep-Alive를 끄고 실제 방문자가 겪는 첫 패킷 연결 속도(DNS+TCP+TLS)를 정밀 측정합니다.",
    faq4Q: "후원한 크레딧이 다 떨어지면 어떻게 되나요?",
    faq4A: "모니터가 일방적으로 삭제되거나 중단되지 않습니다. 7일 유예 기간 후 일일 14,400회 무료 기본 혜택으로 매끄럽게 돌아갑니다.",
    faq5Q: "고객에게 공개할 상태 페이지를 만들 수 있나요?",
    faq5A: "네. /status/:slug 주소로 즉시 공유 가능한 상태 페이지가 제공됩니다. 90일 가동률과 사고 기록을 안전하게 보여줄 수 있습니다.",

    ctaTag: "지금 시작하세요",
    ctaTitle: "인지하지 못한 다운타임을 없앨 준비가 되셨나요?",
    ctaDesc: "중요한 웹 서비스와 API를 안정적으로 지키는 개발자들과 함께하세요. 설정은 30초면 충분합니다.",
    startFreeMonitoring: "무료 모니터링 시작하기 →",
    ctaFooterNotice: "매일 14,400회 무료 점검 · 신용카드 불필요 · 즉각 설정",

    footerTagline: "UptimeMonke · 가볍고 견고한 인프라 모니터링",
    backToTop: "맨 위로 이동 ↑",

    authWelcomeBack: "다시 오신 것을 환영합니다",
    authStartMonitoring: "몇 초 만에 모니터링 시작",
    authResetPassword: "비밀번호 재설정",
    authSubtitleSignIn: "모니터, 인시던트 및 상태 페이지에 액세스하세요.",
    authSubtitleSignUp: "매일 14,400회 무료 점검 평생 제공. 신용카드 불필요.",
    authSubtitleReset: "가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.",
    authCreateAccountTab: "계정 만들기",
    authSignInTab: "로그인",
    authOrContinueEmail: "또는 이메일로 계속하기",
    authYourName: "이름",
    authWorkEmail: "이메일 주소",
    authPassword: "비밀번호",
    authForgotPassword: "비밀번호를 잊으셨나요?",
    authCreateFreeAccountBtn: "무료 계정 생성 →",
    authSignInDashboardBtn: "대시보드 로그인 →",
    authSendResetBtn: "재설정 링크 전송",
    authProcessing: "처리 중…",
    authNoAccountPrompt: "아직 계정이 없으신가요?",
    authSignUpFreeLink: "무료 회원가입",
    authHaveAccountPrompt: "이미 계정이 있으신가요?",
    authSignInLink: "로그인하기",
    authBackToSignIn: "← 로그인으로 돌아가기",
    pwdGreat: "훌륭한 비밀번호입니다",
    pwdDecent: "적절한 비밀번호입니다",
    pwdTooShort: "너무 짧습니다 (최소 6자)",

    // Dashboard Header & Navigation
    dashWorkspace: "워크스페이스",
    dashEditUsername: "사용자 이름 수정",
    dashChecksLeft: "회 남음",
    dashBuyCoffee: "커피 한 잔 후원하기",
    dashAlerts: "알림",
    dashSignOut: "로그아웃",
    dashSignedIn: "로그인됨",

    // Dashboard Metrics & Status
    dashOverallUptime: "전체 가동률 (24시간)",
    dashUpMonitors: "정상 모니터",
    dashDownMonitors: "장애 모니터",
    dashPausedMonitors: "일시 중지됨",
    dashAllOperational: "모든 시스템이 정상 운영 중입니다",
    dashIncidentsActive: "건의 장애 발생 중",
    dashChecksToday: "회 오늘 검사",
    dashFreeAllowance: "매일 1.44만 회 무료",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "이름 또는 URL로 모니터 검색…",
    dashFilterAll: "전체",
    dashFilterUp: "정상",
    dashFilterDown: "장애",
    dashFilterPaused: "일시 중지",
    dashNewMonitor: "새 모니터",

    // Dashboard Public Status Page
    dashStatusPageLive: "공개 상태 페이지 활성화됨:",
    dashViewStatusPage: "상태 페이지 보기",

    // Dashboard Monitor Cards
    dashNeverChecked: "검사 기록 없음",
    dashUptime30d: "30일 가동률",
    dashCopyHeartbeat: "Ping URL 복사",
    dashCopied: "복사됨!",
    dashEdit: "수정",
    dashPause: "일시 중지",
    dashResume: "재개",
    dashDelete: "삭제",
    dashConfirmDelete: "이 모니터를 삭제하시겠습니까?",
    dashStatusUp: "정상",
    dashStatusDown: "장애",
    dashStatusPending: "대기 중",
    dashStatusPaused: "일시 중지",
    dashMaintenance: "유지 관리 중",
    dashCertExpired: "인증서 만료됨",
    dashCertExpiresToday: "인증서 오늘 만료",
    dashCertExpiresTomorrow: "인증서 내일 만료",
    dashCertDays: "인증서 {days}일 남음",

    // Dashboard Empty States
    dashNoMonitorsTitle: "등록된 모니터가 없습니다",
    dashNoMonitorsDesc: "첫 번째 모니터를 추가하여 모니터링을 시작하세요.",
    dashAddFirstMonitor: "첫 모니터 추가",
    dashNoMatchingMonitors: "필터 조건과 일치하는 모니터가 없습니다",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "새 모니터 생성",
    formEditTitle: "모니터 수정",
    formMonitorType: "모니터 유형",
    formFriendlyName: "모니터 이름",
    formFriendlyNamePlaceholder: "예: 프로덕션 API",
    formTargetUrl: "모니터링 대상 URL",
    formTargetHost: "호스트 / 도메인",
    formTargetIp: "IP 주소 또는 호스트",
    formPort: "포트",
    formInterval: "모니터링 간격",
    formAlertContacts: "알림 연락처",
    formSelectContacts: "알림 수신 대상 선택",
    formAllContacts: "모든 인증된 연락처",
    formNoContactsNotice: "인증된 연락처가 없습니다. 알림 설정에서 추가하세요.",
    formAdvancedOptions: "고급 옵션",
    formKeyword: "기대 키워드",
    formKeywordPlaceholder: "응답 본문에 포함되어야 하는 키워드",
    formInvertedKeyword: "반전 알림 (키워드 발견 시 알림)",
    formCustomStatus: "허용 HTTP 상태 코드",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "커스텀 HTTP 헤더",
    formRecordType: "DNS 레코드 유형",
    formExpectedValue: "기대 DNS 값",
    formHeartbeatGrace: "유예 시간",
    formPublicStatus: "공개 상태 페이지",
    formPublicStatusDesc: "공개 상태 페이지에 이 모니터 표시",
    formMuteAlerts: "알림 음소거",
    formMuteAlertsDesc: "이 모니터 장애 시 알림을 보내지 않음",
    formCreateBtn: "모니터 생성",
    formSaveBtn: "변경 사항 저장",
    formCancelBtn: "취소",
    formCreating: "생성 중…",
    formSaving: "저장 중…",

    // Dashboard - Detail Modal
    detailTitle: "모니터 세부정보",
    detailTabOverview: "개요",
    detailTabIncidents: "인시던트",
    detailTabResponseTime: "응답 시간",
    detailTabSettings: "설정",
    detailCurrentStatus: "현재 상태",
    detailUptime: "가동률",
    detailAvgResponse: "평균 응답 시간",
    detailIncidentsRecorded: "인시던트 내역",
    detailNoIncidents: "해당 기간 동안 기록된 인시던트가 없습니다",
    detailIncidentOngoing: "진행 중인 인시던트",
    detailIncidentResolved: "해결됨",
    detailIncidentDuration: "지속 시간",
    detailDeleteMonitor: "이 모니터 삭제",
    detailDeleteWarning:
      "이 작업은 되돌릴 수 없습니다. 모든 검사 기록과 인시던트가 영구적으로 삭제됩니다.",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "알림 연락처",
    contactsSubtitle: "모니터 장애 발생 시 알림을 받을 담당자 및 채널 선택",
    contactsAddNew: "연락처 추가",
    contactsChannel: "채널",
    contactsName: "연락처 이름 (선택 사항)",
    contactsDestination: "수신처 / Webhook URL",
    contactsAddBtn: "연락처 추가",
    contactsVerified: "인증됨",
    contactsPending: "인증 대기 중",
    contactsResend: "링크 재전송",
    contactsTestAlert: "테스트 알림 전송",
    contactsSending: "전송 중…",
    contactsDelete: "삭제",
    contactsNoContacts: "아직 구성된 알림 연락처가 없습니다.",

    // Dashboard - Org Settings Modal
    settingsTitle: "워크스페이스 설정",
    settingsWorkspaceName: "워크스페이스 이름",
    settingsStatusPageTitle: "공개 상태 페이지",
    settingsSlug: "상태 페이지 URL 슬러그",
    settingsPageTitle: "상태 페이지 제목",
    settingsPageDesc: "상태 페이지 설명",
    settingsSave: "변경 사항 저장",

    // Dashboard - Support Modal
    supportTitle: "용량 및 후원",
    supportSubtitle: "UptimeMonke는 정기 구독 없이 운영됩니다",
    supportUsedToday: "오늘 사용한 검사 수",
    supportDailyBudget: "일일 무료 제공량",
    supportRemainingCredit: "남은 후원 검사 수",
    supportBuyCoffee: "커피 한 잔 후원하기",
    supportDonateBtn: "후원하기",

    // Dashboard - Profile Modal
    profileTitle: "계정 및 프로필",
    profileUsername: "사용자 이름",
    profileEmail: "이메일 주소",
    profileSave: "프로필 업데이트",
    profileSaving: "업데이트 중…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 AI 앱 및 API 게이트웨이 모니터링",
    heroAiHeadline: "UptimeMonke로 AI 앱을 안전하게 모니터링하세요",
    heroAiSubtext: "LLM 에이전트, OpenAI & Claude 프록시, FastAPI 백엔드 및 웹 앱을 고속 엣지 프로브로 지속 모니터링합니다.",
    presetAiApi: "🤖 AI / LLM API",
    presetWebApp: "🌐 웹 앱",
    presetSsl: "🔒 SSL 인증서",
    presetHeartbeat: "⚡ 크론 하트비트",
    onboardingJourneyTag: "간단한 3단계",
    onboardingJourneyTitle: "30초 만에 모니터링 시작",
    onboardingStep1: "1. 모니터링 대상 입력",
    onboardingStep1Desc: "AI 엔드포인트, 웹 API, SSL 도메인 또는 크론 작업을 입력하세요.",
    onboardingStep2: "2. 원클릭 로그인",
    onboardingStep2Desc: "Google 또는 이메일로 즉시 로그인하세요. 신용카드가 필요 없습니다.",
    onboardingStep3: "3. 실시간 엣지 점검",
    onboardingStep3Desc: "글로벌 엣지 워커가 즉시 감시를 시작하며 장애 시 Slack/Discord/이메일로 즉시 알립니다.",
    tabAi: "AI / LLM API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (TTFT SLA)",
    demoAiStatus: "스트리밍 정상",
    onboardTitle: "UptimeMonke에 오신 것을 환영합니다",
    onboardSubtitle: "단계를 완료하여 서비스 모니터링을 시작하세요.",
    onboardStep1Title: "첫 번째 모니터 생성",
    onboardStep1Desc: "AI 추론 엔드포인트, HTTP 서비스 또는 하트비트를 구성합니다.",
    onboardStep2Title: "알림 연락처 추가",
    onboardStep2Desc: "Slack, Discord, 이메일 또는 웹훅을 연결하여 즉각 알림을 받으세요.",
    onboardStep3Title: "공개 상태 페이지 게시",
    onboardStep3Desc: "실시간 공개 상태 페이지로 사용자에게 신뢰를 제공하세요.",
    presetAiTitle: "AI 앱 / LLM 게이트웨이",
    presetAiDesc: "추론 엔드포인트, 스트리밍 응답 지연 SLA 및 가용성을 모니터링합니다.",
  },

  // ==========================================
  // MALAY (Bahasa Melayu)
  // ==========================================
  ms: {
    navFeatures: "Ciri-ciri",
    navDemo: "Demo Langsung",
    navAlerts: "Amaran",
    navPricing: "Harga",
    navFaq: "Soalan Lazim",
    probesLive: "Prob Aktif",
    logIn: "Log Masuk",
    startFree: "Mula Percuma",
    dashboardBtn: "Papan Pemuka",

    heroTag: "Pemeriksaan Tepi Bawah Seminit · 100% Percuma Selamanya",
    heroTitle1: "Pastikan laman web & API anda sentiasa ",
    heroTitleHighlight: "dalam talian",
    heroTitle2: ".",
    heroDesc:
      "Pemantauan berterusan HTTP, tarikh luput SSL, TCP ping, dan heartbeat cron dengan pemeriksaan bawah seminit serta amaran pantas sebelum pengguna menyedari gangguan.",
    heroPlaceholder: "Masukkan laman web atau API anda (cth. example.com)",
    heroStartBtn: "Mula Memantau",
    continueWithGoogle: "Teruskan dengan Google",
    continueWithGithub: "Teruskan dengan GitHub",
    signUpWithEmail: "Daftar dengan Emel",
    heroConnecting: "Menyambung…",
    featureIntervals: "⚡ Selang Semakan 60s",
    featureSsl: "🔒 Amaran Luput SSL Percuma",
    featureNoCard: "🚫 Kad Kredit Tidak Diperlukan",
    pillHttp: "HTTP(S) & API",
    pillSsl: "Luput SSL (30h/14h/7h)",
    pillPing: "Ping (ICMP) & TCP",
    pillCron: "Cron Heartbeat",
    pillStatusPage: "Halaman Status Awam",

    demoTag: "Kotak Pasir Interaktif",
    demoTitle: "Lihat Cara UptimeMonke Memeriksa Sistem Anda",
    demoDesc: "Prob masa nyata dihantar dari AWS Lightsail Singapura dengan resolusi bawah seminit.",
    tabHttp: "HTTP & API",
    tabSsl: "Sijil SSL",
    tabPorts: "TCP & DNS",
    tabHeartbeat: "Cron Heartbeat",
    demoWorkerLocation: "Pekerja: sg-1 (ap-southeast-1a)",
    demoUptime30d: "Uptime 30 Hari: 99.99%",
    demoSslValid: "Sah (baki 84 hari)",
    demoSslExpiring: "Tamat dalam 4 hari",
    demoPortOpen: "PORT DIBUKA",
    demoResolved: "DISELESAIKAN",
    demoHealthy: "SIHAT",
    demoLastPing: "Ping terakhir: 4m lalu · Jangkaan: 24j · Ihsan: 30m",
    demoCronSnippet: "Integrasi cron mudah:",

    alertsTag: "Pemberitahuan Insiden Segera",
    alertsTitle: "Maklumkan Pasukan Anda Sebelum Pelanggan Mengadu",
    alertsDesc: "Penghantaran amaran tanpa lengah ke platform komunikasi pasukan jurutera anda.",
    alertDownTitle: "API Pengeluaran TERGANGGU",
    alertRecoveredTitle: "API Pengeluaran TELAH PULIH",
    alertReason: "Sebab: HTTP 502 Bad Gateway (Masa tindak balas: 10,024 ms)",
    alertClosed: "Status: 200 OK (32 ms) · Insiden selesai. Tempoh gangguan: 2m 14s.",

    whyTag: "Dibina untuk Pembangun",
    whyTitle: "Mengapa Pasukan Memilih UptimeMonke",
    whyDesc: "Tiada sekatan bayaran buatan, tiada kontrak perusahaan yang rumit. Pemantauan infrastruktur yang pantas dan boleh dipercayai.",
    why1Title: "Semakan Tepi Bawah Seminit",
    why1Desc: "Platform lama mengehadkan akaun percuma kepada selang 5 minit. UptimeMonke membolehkan semakan bawah seminit secara percuma supaya anda tahu tentang kegagalan dengan serta-merta.",
    why2Title: "Armada Awan Kalis SSRF",
    why2Desc: "Direka dengan perlindungan ketat RFC1918, pertahanan metadata AWS IMDSv2, dan perlindungan DNS rebinding. Selamat untuk sasaran dalaman syarikat.",
    why3Title: "Halaman Status Awam Berjenama",
    why3Desc: "Terbitkan halaman status di /status/:slug dengan bar uptime sejarah 90 hari dan suapan insiden langsung. Pelanggan anda sentiasa mendapat maklumat terkini.",
    why4Title: "Amaran Pelbagai Saluran",
    why4Desc: "Hantar amaran ke Slack, Discord, Telegram, Webhook tersuai, dan emel Mailgun dengan mudah. Kenalan disahkan mengelakkan amaran palsu.",

    pricingTag: "Tiada Langganan",
    pricingTitle: "Tiada Pelan Berbayar",
    pricingLede: "Setiap ciri berfungsi pada akaun percuma. Sumbangan pilihan hanya menampung 'kapasiti' penggunaan pelayan sebenar.",
    freeForeverLabel: "Percuma, selamanya",
    checksPerDay: "semakan setiap hari",
    freeDesc: "Sepuluh pemantau pada 1 minit. Atau lima puluh pada 5 minit. Atau satu pada 6 saat — beban komputasinya sama, jadi harganya tetap percuma.",
    coffeeAddsLabel: "Satu kopi $2.99 menambah",
    checksUnit: "semakan",
    coffeeDesc: "Sekitar sebulan untuk 20 pemantau pada 1 minit, atau 10 pada 30 saat. Kapasiti tidak luput dan dibawa ke hadapan tanpa langganan.",
    buyCoffeeBtn: "Belanja saya secawan kopi",
    coffeeNotice: "Log masuk dahulu supaya kapasiti dimasukkan terus ke ruang kerja anda.",
    ifCreditRunsOutLabel: "Jika kredit habis",
    nothingDeletedFigure: "Tiada apa",
    graceDesc: "Tempoh ihsan seminggu pada kapasiti penuh, kemudian kembali lancar kepada 14,400 semakan percuma harian. Pemantau anda tidak akan terhenti.",
    whyCapacityExplanation: "Mengapa semakan dan bukan bilangan pemantau? Semakan 5 saat adalah 12 kali ganda beban berbanding 1 minit. Menilai berdasarkan beban semakan adalah jauh lebih adil.",

    faqTag: "Soalan Lazim",
    faqTitle: "Semua Perkara yang Perlu Anda Tahu",
    faqDesc: "Jawapan telus kepada soalan lazim pembangun mengenai UptimeMonke.",
    faq1Q: "Adakah UptimeMonke benar-benar percuma? Perlukah kad kredit?",
    faq1A: "Ya! Setiap akaun menerima 14,400 semakan percuma setiap hari selamanya. Tiada kad kredit diperlukan sama sekali.",
    faq2Q: "Bagaimanakah UptimeMonke berbeza daripada alatan seperti UptimeRobot?",
    faq2A: "Perkhidmatan lama menyekat akaun percuma kepada selang 5 minit dan mengunci ciri penting seperti amaran SSL dan cron di sebalik langganan bulanan. UptimeMonke menyediakan semua ini secara percuma dengan sokongan derma kopi.",
    faq3Q: "Dari manakah prob pemantauan dihantar?",
    faq3A: "Prob dihantar dari pelayan AWS Lightsail di Singapura (ap-southeast-1a). Enjin prob kami mematikan HTTP keep-alive untuk mengukur masa sambungan sebenar seperti dialami pelawat sebenar.",
    faq4Q: "Apakah yang berlaku jika kredit sumbangan saya habis?",
    faq4A: "Pemantau anda tidak akan dipadam atau dihentikan. Anda mendapat tempoh ihsan 7 hari sebelum kembali lancar kepada elaun percuma 14,400 semakan sehari.",
    faq5Q: "Bolehkah saya membuat halaman status awam untuk pelanggan saya?",
    faq5A: "Boleh. Setiap ruang kerja mempunyai halaman status awam yang boleh dikongsi di /status/:slug dengan bar uptime 90 hari dan log insiden.",

    ctaTag: "Mula Hari Ini",
    ctaTitle: "Bersedia untuk menghapuskan gangguan yang tidak disedari?",
    ctaDesc: "Sertai pembangun yang memastikan aplikasi dan API web kritikal mereka sentiasa dalam talian. Persediaan mengambil masa kurang dari 30 saat.",
    startFreeMonitoring: "Mula Pemantauan Percuma →",
    ctaFooterNotice: "14,400 semakan percuma setiap hari · Tanpa kad kredit · Persediaan segera",

    footerTagline: "UptimeMonke · Pemantauan Infrastruktur Ringan & Berkuasa",
    backToTop: "Kembali ke atas ↑",

    authWelcomeBack: "Selamat kembali",
    authStartMonitoring: "Mula memantau dalam beberapa saat",
    authResetPassword: "Tetapkan semula kata laluan",
    authSubtitleSignIn: "Akses pemantau, insiden, dan halaman status anda.",
    authSubtitleSignUp: "14,400 semakan percuma setiap hari selamanya. Tanpa kad kredit.",
    authSubtitleReset: "Masukkan emel anda untuk menerima pautan pemulihan.",
    authCreateAccountTab: "Cipta Akaun",
    authSignInTab: "Log Masuk",
    authOrContinueEmail: "atau teruskan dengan emel",
    authYourName: "Nama Anda",
    authWorkEmail: "Emel Kerja atau Peribadi",
    authPassword: "Kata Laluan",
    authForgotPassword: "Lupa kata laluan?",
    authCreateFreeAccountBtn: "Cipta Akaun Percuma →",
    authSignInDashboardBtn: "Log Masuk ke Papan Pemuka →",
    authSendResetBtn: "Hantar Arahan Set Semula",
    authProcessing: "Memproses…",
    authNoAccountPrompt: "Belum mempunyai akaun?",
    authSignUpFreeLink: "Daftar percuma",
    authHaveAccountPrompt: "Sudah mempunyai akaun?",
    authSignInLink: "Log masuk di sini",
    authBackToSignIn: "← Kembali ke log masuk",
    pwdGreat: "Kata laluan yang hebat",
    pwdDecent: "Kata laluan memuaskan",
    pwdTooShort: "Terlalu pendek (min 6 aksara)",

    // Dashboard Header & Navigation
    dashWorkspace: "Ruang Kerja",
    dashEditUsername: "Sunting Nama Pengguna",
    dashChecksLeft: "semakan berbaki",
    dashBuyCoffee: "Belikan saya kopi",
    dashAlerts: "Amaran",
    dashSignOut: "Log keluar",
    dashSignedIn: "Dilog masuk",

    // Dashboard Metrics & Status
    dashOverallUptime: "Kebolehoperasian Keseluruhan (24j)",
    dashUpMonitors: "Pemantau Aktif",
    dashDownMonitors: "Pemantau Tergendala",
    dashPausedMonitors: "Dijeda",
    dashAllOperational: "Semua sistem beroperasi seperti biasa",
    dashIncidentsActive: "insiden aktif",
    dashChecksToday: "semakan hari ini",
    dashFreeAllowance: "14.4k/hari percuma",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "Cari pemantau mengikut nama atau URL…",
    dashFilterAll: "Semua",
    dashFilterUp: "Aktif",
    dashFilterDown: "Tergendala",
    dashFilterPaused: "Dijeda",
    dashNewMonitor: "Pemantau Baharu",

    // Dashboard Public Status Page
    dashStatusPageLive: "Halaman status awam sedang aktif di",
    dashViewStatusPage: "Lihat Halaman Status",

    // Dashboard Monitor Cards
    dashNeverChecked: "belum pernah disemak",
    dashUptime30d: "kebolehoperasian 30h",
    dashCopyHeartbeat: "Salin URL ping",
    dashCopied: "Disalin!",
    dashEdit: "Sunting",
    dashPause: "Jeda",
    dashResume: "Sambung",
    dashDelete: "Padam",
    dashConfirmDelete: "Padam pemantau ini?",
    dashStatusUp: "AKTIF",
    dashStatusDown: "TERGENDALA",
    dashStatusPending: "MENUNGGU",
    dashStatusPaused: "DIJEDA",
    dashMaintenance: "PENYELENGGARAAN",
    dashCertExpired: "sijil tamat tempoh",
    dashCertExpiresToday: "sijil tamat hari ini",
    dashCertExpiresTomorrow: "sijil tamat esok",
    dashCertDays: "sijil {days}h",

    // Dashboard Empty States
    dashNoMonitorsTitle: "Tiada pemantau lagi",
    dashNoMonitorsDesc: "Mulakan dengan menambah pemantau pertama anda.",
    dashAddFirstMonitor: "Tambah pemantau pertama anda",
    dashNoMatchingMonitors: "Tiada pemantau menepati carian anda",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "Cipta Pemantau Baharu",
    formEditTitle: "Sunting Pemantau",
    formMonitorType: "Jenis Pemantau",
    formFriendlyName: "Nama Pemantau",
    formFriendlyNamePlaceholder: "cth. API Pengeluaran",
    formTargetUrl: "URL untuk Dipantau",
    formTargetHost: "Hos / Domain",
    formTargetIp: "Alamat IP atau Hos",
    formPort: "Port",
    formInterval: "Sela Masa Pemantauan",
    formAlertContacts: "Kenalan Amaran",
    formSelectContacts: "Pilih siapa yang menerima amaran",
    formAllContacts: "Semua kenalan disahkan",
    formNoContactsNotice: "Tiada kenalan disahkan. Tambah satu di Amaran.",
    formAdvancedOptions: "Pilihan Lanjutan",
    formKeyword: "Kata Kunci Dijangka",
    formKeywordPlaceholder: "Kata kunci yang mesti ada dalam respons",
    formInvertedKeyword: "Amaran jika kata kunci hadir (terbalik)",
    formCustomStatus: "Kod Status HTTP Diterima",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "Pengepala HTTP Tersuai",
    formRecordType: "Jenis Rekod DNS",
    formExpectedValue: "Nilai DNS Dijangka",
    formHeartbeatGrace: "Tempoh Ihsan",
    formPublicStatus: "Halaman Status Awam",
    formPublicStatusDesc: "Tunjukkan pemantau ini pada halaman status awam anda",
    formMuteAlerts: "Senyapkan Amaran",
    formMuteAlertsDesc: "Jangan hantar pemberitahuan apabila pemantau gagal",
    formCreateBtn: "Cipta Pemantau",
    formSaveBtn: "Simpan Perubahan",
    formCancelBtn: "Batal",
    formCreating: "Mencipta…",
    formSaving: "Menyimpan…",

    // Dashboard - Detail Modal
    detailTitle: "Butiran Pemantau",
    detailTabOverview: "Gambaran Keseluruhan",
    detailTabIncidents: "Insiden",
    detailTabResponseTime: "Masa Tindak Balas",
    detailTabSettings: "Tetapan",
    detailCurrentStatus: "Status Semasa",
    detailUptime: "Kebolehoperasian",
    detailAvgResponse: "Purata Masa Tindak Balas",
    detailIncidentsRecorded: "Sejarah Insiden",
    detailNoIncidents: "Tiada insiden direkodkan dalam jangka masa ini",
    detailIncidentOngoing: "Insiden Sedang Berlaku",
    detailIncidentResolved: "Diselesaikan",
    detailIncidentDuration: "Tempoh Masa",
    detailDeleteMonitor: "Padam pemantau ini",
    detailDeleteWarning:
      "Tindakan ini tidak boleh diundur. Semua sejarah semakan dan insiden akan dipadamkan secara kekal.",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "Kenalan Amaran",
    contactsSubtitle: "Pilih siapa yang diberitahu apabila pemantau tergendala",
    contactsAddNew: "Tambah Kenalan",
    contactsChannel: "Saluran",
    contactsName: "Nama Kenalan (pilihan)",
    contactsDestination: "Destinasi / URL Webhook",
    contactsAddBtn: "Tambah Kenalan",
    contactsVerified: "Disahkan",
    contactsPending: "Menunggu Pengesahan",
    contactsResend: "Hantar Semula Pautan",
    contactsTestAlert: "Hantar Amaran Ujian",
    contactsSending: "Menghantar…",
    contactsDelete: "Buang",
    contactsNoContacts: "Belum ada kenalan amaran dikonfigurasikan.",

    // Dashboard - Org Settings Modal
    settingsTitle: "Tetapan Ruang Kerja",
    settingsWorkspaceName: "Nama Ruang Kerja",
    settingsStatusPageTitle: "Halaman Status Awam",
    settingsSlug: "Slug URL Halaman Status",
    settingsPageTitle: "Tajuk Halaman Status",
    settingsPageDesc: "Penerangan Halaman Status",
    settingsSave: "Simpan Perubahan",

    // Dashboard - Support Modal
    supportTitle: "Kapasiti & Sumbangan",
    supportSubtitle: "UptimeMonke beroperasi tanpa sebarang langganan",
    supportUsedToday: "Semakan Digunakan Hari Ini",
    supportDailyBudget: "Bajet Percuma Harian",
    supportRemainingCredit: "Baki Semakan Sumbangan",
    supportBuyCoffee: "Belikan saya kopi",
    supportDonateBtn: "Sumbang",

    // Dashboard - Profile Modal
    profileTitle: "Akaun & Profil",
    profileUsername: "Nama Pengguna",
    profileEmail: "Alamat E-mel",
    profileSave: "Kemas Kini Profil",
    profileSaving: "Mengemas kini…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 Pemantauan Aplikasi AI & Gerbang API",
    heroAiHeadline: "Pantau aplikasi AI anda dengan UptimeMonke",
    heroAiSubtext: "Pastikan ejen LLM, proksi OpenAI & Anthropic, backend FastAPI, dan aplikasi web sentiasa pantas dengan prob pinggir.",
    presetAiApi: "🤖 AI / LLM API",
    presetWebApp: "🌐 Aplikasi Web",
    presetSsl: "🔒 Sijil SSL",
    presetHeartbeat: "⚡ Denyutan Cron",
    onboardingJourneyTag: "Persediaan Mudah 3 Langkah",
    onboardingJourneyTitle: "Bermula dalam masa kurang dari 30 saat",
    onboardingStep1: "1. Pilih Sasaran",
    onboardingStep1Desc: "Masukkan titik akhir AI, API web, domain SSL, atau skrip cron.",
    onboardingStep2: "2. Log Masuk 1-Klik",
    onboardingStep2Desc: "Pengesahan pantas dengan Google atau e-mel tanpa kata laluan. Tiada kad kredit diperlukan.",
    onboardingStep3: "3. Pemeriksaan Masa Nyata",
    onboardingStep3Desc: "Armada prob global mula memeriksa dengan segera, memaklumkan Slack, Discord, atau E-mel jika berlaku kegagalan.",
    tabAi: "AI / LLM API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (SLA TTFT)",
    demoAiStatus: "Strim Aktif",
    onboardTitle: "Selamat datang ke UptimeMonke",
    onboardSubtitle: "Lengkapkan langkah-langkah ini untuk memulakan pemantauan.",
    onboardStep1Title: "Cipta monitor pertama anda",
    onboardStep1Desc: "Konfigurasikan titik akhir AI, perkhidmatan HTTP, atau denyutan cron.",
    onboardStep2Title: "Tambah kenalan makluman",
    onboardStep2Desc: "Sambungkan Slack, Discord, E-mel, atau Webhook untuk makluman pantas.",
    onboardStep3Title: "Terbitkan Halaman Status",
    onboardStep3Desc: "Beri pengguna ketelusan dengan halaman status awam masa nyata.",
    presetAiTitle: "Aplikasi AI / Gerbang LLM",
    presetAiDesc: "Pantau titik akhir inferens, SLA kependaman penstriman, dan ketersediaan model.",
  },

  // ==========================================
  // INDONESIAN (Bahasa Indonesia)
  // ==========================================
  id: {
    navFeatures: "Fitur",
    navDemo: "Demo Langsung",
    navAlerts: "Peringatan",
    navPricing: "Harga",
    navFaq: "FAQ",
    probesLive: "Probe Aktif",
    logIn: "Masuk",
    startFree: "Mulai Gratis",
    dashboardBtn: "Dasbor",

    heroTag: "Pemeriksaan Edge Sub-Menit · 100% Gratis Selamanya",
    heroTitle1: "Jaga situs web & API Anda tetap ",
    heroTitleHighlight: "online",
    heroTitle2: ".",
    heroDesc:
      "Pemantauan berkelanjutan HTTP, kedaluwarsa SSL, ping TCP, dan cron heartbeat dengan interval sub-menit serta peringatan multi-kanal instan sebelum pengguna menyadari downtime.",
    heroPlaceholder: "Masukkan URL situs web atau API Anda (cth. example.com)",
    heroStartBtn: "Mulai Memantau",
    continueWithGoogle: "Lanjutkan dengan Google",
    continueWithGithub: "Lanjutkan dengan GitHub",
    signUpWithEmail: "Daftar dengan Email",
    heroConnecting: "Menghubungkan…",
    featureIntervals: "⚡ Interval Pengecekan 60d",
    featureSsl: "🔒 Peringatan Kedaluwarsa SSL Gratis",
    featureNoCard: "🚫 Tanpa Kartu Kredit",
    pillHttp: "HTTP(S) & API",
    pillSsl: "Kedaluwarsa SSL (30h/14h/7h)",
    pillPing: "Ping (ICMP) & TCP",
    pillCron: "Cron Heartbeat",
    pillStatusPage: "Halaman Status Publik",

    demoTag: "Sandbox Interaktif",
    demoTitle: "Lihat Cara UptimeMonke Memeriksa Sistem Anda",
    demoDesc: "Probe real-time dikirim dari AWS Lightsail Singapura dengan resolusi sub-menit.",
    tabHttp: "HTTP & API",
    tabSsl: "Sertifikat SSL",
    tabPorts: "TCP & DNS",
    tabHeartbeat: "Cron Heartbeat",
    demoWorkerLocation: "Pekerja: sg-1 (ap-southeast-1a)",
    demoUptime30d: "Uptime 30 Hari: 99.99%",
    demoSslValid: "Valid (sisa 84 hari)",
    demoSslExpiring: "Kedaluwarsa dalam 4 hari",
    demoPortOpen: "PORT TERBUKA",
    demoResolved: "TERSELESAIKAN",
    demoHealthy: "SEHAT",
    demoLastPing: "Ping terakhir: 4m lalu · Interval: 24j · Toleransi: 30m",
    demoCronSnippet: "Integrasi cron sederhana:",

    alertsTag: "Notifikasi Insiden Instan",
    alertsTitle: "Beri Tahu Tim Anda Sebelum Pelanggan Mengeluh",
    alertsDesc: "Pengiriman peringatan instan tanpa jeda ke alat kerja tim teknik Anda.",
    alertDownTitle: "API Produksi DOWN",
    alertRecoveredTitle: "API Produksi TELAH PULIH",
    alertReason: "Alasan: HTTP 502 Bad Gateway (Waktu respons: 10,024 ms)",
    alertClosed: "Status: 200 OK (32 ms) · Insiden ditutup. Durasi downtime: 2m 14s.",

    whyTag: "Dirancang untuk Pengembang",
    whyTitle: "Mengapa Tim Memilih UptimeMonke",
    whyDesc: "Tanpa batasan berbayar buatan, tanpa kontrak korporat berbelit-belit. Pemantauan infrastruktur yang cepat dan andal.",
    why1Title: "Pengecekan Edge Sub-Menit",
    why1Desc: "Platform pemantauan lawas mengunci akun gratis pada interval 5 menit. UptimeMonke memungkinkan pengecekan sub-menit sejak awal sehingga Anda tahu kegagalan seketika.",
    why2Title: "Armada Cloud Kebal SSRF",
    why2Desc: "Didesain dengan perlindungan ketat RFC1918, pencegahan serangan metadata AWS IMDSv2, dan pelindung DNS rebinding. Aman untuk sistem internal perusahaan.",
    why3Title: "Halaman Status Publik Berjenama",
    why3Desc: "Publikasikan halaman status di /status/:slug dengan bar historis 90 hari dan feed insiden langsung untuk transparansi kepada pelanggan.",
    why4Title: "Peringatan Multi-Kanal",
    why4Desc: "Kirim peringatan ke Slack, Discord, Telegram, Webhook kustom, dan email Mailgun tanpa kerepotan konfigurasi. Kontak terverifikasi mencegah spoofing.",

    pricingTag: "Tanpa Langganan",
    pricingTitle: "Tidak Ada Paket Berbayar",
    pricingLede: "Setiap fitur berfungsi di akun gratis. Donasi sukarela hanya membayar 'kapasitas' pemakaian server yang sebenarnya.",
    freeForeverLabel: "Gratis, selamanya",
    checksPerDay: "pengecekan per hari",
    freeDesc: "Sepuluh monitor pada 1 menit. Atau lima puluh pada 5 menit. Atau satu pada 6 detik — beban komputasinya identik, jadi harganya sama-sama gratis.",
    coffeeAddsLabel: "Satu cangkir kopi $2.99 menambah",
    checksUnit: "pengecekan",
    coffeeDesc: "Sekitar satu bulan untuk dua puluh monitor pada 1 menit, atau sepuluh pada 30 detik. Kapasitas tidak kedaluwarsa dan diakumulasi tanpa langganan.",
    buyCoffeeBtn: "Traktir saya kopi",
    coffeeNotice: "Masuk terlebih dahulu agar kapasitas langsung masuk ke workspace Anda.",
    ifCreditRunsOutLabel: "Jika kredit habis",
    nothingDeletedFigure: "Tidak ada yang dihapus",
    graceDesc: "Masa tenggang satu minggu pada kapasitas penuh, lalu otomatis kembali ke kuota gratis 14.400 harian. Monitor Anda tetap berjalan lancar.",
    whyCapacityExplanation: "Mengapa pengecekan dan bukan jumlah monitor? Pengecekan 5 detik membutuhkan daya 12 kali lipat dari 1 menit. Menghitung kapasitas berdasarkan pengecekan jauh lebih adil.",

    faqTag: "Pertanyaan yang Sering Diajukan",
    faqTitle: "Semua yang Perlu Anda Ketahui",
    faqDesc: "Jawaban jujur atas pertanyaan umum pengembang tentang UptimeMonke.",
    faq1Q: "Apakah UptimeMonke benar-benar gratis? Apakah perlu kartu kredit?",
    faq1A: "Ya! Setiap akun menerima 14.400 pengecekan gratis setiap hari selamanya. Tanpa kartu kredit sama sekali.",
    faq2Q: "Apa bedanya UptimeMonke dengan alat tradisional seperti UptimeRobot?",
    faq2A: "Layanan lama membatasi akun gratis pada interval 5 menit dan mengunci fitur penting seperti peringatan SSL dan cron di balik langganan bulanan. UptimeMonke menyediakannya gratis dan didukung donasi kopi satu kali.",
    faq3Q: "Dari mana probe pemantauan dikirimkan?",
    faq3A: "Probe berasal dari instans AWS Lightsail di Singapura (ap-southeast-1a). Mesin probe kami menonaktifkan HTTP keep-alive untuk mengukur koneksi paket pertama yang nyata (DNS+TCP+TLS).",
    faq4Q: "Apa yang terjadi jika kredit donasi saya habis?",
    faq4A: "Monitor Anda tidak akan pernah dihapus atau dihentikan. Anda mendapat masa tenggang 7 hari sebelum kembali ke kuota harian gratis 14.400 tanpa gangguan.",
    faq5Q: "Bisakah saya membuat halaman status publik untuk klien saya?",
    faq5A: "Bisa. Setiap workspace memiliki halaman status publik yang dapat langsung dibagikan di /status/:slug dengan bar historis 90 hari dan log insiden.",

    ctaTag: "Mulai Hari Ini",
    ctaTitle: "Siap melenyapkan downtime yang tak terdeteksi?",
    ctaDesc: "Bergabunglah dengan pengembang yang menjaga web app dan API penting mereka tetap aktif. Pengaturan hanya butuh kurang dari 30 detik.",
    startFreeMonitoring: "Mulai Pemantauan Gratis →",
    ctaFooterNotice: "14.400 pengecekan gratis setiap hari · Tanpa kartu kredit · Pengaturan instan",

    footerTagline: "UptimeMonke · Pemantauan Infrastruktur Ringan & Tangguh",
    backToTop: "Kembali ke atas ↑",

    authWelcomeBack: "Selamat datang kembali",
    authStartMonitoring: "Mulai memantau dalam hitungan detik",
    authResetPassword: "Atur ulang kata sandi",
    authSubtitleSignIn: "Akses monitor, insiden, dan halaman status Anda.",
    authSubtitleSignUp: "14.400 cek gratis setiap hari selamanya. Tanpa kartu kredit.",
    authSubtitleReset: "Masukkan email Anda untuk menerima tautan pemulihan.",
    authCreateAccountTab: "Buat Akun",
    authSignInTab: "Masuk",
    authOrContinueEmail: "atau lanjutkan dengan email",
    authYourName: "Nama Anda",
    authWorkEmail: "Email Kerja atau Pribadi",
    authPassword: "Kata Sandi",
    authForgotPassword: "Lupa kata sandi?",
    authCreateFreeAccountBtn: "Buat Akun Gratis →",
    authSignInDashboardBtn: "Masuk ke Dasbor →",
    authSendResetBtn: "Kirim Instruksi Reset",
    authProcessing: "Memproses…",
    authNoAccountPrompt: "Belum punya akun?",
    authSignUpFreeLink: "Daftar gratis",
    authHaveAccountPrompt: "Sudah punya akun?",
    authSignInLink: "Masuk di sini",
    authBackToSignIn: "← Kembali ke halaman masuk",
    pwdGreat: "Kata sandi luar biasa",
    pwdDecent: "Kata sandi cukup baik",
    pwdTooShort: "Terlalu pendek (min 6 karakter)",

    // Dashboard Header & Navigation
    dashWorkspace: "Ruang Kerja",
    dashEditUsername: "Edit Nama Pengguna",
    dashChecksLeft: "pemeriksaan tersisa",
    dashBuyCoffee: "Belikan saya kopi",
    dashAlerts: "Peringatan",
    dashSignOut: "Keluar",
    dashSignedIn: "Masuk",

    // Dashboard Metrics & Status
    dashOverallUptime: "Uptime Keseluruhan (24j)",
    dashUpMonitors: "Monitor Aktif",
    dashDownMonitors: "Monitor Tumbang",
    dashPausedMonitors: "Dijeda",
    dashAllOperational: "Semua sistem beroperasi normal",
    dashIncidentsActive: "insiden aktif",
    dashChecksToday: "pemeriksaan hari ini",
    dashFreeAllowance: "14.4rb/hari gratis",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "Cari monitor berdasarkan nama atau URL…",
    dashFilterAll: "Semua",
    dashFilterUp: "Aktif",
    dashFilterDown: "Tumbang",
    dashFilterPaused: "Dijeda",
    dashNewMonitor: "Monitor Baru",

    // Dashboard Public Status Page
    dashStatusPageLive: "Halaman status publik aktif di",
    dashViewStatusPage: "Lihat Halaman Status",

    // Dashboard Monitor Cards
    dashNeverChecked: "belum pernah diperiksa",
    dashUptime30d: "uptime 30h",
    dashCopyHeartbeat: "Salin URL ping",
    dashCopied: "Tersalin!",
    dashEdit: "Edit",
    dashPause: "Jeda",
    dashResume: "Lanjutkan",
    dashDelete: "Hapus",
    dashConfirmDelete: "Hapus monitor ini?",
    dashStatusUp: "AKTIF",
    dashStatusDown: "TUMBANG",
    dashStatusPending: "MENUNGGU",
    dashStatusPaused: "DIJEDA",
    dashMaintenance: "PEMELIHARAAN",
    dashCertExpired: "sertifikat kedaluwarsa",
    dashCertExpiresToday: "sertifikat kedaluwarsa hari ini",
    dashCertExpiresTomorrow: "sertifikat kedaluwarsa besok",
    dashCertDays: "sertifikat {days}h",

    // Dashboard Empty States
    dashNoMonitorsTitle: "Belum ada monitor",
    dashNoMonitorsDesc: "Mulai pantau layanan Anda dengan menambahkan monitor pertama.",
    dashAddFirstMonitor: "Tambah monitor pertama",
    dashNoMatchingMonitors: "Tidak ada monitor yang cocok dengan filter",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "Buat Monitor Baru",
    formEditTitle: "Edit Monitor",
    formMonitorType: "Tipe Monitor",
    formFriendlyName: "Nama Monitor",
    formFriendlyNamePlaceholder: "mis. Production API",
    formTargetUrl: "URL untuk Dipantau",
    formTargetHost: "Host / Domain",
    formTargetIp: "Alamat IP atau Host",
    formPort: "Port",
    formInterval: "Interval Pemantauan",
    formAlertContacts: "Kontak Peringatan",
    formSelectContacts: "Pilih siapa yang menerima peringatan",
    formAllContacts: "Semua kontak terverifikasi",
    formNoContactsNotice: "Belum ada kontak terverifikasi. Tambahkan di menu Peringatan.",
    formAdvancedOptions: "Opsi Lanjutan",
    formKeyword: "Kata Kunci yang Diharapkan",
    formKeywordPlaceholder: "Teks yang wajib ada dalam respons",
    formInvertedKeyword: "Peringatkan jika kata kunci ada (terbalik)",
    formCustomStatus: "Kode Status HTTP Diterima",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "Header HTTP Kustom",
    formRecordType: "Tipe DNS Record",
    formExpectedValue: "Nilai DNS yang Diharapkan",
    formHeartbeatGrace: "Masa Tenggang",
    formPublicStatus: "Halaman Status Publik",
    formPublicStatusDesc: "Tampilkan monitor ini di halaman status publik Anda",
    formMuteAlerts: "Senyapkan Peringatan",
    formMuteAlertsDesc: "Jangan kirim notifikasi saat monitor ini tumbang",
    formCreateBtn: "Buat Monitor",
    formSaveBtn: "Simpan Perubahan",
    formCancelBtn: "Batal",
    formCreating: "Membuat…",
    formSaving: "Menyimpan…",

    // Dashboard - Detail Modal
    detailTitle: "Detail Monitor",
    detailTabOverview: "Ikhtisar",
    detailTabIncidents: "Insiden",
    detailTabResponseTime: "Waktu Respons",
    detailTabSettings: "Pengaturan",
    detailCurrentStatus: "Status Saat Ini",
    detailUptime: "Uptime",
    detailAvgResponse: "Rata-rata Waktu Respons",
    detailIncidentsRecorded: "Riwayat Insiden",
    detailNoIncidents: "Tidak ada insiden tercatat dalam periode ini",
    detailIncidentOngoing: "Insiden Sedang Berlangsung",
    detailIncidentResolved: "Terselesaikan",
    detailIncidentDuration: "Durasi",
    detailDeleteMonitor: "Hapus monitor ini",
    detailDeleteWarning:
      "Tindakan ini tidak dapat dibatalkan. Semua riwayat pemeriksaan dan insiden akan dihapus secara permanen.",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "Kontak Peringatan",
    contactsSubtitle: "Pilih siapa yang diberi tahu saat monitor mengalami gangguan",
    contactsAddNew: "Tambah Kontak",
    contactsChannel: "Saluran",
    contactsName: "Nama Kontak (opsional)",
    contactsDestination: "Tujuan / URL Webhook",
    contactsAddBtn: "Tambah Kontak",
    contactsVerified: "Terverifikasi",
    contactsPending: "Menunggu Verifikasi",
    contactsResend: "Kirim Ulang Tautan",
    contactsTestAlert: "Kirim Tes Peringatan",
    contactsSending: "Mengirim…",
    contactsDelete: "Hapus",
    contactsNoContacts: "Belum ada kontak peringatan yang dikonfigurasi.",

    // Dashboard - Org Settings Modal
    settingsTitle: "Pengaturan Ruang Kerja",
    settingsWorkspaceName: "Nama Ruang Kerja",
    settingsStatusPageTitle: "Halaman Status Publik",
    settingsSlug: "Slug URL Halaman Status",
    settingsPageTitle: "Judul Halaman Status",
    settingsPageDesc: "Deskripsi Halaman Status",
    settingsSave: "Simpan Perubahan",

    // Dashboard - Support Modal
    supportTitle: "Kapasitas & Donasi",
    supportSubtitle: "UptimeMonke beroperasi murni tanpa sistem langganan",
    supportUsedToday: "Pemeriksaan Terpakai Hari Ini",
    supportDailyBudget: "Batas Gratis Harian",
    supportRemainingCredit: "Sisa Pemeriksaan dari Donasi",
    supportBuyCoffee: "Belikan saya kopi",
    supportDonateBtn: "Donasi",

    // Dashboard - Profile Modal
    profileTitle: "Akun & Profil",
    profileUsername: "Nama Pengguna",
    profileEmail: "Alamat Email",
    profileSave: "Perbarui Profil",
    profileSaving: "Memperbarui…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 Pemantauan Aplikasi AI & Gateway API",
    heroAiHeadline: "Pantau aplikasi AI Anda dengan UptimeMonke",
    heroAiSubtext: "Jaga agen LLM, proxy OpenAI & Anthropic, backend FastAPI, dan web app tetap cepat dan tersedia dengan probe edge berkala.",
    presetAiApi: "🤖 AI / LLM API",
    presetWebApp: "🌐 Web App",
    presetSsl: "🔒 Sertifikat SSL",
    presetHeartbeat: "⚡ Cron Heartbeat",
    onboardingJourneyTag: "Pengaturan Mudah 3 Langkah",
    onboardingJourneyTitle: "Aktif dan berjalan dalam waktu kurang dari 30 detik",
    onboardingStep1: "1. Pilih Target",
    onboardingStep1Desc: "Masukkan endpoint AI, web API, domain SSL, atau cron worker latar belakang.",
    onboardingStep2: "2. Masuk 1-Klik",
    onboardingStep2Desc: "Otentikasi instan dengan Google atau email tanpa password. Tanpa kartu kredit.",
    onboardingStep3: "3. Pemeriksaan Edge Real-Time",
    onboardingStep3Desc: "Armada probe global langsung memeriksa dan memberi tahu Slack, Discord, atau Email jika ada kendala.",
    tabAi: "AI / LLM API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (TTFT SLA)",
    demoAiStatus: "Streaming Aktif",
    onboardTitle: "Selamat datang di UptimeMonke",
    onboardSubtitle: "Selesaikan langkah-langkah berikut untuk memulai pemantauan.",
    onboardStep1Title: "Buat monitor pertama Anda",
    onboardStep1Desc: "Konfigurasikan endpoint inferensi AI, layanan HTTP, atau heartbeat latar belakang.",
    onboardStep2Title: "Tambahkan kontak peringatan",
    onboardStep2Desc: "Hubungkan Slack, Discord, Email, atau Webhook untuk notifikasi cepat.",
    onboardStep3Title: "Publikasikan Halaman Status",
    onboardStep3Desc: "Beri pengguna transparansi dengan halaman status publik real-time.",
    presetAiTitle: "Aplikasi AI / LLM Gateway",
    presetAiDesc: "Pantau endpoint inferensi, SLA latensi streaming, dan ketersediaan model.",
  },

  // ==========================================
  // BURMESE (မြန်မာစာ)
  // ==========================================
  my: {
    navFeatures: "လုပ်ဆောင်ချက်များ",
    navDemo: "တိုက်ရိုက်စမ်းသပ်မှု",
    navAlerts: "အသိပေးချက်များ",
    navPricing: "ဈေးနှုန်း",
    navFaq: "အမေးများသောမေးခွန်းများ",
    probesLive: "တိုက်ရိုက်စောင့်ကြည့်နေသည်",
    logIn: "အကောင့်ဝင်ရန်",
    startFree: "အခမဲ့စတင်ရန်",
    dashboardBtn: "ဒက်ရှ်ဘုတ်",

    heroTag: "တစ်မိနစ်အောက် စောင့်ကြည့်စစ်ဆေးမှု · အမြဲတမ်း ၁၀၀% အခမဲ့",
    heroTitle1: "သင့်ဝဘ်ဆိုက်နှင့် API များကို အမြဲမပြတ် ",
    heroTitleHighlight: "အွန်လိုင်းပေါ်တွင်",
    heroTitle2: " ရှိနေပါစေ။",
    heroDesc:
      "HTTP၊ SSL သက်တမ်းကုန်ဆုံးမှု၊ TCP ping နှင့် cron heartbeat များကို တစ်မိနစ်အောက်အကြိမ်ရေဖြင့် အဆက်မပြတ်စစ်ဆေးပြီး အသုံးပြုသူများ မသိရှိမီ ချက်ချင်းသတိပေးချက်များ ပေးပို့ပေးပါသည်။",
    heroPlaceholder: "ဝဘ်ဆိုက် (သို့) API လိပ်စာထည့်ပါ (ဥပမာ- example.com)",
    heroStartBtn: "စောင့်ကြည့်စစ်ဆေးရန်",
    continueWithGoogle: "Google ဖြင့် ဆက်လက်လုပ်ဆောင်ရန်",
    continueWithGithub: "GitHub ဖြင့် ဆက်လက်လုပ်ဆောင်ရန်",
    signUpWithEmail: "အီးမေးလ်ဖြင့် အကောင့်ဖွင့်ရန်",
    heroConnecting: "ချိတ်ဆက်နေသည်…",
    featureIntervals: "⚡ ၆၀ စက္ကန့် စစ်ဆေးမှုနှုန်း",
    featureSsl: "🔒 အခမဲ့ SSL သက်တမ်းကုန်သတိပေးချက်",
    featureNoCard: "🚫 ခရက်ဒစ်ကတ် မလိုအပ်ပါ",
    pillHttp: "HTTP(S) နှင့် API များ",
    pillSsl: "SSL သက်တမ်း (၃၀ရက်/၁၄ရက်/၇ရက်)",
    pillPing: "Ping (ICMP) နှင့် TCP",
    pillCron: "Cron Heartbeat များ",
    pillStatusPage: "အများပြည်သူကြည့် စတေးတပ်စ်စာမျက်နှာ",

    demoTag: "လက်တွေ့စမ်းသပ်ခန်း",
    demoTitle: "UptimeMonke မည်သို့စစ်ဆေးသည်ကို ကြည့်ရှုပါ",
    demoDesc: "AWS Lightsail စင်ကာပူမှ တစ်မိနစ်အောက် အကြိမ်နှုန်းဖြင့် တိုက်ရိုက်စစ်ဆေးပေးပါသည်။",
    tabHttp: "HTTP နှင့် API",
    tabSsl: "SSL လက်မှတ်များ",
    tabPorts: "TCP နှင့် DNS",
    tabHeartbeat: "Cron Heartbeat",
    demoWorkerLocation: "ဆာဗာ: sg-1 (ap-southeast-1a)",
    demoUptime30d: "ရက် ၃၀ ပုံမှန်လည်ပတ်မှု: ၉၉.၉၉%",
    demoSslValid: "သက်တမ်းရှိ (၈၄ ရက်ကျန်)",
    demoSslExpiring: "၄ ရက်အတွင်း သက်တမ်းကုန်မည်",
    demoPortOpen: "PORT ဖွင့်ထားသည်",
    demoResolved: "ဖြေရှင်းပြီးပါပြီ",
    demoHealthy: "ကောင်းမွန်သည်",
    demoLastPing: "နောက်ဆုံးစစ်ဆေးမှု: ၄ မိနစ်ခန့်က · ကြာချိန်: ၂၄ နာရီ · ခွင့်ပြုချိန်: ၃၀ မိနစ်",
    demoCronSnippet: "ရိုးရှင်းသော Cron ချိတ်ဆက်မှု:",

    alertsTag: "ချက်ချင်းဖြစ်ရပ် အသိပေးချက်",
    alertsTitle: "သုံးစွဲသူများ မတိုင်ကြားမီ သင့်အဖွဲ့ထံ သတိပေးပါ",
    alertsDesc: "အင်ဂျင်နီယာအဖွဲ့ အသုံးပြုနေသော ဆက်သွယ်ရေးစနစ်များသို့ အချိန်မဆိုင်းဘဲ ချက်ချင်းအကြောင်းကြားပေးပါသည်။",
    alertDownTitle: "ထုတ်လုပ်မှု API ပျက်ကျနေပါသည်",
    alertRecoveredTitle: "ထုတ်လုပ်မှု API ပြန်လည်ကောင်းမွန်ပါပြီ",
    alertReason: "အကြောင်းအရင်း: HTTP 502 Bad Gateway (တုံ့ပြန်ချိန်: ၁၀,၀၂၄ ms)",
    alertClosed: "အခြေအနေ: 200 OK (၃၂ ms) · ပြဿနာဖြေရှင်းပြီးပါပြီ။ ရပ်တန့်ကြာချိန်: ၂ မိနစ် ၁၄ စက္ကန့်။",

    whyTag: "ဆော့ဖ်ဝဲရေးသားသူများအတွက် အထူးဖန်တီးထားသည်",
    whyTitle: "UptimeMonke ကို အဘယ်ကြောင့်ရွေးချယ်ကြသနည်း",
    whyDesc: "မလိုအပ်သော ကန့်သတ်ချက်များနှင့် ရှုပ်ထွေးသော စာချုပ်များမရှိဘဲ လျင်မြန်စိတ်ချရသော စနစ်စောင့်ကြည့်မှုသာ ဖြစ်ပါသည်။",
    why1Title: "တစ်မိနစ်အောက် စစ်ဆေးမှုများ",
    why1Desc: "ရိုးရိုးစနစ်များတွင် အခမဲ့အကောင့်များကို ၅ မိနစ်ခြားသာ စစ်ဆေးခွင့်ပေးထားသည်။ UptimeMonke သည် အစကတည်းက တစ်မိနစ်အောက် စစ်ဆေးခွင့်ပေးထားသဖြင့် ပြဿနာများကို ချက်ချင်းသိနိုင်သည်။",
    why2Title: "SSRF ကာကွယ်မှုအပြည့်ပါ ဆာဗာများ",
    why2Desc: "RFC1918 ကာကွယ်မှု၊ AWS IMDSv2 တိုက်ခိုက်မှုကာကွယ်မှုများနှင့် DNS rebinding တားဆီးမှုများ ပါဝင်သောကြောင့် ကုမ္ပဏီတွင်းစနစ်များအတွက်ပါ လုံခြုံစိတ်ချရသည်။",
    why3Title: "မိမိစိတ်ကြိုက် အများပြည်သူကြည့် စတေးတပ်စ်စာမျက်နှာ",
    why3Desc: "/status/:slug တွင် ရက်ပေါင်း ၉၀ လည်ပတ်မှုမှတ်တမ်းနှင့် တိုက်ရိုက်ဖြစ်ရပ်များကို ဖော်ပြပေးနိုင်သော စာမျက်နှာကို ဖန်တီးပေးနိုင်သည်။",
    why4Title: "ဆက်သွယ်ရေးလမ်းကြောင်း ပေါင်းစုံသတိပေးချက်",
    why4Desc: "Slack, Discord, Telegram, Webhook နှင့် Mailgun အီးမေးလ်များသို့ အခက်အခဲမရှိ ပို့ဆောင်ပေးနိုင်ပြီး အတုအယောင်သတိပေးချက်များကို ကာကွယ်ပေးထားသည်။",

    pricingTag: "လစဉ်ကြေးပေးရန်မလိုပါ",
    pricingTitle: "ပေးချေရမည့် အခပေးအစီအစဉ် မရှိပါ",
    pricingLede: "လုပ်ဆောင်ချက်အားလုံးကို အခမဲ့အကောင့်တွင် အသုံးပြုနိုင်ပါသည်။ မိမိဆန္ဒအလျောက် ကူညီပံ့ပိုးမှုသည် အမှန်တကယ်ဆာဗာကုန်ကျစရိတ်ဖြစ်သော စစ်ဆေးမှုအရေအတွက်အတွက်သာ ဖြစ်ပါသည်။",
    freeForeverLabel: "အမြဲတမ်း အခမဲ့",
    checksPerDay: "တစ်ရက်လျှင် စစ်ဆေးမှုအကြိမ်ရေ",
    freeDesc: "၁ မိနစ်ခြားစစ်ဆေးမည့်စနစ် ၁၀ ခု (သို့မဟုတ်) ၅ မိနစ်ခြား စနစ် ၅၀ (သို့မဟုတ်) ၆ စက္ကန့်ခြား ၁ ခု — ဆာဗာအလုပ်လုပ်ရမှု တူညီသောကြောင့် အားလုံး အခမဲ့ဖြစ်ပါသည်။",
    coffeeAddsLabel: "$၂.၉၉ တန် ကော်ဖီတစ်ခွက် ထည့်ဝင်ပါက",
    checksUnit: "အကြိမ် စစ်ဆေးမှု ထပ်တိုးရရှိမည်",
    coffeeDesc: "၁ မိနစ်ခြားစနစ် ၂၀ ခုအတွက် တစ်လစာခန့်။ အသုံးမပြုရသေးသော စစ်ဆေးမှုများ ဆုံးရှုံးမသွားဘဲ လစဉ်ကြေးမလိုဘဲ နောက်လများသို့ ကူးပြောင်းသွားမည်။",
    buyCoffeeBtn: "ကော်ဖီတစ်ခွက် တိုက်ကျွေးရန်",
    coffeeNotice: "စစ်ဆေးမှုအရေအတွက် သင့်အကောင့်ထဲ တိုက်ရိုက်ရောက်ရှိစေရန် ပထမဦးစွာ အကောင့်ဝင်ရောက်ပေးပါ။",
    ifCreditRunsOutLabel: "စစ်ဆေးမှု ကုန်ဆုံးသွားပါကလည်း",
    nothingDeletedFigure: "မည်သည့်အရာမှ ဖျက်ပစ်မည်မဟုတ်ပါ",
    graceDesc: "၁ ပတ်ကြာ ခွင့်ပြုချိန်ရရှိမည်ဖြစ်ပြီး ၎င်းနောက် တစ်ရက်လျှင် ၁၄,၄၀၀ ကြိမ် အခမဲ့နှုန်းသို့ ချောမွေ့စွာ ပြန်လည်ရောက်ရှိပါမည်။ စောင့်ကြည့်စစ်ဆေးမှုများ ရပ်တန့်သွားမည်မဟုတ်ပါ။",
    whyCapacityExplanation: "အဘယ်ကြောင့် စနစ်အရေအတွက်မဟုတ်ဘဲ စစ်ဆေးမှုအကြိမ်ရေကို အခြေခံသနည်း? ၅ စက္ကန့်ခြားစစ်ဆေးမှုသည် ၁ မိနစ်ခြားစစ်ဆေးမှုထက် ၁၂ ဆ ပိုမိုဝန်ပိသောကြောင့် စစ်ဆေးမှုနှုန်းအပေါ် မူတည်တွက်ချက်ခြင်းက အမျှတဆုံးဖြစ်ပါသည်။",

    faqTag: "အမေးများသော မေးခွန်းများ",
    faqTitle: "သင်သိရှိလိုသမျှ အချက်အလက်များ",
    faqDesc: "UptimeMonke နှင့်ပတ်သက်၍ မေးလေ့ရှိသော မေးခွန်းများအတွက် ရိုးသားသော ရှင်းလင်းချက်များ။",
    faq1Q: "UptimeMonke သည် အမှန်တကယ် အခမဲ့လား? ခရက်ဒစ်ကတ် လိုအပ်ပါသလား?",
    faq1A: "ဟုတ်ကဲ့၊ အမှန်တကယ် အခမဲ့ဖြစ်ပါသည်။ အကောင့်တိုင်းသည် နေ့စဉ် ၁၄,၄၀၀ ကြိမ် စစ်ဆေးမှုကို အမြဲတမ်း အခမဲ့ရရှိမည်ဖြစ်ပြီး ခရက်ဒစ်ကတ်လုံးဝမလိုအပ်ပါ။",
    faq2Q: "UptimeRobot ကဲ့သို့သော ရိုးရိုးစနစ်များနှင့် မည်သို့ကွာခြားသနည်း?",
    faq2A: "ယခင်စနစ်များသည် အခမဲ့အကောင့်များကို ၅ မိနစ်ခြားသာ ကန့်သတ်ထားပြီး SSL သတိပေးချက်နှင့် Cron စနစ်များကို လစဉ်ကြေးယူကြသည်။ UptimeMonke သည် ၎င်းတို့ကို အခမဲ့ပေးထားပြီး ဆန္ဒအလျောက် ကော်ဖီဖိုးလှူဒါန်းမှုဖြင့်သာ လည်ပတ်ပါသည်။",
    faq3Q: "စောင့်ကြည့်စစ်ဆေးမှုများကို မည်သည့်နေရာမှ ပြုလုပ်ပါသနည်း?",
    faq3A: "စင်ကာပူရှိ AWS Lightsail (ap-southeast-1a) မှ စစ်ဆေးပေးပါသည်။ အသုံးပြုသူများ တိုက်ရိုက်ကြုံတွေ့ရမည့် အချိန်အစစ်အမှန်ကို တိုင်းတာနိုင်ရန် HTTP keep-alive ကို ပိတ်ထားပါသည်။",
    faq4Q: "ထည့်ဝင်ထားသော စစ်ဆေးမှုများ ကုန်သွားပါက မည်သို့ဖြစ်မည်နည်း?",
    faq4A: "သင့်စနစ်များကို မည်သည့်အခါမျှ ဖျက်ပစ်မည်မဟုတ်ပါ။ ၇ ရက်ခွင့်ပြုချိန်ရရှိမည်ဖြစ်ပြီး ၎င်းနောက် တစ်ရက် ၁၄,၄၀၀ ကြိမ် အခမဲ့စနစ်သို့ အလိုအလျောက် အဆင်ပြေစွာ ပြန်လည်ရောက်ရှိပါမည်။",
    faq5Q: "သုံးစွဲသူများ ကြည့်ရှုနိုင်ရန် စတေးတပ်စ်စာမျက်နှာ ဖန်တီးနိုင်ပါသလား?",
    faq5A: "ဖန်တီးနိုင်ပါသည်။ /status/:slug ဖြင့် ရက်ပေါင်း ၉၀ လည်ပတ်မှုမှတ်တမ်းနှင့် အချက်အလက်များကို ချက်ချင်းလင့်ခ်မျှဝေနိုင်ပါသည်။",

    ctaTag: "ယနေ့ပင် စတင်လိုက်ပါ",
    ctaTitle: "မသိလိုက်ဘဲ ဝဘ်ဆိုက်ပျက်ကျနေမှုများကို ကာကွယ်ရန် အဆင်သင့်ဖြစ်ပြီလား?",
    ctaDesc: "အရေးကြီးသော ဝဘ်ဆိုက်နှင့် API များကို အွန်လိုင်းပေါ် အမြဲရှိနေစေရန် လုပ်ဆောင်နေကြသော ဆော့ဖ်ဝဲအင်ဂျင်နီယာများနှင့် ပူးပေါင်းလိုက်ပါ။ စတင်ရန် စက္ကန့် ၃၀ သာ ကြာပါမည်။",
    startFreeMonitoring: "အခမဲ့ စောင့်ကြည့်စစ်ဆေးခြင်း စတင်ရန် →",
    ctaFooterNotice: "နေ့စဉ် အခမဲ့စစ်ဆေးမှု ၁၄,၄၀၀ ကြိမ် · ခရက်ဒစ်ကတ်မလို · ချက်ချင်းအသုံးပြုနိုင်သည်",

    footerTagline: "UptimeMonke · ပေါ့ပါးသွက်လက်ပြီး စိတ်ချရသော အခြေခံအဆောက်အအုံ စောင့်ကြည့်စနစ်",
    backToTop: "ထိပ်ဆုံးသို့ ပြန်သွားရန် ↑",

    authWelcomeBack: "ပြန်လည်ကြိုဆိုပါသည်",
    authStartMonitoring: "စက္ကန့်ပိုင်းအတွင်း စောင့်ကြည့်စစ်ဆေးပါ",
    authResetPassword: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
    authSubtitleSignIn: "သင့်မော်နီတာများ၊ ဖြစ်ရပ်များနှင့် စတေးတပ်စ်စာမျက်နှာများကို ကြည့်ရှုပါ။",
    authSubtitleSignUp: "နေ့စဉ် အခမဲ့စစ်ဆေးမှု ၁၄,၄၀၀ ကြိမ် အမြဲရရှိမည်။ ခရက်ဒစ်ကတ်မလိုပါ။",
    authSubtitleReset: "ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ရယူရန် သင့်အီးမေးလ်လိပ်စာကို ထည့်သွင်းပါ။",
    authCreateAccountTab: "အကောင့်အသစ်ဖွင့်ရန်",
    authSignInTab: "အကောင့်ဝင်ရန်",
    authOrContinueEmail: "သို့မဟုတ် အီးမေးလ်ဖြင့် ဆက်လက်လုပ်ဆောင်ရန်",
    authYourName: "သင့်အမည်",
    authWorkEmail: "အီးမေးလ်လိပ်စာ",
    authPassword: "စကားဝှက်",
    authForgotPassword: "စကားဝှက် မေ့နေပါသလား?",
    authCreateFreeAccountBtn: "အခမဲ့ အကောင့်ဖွင့်ရန် →",
    authSignInDashboardBtn: "ဒက်ရှ်ဘုတ်သို့ ဝင်ရောက်ရန် →",
    authSendResetBtn: "စကားဝှက်ပြင်ရန် ပို့ပါ",
    authProcessing: "လုပ်ဆောင်နေပါသည်…",
    authNoAccountPrompt: "အကောင့် မရှိသေးပါသလား?",
    authSignUpFreeLink: "အခမဲ့ အကောင့်ဖွင့်ပါ",
    authHaveAccountPrompt: "အကောင့် ရှိပြီးသားလား?",
    authSignInLink: "ဤနေရာတွင် အကောင့်ဝင်ပါ",
    authBackToSignIn: "← အကောင့်ဝင်ခြင်းသို့ ပြန်သွားရန်",
    pwdGreat: "စကားဝှက် အလွန်ကောင်းမွန်ပါသည်",
    pwdDecent: "စကားဝှက် သင့်တင့်ပါသည်",
    pwdTooShort: "တိုလွန်းနေပါသည် (အနည်းဆုံး ၆ လုံး)",

    // Dashboard Header & Navigation
    dashWorkspace: "လုပ်ငန်းခွင်",
    dashEditUsername: "အသုံးပြုသူအမည် ပြင်ရန်",
    dashChecksLeft: "ကြိမ် စစ်ဆေးမှုကျန်ရှိ",
    dashBuyCoffee: "ကော်ဖီတစ်ခွက် တိုက်ကျွေးရန်",
    dashAlerts: "သတိပေးချက်များ",
    dashSignOut: "အကောင့်ထွက်ရန်",
    dashSignedIn: "အကောင့်ဝင်ထားသည်",

    // Dashboard Metrics & Status
    dashOverallUptime: "စုစုပေါင်း လည်ပတ်မှု (၂၄ နာရီ)",
    dashUpMonitors: "ပုံမှန်လည်ပတ်နေသော စနစ်များ",
    dashDownMonitors: "ရပ်တန့်နေသော စနစ်များ",
    dashPausedMonitors: "ခေတ္တရပ်ထားသည်",
    dashAllOperational: "စနစ်အားလုံး ပုံမှန်လည်ပတ်နေပါသည်",
    dashIncidentsActive: "ခု ချို့ယွင်းမှုရှိနေသည်",
    dashChecksToday: "ကြိမ် ယနေ့စစ်ဆေးမှု",
    dashFreeAllowance: "တစ်ရက် ၁၄,၄၀၀ ကြိမ် အခမဲ့",

    // Dashboard Filters & Actions
    dashSearchPlaceholder: "အမည် သို့မဟုတ် URL ဖြင့် ရှာဖွေပါ…",
    dashFilterAll: "အားလုံး",
    dashFilterUp: "လည်ပတ်နေ",
    dashFilterDown: "ရပ်တန့်နေ",
    dashFilterPaused: "ခေတ္တရပ်ထား",
    dashNewMonitor: "စနစ်သစ် စောင့်ကြည့်ရန်",

    // Dashboard Public Status Page
    dashStatusPageLive: "အများသုံး အခြေအနေစာမျက်နှာ လွှင့်တင်ထားသည်-",
    dashViewStatusPage: "အခြေအနေ စာမျက်နှာကြည့်ရန်",

    // Dashboard Monitor Cards
    dashNeverChecked: "မစစ်ဆေးရသေးပါ",
    dashUptime30d: "ရက် ၃၀ လည်ပတ်မှု",
    dashCopyHeartbeat: "Ping URL ကူးယူရန်",
    dashCopied: "ကူးယူပြီးပါပြီ!",
    dashEdit: "ပြင်ဆင်ရန်",
    dashPause: "ခေတ္တရပ်ရန်",
    dashResume: "ပြန်လည်စတင်ရန်",
    dashDelete: "ဖျက်ပစ်ရန်",
    dashConfirmDelete: "ဤစနစ်ကို ဖျက်ပစ်မှာ သေချာပါသလား?",
    dashStatusUp: "ကောင်းမွန်",
    dashStatusDown: "ရပ်တန့်",
    dashStatusPending: "စစ်ဆေးနေဆဲ",
    dashStatusPaused: "ခေတ္တရပ်",
    dashMaintenance: "ပြုပြင်နေဆဲ",
    dashCertExpired: "လက်မှတ် သက်တမ်းကုန်ပြီ",
    dashCertExpiresToday: "လက်မှတ် ယနေ့ကုန်ဆုံးမည်",
    dashCertExpiresTomorrow: "လက်မှတ် မနက်ဖြန်ကုန်ဆုံးမည်",
    dashCertDays: "လက်မှတ် ရက်ပေါင်း {days} ကျန်",

    // Dashboard Empty States
    dashNoMonitorsTitle: "စောင့်ကြည့်စနစ်များ မရှိသေးပါ",
    dashNoMonitorsDesc: "စတင်ရန် ပထမဆုံး စောင့်ကြည့်စနစ်ကို ထည့်သွင်းပါ။",
    dashAddFirstMonitor: "ပထမဆုံး စနစ်စတင်ထည့်ရန်",
    dashNoMatchingMonitors: "ကိုက်ညီသော စနစ်မရှိပါ",

    // Dashboard - Form (Create / Edit Monitor)
    formNewTitle: "စောင့်ကြည့်စနစ်သစ် ဖန်တီးရန်",
    formEditTitle: "စနစ် ပြင်ဆင်ရန်",
    formMonitorType: "စောင့်ကြည့်မှု အမျိုးအစား",
    formFriendlyName: "စနစ် အမည်",
    formFriendlyNamePlaceholder: "ဥပမာ - Production API",
    formTargetUrl: "စောင့်ကြည့်မည့် URL",
    formTargetHost: "Host / ဒိုမိန်း",
    formTargetIp: "IP လိပ်စာ သို့မဟုတ် Host",
    formPort: "Port နံပါတ်",
    formInterval: "စစ်ဆေးမည့် အချိန်ခြား",
    formAlertContacts: "အသိပေးရမည့် လိပ်စာများ",
    formSelectContacts: "သတိပေးချက်လက်ခံမည့်သူ ရွေးချယ်ပါ",
    formAllContacts: "အတည်ပြုပြီးသူ အားလုံး",
    formNoContactsNotice: "အတည်ပြုပြီးသော လိပ်စာမရှိသေးပါ။ သတိပေးချက်များတွင် သွားရောက်ထည့်သွင်းပါ။",
    formAdvancedOptions: "အဆင့်မြင့် ရွေးချယ်စရာများ",
    formKeyword: "မျှော်မှန်းထားသော စကားလုံး",
    formKeywordPlaceholder: "တုံ့ပြန်မှုထဲတွင် ပါဝင်ရမည့် စကားလုံး",
    formInvertedKeyword: "ပြောင်းပြန်သတိပေးချက် (စကားလုံးတွေ့ရှိပါက သတိပေးရန်)",
    formCustomStatus: "လက်ခံမည့် HTTP အခြေအနေကုဒ်များ",
    formStatusPlaceholder: "200, 201, 204",
    formHttpHeaders: "စိတ်ကြိုက် HTTP Headers",
    formRecordType: "DNS Record အမျိုးအစား",
    formExpectedValue: "မျှော်မှန်း DNS တန်ဖိုး",
    formHeartbeatGrace: "ခွင့်ပြုချိန်",
    formPublicStatus: "အများသုံး အခြေအနေစာမျက်နှာ",
    formPublicStatusDesc: "အများသုံးစာမျက်နှာတွင် ဤစနစ်ကို ဖော်ပြရန်",
    formMuteAlerts: "သတိပေးချက် အသံပိတ်ရန်",
    formMuteAlertsDesc: "ဤစနစ်ချွတ်ယွင်းပါက သတိပေးချက် မပို့ရန်",
    formCreateBtn: "စနစ် ဖန်တီးရန်",
    formSaveBtn: "သိမ်းဆည်းရန်",
    formCancelBtn: "ပယ်ဖျက်ရန်",
    formCreating: "ဖန်တီးနေပါသည်…",
    formSaving: "သိမ်းဆည်းနေပါသည်…",

    // Dashboard - Detail Modal
    detailTitle: "စနစ် အသေးစိတ်",
    detailTabOverview: "အကျဉ်းချုပ်",
    detailTabIncidents: "ချို့ယွင်းချက် မှတ်တမ်း",
    detailTabResponseTime: "တုံ့ပြန်ချိန်",
    detailTabSettings: "ဆက်တင်များ",
    detailCurrentStatus: "လက်ရှိ အခြေအနေ",
    detailUptime: "လည်ပတ်နိုင်မှုနှုန်း",
    detailAvgResponse: "ပျမ်းမျှ တုံ့ပြန်ချိန်",
    detailIncidentsRecorded: "ဖြစ်ရပ် မှတ်တမ်းများ",
    detailNoIncidents: "ဤကာလအတွင်း ချို့ယွင်းချက် မှတ်တမ်းမရှိပါ",
    detailIncidentOngoing: "ဖြစ်ပွားနေဆဲ ချို့ယွင်းချက်",
    detailIncidentResolved: "ပြန်လည် ကောင်းမွန်သွားသည်",
    detailIncidentDuration: "ကြာချိန်",
    detailDeleteMonitor: "ဤစနစ်ကို ဖျက်ပစ်ရန်",
    detailDeleteWarning:
      "ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ။ စစ်ဆေးမှုမှတ်တမ်းအားလုံး အပြီးတိုင် ပျက်ပြယ်သွားပါမည်။",

    // Dashboard - Alert Contacts Modal
    contactsTitle: "အသိပေးရမည့် လိပ်စာများ",
    contactsSubtitle: "စနစ်များ ချွတ်ယွင်းပါက အသိပေးချက်ရရှိမည့်သူများကို ရွေးချယ်ပါ",
    contactsAddNew: "လိပ်စာ အသစ်ထည့်ရန်",
    contactsChannel: "ချန်နယ်",
    contactsName: "အမည် (ရွေးချယ်နိုင်သည်)",
    contactsDestination: "ပို့ဆောင်မည့်နေရာ / Webhook URL",
    contactsAddBtn: "လိပ်စာ ထည့်သွင်းရန်",
    contactsVerified: "အတည်ပြုပြီး",
    contactsPending: "အတည်ပြုရန် စောင့်ဆိုင်းနေသည်",
    contactsResend: "လင့်ခ် ပြန်ပို့ရန်",
    contactsTestAlert: "စမ်းသပ် သတိပေးချက်ပို့ရန်",
    contactsSending: "ပေးပို့နေပါသည်…",
    contactsDelete: "ဖယ်ရှားရန်",
    contactsNoContacts: "အသိပေးချက် လိပ်စာ မထည့်သွင်းရသေးပါ။",

    // Dashboard - Org Settings Modal
    settingsTitle: "လုပ်ငန်းခွင် ဆက်တင်များ",
    settingsWorkspaceName: "လုပ်ငန်းခွင် အမည်",
    settingsStatusPageTitle: "အများသုံး အခြေအနေစာမျက်နှာ",
    settingsSlug: "စာမျက်နှာ URL Slug",
    settingsPageTitle: "စာမျက်နှာ ခေါင်းစဉ်",
    settingsPageDesc: "စာမျက်နှာ ဖော်ပြချက်",
    settingsSave: "သိမ်းဆည်းရန်",

    // Dashboard - Support Modal
    supportTitle: "စစ်ဆေးမှု ပမာဏနှင့် အလှူ",
    supportSubtitle: "UptimeMonke သည် လစဉ်ကြေးမယူဘဲ လည်ပတ်နေပါသည်",
    supportUsedToday: "ယနေ့ စစ်ဆေးပြီးသည့် အကြိမ်ရေ",
    supportDailyBudget: "နေ့စဉ် အခမဲ့ ပမာဏ",
    supportRemainingCredit: "လှူဒါန်းမှုမှ ကျန်ရှိသော အကြိမ်ရေ",
    supportBuyCoffee: "ကော်ဖီတစ်ခွက် တိုက်ကျွေးရန်",
    supportDonateBtn: "လှူဒါန်းရန်",

    // Dashboard - Profile Modal
    profileTitle: "အကောင့်နှင့် ပရိုဖိုင်",
    profileUsername: "အသုံးပြုသူ အမည်",
    profileEmail: "အီးမေးလ် လိပ်စာ",
    profileSave: "ပရိုဖိုင် အဆင့်မြှင့်ရန်",
    profileSaving: "အဆင့်မြှင့်နေပါသည်…",

    // AI & Onboarding Enhancements
    heroAiBadge: "🤖 AI အက်ပ်နှင့် API Gateway စောင့်ကြည့်စစ်ဆေးမှု",
    heroAiHeadline: "သင့် AI အက်ပ်ကို UptimeMonke ဖြင့် စောင့်ကြည့်စစ်ဆေးပါ",
    heroAiSubtext: "LLM agents၊ OpenAI & Claude proxies၊ FastAPI backends နှင့် ဝဘ်အက်ပ်များကို စက္ကန့်ပိုင်းအတွင်း edge probes ဖြင့် စောင့်ကြည့်ပါ။",
    presetAiApi: "🤖 AI / LLM API",
    presetWebApp: "🌐 ဝဘ်အက်ပ်",
    presetSsl: "🔒 SSL လက်မှတ်",
    presetHeartbeat: "⚡ Cron Heartbeat",
    onboardingJourneyTag: "ရိုးရှင်းသော အဆင့် ၃ ဆင့်",
    onboardingJourneyTitle: "စက္ကန့် ၃၀ အတွင်း စတင်အသုံးပြုနိုင်ပါသည်",
    onboardingStep1: "၁။ ပစ်မှတ်ရွေးချယ်ပါ",
    onboardingStep1Desc: "သင့် AI endpoint၊ web API၊ SSL domain သို့မဟုတ် cron script ကို ထည့်သွင်းပါ။",
    onboardingStep2: "၂။ ၁-ကလစ်ဖြင့် အကောင့်ဝင်ပါ",
    onboardingStep2Desc: "Google သို့မဟုတ် အီးမေးလ်ဖြင့် ချက်ချင်းဝင်ရောက်နိုင်ပါသည်။ ခရက်ဒစ်ကတ် မလိုအပ်ပါ။",
    onboardingStep3: "၃။ အချိန်နှင့်တပြေးညီ စောင့်ကြည့်မှု",
    onboardingStep3Desc: "ကမ္ဘာလုံးဆိုင်ရာ probes များက ချက်ချင်းစတင်စစ်ဆေးပြီး ချွတ်ယွင်းပါက Slack သို့မဟုတ် အီးမေးလ်သို့ သတိပေးချက်ပို့ပါမည်။",
    tabAi: "AI / LLM API",
    demoAiEndpoint: "api.myapp.ai/v1/chat/completions",
    demoAiLatency: "380 ms (TTFT SLA)",
    demoAiStatus: "Stream ပုံမှန်အလုပ်လုပ်နေသည်",
    onboardTitle: "UptimeMonke မှ ကြိုဆိုပါသည်",
    onboardSubtitle: "သင့်ဝန်ဆောင်မှုများအတွက် စောင့်ကြည့်စစ်ဆေးမှု စတင်ရန် ဤအဆင့်များကို ပြီးစီးအောင်လုပ်ဆောင်ပါ။",
    onboardStep1Title: "ပထမဆုံး မော်နီတာ ဖန်တီးပါ",
    onboardStep1Desc: "AI inference endpoint၊ HTTP ဝန်ဆောင်မှု သို့မဟုတ် heartbeat ကို သတ်မှတ်ပါ။",
    onboardStep2Title: "သတိပေးချက် ဆက်သွယ်ရန်လိပ်စာ ထည့်ပါ",
    onboardStep2Desc: "Slack၊ Discord သို့မဟုတ် အီးမေးလ်ကို ချိတ်ဆက်ပါ။",
    onboardStep3Title: "အများပြည်သူသုံး အခြေအနေစာမျက်နှာ ထုတ်ဝေပါ",
    onboardStep3Desc: "သုံးစွဲသူများအတွက် အချိန်နှင့်တပြေးညီ အခြေအနေစာမျက်နှာကို မျှဝေပါ။",
    presetAiTitle: "AI အက်ပ် / LLM Gateway",
    presetAiDesc: "Inference endpoints၊ streaming latency SLA နှင့် မော်ဒယ် အခြေအနေများကို စောင့်ကြည့်ပါ။",
  },
};
