import 'server-only';
import { hasCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
import { resolveCustomerContactSnapshot } from '@/modules/customers/customers.service';
import { runCreationSubmission, SubmissionError } from '@/modules/submissions/submissions.service';
import type { CreationSubmissionIdentity } from '@/modules/submissions/submissions.types';
import type { QuoteCreateInput } from './quotes.schema';
import { createQuoteWithDetails, findActiveQuoteCustomFields, findQuoteById } from './quotes.repo';
import { generateQuoteNumber, prepareQuoteComponents } from './quotes.service';

function isQuoteNumberConflict(error: unknown) {
  const candidate = error as { code?: string; meta?: { target?: string | string[] } };
  return candidate?.code === 'P2002' && (Array.isArray(candidate.meta?.target) ? candidate.meta.target.includes('quoteNumber') : String(candidate.meta?.target).includes('quoteNumber'));
}

export async function createQuoteFromPayload(input: QuoteCreateInput, userId: string, submission?: CreationSubmissionIdentity | null) {
  return runCreationSubmission(submission ?? null, async () => {
    let data = input;
    if (data.customerContactId) {
      if (!data.customerId) throw new SubmissionError('Select a customer before selecting a contact.', 400, 'INVALID_CUSTOMER_CONTACT');
      try { data = { ...data, ...await resolveCustomerContactSnapshot(data.customerId, data.customerContactId) }; }
      catch (error) { throw new SubmissionError(error instanceof Error ? error.message : 'Invalid customer contact.', 400, 'INVALID_CUSTOMER_CONTACT'); }
    }
    let prepared;
    try { prepared = await prepareQuoteComponents(data); }
    catch (error) { throw new SubmissionError(error instanceof Error ? error.message : 'Failed to prepare quote.', 400, 'INVALID_QUOTE'); }
    const customFieldValues = data.customFieldValues ?? [];
    const allowed = new Set((customFieldValues.length ? await findActiveQuoteCustomFields({ fieldIds: customFieldValues.map(value => value.fieldId), business: data.business }) : []).map(field => field.id));
    const normalizedCustomFieldValues = customFieldValues.filter(value => allowed.has(value.fieldId) && hasCustomFieldValue(value.value)).map(value => ({ fieldId: value.fieldId, value: serializeCustomFieldValue(value.value) })).filter((value): value is { fieldId: string; value: string } => value.value !== null);
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await createQuoteWithDetails({ data, prepared, normalizedCustomFieldValues, userId, submission }); }
      catch (error) {
        if ((error as { code?: string })?.code === 'P2003') {
          throw new SubmissionError('A selected customer, material, department, or other quote reference no longer exists. Review those selections and save again. No quote was created.', 400, 'INVALID_QUOTE_REFERENCE');
        }
        if (!isQuoteNumberConflict(error)) throw error;
        if (data.quoteNumber?.trim()) throw new SubmissionError('That quote number is already in use. Choose another number.', 409, 'QUOTE_NUMBER_CONFLICT');
        if (attempt === 3) throw new SubmissionError('Unable to reserve a quote number. Retry the saved submission.', 503, 'QUOTE_NUMBER_BUSY');
        prepared = { ...prepared, quoteNumber: await generateQuoteNumber() };
      }
    }
    throw new Error('Quote creation did not finish.');
  }, async (record) => findQuoteById(record.id));
}
