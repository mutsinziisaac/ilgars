import {
  Fragment,
  StrictMode,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "leaflet/dist/leaflet.css"
import "@/i18n"
import { LANGUAGE_CHANGE_EVENT, normalizeLocale, i18n } from "@/i18n"
import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/query-client"

function LocaleBoundary({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(() =>
    normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
  )

  useEffect(() => {
    const updateLocale = () => {
      setLocale(normalizeLocale(i18n.resolvedLanguage ?? i18n.language))
    }

    const handleLanguageEvent = () => updateLocale()

    i18n.on("languageChanged", updateLocale)
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageEvent)

    return () => {
      i18n.off("languageChanged", updateLocale)
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageEvent)
    }
  }, [])

  return <Fragment key={locale}>{children}</Fragment>
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="light">
          <LocaleBoundary>
            <App />
          </LocaleBoundary>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
