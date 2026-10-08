export type CreationSubmissionScope = 'quote:create' | 'order:create' | `order:repeat:${string}` | `quote:convert:${string}`;
export type CreationSubmissionIdentity = {
  key: string;
  payloadHash: string;
  kind: 'quote' | 'order';
};
export type CreatedSubmissionRecord = {
  id: string;
  submissionPayloadHash: string | null;
  orderNumber?: string;
  parts?: Array<{ id: string }>;
};
