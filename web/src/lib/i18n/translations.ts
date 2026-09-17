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
      "Yes! Every account receives 14,400 free checks every single day forever. No credit card is ever required. You can monitor 10 endpoints at 1-minute intervals or 50 endpoints at 5-minute intervals completely free.",
    faq2Q: "How is UptimeMonke different from traditional tools like UptimeRobot?",
    faq2A:
      "Legacy monitoring services restrict free accounts to slow 5-minute check intervals and paywall critical features like SSL certificate expiry warnings and cron heartbeat monitoring behind monthly recurring subscriptions. UptimeMonke provides sub-minute intervals, SSL tracking, heartbeats, and public status pages on the free tier, supported by optional one-off $2.99 coffee donations instead of subscriptions.",
    faq3Q: "Where are monitoring probes dispatched from?",
    faq3A:
      "Probes originate from hardened AWS Lightsail edge instances (currently in Singapore ap-southeast-1a). Our probe engine runs with HTTP keep-alive disabled to measure genuine first-packet connection times (DNS + TCP handshake + TLS) just like real visitors experience.",
    faq4Q: "What happens if my workspace runs out of donated credit?",
    faq4A:
      "Your monitors are never paused or deleted. When your credit reaches zero, you enter a 7-day grace window at full service, after which your workspace smoothly transitions back to the 14,400 daily free allowance. Existing monitors continue checking uninterrupted.",
    faq5Q: "Can I create a public status page for my clients or users?",
    faq5A:
      "Yes. Every workspace has an instantly shareable public status page at /status/:slug. It features real-time 90-day uptime bars, overall operational status, and automated incident logs with sensitive target URLs safely withheld.",

    ctaTag: "Get Started Today",
    ctaTitle: "Ready to eliminate undetected downtime?",
    ctaDesc:
      "Join developers keeping their critical web applications and APIs online. Setup takes under 30 seconds.",
    startFreeMonitoring: "Start Free Monitoring →",
    ctaFooterNotice:
      "14,400 free checks every day · No credit card required · Instant setup",

    footerTagline: "UptimeMonke · Lightweight Infrastructure Monitoring",
    backToTop: "Back to top ↑",

    authWelcomeBack: "Welcome back",
    authStartMonitoring: "Start monitoring in seconds",
    authResetPassword: "Reset your password",
    authSubtitleSignIn: "Access your monitors, incidents, and status pages.",
    authSubtitleSignUp: "14,400 free checks daily forever. No credit card required.",
    authSubtitleReset: "Enter your email to receive a recovery link.",
    authCreateAccountTab: "Create Account",
    authSignInTab: "Sign In",
    authOrContinueEmail: "or continue with email",
    authYourName: "Your Name",
    authWorkEmail: "Work or Personal Email",
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
  },
};
