import Link from "next/link";

export default function Home() {
  return <>
    <section className="hero">
      <p className="eyebrow"><span className="dot" /> YOUR NEXT GOOD WATCH STARTS HERE</p>
      <h1>Life’s too short<br />for <em>bad movies.</em></h1>
      <p className="intro">A little less scrolling. A lot more stories you love.<br className="desktop-break" /> A personal home for your movie and TV taste.</p>
      <div className="actions"><Link className="button primary" href="/discover">Browse movies &amp; TV <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/login">Make yourself at home <span aria-hidden="true">↗</span></Link></div>
      <p className="small muted">Free, personal, and made for the love of film.</p>
      <div className="ticket" aria-hidden="true"><span className="ticket-number">01 / THE OPENING SCENE</span><div className="frame"><span>YOUR TASTE.<br /><i>THE MAIN<br />CHARACTER.</i></span><span className="play">▶</span></div><div className="ticket-bottom"><span>IS IT WORTH IT?</span><span>ADMIT ONE</span></div></div>
    </section>
    <section id="how-it-works" className="principles"><div className="section-title"><p className="eyebrow">A BETTER KIND OF MOVIE NIGHT</p><h2>More you. Less guesswork.</h2></div>
      <div className="cards"><article><span className="card-index">01 / KEEP IT PERSONAL</span><h3>A place for your taste.</h3><p>Your reactions, your watchlist, your next obsession. A library that belongs to you.</p><span className="pill">Library · Ready to explore</span></article><article><span className="card-index">02 / FIND YOUR NEXT FAVORITE</span><h3>Follow what you love.</h3><p>Movie and TV suggestions shaped by your taste, with a reason behind every pick.</p><span className="pill">Recommendations · Phase 4</span></article><article><span className="card-index">03 / A SECOND OPINION</span><h3>A verdict, if you want one.</h3><p>Optional Gemini opinions, only when you ask. Your movie night stays in your hands.</p><span className="pill">Optional AI · Phase 5</span></article></div>
    </section>
    <section className="foundation"><div><p className="eyebrow">THE OPENING CHAPTER</p><h2>The foundation is taking shape.</h2><p>Explore the catalog, keep a personal library, and start shaping your taste. Recommendations are coming in the next chapter.</p></div><Link className="button secondary" href="/settings">Visit your account <span aria-hidden="true">→</span></Link></section>
  </>;
}
