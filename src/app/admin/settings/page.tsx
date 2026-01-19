import NavTabs from '@/components/Admin/NavTabs';
import { getAppSettings } from '@/lib/app-settings';
import Client from './client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <h1 className="mb-3 text-xl font-semibold">Settings</h1>
      <Client settings={settings} />
    </div>
  );
}
