import { useEffect, useMemo, useState } from 'react';
import {
  capabilities,
  contactCards,
  differentiators,
  equipment,
  gallery,
  materials,
  navSections,
  supportedCompanies,
  whyUs,
} from './siteContent';

const sectionIds = navSections.map((section) => section.id);

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const observers = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (!observers.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActive(visible.target.id);
        }
      },
      {
        rootMargin: '-35% 0px -45% 0px',
        threshold: [0.2, 0.35, 0.5, 0.65],
      },
    );

    observers.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function useRevealOnScroll() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!targets.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -12% 0px' },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
}

function useScrollMetrics() {
  const [metrics, setMetrics] = useState({ progress: 0, depth: 0 });

  useEffect(() => {
    const update = () => {
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;
      const progress = documentHeight > 0 ? Math.min(scrollY / documentHeight, 1) : 0;
      setMetrics({ progress, depth: scrollY });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return metrics;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function App() {
  const activeSection = useActiveSection(sectionIds);
  useRevealOnScroll();
  const { progress, depth } = useScrollMetrics();

  const heroPanelStyle = useMemo(
    () => ({
      transform: `translate3d(0, ${Math.min(depth * 0.08, 42)}px, 0) scale(${1 + progress * 0.03})`,
    }),
    [depth, progress],
  );

  return (
    <div className="site-shell">
      <div className="scroll-indicator" aria-hidden="true">
        <span style={{ transform: `scaleY(${Math.max(progress, 0.04)})` }} />
      </div>
      <div className="ambient-grid" aria-hidden="true">
        <div className="ambient-grid__halo ambient-grid__halo--one" />
        <div className="ambient-grid__halo ambient-grid__halo--two" />
        <div className="ambient-grid__mesh" style={{ transform: `translateY(${depth * -0.04}px)` }} />
      </div>

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-lockup__eyebrow">Unified manufacturing group</span>
          <a href="#hero" onClick={(event) => { event.preventDefault(); scrollToSection('hero'); }}>
            Sterling / C&amp;R / PKP
          </a>
        </div>
        <nav aria-label="Section navigation" className="topbar__nav">
          {navSections.map((section) => (
            <a
              key={section.id}
              className={activeSection === section.id ? 'is-active' : ''}
              href={`#${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToSection(section.id);
              }}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero section" id="hero">
          <div className="section__content hero__grid">
            <div className="hero__copy" data-reveal="slide-up">
              <p className="section-kicker">Full-service manufacturing under one roof</p>
              <h1>
                Precision machining, fabrication, finishing, and powder coating built for
                serious production.
              </h1>
              <p className="hero__lede">
                Sterling Tool &amp; Die, C &amp; R Machine and Fabrication, and Preferred Kustom
                Powder operate together as one integrated manufacturing operation—ready for
                prototype work, production parts, and complete finished assemblies.
              </p>
              <div className="hero__actions">
                <button className="button button--primary" onClick={() => scrollToSection('contact')}>
                  Request a Quote
                </button>
                <button className="button button--ghost" onClick={() => scrollToSection('capabilities')}>
                  View Capabilities
                </button>
              </div>
              <ul className="hero__signals" aria-label="Key facts">
                <li>30,000 sq ft facility</li>
                <li>.001 tolerances held regularly</li>
                <li>10 four-axis CNC machines</li>
                <li>Design-to-finish one-stop execution</li>
              </ul>
            </div>

            <div className="hero__visual" data-reveal="fade" style={heroPanelStyle}>
              <div className="hero__visual-frame">
                <div className="hero__visual-copy">
                  <span>Production readiness</span>
                  <strong>Machining + Fabrication + Finishing</strong>
                </div>
                <div className="hero__visual-stack">
                  <article>
                    <span>Machining</span>
                    <strong>4-axis throughput</strong>
                  </article>
                  <article>
                    <span>Fabrication</span>
                    <strong>Integrated builds</strong>
                  </article>
                  <article>
                    <span>Finishing</span>
                    <strong>In-house powder coat</strong>
                  </article>
                </div>
                <div className="hero__rings" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--panel" id="brands">
          <div className="section__content section__two-column">
            <div data-reveal="slide-up">
              <p className="section-kicker">One roof. Three brands. One manufacturing partner.</p>
              <h2>Separate specialties, unified execution.</h2>
              <p>
                This operation combines Sterling Tool &amp; Die, C &amp; R Machine and
                Fabrication, and Preferred Kustom Powder into a single manufacturing
                ecosystem. The result is fewer external handoffs, tighter accountability,
                and a cleaner path from raw material to finished part.
              </p>
            </div>
            <div className="brand-stack" data-reveal="fade">
              <article>
                <span>Sterling Tool &amp; Die</span>
                <p>Precision machining and production-focused manufacturing execution.</p>
              </article>
              <article>
                <span>C &amp; R Machine and Fabrication</span>
                <p>Fabrication, integrated builds, and manufacturing support capability.</p>
              </article>
              <article>
                <span>Preferred Kustom Powder</span>
                <p>In-house powder coating and finishing that closes the loop on delivery.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="capabilities">
          <div className="section__content">
            <div className="section-heading" data-reveal="slide-up">
              <p className="section-kicker">Capabilities</p>
              <h2>Built to cover the full manufacturing stack.</h2>
              <p>
                From prototype support to production throughput, the operation is designed
                to keep critical work in-house and moving.
              </p>
            </div>
            <div className="capability-grid">
              {capabilities.map((capability, index) => (
                <article key={capability.title} className="capability-card" data-reveal="slide-up">
                  <span className="capability-card__index">0{index + 1}</span>
                  <h3>{capability.title}</h3>
                  <p>{capability.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--contrast" id="why-us">
          <div className="section__content">
            <div className="section-heading" data-reveal="slide-up">
              <p className="section-kicker">Why choose us</p>
              <h2>Industrial customers use us when the work actually matters.</h2>
            </div>
            <div className="stats-grid" data-reveal="fade">
              {differentiators.map((item) => (
                <article key={item.label} className="stat-card">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
            <div className="why-grid">
              {whyUs.map((point) => (
                <article key={point} className="bullet-card" data-reveal="slide-up">
                  <span className="bullet-card__marker" aria-hidden="true" />
                  <p>{point}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="trust">
          <div className="section__content section__two-column section__two-column--tight">
            <div data-reveal="slide-up">
              <p className="section-kicker">Industries and trust</p>
              <h2>Trusted by demanding industrial teams.</h2>
              <p>
                We support customers that expect dimensional control, production readiness,
                and reliable delivery. For now, company references are presented as text only.
              </p>
            </div>
            <div className="trust-cloud" data-reveal="fade">
              {supportedCompanies.map((company) => (
                <span key={company}>{company}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--panel" id="materials">
          <div className="section__content section__two-column">
            <div data-reveal="slide-up">
              <p className="section-kicker">Material range</p>
              <h2>Comfortable across steels, stainless, aluminum, plastics, and titanium.</h2>
              <p>
                The shop works across production metals and engineering plastics, allowing
                programs to stay with one manufacturing partner even when part requirements shift.
              </p>
            </div>
            <div className="material-cloud" data-reveal="fade">
              {materials.map((material) => (
                <span key={material}>{material}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="equipment">
          <div className="section__content">
            <div className="section-heading" data-reveal="slide-up">
              <p className="section-kicker">Equipment</p>
              <h2>Real capacity for repeatable throughput.</h2>
            </div>
            <div className="equipment-grid">
              {equipment.map((item) => (
                <article key={item.label} className="equipment-card" data-reveal="slide-up">
                  <strong>{item.count}</strong>
                  <p>{item.label}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--gallery" id="gallery">
          <div className="section__content">
            <div className="section-heading" data-reveal="slide-up">
              <p className="section-kicker">Visual gallery</p>
              <h2>Placeholder media now. Easy swaps later.</h2>
              <p>
                The gallery uses stock imagery today and is intentionally structured so real
                shop photography can replace these assets without changing layout code.
              </p>
            </div>
            <div className="gallery-grid">
              {gallery.map((item) => (
                <article key={item.title} className="gallery-card" data-reveal="fade">
                  <img alt={item.title} loading="lazy" src={item.image} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--cta" id="contact">
          <div className="section__content section__two-column">
            <div data-reveal="slide-up">
              <p className="section-kicker">Request a quote</p>
              <h2>Bring us the program. We can carry it from design support to finished part.</h2>
              <p>
                Add your production quote workflow, direct contact details, and final legal
                copy here when the team is ready to expose the page publicly.
              </p>
            </div>
            <div className="contact-grid" data-reveal="fade">
              {contactCards.map((card) => (
                <article key={card.title} className="contact-card">
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <a href="mailto:placeholder@example.com">{card.cta}</a>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
