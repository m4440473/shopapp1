import { redirect } from 'next/navigation';
import { Calculator, Database, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/Card';
import { getServerAuthSession } from '@/lib/auth-session';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';
import FeedsSpeedsCalculator from './FeedsSpeedsCalculator';

export default async function FeedsSpeedsPage() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect(buildSignInRedirectPath('/tools/feeds-speeds'));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary" className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
            Shop Tools
          </Badge>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-foreground">Feeds and Speeds</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              A full-scope calculator page for the whole shop. Mix any supported FSWizard tool family with the attached FSWizard material database and get native ShopApp recommendations without leaving the app.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/70 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <Calculator className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Full Tool Coverage</p>
                <p className="text-xs text-muted-foreground">Milling, drilling, reaming, threading, turning.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">FSWizard Materials</p>
                <p className="text-xs text-muted-foreground">Using the provided embedded material database directly.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Calculator Only</p>
                <p className="text-xs text-muted-foreground">No presets or saved setups in v1.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <FeedsSpeedsCalculator />
    </div>
  );
}
