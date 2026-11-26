import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Admin } from './Admin'
import { Guest } from './Guest'
import { supabase } from './survey'
import './style.css'

const admin = location.pathname.replace(/\/+$/, '') === '/admin'
if (admin) document.title = 'Staff Access · Haidilao Tasting Survey'

function App() {
  return <>
    <header className="top">
      <div className="page-width top-inner">
        <a className="brand" href="/" aria-label="Haidilao guest survey">
          <img src="/haidilao-logo.svg" alt="" width={164} height={62} />
        </a>
        {admin && <nav><a href="/">Guest survey</a></nav>}
      </div>
    </header>
    {!admin ? <Guest /> : supabase ? <Admin /> : <main className="page-width">
      <section className="card notice login"><p className="eyebrow">STAFF ACCESS</p>
        <h1>Staff sign-in</h1><p>Connect Supabase to enable staff access.</p>
      </section>
    </main>}
    <footer className="page-width"><span>Haidilao · Food Sampling</span><span>Customer Feedback Survey</span></footer>
  </>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
