import { prisma } from '@/lib/prisma';
import { hexToHslCss, normalizeHex } from '@/lib/colors';

export const APP_SETTINGS_SINGLETON_ID = 'singleton';

export type ThemeVars = Record<string, string>;

export type AppSettingsRecord = {
  id: string;
  companyName: string;
  logoPath: string | null;
  themePrimary: string;
  themeAccent: string;
  attachmentsDir: string;
  requirePOForQuoteApproval: boolean;
  requirePOForQuoteToOrder: boolean;
  invoiceTemplateId: string;
  invoiceOptions: string | null;
  updatedAt: Date;
};

export async function getAppSettings(): Promise<AppSettingsRecord> {
  const existing = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_SINGLETON_ID } });
  if (existing) return existing;

  return prisma.appSettings.create({
    data: {
      id: APP_SETTINGS_SINGLETON_ID,
    },
  });
}

export async function updateAppSettings(data: Partial<AppSettingsRecord>): Promise<AppSettingsRecord> {
  return prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    update: data,
    create: {
      id: APP_SETTINGS_SINGLETON_ID,
      ...data,
    },
  });
}

export function buildThemeVars(
  settings: Pick<AppSettingsRecord, 'themePrimary' | 'themeAccent'>,
): ThemeVars {
  const primaryHex = normalizeHex(settings.themePrimary);
  const accentHex = normalizeHex(settings.themeAccent);
  const primaryHsl = hexToHslCss(primaryHex);
  const accentHsl = hexToHslCss(accentHex);

  return {
    '--brand-primary': primaryHex,
    '--brand-accent': accentHex,
    '--brand-primary-hsl': primaryHsl,
    '--brand-accent-hsl': accentHsl,
    '--primary': primaryHsl,
    '--accent': accentHsl,
    '--ring': primaryHsl,
    '--sidebar-primary': primaryHsl,
    '--sidebar-ring': primaryHsl,
    '--sidebar-accent': accentHsl,
  };
}
