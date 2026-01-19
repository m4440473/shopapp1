'use client';

import * as React from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { hexToHslCss, isValidHex, normalizeHex } from '@/lib/colors';
import { getInitials } from '@/lib/get-initials';

const TEMPLATE_OPTIONS = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional header, totals block, and clear line items.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Compact layout with subtle dividers and a focus on parts.',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High-contrast headings with a prominent totals section.',
  },
] as const;

type InvoiceTemplateId = (typeof TEMPLATE_OPTIONS)[number]['id'];

type InvoiceOptionsState = {
  showLogo: boolean;
  showTerms: boolean;
  showPO: boolean;
  showNotes: boolean;
};

function parseInvoiceOptions(value: string | null): InvoiceOptionsState {
  if (!value) {
    return { showLogo: false, showTerms: false, showPO: false, showNotes: false };
  }
  try {
    const parsed = JSON.parse(value) as Partial<InvoiceOptionsState>;
    return {
      showLogo: Boolean(parsed.showLogo),
      showTerms: Boolean(parsed.showTerms),
      showPO: Boolean(parsed.showPO),
      showNotes: Boolean(parsed.showNotes),
    };
  } catch {
    return { showLogo: false, showTerms: false, showPO: false, showNotes: false };
  }
}

function applyThemeVariables(primary: string, accent: string) {
  const primaryHex = normalizeHex(primary);
  const accentHex = normalizeHex(accent);
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', primaryHex);
  root.style.setProperty('--brand-accent', accentHex);
  root.style.setProperty('--brand-primary-hsl', hexToHslCss(primaryHex));
  root.style.setProperty('--brand-accent-hsl', hexToHslCss(accentHex));
  root.style.setProperty('--primary', hexToHslCss(primaryHex));
  root.style.setProperty('--accent', hexToHslCss(accentHex));
  root.style.setProperty('--ring', hexToHslCss(primaryHex));
  root.style.setProperty('--sidebar-primary', hexToHslCss(primaryHex));
  root.style.setProperty('--sidebar-ring', hexToHslCss(primaryHex));
  root.style.setProperty('--sidebar-accent', hexToHslCss(accentHex));
}

type AppSettingsProps = {
  companyName: string;
  logoPath: string | null;
  themePrimary: string;
  themeAccent: string;
  attachmentsDir: string;
  requirePOForQuoteApproval: boolean;
  requirePOForQuoteToOrder: boolean;
  invoiceTemplateId: string;
  invoiceOptions: string | null;
};

export default function Client({ settings }: { settings: AppSettingsProps }) {
  const [companyName, setCompanyName] = React.useState(settings.companyName);
  const [logoPath, setLogoPath] = React.useState<string | null>(settings.logoPath);
  const [themePrimary, setThemePrimary] = React.useState(settings.themePrimary);
  const [themeAccent, setThemeAccent] = React.useState(settings.themeAccent);
  const [attachmentsDir, setAttachmentsDir] = React.useState(settings.attachmentsDir);
  const [requirePOForQuoteApproval, setRequirePOForQuoteApproval] = React.useState(
    settings.requirePOForQuoteApproval,
  );
  const [requirePOForQuoteToOrder, setRequirePOForQuoteToOrder] = React.useState(
    settings.requirePOForQuoteToOrder,
  );
  const [invoiceTemplateId, setInvoiceTemplateId] = React.useState<InvoiceTemplateId>(
    (settings.invoiceTemplateId as InvoiceTemplateId) ?? 'classic',
  );
  const [invoiceOptions, setInvoiceOptions] = React.useState<InvoiceOptionsState>({
    ...parseInvoiceOptions(settings.invoiceOptions),
  });
  const [logoVersion, setLogoVersion] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const logoUrl = logoPath ? `/branding/logo?v=${logoVersion}` : null;
  const initials = getInitials(companyName);
  const safePrimary = isValidHex(themePrimary) ? normalizeHex(themePrimary) : '#0ea5e9';
  const safeAccent = isValidHex(themeAccent) ? normalizeHex(themeAccent) : '#a855f7';

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/settings/logo', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to upload logo');
      }
      setLogoPath(data.logoPath ?? null);
      setLogoVersion((prev) => prev + 1);
      setMessage('Logo updated.');
    } catch (err: any) {
      setError(err?.message || 'Unable to upload logo');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          themePrimary,
          themeAccent,
          attachmentsDir,
          requirePOForQuoteApproval,
          requirePOForQuoteToOrder,
          invoiceTemplateId,
          invoiceOptions,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.formErrors?.[0] || 'Failed to update settings');
      }

      applyThemeVariables(themePrimary, themeAccent);
      setMessage('Settings saved.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>App configuration</CardTitle>
          <CardDescription>Single-tenant settings apply to the entire installation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            {message && <p className="text-sm text-emerald-300">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="storage">Uploads &amp; storage</TabsTrigger>
          <TabsTrigger value="workflow">Workflow rules</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Update the company name and logo used across the app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Shopapp1"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="logoUpload">Company logo</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-muted">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Company logo" className="h-12 w-12 object-contain" />
                    ) : (
                      <span className="text-lg font-semibold text-muted-foreground">{initials}</span>
                    )}
                  </div>
                  <Input id="logoUpload" type="file" accept="image/*" onChange={handleLogoUpload} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Uploads are saved under the attachments storage root and appear in headers and invoices.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme colors</CardTitle>
              <CardDescription>Pick primary and accent colors. Changes apply instantly after saving.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="themePrimary">Primary color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="themePrimary"
                        value={themePrimary}
                        onChange={(event) => setThemePrimary(event.target.value)}
                        placeholder="#0ea5e9"
                      />
                      <input
                        aria-label="Select primary color"
                        type="color"
                        value={safePrimary}
                        onChange={(event) => setThemePrimary(event.target.value)}
                        className="h-10 w-12 rounded border border-border bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="themeAccent">Accent color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="themeAccent"
                        value={themeAccent}
                        onChange={(event) => setThemeAccent(event.target.value)}
                        placeholder="#a855f7"
                      />
                      <input
                        aria-label="Select accent color"
                        type="color"
                        value={safeAccent}
                        onChange={(event) => setThemeAccent(event.target.value)}
                        className="h-10 w-12 rounded border border-border bg-transparent"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The palette drives buttons, highlights, and sidebar accents with no rebuild required.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Live preview</p>
                <div
                  className="mt-3 rounded-lg border border-border bg-background/80 p-4"
                  style={{
                    background: `linear-gradient(135deg, ${safePrimary} 0%, ${safeAccent} 100%)`,
                  }}
                >
                  <div className="rounded-md bg-background/85 p-4 text-sm text-foreground shadow">
                    Primary and accent colors combine for highlights, chips, and call-to-actions.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Uploads &amp; storage</CardTitle>
              <CardDescription>Control where attachments are stored on disk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="attachmentsDir">Attachments storage root (ATTACHMENTS_DIR)</Label>
              <Input
                id="attachmentsDir"
                value={attachmentsDir}
                onChange={(event) => setAttachmentsDir(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Changing this does not move existing files. Update this before new uploads are captured.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow rules</CardTitle>
              <CardDescription>Enforce approval attachments during key quote steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={requirePOForQuoteApproval}
                  onCheckedChange={(checked) => setRequirePOForQuoteApproval(checked === true)}
                />
                Require PO or approval attachment before marking a quote as received.
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={requirePOForQuoteToOrder}
                  onCheckedChange={(checked) => setRequirePOForQuoteToOrder(checked === true)}
                />
                Require PO or approval attachment before converting a quote to an order.
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice templates</CardTitle>
              <CardDescription>Select a template and enable optional elements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={invoiceTemplateId}
                onValueChange={(value) => setInvoiceTemplateId(value as InvoiceTemplateId)}
                className="grid gap-3 md:grid-cols-3"
              >
                {TEMPLATE_OPTIONS.map((template) => (
                  <label
                    key={template.id}
                    htmlFor={`template-${template.id}`}
                    className={`flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm transition hover:border-primary/40 ${
                      invoiceTemplateId === template.id ? 'border-primary/60 bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id={`template-${template.id}`} value={template.id} />
                      <span className="font-medium text-foreground">{template.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{template.description}</span>
                  </label>
                ))}
              </RadioGroup>

              <div className="space-y-3">
                <p className="text-sm font-medium">Template options</p>
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={invoiceOptions.showLogo}
                    onCheckedChange={(checked) =>
                      setInvoiceOptions((prev) => ({ ...prev, showLogo: checked === true }))
                    }
                  />
                  Show company logo in the header.
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={invoiceOptions.showTerms}
                    onCheckedChange={(checked) =>
                      setInvoiceOptions((prev) => ({ ...prev, showTerms: checked === true }))
                    }
                  />
                  Include payment terms on the footer.
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={invoiceOptions.showPO}
                    onCheckedChange={(checked) =>
                      setInvoiceOptions((prev) => ({ ...prev, showPO: checked === true }))
                    }
                  />
                  Display PO or approval reference fields.
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={invoiceOptions.showNotes}
                    onCheckedChange={(checked) =>
                      setInvoiceOptions((prev) => ({ ...prev, showNotes: checked === true }))
                    }
                  />
                  Show internal notes block on the invoice.
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
}
