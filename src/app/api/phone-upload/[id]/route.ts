import { addPhonePhoto, finishPhoneUpload, getPhoneUpload } from '@/modules/phone-upload/phone-upload.service';
import { boundedBody, boundedPhotoRequest, phoneResponse, sameOrigin } from '@/modules/phone-upload/phone-upload.http';
import { PHONE_UPLOAD_LIMITS } from '@/modules/phone-upload/phone-upload.types';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
const capability = (request: Request) => request.headers.get('x-phone-upload-token') || '';
export async function GET(request: Request, context: Context) {
  return phoneResponse(async () => getPhoneUpload((await context.params).id, capability(request)));
}
export async function POST(request: Request, context: Context) {
  return phoneResponse(() => boundedPhotoRequest(async () => {
    sameOrigin(request);
    const id = (await context.params).id, token = capability(request);
    await getPhoneUpload(id, token); // Reject unauthorized requests before reading the body.
    return addPhonePhoto(id, token, {
      bytes: await boundedBody(request, PHONE_UPLOAD_LIMITS.fileBytes), mimeType: request.headers.get('content-type') || '',
      filename: decodeURIComponent(request.headers.get('x-photo-filename') || ''), requestId: request.headers.get('x-photo-id') || '',
    });
  }));
}
export async function PATCH(request: Request, context: Context) {
  return phoneResponse(async () => { sameOrigin(request); return finishPhoneUpload((await context.params).id, capability(request)); });
}
