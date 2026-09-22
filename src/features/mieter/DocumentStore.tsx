import { useRef, useState } from "react";
import { db, deleteWithTombstone, useLiveQuery } from "../../lib/db";
import type { AppDocument } from "../../lib/db/schema";
import { Card } from "../../lib/ui/shared/Card";
import { EmptyState } from "../../lib/ui/shared/EmptyState";
import { Button, Callout, Modal, Skeleton, useConfirm, useToast } from "../../lib/ui/ui";
import { FileText, Image as ImageIcon, Plus } from "../../lib/ui/ui/icons";

interface DocumentStoreProps {
  entityType: "unit" | "occupancy" | "property" | "maintenance";
  entityId: number;
  title?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const mbFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${mbFormatter.format(bytes / (1024 * 1024))} MB`;
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Konvertiert eine Data-URL ("data:application/pdf;base64,...") in einen Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Ungültige Data-URL");
  const mime = match[1] ?? "application/octet-stream";
  const isBase64 = match[2] === ";base64";
  const payload = match[3] ?? "";
  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

export function DocumentStore({ entityType, entityId, title = "Dokumente" }: DocumentStoreProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<AppDocument | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  const documents = useLiveQuery(async () => {
    const docs = await db.documents
      .where("[entityType+entityId]")
      .equals([entityType, entityId])
      .toArray();
    return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [entityType, entityId]);

  const totalSize = documents?.reduce((sum, d) => sum + d.size, 0) ?? 0;
  const docCount = documents?.length ?? 0;

  const handleUpload = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = "";

    if (file.size > MAX_FILE_SIZE) {
      setError(`Datei zu groß (${formatSize(file.size)}). Maximal 5 MB erlaubt.`);
      return;
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError(`Dateityp nicht unterstützt (${file.type || "unbekannt"}).`);
      return;
    }

    let data: string;
    try {
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error(err);
      setError("Datei konnte nicht gelesen werden.");
      return;
    }

    if (!data.startsWith(`data:${file.type};base64,`)) {
      setError("Datei konnte nicht gelesen werden.");
      return;
    }

    try {
      await db.documents.add({
        entityType,
        entityId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        data,
        uploadedAt: new Date().toISOString(),
      });
      setError(null);
      toast.success("Dokument hochgeladen.");
    } catch (err) {
      toast.error("Hochladen fehlgeschlagen.");
      console.error(err);
    }
  };

  const handlePreview = (doc: AppDocument) => {
    if (isPdf(doc.mimeType)) {
      // Blob-URL statt Data-URL: kleinere URL, isolierter Origin via blob:-Scheme,
      // bessere Browser-Kompatibilität und automatische GC nach revoke.
      try {
        const blob = dataUrlToBlob(doc.data);
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        // Nach kurzer Zeit revoken — Blob-URLs leben sonst bis Tab-Close
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        if (!win) {
          setError("Pop-up wurde blockiert. Bitte in den Browser-Einstellungen erlauben.");
        }
      } catch (err) {
        console.error(err);
        setError("PDF konnte nicht geöffnet werden.");
      }
    } else if (isImage(doc.mimeType)) {
      setPreviewDoc(doc);
    }
  };

  const handleDelete = async (doc: AppDocument) => {
    if (doc.id == null) return;
    const ok = await confirm({
      title: "Dokument löschen?",
      message: `„${doc.name}“ wird unwiderruflich gelöscht.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteWithTombstone("documents", doc.id);
      toast.success("Dokument gelöscht.");
    } catch (err) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(err);
    }
  };

  return (
    <>
      <Card
        title={title}
        action={
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={handleUpload}>
            Datei hochladen
          </Button>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
          aria-label="Datei auswählen"
          tabIndex={-1}
        />

        {error && (
          <Callout variant="danger" className="mb-3">
            {error}
          </Callout>
        )}

        {documents === undefined ? (
          <div className="space-y-2">
            <Skeleton height="2rem" />
            <Skeleton height="2rem" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} strokeWidth={1.75} />}
            title="Keine Dokumente vorhanden"
            description="Laden Sie PDF- oder Bilddateien hoch."
            action={{ label: "Datei hochladen", onClick: handleUpload }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-medium text-fg-muted w-8" />
                    <th className="text-left py-2 px-2 text-xs font-medium text-fg-muted">Name</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-fg-muted">
                      Größe
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-fg-muted">Datum</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-fg-muted">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-border/50 hover:bg-surface-muted/30"
                    >
                      <td className="py-2 px-2 text-center">
                        {isPdf(doc.mimeType) ? (
                          <FileText
                            size={18}
                            strokeWidth={1.75}
                            className="inline-block text-danger-fg"
                            aria-label="PDF"
                          />
                        ) : (
                          <ImageIcon
                            size={18}
                            strokeWidth={1.75}
                            className="inline-block text-info-fg"
                            aria-label="Bild"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => handlePreview(doc)}
                          className="text-fg hover:text-accent dark:hover:text-accent-dark hover:underline text-left truncate max-w-[200px] block"
                          title={doc.name}
                        >
                          {doc.name}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right text-fg-muted font-mono text-xs">
                        {formatSize(doc.size)}
                      </td>
                      <td className="py-2 px-2 text-fg-muted text-xs">
                        {new Date(doc.uploadedAt).toLocaleDateString("de-DE")}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          onClick={() => void handleDelete(doc)}
                          aria-label={`${doc.name} löschen`}
                        >
                          Löschen
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t border-border text-xs text-fg-muted">
              Speicher: {formatSize(totalSize)} ({docCount}{" "}
              {docCount === 1 ? "Dokument" : "Dokumente"})
            </div>
          </>
        )}
      </Card>

      <Modal
        open={previewDoc !== null && isImage(previewDoc.mimeType)}
        onClose={() => setPreviewDoc(null)}
        title={<span className="block truncate">{previewDoc?.name}</span>}
        size="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setPreviewDoc(null)}>
            Schließen
          </Button>
        }
      >
        {previewDoc && (
          <div className="flex items-center justify-center">
            <img
              src={previewDoc.data}
              alt={previewDoc.name}
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
