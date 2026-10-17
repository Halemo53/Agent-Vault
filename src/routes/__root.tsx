import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { WagmiProvider } from "wagmi";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { wagmiConfig } from "../lib/web3";
import logoMark from "../assets/logo-mark.png";
import { ConnectButton } from "../components/av/ConnectButton";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl">404</h1>
        <p className="mt-4 text-muted-foreground">This page does not exist.</p>
        <Link to="/" className="btn-av btn-primary mt-6">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again or head home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-av btn-primary" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
          <a href="/" className="btn-av btn-outline">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AgentVault — Budget vaults for AI agents" },
      { name: "description", content: "Privacy-preserving, on-chain spending limits for autonomous AI agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const nav = [
  { to: "/vault", label: "Vault" },
  { to: "/agents", label: "Agents" },
  { to: "/vendors", label: "Vendors" },
  { to: "/monitor", label: "Monitor" },
  { to: "/docs", label: "Docs" },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SiteHeader />
        <main className="animate-page">
          <Outlet />
        </main>
        <footer className="border-t">
          <div className="container-av py-8 text-sm">
            <span className="rule-av mb-6" aria-hidden />
            <div className="flex flex-col justify-between gap-4 md:flex-row">
            <span className="text-muted-foreground">AgentVault · Built for Primus Labs Code Prover</span>
            <div className="flex gap-6">
              <a href="https://github.com/primus-labs" target="_blank" rel="noreferrer" className="link-av">GitHub</a>
              <Link to="/docs" className="link-av">Docs</Link>
              <a href="https://discord.gg/3pwZEcm6s8" target="_blank" rel="noreferrer" className="link-av">Discord</a>
            </div>
            </div>
          </div>
        </footer>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="AgentVault home">
      <img src={logoMark} alt="" width={30} height={30} className="h-[30px] w-[30px]" />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">AgentVault</span>
    </Link>
  );
}

function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 bg-background transition-[border-color] ${scrolled ? "border-b-2 border-primary" : "border-b"}`}>
      <div className="container-av flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="nav-link-av">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ConnectButton />
          <button className="btn-av btn-outline h-10 w-10 px-0 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/20" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="animate-drawer absolute right-0 top-0 flex h-full w-72 flex-col border-l bg-background p-6">
            <div className="flex items-center justify-between">
              <span className="rule-av" aria-hidden />
              <button className="btn-av btn-outline h-10 w-10 px-0" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-6" aria-label="Mobile">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} className="nav-link-av self-start text-lg" onClick={() => setOpen(false)}>{n.label}</Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
