/**
 * Uploaded PDFs live on the server (server/data/uploads), so every device sees them.
 * Same function names as the old IndexedDB version, so callers did not change.
 */
import { downloadFile, removeFile, uploadFile } from '../api';

export const putFile = (id: string, blob: Blob, onProgress?: (percent: number) => void) =>
  uploadFile(id, blob, onProgress);
export const getFile = (id: string) => downloadFile(id);
export const deleteFile = (id: string) => removeFile(id);
