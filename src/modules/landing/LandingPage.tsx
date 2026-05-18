import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Receipt,
  Droplet,
  Gauge,
  Wallet,
  Landmark,
  Wrench,
  KeyRound,
  TrendingUp,
  Coins,
  FileText,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Printer,
  Lock,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../../components/shared/Card';

function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.95c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

interface FeatureItem {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  desc: string;
}

const features: FeatureItem[] = [
  {
    icon: Users,
    iconClass: 'bg-green-500/10 text-green-700 dark:text-green-300',
    title: 'Mieterverwaltung',
    desc: 'Wohnungen, Mieter und Belegungszeiträume auf einen Blick.',
  },
  {
    icon: Receipt,
    iconClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    title: 'Nebenkostenabrechnung',
    desc: 'Jährliche Abrechnung mit Verteilungsschlüsseln, druckfertig für deine Mieter.',
  },
  {
    icon: Droplet,
    iconClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    title: 'Versorger & Verbrauch',
    desc: 'Wasser, Gas, Strom, Fernwärme — Rechnungen, Verbräuche, Anomalien.',
  },
  {
    icon: Gauge,
    iconClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    title: 'Zählerstände',
    desc: 'Alle Zähler an einem Ort, inkl. Eichfrist-Erinnerung.',
  },
  {
    icon: Wallet,
    iconClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    title: 'Mieteinnahmen',
    desc: 'Soll/Ist-Vergleich, offene Posten, Mahnwesen, Jahresübersicht.',
  },
  {
    icon: Landmark,
    iconClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    title: 'Steuer-Export',
    desc: 'Anlage V Übertragungshilfe für ELSTER mit berechneten Zeilen.',
  },
  {
    icon: Wrench,
    iconClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    title: 'Instandhaltung',
    desc: 'Reparaturen, Wartungen und wiederkehrende Aufgaben verwalten.',
  },
  {
    icon: KeyRound,
    iconClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    title: 'Übergabeprotokoll',
    desc: 'Ein-/Auszug mit Raumzustand, Zählern und Unterschrift.',
  },
  {
    icon: TrendingUp,
    iconClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    title: 'Renditeberechnung',
    desc: 'Brutto-/Nettomietrendite, Cashflow, Eigenkapitalrendite.',
  },
  {
    icon: Coins,
    iconClass: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
    title: 'Kaution & Mieterhöhung',
    desc: 'Einzahlung, Verzinsung, Erstattung — und Miethistorie mit Begründung.',
  },
  {
    icon: FileText,
    iconClass: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    title: 'Mietvertrag-Generator',
    desc: 'Druckbare Vorlage, vorausgefüllt mit deinen Stammdaten.',
  },
  {
    icon: Sparkles,
    iconClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    title: 'Mietspiegel-Vergleich',
    desc: 'Kaltmiete/m² vs. ortsübliche Vergleichsmiete mit Ampel.',
  },
];

interface PrincipleItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const principles: PrincipleItem[] = [
  {
    icon: ShieldCheck,
    title: 'Daten bleiben bei dir',
    desc: 'Alles wird lokal im Browser gespeichert (IndexedDB). Kein Account, keine E-Mail.',
  },
  {
    icon: Lock,
    title: 'Sync Ende-zu-Ende verschlüsselt',
    desc: 'Optional zwischen Geräten via Cloudflare R2 — der Server kennt das Geheimnis nie.',
  },
  {
    icon: WifiOff,
    title: 'Offline & installierbar',
    desc: 'PWA mit Service Worker: einmal geladen, läuft auch ohne Internet.',
  },
  {
    icon: Printer,
    title: 'Druckfertige A4-Layouts',
    desc: 'Abrechnungen, Mietverträge und Übergabeprotokolle direkt aus dem Browser.',
  },
];

export function LandingPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-8">
      {/* Hero */}
      <section className="text-center pt-4 sm:pt-8 space-y-5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[--color-accent]/10 text-[--color-accent] dark:text-[--color-accent-dark]">
          <Building2 size={24} strokeWidth={1.75} />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Hausverwaltung im Browser —
          <br className="hidden sm:inline" />{' '}
          <span className="text-[--color-accent] dark:text-[--color-accent-dark]">
            kostenlos, offline, ohne Konto
          </span>
          .
        </h1>
        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Eine Open-Source Web-App für private Vermieter kleiner Mehrfamilienhäuser
          (3–10 Wohneinheiten). Komplette Verwaltung &mdash; ohne Installation,
          ohne Registrierung, ohne monatliche Kosten.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white font-medium text-sm shadow-sm transition-colors"
          >
            Loslegen
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
          <a
            href="https://github.com/daniel-rck/Hausverwaltung"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium text-sm transition-colors"
          >
            <GithubMark size={16} />
            Auf GitHub ansehen
          </a>
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="prinzipien" className="space-y-3">
        <h2 id="prinzipien" className="sr-only">
          Prinzipien
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {principles.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 space-y-2"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[--color-accent]/10 text-[--color-accent] dark:text-[--color-accent-dark]">
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature-Grid */}
      <section aria-labelledby="features" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="features"
            className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Alles, was du brauchst
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Zwölf Module, miteinander verzahnt — Stammdaten landen automatisch dort, wo du sie brauchst.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map(({ icon: Icon, iconClass, title, desc }) => (
            <div
              key={title}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex gap-3"
            >
              <span
                className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md ${iconClass}`}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Ownership */}
      <Card title="Deine Daten gehören dir" padding="lg">
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
          <p>
            Alle Daten bleiben <strong>lokal in deinem Browser</strong> gespeichert.
            Es werden keine Daten an einen fremden Server gesendet — kein
            Account, keine Registrierung, keine E-Mail nötig.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Backup per JSON-Datei</strong> — jederzeit exportieren und
              auf einem anderen Gerät importieren.
            </li>
            <li>
              <strong>Transfer per Link</strong> — Daten komprimiert als URL
              teilen, z.B. vom PC aufs Tablet.
            </li>
            <li>
              <strong>Multi-Device-Sync (optional)</strong> — synchronisiere
              zwischen mehreren Geräten ohne Konto. Pairing per 6-stelligem
              Einmal-Code; das Sync-Geheimnis wird clientseitig mit AES-GCM
              verschlüsselt, der Server kennt es nie im Klartext.
            </li>
            <li>
              <strong>Installierbar</strong> — als App auf dem Homescreen deines
              Handys (PWA).
            </li>
          </ul>
        </div>
      </Card>

      {/* How it works */}
      <section aria-labelledby="wie" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="wie"
            className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            In drei Schritten startklar
          </h2>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              n: 1,
              title: 'App öffnen',
              desc: 'Browser auf — keine Installation, kein Login. Die App läuft sofort.',
            },
            {
              n: 2,
              title: 'Mietobjekt anlegen',
              desc: 'Name und Adresse eintragen, Wohnungen und Mieter hinzufügen.',
            },
            {
              n: 3,
              title: 'Fertig',
              desc: 'Alle Module greifen automatisch auf die Stammdaten zu.',
            },
          ].map(({ n, title, desc }) => (
            <li
              key={n}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2"
            >
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[--color-accent]/10 text-[--color-accent] dark:text-[--color-accent-dark] text-xs font-semibold tabular-nums">
                {n}
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {desc}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Tipp: Mach regelmäßig ein Backup über den Export-Button auf dem
          Dashboard.
        </p>
      </section>

      {/* Tech Footer */}
      <section
        aria-labelledby="tech"
        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3"
      >
        <h2
          id="tech"
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Open Source & quelloffen
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Hausverwaltung ist ein nicht-kommerzielles Open-Source-Projekt,
          veröffentlicht unter der MIT-Lizenz. Code, Issues und Diskussionen
          findest du auf GitHub.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            'React 19',
            'TypeScript',
            'Vite',
            'Tailwind CSS',
            'Dexie / IndexedDB',
            'Cloudflare Workers',
            'PWA',
            'MIT',
          ].map((label) => (
            <span
              key={label}
              className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs">
          <a
            href="https://github.com/daniel-rck/Hausverwaltung"
            target="_blank"
            rel="noreferrer"
            className="text-[--color-accent] dark:text-[--color-accent-dark] hover:underline inline-flex items-center gap-1"
          >
            <GithubMark size={12} />
            Quellcode
          </a>
          <a
            href="https://github.com/daniel-rck/Hausverwaltung/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="text-[--color-accent] dark:text-[--color-accent-dark] hover:underline"
          >
            README
          </a>
          <a
            href="https://github.com/daniel-rck/Hausverwaltung/blob/main/SETUP.md"
            target="_blank"
            rel="noreferrer"
            className="text-[--color-accent] dark:text-[--color-accent-dark] hover:underline"
          >
            Selbst hosten
          </a>
          <a
            href="https://github.com/daniel-rck/Hausverwaltung/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noreferrer"
            className="text-[--color-accent] dark:text-[--color-accent-dark] hover:underline"
          >
            Mitmachen
          </a>
          <Link
            to="/datenschutz"
            className="text-[--color-accent] dark:text-[--color-accent-dark] hover:underline"
          >
            Datenschutz
          </Link>
          <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">
            v{APP_VERSION}
          </span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center pt-2 pb-4 space-y-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[--color-accent]/10 text-[--color-accent] dark:text-[--color-accent-dark]">
          <Smartphone size={20} strokeWidth={1.75} />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bereit?
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Leg dein erstes Mietobjekt an &mdash; in zwei Minuten bist du startklar.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white font-medium text-sm shadow-sm transition-colors"
          >
            App öffnen
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
        </div>
      </section>
    </div>
  );
}
