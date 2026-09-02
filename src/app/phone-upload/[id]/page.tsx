import { PhonePhotoUpload } from '@/components/orders/drawing-import/PhonePhotoUpload';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send drawing photos — ShopApp', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function PhoneUploadPage({ params }: { params: Promise<{ id: string }> }) {
  return <PhonePhotoUpload id={(await params).id} />;
}
