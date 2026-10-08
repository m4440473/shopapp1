import type { CreationSubmissionIdentity } from './submissions.types';

export function submissionFields(identity?: CreationSubmissionIdentity | null) {
  return identity ? { submissionKey: identity.key, submissionPayloadHash: identity.payloadHash } : {};
}
