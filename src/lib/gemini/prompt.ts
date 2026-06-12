// German on purpose — the scanned documents are German Messdienst statements.
export const EXTRACTION_PROMPT = `Du siehst Foto(s) einer deutschen Messdienst-Nutzerabrechnung
(z.B. Brunata, Metrona, Techem, Ista — "Übersicht aller Nutzerabrechnungen" für Heizung,
Warmwasser, Kaltwasser eines Mehrfamilienhauses).
Extrahiere die Abrechnungsdaten in das vorgegebene JSON-Schema.
Regeln:
- Zahlen mit Punkt als Dezimaltrenner, keine Tausendertrenner, keine Einheiten, keine Währungszeichen.
- "provider": Name des Messdienstleisters (z.B. "BRUNATA METRONA").
- "billingFrom"/"billingTo": Abrechnungszeitraum als ISO-Datum YYYY-MM-DD.
- "year": das Abrechnungsjahr (Jahr von billingTo).
- "units": ein Eintrag pro Wohnung/Nutzer (NICHT die Zeile "Summe aller Nutzer").
  - "unitLabel": Wohnungs-/Nutzernummer wie gedruckt (z.B. "0001 KG01").
  - "tenantName": Name(n) der Nutzer wie gedruckt.
  - "positions": alle Kostenzeilen der Wohnung mit "label" (z.B. "Heizung Grundkosten"),
    "amount" (Betrag in EUR), optional "consumption" (Anteile/Einheiten) und "unit" (z.B. "m³", "MWh", "m2").
  - "total": Gesamtbetrag der Wohnung in EUR.
- "totals": die Kostenzeilen der Zeile "Summe aller Nutzer" (gleiche Struktur wie positions).
- Nicht sicher erkennbare Werte: null bzw. weglassen.`;
