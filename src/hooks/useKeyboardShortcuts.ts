import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Mapping `g <key>` → Route. */
const GO_ROUTES: Record<string, string> = {
  d: '/',
  m: '/mieter',
  z: '/zaehler',
  w: '/wasser',
  n: '/nebenkosten',
  f: '/finanzen',
  r: '/rendite',
  i: '/instandhaltung',
  u: '/uebergabe',
  e: '/einstellungen',
};

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Mountet globale Tastenkürzel:
 * - `g d` / `g m` / `g z` / ... → Navigation zum jeweiligen Modul
 * - `?` → öffnet Shortcuts-Hilfe-Modal (über `onShowHelp`-Callback)
 *
 * Wird nicht ausgelöst, wenn der Fokus in einem Input/Textarea/contenteditable liegt.
 */
export function useKeyboardShortcuts(onShowHelp: () => void) {
  const navigate = useNavigate();
  const [gPressedAt, setGPressedAt] = useState<number>(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditable(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        onShowHelp();
        return;
      }

      if (e.key === 'g') {
        setGPressedAt(Date.now());
        return;
      }

      const recent = Date.now() - gPressedAt < 1500;
      if (recent && GO_ROUTES[e.key]) {
        e.preventDefault();
        setGPressedAt(0);
        navigate(GO_ROUTES[e.key]);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate, onShowHelp, gPressedAt]);
}
