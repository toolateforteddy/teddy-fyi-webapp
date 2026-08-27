import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, ExternalLink, Download, Video } from 'lucide-react'

export function ArticlesPage() {
  const articles = [
    {
      title: 'Open Salaries',
      author: 'TechCrunch',
      description: 'Why an open salary policy always beats secrecy in modern organizational cultures.',
      url: 'https://techcrunch.com/2015/03/21/why-an-open-salary-policy-always-beats-secrecy/',
      pdf: '/pdf/OpenSalary.pdf',
      type: 'article'
    },
    {
      title: 'Dead Sea Effect',
      author: 'Bruce F. Webster',
      description: 'The wetware crisis: exploring why talented developers leave organizations while expert beginners stay.',
      url: 'http://brucefwebster.com/2008/04/11/the-wetware-crisis-the-dead-sea-effect/',
      pdf: '/pdf/DeadSeaEffect.pdf',
      type: 'article'
    },
    {
      title: 'Expert Beginner',
      author: 'Daedtech',
      description: 'How developers stop learning and the rise of the expert beginner within engineering teams.',
      url: 'http://www.daedtech.com/how-developers-stop-learning-rise-of-the-expert-beginner/',
      pdf: '/pdf/RiseOfTheExpertBeginner.pdf',
      type: 'article'
    },
    {
      title: 'Beggar CEO and Sucker Culture',
      author: 'Daedtech',
      description: 'An analysis of corporate dynamics, startup expectations, and equity compensation realities.',
      url: 'http://www.daedtech.com/the-beggar-ceo-and-sucker-culture/',
      pdf: '/pdf/BeggarCEO.pdf',
      type: 'article'
    },
    {
      title: 'Dan Pink: Motivation',
      author: 'TED',
      description: 'The puzzle of motivation: why traditional carrot-and-stick rewards do not work for cognitive tasks.',
      url: 'https://www.ted.com/talks/dan_pink_on_motivation',
      type: 'video'
    }
  ]

  return (
    <div className="min-h-dvh bg-black text-white py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#c0a9f5]/30">
      {/* Container */}
      <div className="max-w-3xl mx-auto space-y-10">
        
        {/* Navigation / Header */}
        <header className="flex justify-between items-center pb-6 border-b border-neutral-900">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
        </header>

        {/* Hero Section */}
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-primary uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Articles I Like</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
            Articles & Media
          </h1>
          <p className="text-sm text-text-muted max-w-xl leading-relaxed">
            A curated list of articles, essays, and videos about engineering leadership, organizational culture, motivation, and professional growth.
          </p>
        </section>

        {/* Articles Grid */}
        <section className="grid grid-cols-1 gap-6 pt-4">
          {articles.map((art, idx) => (
            <div
              key={idx}
              className="group relative p-6 rounded-2xl bg-surface-tile border border-neutral-900 hover:border-neutral-850 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2 flex-1">
                {/* Header Tag */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono uppercase text-primary">
                    {art.type === 'video' ? <Video className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                    {art.author}
                  </span>
                </div>

                <a 
                  href={art.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-lg font-bold text-white group-hover:text-primary transition-colors leading-snug cursor-pointer"
                >
                  <span>{art.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-white transition-colors" />
                </a>

                <p className="text-sm text-text-muted leading-relaxed max-w-xl">
                  {art.description}
                </p>
              </div>

              {/* Action Downloads / Links */}
              {art.pdf && (
                <a
                  href={art.pdf}
                  download
                  className="self-start md:self-center flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-white hover:text-primary font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-neutral-800 hover:border-neutral-700 active:scale-95 transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
              )}
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-neutral-900 text-[10px] text-neutral-600 font-mono">
          &copy; {new Date().getFullYear()} Teddy Martin. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

export default ArticlesPage
