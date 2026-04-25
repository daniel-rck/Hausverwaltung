import type { RentChange } from '../db/schema';

/**
 * §558 BGB — Validierung einer Vergleichsmieten-Erhöhung.
 *
 * Geprüfte Regeln (Standard-Kappungsgrenze 20% in 3 Jahren — in vielen
 * Großstädten per Verordnung auf 15% gesenkt; konfigurierbar):
 *  - 12-Monats-Sperrfrist seit der letzten Erhöhung
 *  - 15-Monats-Wartezeit nach Mietbeginn vor der ersten Erhöhung
 *  - Kappungsgrenze: max. 20% (bzw. 15%) in 3 Jahren ggü. der Miete vor 3 Jahren
 *
 * Modernisierungs- und Indexerhöhungen unterliegen anderen Regeln und
 * werden hier ausgenommen (`reason !== 'mietspiegel'` → keine Prüfung).
 *
 * Achtung: Die Berechnungen sind ein Hilfsmittel — die rechtliche
 * Prüfung liegt beim Vermieter. Banner-Hinweis in der UI vorgesehen.
 */

export interface RentLawIssue {
  level: 'warn' | 'error';
  message: string;
}

export interface RentLawCheckInput {
  effectiveDate: string; // YYYY-MM
  newRentCold: number;
  oldRentCold: number;
  reason: 'mietspiegel' | 'index' | 'modernization' | 'agreement';
  occupancyFrom: string; // YYYY-MM
  history: RentChange[]; // bestehende Änderungen, beliebige Reihenfolge
  cappingPct?: number; // default 20
}

/** "YYYY-MM" → Datum 1. des Monats (lokale Zeit, ausreichend für Monatsdiff) */
function ymToDate(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}

function monthsBetween(fromYM: string, toYM: string): number {
  const [y1, m1] = fromYM.split('-').map(Number);
  const [y2, m2] = toYM.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function checkRentIncrease(input: RentLawCheckInput): RentLawIssue[] {
  const issues: RentLawIssue[] = [];

  if (input.reason !== 'mietspiegel') return issues;
  if (input.newRentCold <= input.oldRentCold) return issues;

  const cappingPct = input.cappingPct ?? 20;
  const sortedPast = input.history
    .filter((r) => r.effectiveDate < input.effectiveDate)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  const lastChange = sortedPast[sortedPast.length - 1];
  const lastIncreaseDate = lastChange?.effectiveDate ?? input.occupancyFrom;

  const monthsSinceLast = monthsBetween(lastIncreaseDate, input.effectiveDate);
  if (monthsSinceLast < 12) {
    issues.push({
      level: 'error',
      message: `12-Monats-Sperrfrist nicht eingehalten — seit der letzten Erhöhung (${lastIncreaseDate}) sind erst ${monthsSinceLast} Monate vergangen.`,
    });
  }

  // 15-Monats-Wartezeit nach Mietbeginn vor erster Erhöhung
  if (sortedPast.length === 0) {
    const sinceMoveIn = monthsBetween(input.occupancyFrom, input.effectiveDate);
    if (sinceMoveIn < 15) {
      issues.push({
        level: 'error',
        message: `Erste Mieterhöhung frühestens 15 Monate nach Mietbeginn zulässig (aktuell ${sinceMoveIn} Monate).`,
      });
    }
  }

  // Kappungsgrenze: Vergleich mit Miete, die 36 Monate vor effectiveDate galt
  const refDate = ymToDate(input.effectiveDate);
  refDate.setMonth(refDate.getMonth() - 36);
  const refYM = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;

  // Welche Kaltmiete galt zum Zeitpunkt refYM?
  // History enthält "neueRente ab effectiveDate". Wenn nichts früher als refYM existiert,
  // gilt occupancy.rentCold zum Mietbeginn (= input.oldRentCold beim ersten Eintrag schwierig
  // zu rekonstruieren; deshalb: rentBeforeRef = älteste oldRentCold oder input.oldRentCold).
  let rentBeforeRef: number;
  const beforeRef = sortedPast.filter((r) => r.effectiveDate <= refYM);
  if (beforeRef.length > 0) {
    rentBeforeRef = beforeRef[beforeRef.length - 1].newRentCold;
  } else if (sortedPast.length > 0) {
    rentBeforeRef = sortedPast[0].oldRentCold;
  } else {
    rentBeforeRef = input.oldRentCold;
  }

  if (rentBeforeRef > 0) {
    const totalIncreasePct = ((input.newRentCold - rentBeforeRef) / rentBeforeRef) * 100;
    if (totalIncreasePct > cappingPct) {
      issues.push({
        level: 'error',
        message: `Kappungsgrenze überschritten — Erhöhung um ${totalIncreasePct.toFixed(1)}% in 3 Jahren (max. ${cappingPct}%).`,
      });
    } else if (totalIncreasePct > cappingPct - 2) {
      issues.push({
        level: 'warn',
        message: `Kappungsgrenze nahezu erreicht (${totalIncreasePct.toFixed(1)}% von max. ${cappingPct}%).`,
      });
    }
  }

  return issues;
}
