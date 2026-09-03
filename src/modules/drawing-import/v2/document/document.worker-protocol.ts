import type { DrawingImportNormalizedRegion } from '../drawing-import-v2.types';

export const DOCUMENT_WORKER_PROTOCOL_VERSION = 1 as const;

export type DocumentWorkerPingRequest = {
  protocolVersion: typeof DOCUMENT_WORKER_PROTOCOL_VERSION;
  requestId: string;
  action: 'ping';
};

export type DocumentWorkerAnalyzePdfRequest = {
  protocolVersion: typeof DOCUMENT_WORKER_PROTOCOL_VERSION;
  requestId: string;
  action: 'analyze_pdf_page';
  inputPath: string;
  previewOutputPath: string;
  previewMaxDimension: number;
  previewMaxScale: number;
  crops: Array<{
    cropId: string;
    region: DrawingImportNormalizedRegion;
    outputPath: string;
  }>;
};

export type DocumentWorkerRequest = DocumentWorkerPingRequest | DocumentWorkerAnalyzePdfRequest;

export type DocumentWorkerRawTextItem = {
  text: string;
  direction: string | null;
  transform: number[];
  width: number;
  height: number;
  fontName: string | null;
  hasEol: boolean;
  fontFamily: string | null;
  fontAscent: number | null;
  fontDescent: number | null;
  vertical: boolean;
};

export type DocumentWorkerResponse = {
  protocolVersion: typeof DOCUMENT_WORKER_PROTOCOL_VERSION;
  requestId: string;
  ok: boolean;
  error?: string;
  result?: {
    pong?: true;
    page?: {
      width: number;
      height: number;
      rotation: number;
      userUnit: number;
      view: number[];
      textItems: DocumentWorkerRawTextItem[];
      preview: { path: string; width: number; height: number; hash: string };
      crops: Array<{ cropId: string; path: string; width: number; height: number; hash: string }>;
    };
  };
};
