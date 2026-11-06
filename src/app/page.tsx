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
      <div className="cards"><article><span className="card-index">01 / KEEP IT PERSONAL</span><h3>A place for your taste.</h3><p>Your reactions, your watchlist, your next obsession. A library that belongs to you.</p><Link className="pill" href="/library">Open your library →</Link></article><article><span className="card-index">02 / FIND YOUR NEXT FAVORITE</span><h3>Follow what you love.</h3><p>Movie and TV suggestions shaped by your taste, with a reason behind every pick.</p><Link className="pill" href="/for-you">See your recommendations →</Link></article><article><span className="card-index">03 / A SECOND OPINION</span><h3>A verdict, if you want one.</h3><p>Optional AI opinions, only when you ask. Your movie night stays in your hands.</p><Link className="pill" href="/ai/find">Find something with AI →</Link></article></div>
    </section>
  </>;
}
