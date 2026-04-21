import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteWithTombstone } from '../../db';
import { Card } from '../../components/shared/Card';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import type { AppDocument } from '../../db/schema';

interface DocumentStoreProps {
  entityType: 'unit' | 'occupancy' | 'property' | 'maintenance';
  entityId: number;
  title?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function DocumentStore({
  entityType,
  entityId,
  title = 'Dokumente',
}: DocumentStoreProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<AppDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<AppDocument | null>(null);

  const documents = useLiveQuery(
    async () => {
      const docs = await db.documents
        .where('[entityType+entityId]')
        .equals([entityType, entityId])
        .toArray();
      return docs.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      );
    },
    [entityType, entityId],
  );

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
    e.target.value = '';

    if (file.size > MAX_FILE_SIZE) {
      setError(`Datei zu groß (${formatSize(file.size)}). Maximal 5 MB erlaubt.`);
      return;
    }

    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

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
  };

  const handlePreview = (doc: AppDocument) => {
    if (isPdf(doc.mimeType)) {
      window.open(doc.data);
    } else if (isImage(doc.mimeType)) {
      setPreviewDoc(doc);
    }
  };

  const handleDelete = async () => {
    if (deleteDoc?.id) {
      await deleteWithTombstone('documents', deleteDoc.id);
      setDeleteDoc(null);
    }
  };

  return (
    <>
      <Card
        title={title}
        action={
          <button
            onClick={handleUpload}
            className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Datei hochladen
          </button>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!documents || documents.length === 0 ? (
          <EmptyState
            icon="📄"
            title="Keine Dokumente vorhanden"
            description="Laden Sie PDF- oder Bilddateien hoch."
            action={{ label: 'Datei hochladen', onClick: handleUpload }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-700">
                    <th className="text-left py-2 px-2 text-xs font-medium text-stone-500 dark:text-stone-400 w-8" />
                    <th className="text-left py-2 px-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                      Name
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                      Größe
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                      Datum
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-stone-100 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-700/30"
                    >
                      <td className="py-2 px-2 text-center">
                        {isPdf(doc.mimeType) ? (
                          <span className="text-red-500" title="PDF">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-5 h-5 inline-block"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zM10 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 0110 8z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-blue-500" title="Bild">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-5 h-5 inline-block"
                            >
                              <path
                                fillRule="evenodd"
                                d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-4.221-4.22a.75.75 0 00-1.06 0L2.5 11.06zm6.72-4.06a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => handlePreview(doc)}
                          className="text-stone-800 dark:text-stone-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left truncate max-w-[200px] block"
                          title={doc.name}
                        >
                          {doc.name}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right text-stone-500 dark:text-stone-400 font-mono text-xs">
                        {formatSize(doc.size)}
                      </td>
                      <td className="py-2 px-2 text-stone-500 dark:text-stone-400 text-xs">
                        {new Date(doc.uploadedAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => setDeleteDoc(doc)}
                          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400">
              Speicher: {formatSize(totalSize)} ({docCount}{' '}
              {docCount === 1 ? 'Dokument' : 'Dokumente'})
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={deleteDoc !== null}
        title="Dokument löschen"
        message={`Möchten Sie „${deleteDoc?.name}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDoc(null)}
        danger
      />

      {previewDoc && isImage(previewDoc.mimeType) && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white dark:bg-stone-800 rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 dark:border-stone-700">
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                {previewDoc.name}
              </h3>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center">
              <img
                src={previewDoc.data}
                alt={previewDoc.name}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
