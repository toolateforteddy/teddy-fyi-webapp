import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { ArticlesPage } from './ArticlesPage'
import { CrackedPage } from './CrackedPage'
import { NotFoundPage } from './NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* About me */}
      <Route path="/" element={<LandingPage />} />

      <Route path="/articles" element={<ArticlesPage />} />

      {/* A recruiter asked; a chatbot answered. Public, with its methodology attached. */}
      <Route path="/cracked" element={<CrackedPage />} />

      {/* /resume and /resume-devex are deliberately absent: nginx answers them
          before the SPA ever sees them, sniffing the user agent so link unfurls
          get the OG preview page and humans get the PDF. See teddyfyi's
          static/nginx.conf.

          The grocery app's routes are absent for a different reason -- they now
          live on grocery.teddy.fyi. nginx 302s the old paths there. */}

      {/* Anything unmatched says so and stays put. Redirecting here to "/"
          instead made a stale bundle -- one that predates a route -- look
          exactly like a broken server rule. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
