import logo from "@/assets/logo.svg";
import { AdSlot } from "@/components/app/AdSlot";
import { TiltCard } from "@/components/app/TiltCard";
import { LanguageToggle, ThemeToggle } from "@/components/app/AppShell";
import { DemoQuiz } from "@/components/landing/DemoQuiz";
import { GameShowcase } from "@/components/landing/MiniGames";
import { Hero3DScene } from "@/components/landing/Hero3DScene";
import { useLandingCopy } from "@/components/landing/LandingCopy";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Brain,
  ChartLine,
  CheckCircle2,
  Gamepad2,
  GraduationCap,
  Languages,
  Loader2,
  MonitorSmartphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router";

const FEATURES = [
  {
    icon: BookOpenCheck,
    titleKey: "landing.feature.assessments.title",
    bodyKey: "landing.feature.assessments.body",
    tint: "from-nq-blue to-nq-violet",
  },
  {
    icon: BadgeCheck,
    titleKey: "landing.feature.grading.title",
    bodyKey: "landing.feature.grading.body",
    tint: "from-emerald-400 to-teal-500",
  },
  {
    icon: Trophy,
    titleKey: "landing.feature.gamification.title",
    bodyKey: "landing.feature.gamification.body",
    tint: "from-amber-400 to-orange-500",
  },
  {
    icon: ChartLine,
    titleKey: "landing.feature.analytics.title",
    bodyKey: "landing.feature.analytics.body",
    tint: "from-cyan-400 to-nq-blue",
  },
  {
    icon: Languages,
    titleKey: "landing.feature.bilingual.title",
    bodyKey: "landing.feature.bilingual.body",
    tint: "from-fuchsia-500 to-nq-violet",
  },
  {
    icon: MonitorSmartphone,
    titleKey: "landing.feature.devices.title",
    bodyKey: "landing.feature.devices.body",
    tint: "from-nq-violet to-nq-coral",
  },
];

const STEPS = [
  { key: "landing.step.one", icon: Brain },
  { key: "landing.step.two", icon: Rocket },
  { key: "landing.step.three", icon: Target },
] as const;

export default function Landing() {
  const { t, pick, formatNumber } = useI18n();
  const { isLoading, isAuthenticated } = useAuth();
  const status = useQuery(api.profiles.platformStatus);
  // Owner-edited copy from Admin → Settings wins over the shipped text.
  const copy = useLandingCopy(status?.settings?.landing?.landingCopy);
  const [searchParams] = useSearchParams();
  /** The owner previews the same page from Admin → Settings while signed in. */
  const previewing = searchParams.get("preview") === "1";

  const settings = status?.settings;
  const landing = settings?.landing;
  const landingGames = landing?.landingGames ?? null;
  const landingGameImages = landing?.landingGameImages ?? null;
  const sections = landing?.sections ?? {
    features: true,
    demo: true,
    games: true,
    steps: true,
    stats: false,
  };

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }
  if (isAuthenticated && !previewing) {
    return <Navigate to="/dashboard" replace />;
  }
  if (status && landing && !landing.enabled) {
    return <Navigate to="/auth" replace />;
  }

  const schoolName = settings
    ? pick(settings.schoolNameEn, settings.schoolNameAr)
    : t("app.name");
  const tagline = settings
    ? pick(settings.taglineEn ?? "", settings.taglineAr ?? "")
    : "";
  const headline = settings?.landing
    ? pick(
        settings.landing.headlineEn ?? "",
        settings.landing.headlineAr ?? "",
      ) || copy("landing.title")
    : copy("landing.title");
  const subtitle = settings?.landing
    ? pick(
        settings.landing.subtitleEn ?? "",
        settings.landing.subtitleAr ?? "",
      ) || copy("landing.subtitle")
    : copy("landing.subtitle");
  const ctaLabel = settings?.landing
    ? pick(settings.landing.ctaEn ?? "", settings.landing.ctaAr ?? "") ||
      copy("landing.cta.start")
    : copy("landing.cta.start");

  const counts = status?.counts;
  const stats = [
    {
      label: copy("landing.stat.students"),
      value: counts?.students ?? 0,
      icon: Users,
    },
    {
      label: copy("landing.stat.teachers"),
      value: counts?.teachers ?? 0,
      icon: GraduationCap,
    },
    {
      label: copy("landing.stat.assessments"),
      value: counts?.published ?? 0,
      icon: BookOpenCheck,
    },
  ];

  return (
    <div className="min-h-dvh scroll-smooth bg-background">
      {previewing && isAuthenticated ? (
        <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/15 bg-nq-navy/95 px-4 py-2 text-center text-xs text-white shadow-xl backdrop-blur">
          <span>{copy("landing.preview_banner")}</span>
          <Link
            to="/dashboard"
            className="font-bold text-nq-yellow underline underline-offset-2"
          >
            {copy("landing.preview_back")}
          </Link>
        </div>
      ) : null}
      {/* ------------------------------- Header ------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label={schoolName}
            className="flex min-w-0 items-center gap-2.5 rounded-xl transition-opacity hover:opacity-85"
          >
            {/* The platform's real logo; an uploaded logo overrides it. */}
            <img
              src={settings?.logoUrl ?? logo}
              alt={schoolName}
              width={174}
              height={192}
              className="h-10 w-auto shrink-0 object-contain drop-shadow-[0_8px_16px_rgb(17_28_61/0.16)]"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold">
                {schoolName}
              </span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {tagline || t("app.tagline")}
              </span>
            </span>
          </Link>

          <nav className="ms-6 hidden items-center gap-1 lg:flex">
            <a
              href="#features"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {copy("landing.nav.features")}
            </a>
            <a
              href="#demo"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {copy("landing.nav.demo")}
            </a>
            <a
              href="#games"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {copy("landing.nav.games")}
            </a>
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle compact />
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">{copy("landing.cta.login")}</Link>
            </Button>
            <Button asChild size="sm" className="hidden gap-1.5 sm:inline-flex">
              <Link to="/auth">
                {ctaLabel}
                <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* -------------------------------- Hero ------------------------------- */}
      <section className="nq-hero nq-dots relative overflow-hidden text-white">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-20 lg:pb-24">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-nq-turquoise" aria-hidden />
              {copy("landing.badge")}
            </span>
            <h1 className="mt-4 text-4xl leading-[1.1] font-black tracking-tight sm:text-5xl xl:text-6xl">
              {headline}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">
              {subtitle}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 border-0 bg-white text-nq-navy shadow-[0_18px_40px_-20px_rgb(0_0_0/0.7)] hover:bg-white hover:brightness-100"
              >
                <Link to="/auth">
                  {ctaLabel}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
              >
                <a href="#demo">
                  <Gamepad2 className="size-4" aria-hidden />
                  {copy("landing.cta.try")}
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-nq-turquoise" aria-hidden />
                {copy("landing.hero.secure")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-4 text-nq-yellow" aria-hidden />
                {copy("landing.hero.instant")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-nq-coral" aria-hidden />
                {copy("landing.hero.bilingual")}
              </span>
            </div>

            {sections.stats && counts ? (
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/12 bg-white/8 p-3 backdrop-blur"
                  >
                    <stat.icon className="size-4 text-white/55" aria-hidden />
                    <p className="mt-1.5 text-xl font-extrabold tabular-nums">
                      {formatNumber(stat.value)}
                    </p>
                    <p className="truncate text-[10px] font-medium text-white/55">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <Hero3DScene />
        </div>
      </section>

      {/* ------------------------------ Features ----------------------------- */}
      {sections.features ? (
        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold tracking-wide text-primary uppercase">
              <Sparkles className="size-3" aria-hidden />
              {copy("landing.features.eyebrow")}
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {copy("landing.features.title")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              {copy("landing.features.subtitle")}
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <TiltCard key={feature.titleKey} intensity={6}>
                <div className="nq-card h-full p-5">
                  <span
                    className={cn(
                      "grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_14px_28px_-18px_rgb(23_27_56/0.9)]",
                      feature.tint,
                    )}
                  >
                    <feature.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-extrabold">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {t(feature.bodyKey)}
                  </p>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>
      ) : null}

      {/* -------------------------------- Demo ------------------------------- */}
      {sections.demo ? (
        <section
          id="demo"
          className="border-y border-border/60 bg-secondary/35 py-16 lg:py-20"
        >
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-nq-violet/25 bg-nq-violet/10 px-3 py-1 text-[11px] font-bold tracking-wide text-nq-violet uppercase">
                <Brain className="size-3" aria-hidden />
                {copy("landing.demo.eyebrow")}
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {copy("landing.demo.title")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {copy("landing.demo.subtitle")}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  copy("landing.demo.point1"),
                  copy("landing.demo.point2"),
                  copy("landing.demo.point3"),
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DemoQuiz copy={copy} />
          </div>
        </section>
      ) : null}

      {/* -------------------------------- Games ------------------------------ */}
      {sections.games ? (
        <section id="games" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-nq-turquoise/30 bg-nq-turquoise/10 px-3 py-1 text-[11px] font-bold tracking-wide text-cyan-600 uppercase dark:text-nq-turquoise">
                <Gamepad2 className="size-3" aria-hidden />
                {copy("landing.games.eyebrow")}
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {copy("landing.games.title")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {copy("landing.games.subtitle")}
              </p>
            </div>
            <span className="chip gap-1.5">
              <Trophy className="size-3.5 text-nq-yellow" aria-hidden />
              {copy("landing.games.badge")}
            </span>
          </div>
          <GameShowcase className="mt-8" content={landingGames} images={landingGameImages} />
        </section>
      ) : null}

      {/* -------------------------------- Steps ------------------------------ */}
      {sections.steps ? (
        <section className="border-y border-border/60 bg-secondary/35 py-16 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                {copy("landing.steps.title")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {copy("landing.steps.subtitle")}
              </p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.key} className="nq-card relative p-5">
                  <span className="nq-gradient absolute end-4 top-4 grid size-8 place-items-center rounded-xl text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 pe-8 text-base font-extrabold">
                    {t(`${step.key}.title`)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {t(`${step.key}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* -------------------------------- Stats ------------------------------ */}
      {sections.stats && counts ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={`wide-${stat.label}`}
                className="nq-card flex items-center gap-4 p-5"
              >
                <span className="nq-gradient grid size-12 shrink-0 place-items-center rounded-2xl text-white">
                  <stat.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-2xl font-black tabular-nums">
                    {formatNumber(stat.value)}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <AdSlot className="mx-auto mt-8 w-full max-w-4xl" />
        </section>
      ) : null}

      {/* --------------------------------- CTA ------------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <div className="nq-hero nq-dots relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-10">
          <span
            aria-hidden
            className="absolute -top-16 start-1/3 size-56 rounded-full bg-nq-violet/40 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold backdrop-blur">
              <Sparkles className="size-3 text-nq-yellow" aria-hidden />
              {copy("landing.cta.eyebrow")}
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              {copy("landing.cta.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/70">
              {copy("landing.cta.body")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 border-0 bg-white text-nq-navy hover:bg-white hover:brightness-100"
              >
                <Link to="/auth">
                  {ctaLabel}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/auth">{copy("landing.cta.login")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- Footer ------------------------------ */}
      <footer className="border-t border-border/60 px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="nq-gradient grid size-7 place-items-center rounded-lg text-white">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <span>
              {schoolName} · {copy("landing.footer.rights", { year: 2026 })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#features" className="hover:text-foreground">
              {copy("landing.nav.features")}
            </a>
            <a href="#games" className="hover:text-foreground">
              {copy("landing.nav.games")}
            </a>
            <Link to="/privacy" className="hover:text-foreground">
              {copy("landing.footer.privacy")}
            </Link>
            <Link to="/auth" className="font-semibold text-primary">
              {copy("landing.cta.login")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

