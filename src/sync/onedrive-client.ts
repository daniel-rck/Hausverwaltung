import {
  PublicClientApplication,
  type AccountInfo,
  BrowserAuthError,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';

/**
 * Azure-App-Registrierung:
 *   - portal.azure.com → App registrations → New registration
 *   - Supported account types: Personal Microsoft accounts only
 *   - Redirect URI (SPA): deployed origin + BASE_URL, sowie http://localhost:5173 für Dev
 *   - API permissions: Files.ReadWrite.AppFolder (delegated)
 *   - Kein Client-Secret (PKCE-Flow)
 *
 * Die Client-ID darf im Frontend liegen (öffentlich). Wer die App forkt und unter
 * eigener Domain deployt, trägt hier die eigene Client-ID ein.
 */
const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID ?? '';

const SCOPES = ['Files.ReadWrite.AppFolder'];

const SYNC_FILE_NAME = 'sync.json';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const BASE_URL = import.meta.env.BASE_URL || '/';

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

export function isOneDriveConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

function getInstance(): PublicClientApplication {
  if (!msalInstance) {
    if (!CLIENT_ID) {
      throw new Error(
        'OneDrive-Sync nicht konfiguriert. VITE_ONEDRIVE_CLIENT_ID fehlt.',
      );
    }
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: window.location.origin + BASE_URL,
      },
      cache: {
        // sessionStorage statt localStorage: Token bleiben nicht persistent über
        // Browser-Sessions hinweg, was XSS-Token-Leaks deutlich entschärft.
        // Nutzer akzeptiert dafür einen erneuten Login pro neuer Browser-Session.
        cacheLocation: 'sessionStorage',
      },
    });
  }
  return msalInstance;
}

async function ensureInitialized(): Promise<PublicClientApplication> {
  const pca = getInstance();
  if (!initPromise) {
    initPromise = pca
      .initialize()
      .then(async () => {
        try {
          await pca.handleRedirectPromise();
        } catch (err) {
          // `no_token_request_cache_error` tritt auf, wenn die URL ein OAuth-Fragment
          // (z.B. aus abgebrochenem Redirect-Flow oder geleertem Cache nach signOut)
          // enthält, der zugehörige Request im Cache aber nicht mehr existiert.
          // Harmlos: URL bereinigen, App-Start nicht blockieren.
          if (isNoTokenRequestCacheError(err)) {
            const url = new URL(window.location.href);
            url.search = '';
            url.hash = '';
            window.history.replaceState(null, '', url.toString());
            return;
          }
          throw err;
        }
      });
  }
  await initPromise;
  return pca;
}

function isNoTokenRequestCacheError(err: unknown): boolean {
  return (
    err instanceof BrowserAuthError &&
    err.errorCode === 'no_token_request_cache_error'
  );
}

export async function signIn(): Promise<AccountInfo> {
  const pca = await ensureInitialized();
  const result = await pca.loginPopup({
    scopes: SCOPES,
    prompt: 'select_account',
  });
  pca.setActiveAccount(result.account);
  return result.account;
}

export async function signOut(): Promise<void> {
  const pca = await ensureInitialized();
  const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
  if (!account) return;
  // Silent logout: lokalen Cache leeren ohne Browser-Redirect
  await pca.clearCache({ account });
}

export async function getActiveAccount(): Promise<AccountInfo | null> {
  const pca = await ensureInitialized();
  return pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
}

async function getAccessToken(): Promise<string> {
  const pca = await ensureInitialized();
  const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
  if (!account) {
    throw new Error('Nicht bei OneDrive angemeldet.');
  }
  try {
    const res = await pca.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await pca.acquireTokenPopup({ scopes: SCOPES, account });
      return res.accessToken;
    }
    throw err;
  }
}

export interface RemoteFile {
  content: string;
  etag: string;
}

/**
 * Lädt `sync.json` aus dem App-Folder. `null`, wenn die Datei (noch) nicht existiert.
 * `if-none-match` erlaubt effizientes Polling: bei unverändertem ETag → 304, null zurück.
 */
export async function downloadSyncFile(
  currentEtag?: string,
): Promise<RemoteFile | null | 'not-modified'> {
  const token = await getAccessToken();
  const url = `${GRAPH_BASE}/me/drive/special/approot:/${SYNC_FILE_NAME}`;

  const metaHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (currentEtag) {
    metaHeaders['If-None-Match'] = currentEtag;
  }

  const metaRes = await fetch(url, { headers: metaHeaders });
  if (metaRes.status === 404) {
    return null;
  }
  if (metaRes.status === 304) {
    return 'not-modified';
  }
  if (!metaRes.ok) {
    throw new Error(`OneDrive-Download fehlgeschlagen: ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as { eTag?: string; '@odata.etag'?: string };
  const etag = (meta['@odata.etag'] ?? meta.eTag ?? '').toString();

  const contentRes = await fetch(`${url}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!contentRes.ok) {
    throw new Error(`OneDrive-Inhalt fehlgeschlagen: ${contentRes.status}`);
  }
  const content = await contentRes.text();

  return { content, etag };
}

/**
 * Schreibt `sync.json` in den App-Folder.
 * `ifMatch` sichert gegen Race-Conditions: wenn der Remote-ETag inzwischen
 * abweicht, liefert Graph 412 Precondition Failed — der Caller muss dann
 * neu mergen und erneut versuchen.
 */
export async function uploadSyncFile(
  content: string,
  ifMatch?: string,
): Promise<string> {
  const token = await getAccessToken();
  const url = `${GRAPH_BASE}/me/drive/special/approot:/${SYNC_FILE_NAME}:/content`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (ifMatch) {
    headers['If-Match'] = ifMatch;
  }

  const res = await fetch(url, { method: 'PUT', headers, body: content });
  if (res.status === 412) {
    throw new EtagConflictError('Remote wurde parallel geändert.');
  }
  if (!res.ok) {
    throw new Error(`OneDrive-Upload fehlgeschlagen: ${res.status}`);
  }
  const data = (await res.json()) as { eTag?: string; '@odata.etag'?: string };
  return (data['@odata.etag'] ?? data.eTag ?? '').toString();
}

export class EtagConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtagConflictError';
  }
}
