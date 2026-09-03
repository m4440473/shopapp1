import { claimPhoneUpload, finishOwnedPhoneUpload, getOwnedPhoneUpload, revokePhoneUpload } from '@/modules/phone-upload/phone-upload.service';
import { phoneAdmin, phoneResponse, sameOrigin, smallJson } from '@/modules/phone-upload/phone-upload.http';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return phoneResponse(async () => getOwnedPhoneUpload((await context.params).id, await phoneAdmin()));
}
export async function POST(request: Request, context: Context) {
  return phoneResponse(async () => { sameOrigin(request); const owner = await phoneAdmin(); return claimPhoneUpload((await context.params).id, owner, await smallJson(request)); });
}
export async function DELETE(request: Request, context: Context) {
  return phoneResponse(async () => { sameOrigin(request); return revokePhoneUpload((await context.params).id, await phoneAdmin()); });
}
export async function PATCH(request: Request, context: Context) {
  return phoneResponse(async () => { sameOrigin(request); return finishOwnedPhoneUpload((await context.params).id, await phoneAdmin()); });
}
