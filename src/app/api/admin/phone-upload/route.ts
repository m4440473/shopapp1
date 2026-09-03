import { createPhoneUpload } from '@/modules/phone-upload/phone-upload.service';
import { phoneAdmin, phoneResponse, sameOrigin, smallJson } from '@/modules/phone-upload/phone-upload.http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return phoneResponse(async () => { sameOrigin(request); const owner = await phoneAdmin(); return createPhoneUpload(owner, await smallJson(request), new URL(request.url).origin); });
}
