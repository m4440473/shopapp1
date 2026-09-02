export const PHONE_UPLOAD_LIMITS = { files: 100, fileBytes: 20 * 1024 * 1024, totalBytes: 95 * 1024 * 1024, lifetimeMs: 30 * 60 * 1000 } as const;
export type PhoneUploadContext = {
  destination: 'quote' | 'order';
  business: string; customerName: string; draftReference: string;
  intakeMode: 'ONE_OFF' | 'ASSEMBLY'; assemblyMultiplier: number;
};
export type PhoneUploadFile = { id: string; filename: string; size: number; hash: string; requestId: string };
export type PhoneUploadSession = PhoneUploadContext & {
  id: string; ownerId: string; tokenHash: string; expiresAt: number; retainUntil: number;
  status: 'OPEN' | 'READY' | 'IMPORTED' | 'REVOKED'; files: PhoneUploadFile[]; jobId?: string;
};
export type PhoneUploadStatus = Pick<PhoneUploadSession, 'id' | 'status' | 'expiresAt'> & { count: number; bytes: number };
export class PhoneUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
