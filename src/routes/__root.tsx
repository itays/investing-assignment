import { TanStackDevtools } from "@tanstack/react-devtools"
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

import { SiteHeader } from "@/components/site-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { loadCurrentPerson } from "@/server/functions"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  loader: () => loadCurrentPerson(),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "color-scheme",
        content: "light dark",
      },
      {
        title: "Market Desk",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>
          <h1>Page not found</h1>
        </EmptyTitle>
        <EmptyDescription>The requested page does not exist.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const person = Route.useLoaderData()

  return (
    <>
      <SiteHeader person={person} />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <Outlet />
      </main>
    </>
  )
}

// Set the theme and register the shortcut before hydration (and the first paint).
const initializeTheme = `
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  let saved;
  try { saved = localStorage.getItem("theme"); } catch {}

  const applyTheme = (dark) => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelectorAll('meta[name="color-scheme"]').forEach((meta) => {
      meta.content = dark ? "dark" : "light";
    });
  };
  applyTheme(saved === "dark" || (saved !== "light" && systemTheme.matches));

  systemTheme.addEventListener("change", (event) => {
    try { saved = localStorage.getItem("theme"); } catch { saved = undefined; }
    if (saved !== "dark" && saved !== "light") applyTheme(event.matches);
  });

  const toggleTheme = () => {
    const dark = !document.documentElement.classList.contains("dark");
    applyTheme(dark);
    saved = dark ? "dark" : "light";
    try { localStorage.setItem("theme", saved); } catch {}
  };

  window.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-theme-toggle]")
    ) toggleTheme();
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.key.toLowerCase() !== "d" || event.repeat ||
      event.altKey || event.ctrlKey || event.metaKey ||
      (event.target instanceof Element && event.target.closest(
        'input, textarea, select, [contenteditable], [role="textbox"]'
      ))
    ) return;

    toggleTheme();
  });
`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: The script contains a static, application-defined theme initializer. */}
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body className="antialiased">
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
