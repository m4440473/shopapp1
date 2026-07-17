'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Gauge, Layers3, RefreshCcw, Wrench } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  calculateFeedsSpeeds,
  fswizardMaterials,
  fswizardToolCoatings,
  fswizardToolMaterials,
  fswizardToolTypes,
  getDefaultFeedsSpeedsInputs,
  getFeedsSpeedsInputsForTool,
  getToolFamilyLabel,
  updateFeedsSpeedsDiameter,
} from '@/modules/feeds-speeds/feeds-speeds';
import type { FeedsSpeedsInputs } from '@/modules/feeds-speeds/feeds-speeds.types';

function ResultStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: keyof FeedsSpeedsInputs;
  label: string;
  value: number;
  onChange: (id: keyof FeedsSpeedsInputs, value: number) => void;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={String(id)}>{label}</Label>
      <Input
        id={String(id)}
        type="number"
        step="any"
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(id, Number(event.target.value))}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function FeedsSpeedsCalculator() {
  const defaults = useMemo(() => getDefaultFeedsSpeedsInputs(), []);
  const [inputs, setInputs] = useState<FeedsSpeedsInputs>(defaults);

  const result = useMemo(() => calculateFeedsSpeeds(inputs), [inputs]);
  const selectedTool = useMemo(
    () => fswizardToolTypes.find((item) => String(item.id) === inputs.toolTypeId) ?? null,
    [inputs.toolTypeId]
  );
  const selectedMaterial = useMemo(
    () => fswizardMaterials.find((item) => String(item.id) === inputs.materialId) ?? null,
    [inputs.materialId]
  );
  const hasErrors = Boolean(result?.errors.length);

  function patchInput<K extends keyof FeedsSpeedsInputs>(key: K, value: FeedsSpeedsInputs[K]) {
    setInputs((current) =>
      key === 'diameter'
        ? updateFeedsSpeedsDiameter(current, Number(value))
        : { ...current, [key]: value }
    );
  }

  function changeTool(toolTypeId: string) {
    setInputs((current) => getFeedsSpeedsInputsForTool(toolTypeId, current));
  }

  const isMillingTool =
    selectedTool?.type === 'endmill' ||
    selectedTool?.type === 'threadmill' ||
    selectedTool?.type === 'chamfermill' ||
    selectedTool?.type === 'cornerrounding';
  const isTurningTool =
    selectedTool?.type === 'turn' || selectedTool?.type === 'groove';
  const isThreadMill = selectedTool?.type === 'threadmill';
  const isTap = selectedTool?.type === 'tap';
  const isDrillOrReamer =
    selectedTool?.type === 'drill' || selectedTool?.type === 'ream';
  const isRotaryTool =
    selectedTool?.type === 'endmill' ||
    selectedTool?.type === 'drill' ||
    selectedTool?.type === 'ream' ||
    selectedTool?.type === 'threadmill' ||
    selectedTool?.type === 'tap' ||
    selectedTool?.type === 'chamfermill' ||
    selectedTool?.type === 'cornerrounding';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-border/70 bg-card/70">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Calculator Inputs</CardTitle>
                <CardDescription>
                  Mix tool family, material, tooling substrate, and coating the same way you would in FSWizard, but inside the ShopApp shell.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="toolTypeId">Tool family</Label>
                <Select value={inputs.toolTypeId} onValueChange={changeTool}>
                  <SelectTrigger id="toolTypeId" aria-label="Tool family">
                    <SelectValue placeholder="Choose a tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {fswizardToolTypes.map((tool) => (
                      <SelectItem key={tool.id} value={String(tool.id)}>
                        {getToolFamilyLabel(tool)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toolMaterialId">Tool material</Label>
                <Select value={inputs.toolMaterialId} onValueChange={(value) => patchInput('toolMaterialId', value)}>
                  <SelectTrigger id="toolMaterialId" aria-label="Tool material">
                    <SelectValue placeholder="Choose tooling substrate" />
                  </SelectTrigger>
                  <SelectContent>
                    {fswizardToolMaterials.map((toolMaterial) => (
                      <SelectItem key={toolMaterial.id} value={String(toolMaterial.id)}>
                        {toolMaterial.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coatingId">Coating</Label>
                <Select value={inputs.coatingId} onValueChange={(value) => patchInput('coatingId', value)}>
                  <SelectTrigger id="coatingId" aria-label="Coating">
                    <SelectValue placeholder="Choose coating" />
                  </SelectTrigger>
                  <SelectContent>
                    {fswizardToolCoatings.map((coating) => (
                      <SelectItem key={coating.id} value={String(coating.id)}>
                        {coating.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="materialId">Material</Label>
                <Select value={inputs.materialId} onValueChange={(value) => patchInput('materialId', value)}>
                  <SelectTrigger id="materialId" aria-label="Material">
                    <SelectValue placeholder="Choose material" />
                  </SelectTrigger>
                  <SelectContent>
                    {fswizardMaterials.map((material) => (
                      <SelectItem key={material.id} value={String(material.id)}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <NumberField
                id="diameter"
                label="Tool diameter (in.)"
                value={inputs.diameter}
                onChange={patchInput}
                hint="Used for RPM, chipload interpolation, and DOC/WOC suggestions."
              />
              <NumberField
                id="fluteCount"
                label="Flutes / edges"
                value={inputs.fluteCount}
                onChange={patchInput}
                hint={`Bundled family default: ${selectedTool?.flutes ?? '--'}. Enter the cutter actually in the spindle.`}
              />
              {isMillingTool || isTurningTool ? (
                <NumberField
                  id="doc"
                  label="Planned DOC (in.)"
                  value={inputs.doc}
                  onChange={patchInput}
                  hint="Enter 0 to let the FSWizard model suggest depth."
                />
              ) : null}
              {isMillingTool ? (
                <NumberField
                  id="woc"
                  label="Planned WOC (in.)"
                  value={inputs.woc}
                  onChange={patchInput}
                  hint="Enter 0 to let the FSWizard model suggest width."
                />
              ) : null}

              {isMillingTool ? (
                <div className="space-y-2">
                  <Label htmlFor="cutType">Cut type</Label>
                  <Select
                    value={inputs.slotting ? 'slot' : 'side'}
                    onValueChange={(value) => patchInput('slotting', value === 'slot')}
                  >
                    <SelectTrigger id="cutType" aria-label="Cut type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="side">Side milling</SelectItem>
                      <SelectItem value="slot">Full-width slot</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Slotting is explicit so a full-width cut cannot be mistaken for side milling.
                  </p>
                </div>
              ) : null}

              {isTurningTool ? (
                <NumberField
                  id="workDiameter"
                  label="Work diameter (in.)"
                  value={inputs.workDiameter}
                  onChange={patchInput}
                  hint="Diameter of the part where the cut is being made."
                />
              ) : null}
              {isTap ? (
                <NumberField
                  id="threadLead"
                  label="Tap lead (in./rev)"
                  value={inputs.threadLead}
                  onChange={patchInput}
                  hint="Required. For 20 TPI enter 0.05; for 13 TPI enter 0.076923."
                />
              ) : null}
              {isThreadMill ? (
                <>
                  <NumberField
                    id="threadDiameter"
                    label="Thread major diameter (in.)"
                    value={inputs.threadDiameter}
                    onChange={patchInput}
                    hint="Required for thread-path feed compensation and pilot size."
                  />
                  <div className="space-y-2">
                    <Label htmlFor="threadLocation">Thread location</Label>
                    <Select
                      value={inputs.threadExternal ? 'external' : 'internal'}
                      onValueChange={(value) => patchInput('threadExternal', value === 'external')}
                    >
                      <SelectTrigger id="threadLocation" aria-label="Thread location">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal thread</SelectItem>
                        <SelectItem value="external">External thread</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Internal and external thread mills require different center-path feed.
                    </p>
                  </div>
                </>
              ) : null}

              {isMillingTool || isTurningTool || isDrillOrReamer ? (
                <>
                  <NumberField
                    id="stickout"
                    label="Tool stickout (in.)"
                    value={inputs.stickout}
                    onChange={patchInput}
                    hint="Length from holder or tool block to the cutting tip."
                  />
                  <NumberField
                    id="fluteLength"
                    label={isTurningTool ? 'Insert / cutting length (in.)' : 'Flute length (in.)'}
                    value={inputs.fluteLength}
                    onChange={patchInput}
                    hint="The usable cutting length; it cannot exceed stickout."
                  />
                  <NumberField
                    id="shankDiameter"
                    label={isTurningTool ? 'Tool shank size (in.)' : 'Shank diameter (in.)'}
                    value={inputs.shankDiameter}
                    onChange={patchInput}
                    hint="Used by the source deflection and rigidity model."
                  />
                </>
              ) : null}

              {isMillingTool || isTurningTool ? (
                <NumberField
                  id="leadAngle"
                  label="Lead angle (degrees)"
                  value={inputs.leadAngle}
                  onChange={patchInput}
                  hint="Loaded from the selected family; change it when the actual cutter differs."
                />
              ) : null}

              {isMillingTool || isTurningTool ? (
                <NumberField
                  id="cornerRadius"
                  label="Corner radius (in.)"
                  value={inputs.cornerRadius}
                  onChange={patchInput}
                  hint="Actual cutter or insert corner radius."
                />
              ) : null}
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Machine: {result?.machine.name ?? 'Haas VF-2SS'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hard limits: {result?.machine.maxRpm.toLocaleString() ?? '12,000'} RPM and{' '}
                    {result?.machine.maxCuttingFeedIpm ?? 833} IPM cutting feed.
                  </p>
                </div>
                <Badge variant="secondary" className="border border-primary/30 bg-background/70">
                  30 hp · 90 ft-lb reference
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-3">
              <Badge variant="secondary" className="rounded-full border border-primary/30 bg-primary/10 text-primary">
                {selectedTool ? selectedTool.type.toUpperCase() : 'TOOL'}
              </Badge>
              {selectedMaterial?.hb ? (
                <Badge variant="outline" className="rounded-full border-border/80">
                  {selectedMaterial.hb} HB
                </Badge>
              ) : null}
              {selectedMaterial?.group ? (
                <Badge variant="outline" className="rounded-full border-border/80">
                  Group {selectedMaterial.group}
                </Badge>
              ) : null}
              <Button type="button" variant="secondary" className="ml-auto gap-2" onClick={() => setInputs(defaults)}>
                <RefreshCcw className="h-4 w-4" />
                Reset defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Primary Recommendation</CardTitle>
              <CardDescription>
                Programmed values after the FSWizard model and Haas VF-2SS limits are applied.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result?.errors.length ? (
                <div className="space-y-2">
                  {result.errors.map((error) => (
                    <div
                      key={error}
                      className="flex gap-3 rounded-xl border border-[#ff5a00] bg-white p-3 text-sm text-[#0b1f3a] shadow-[0_0_16px_rgba(255,90,0,0.18)]"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5a00]" />
                      <p className="font-medium">{error}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat label="SFM" value={result && !hasErrors ? `${result.sfm}` : '--'} hint={result?.sfmHigh ? `High side: ${result.sfmHigh} SFM` : 'Programmed surface speed after machine limits.'} />
              <ResultStat
                label="RPM"
                value={result && !hasErrors ? `${result.rpm}` : '--'}
                hint={
                  result?.rpmLimitApplied
                    ? `Capped from ${result.rawRpm} RPM to the VF-2SS limit.`
                    : selectedTool?.type === 'turn' || selectedTool?.type === 'groove'
                      ? 'Based on work diameter.'
                      : 'Based on effective cutting diameter.'
                }
              />
              <ResultStat
                label={selectedTool?.ipr_mode ? 'IPR' : 'Chipload'}
                value={
                  result && !hasErrors
                    ? selectedTool?.ipr_mode
                      ? `${result.ipr} in/rev`
                      : `${result.chipLoadPerTooth} in/tooth`
                    : '--'
                }
                hint={selectedTool?.ipr_mode ? 'Per revolution feed recommendation.' : 'Per tooth feed recommendation.'}
              />
              <ResultStat
                label={selectedTool?.type === 'tap' ? 'Tap Feed' : 'Feed Rate'}
                value={
                  result && !hasErrors
                    ? `${selectedTool?.type === 'tap' && result.threadFeed ? result.threadFeed : result.feedRate} in/min`
                    : '--'
                }
                hint={
                  result?.feedLimitApplied
                    ? `Capped from ${result.rawFeedRate} IPM to the VF-2SS limit.`
                    : selectedTool?.type === 'tap'
                      ? 'Uses the entered thread lead.'
                      : isDrillOrReamer
                        ? 'This is the axial drilling/reaming feed.'
                        : 'Main cutting feed in inches per minute.'
                }
              />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Operating Notes</CardTitle>
              <CardDescription>
                Quick-read guidance distilled from the selected FSWizard records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  Estimated spindle load:{' '}
                  <span className="font-medium">
                    {result?.spindleHorsepower !== null && result?.spindleHorsepower !== undefined
                      ? `${result.spindleHorsepower} hp (${result.spindleHorsepowerPercent}%)`
                      : 'not available for this operation'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  {result?.slotDoc ? `Slot DOC ${result.slotDoc}"` : 'No slot DOC guideline'}
                  {result?.sideWoc ? ` · Side WOC ${result.sideWoc}"` : ''}
                  {result?.sideDoc ? ` · Side DOC ${result.sideDoc}"` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  {result?.peckDepth ? `Peck ${result.peckDepth}"` : 'No peck recommendation'}
                  {result?.pilotDiameter ? ` · Pilot ${result.pilotDiameter}"` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  {result?.effectiveDoc !== null && result?.effectiveDoc !== undefined
                    ? `Calculated cut ${result.effectiveDoc}" DOC`
                    : 'No DOC model for this operation'}
                  {result?.effectiveWoc !== null && result?.effectiveWoc !== undefined
                    ? ` · ${result.effectiveWoc}" WOC`
                    : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="tooling">Tooling Detail</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/70 bg-card/70 lg:col-span-2">
              <CardHeader>
                <CardTitle>What This Mix Is Doing</CardTitle>
                <CardDescription>
                  A compact explanation of the output stack driving this recommendation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Material SFM starts from the selected FSWizard material row, then gets multiplied by the tool family, tooling substrate, and coating factors.
                </p>
                <p>
                  Feed starts with the FSWizard chipload table, then applies material, tool-family, tool-material, engagement, geometry, and deflection factors. Coating changes SFM, not chipload.
                </p>
                <p>
                  The final programmed RPM and feed are capped to the Haas VF-2SS envelope. Any cap or estimated spindle overload is called out explicitly.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle>Current Tool Family</CardTitle>
                <CardDescription>
                  The calculator switches behavior automatically across all tool types in the bundle.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium text-foreground">{selectedTool ? getToolFamilyLabel(selectedTool) : '--'}</p>
                <p className="text-muted-foreground">
                  {selectedTool?.ipr_mode
                    ? 'This family uses IPR/IPM style feed logic.'
                    : 'This family uses IPT/IPM style feed logic.'}
                </p>
                <p className="text-muted-foreground">
                  {isRotaryTool
                    ? 'RPM uses the source-derived effective cutting diameter.'
                    : 'RPM is based on work diameter where applicable.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tooling">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle>Tool Defaults</CardTitle>
                <CardDescription>Default geometry factors pulled from the selected FSWizard tool family.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Default flutes:</span> <span className="font-medium text-foreground">{selectedTool?.flutes ?? '--'}</span></div>
                <div><span className="text-muted-foreground">Default dia:</span> <span className="font-medium text-foreground">{selectedTool?.diameter ?? '--'}</span></div>
                <div><span className="text-muted-foreground">Flute len factor:</span> <span className="font-medium text-foreground">{selectedTool?.flute_len ?? '--'}</span></div>
                <div><span className="text-muted-foreground">Tool len factor:</span> <span className="font-medium text-foreground">{selectedTool?.tool_len ?? '--'}</span></div>
                <div><span className="text-muted-foreground">Ramp angle:</span> <span className="font-medium text-foreground">{selectedTool?.ramp_angle ?? '--'}°</span></div>
                <div><span className="text-muted-foreground">Lead angle:</span> <span className="font-medium text-foreground">{selectedTool?.leadangle ?? '--'}°</span></div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle>Derived Secondary Values</CardTitle>
                <CardDescription>These help compare the calculator output against the cut you plan to run.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">IPR:</span> <span className="font-medium text-foreground">{result ? `${result.ipr} in/rev` : '--'}</span></div>
                <div><span className="text-muted-foreground">Thread feed:</span> <span className="font-medium text-foreground">{result?.threadFeed ? `${result.threadFeed} ipm` : '--'}</span></div>
                <div><span className="text-muted-foreground">Pilot size:</span> <span className="font-medium text-foreground">{result?.pilotDiameter ? `${result.pilotDiameter}"` : '--'}</span></div>
                <div><span className="text-muted-foreground">Peck depth:</span> <span className="font-medium text-foreground">{result?.peckDepth ? `${result.peckDepth}"` : '--'}</span></div>
                <div><span className="text-muted-foreground">Effective diameter:</span> <span className="font-medium text-foreground">{result ? `${result.effectiveDiameter}"` : '--'}</span></div>
                <div><span className="text-muted-foreground">Material removal:</span> <span className="font-medium text-foreground">{result?.materialRemovalRate !== null && result?.materialRemovalRate !== undefined ? `${result.materialRemovalRate} in³/min` : '--'}</span></div>
                <div><span className="text-muted-foreground">Estimated horsepower:</span> <span className="font-medium text-foreground">{result?.spindleHorsepower !== null && result?.spindleHorsepower !== undefined ? `${result.spindleHorsepower} hp` : '--'}</span></div>
                <div><span className="text-muted-foreground">Estimated torque:</span> <span className="font-medium text-foreground">{result?.spindleTorqueFtLb !== null && result?.spindleTorqueFtLb !== undefined ? `${result.spindleTorqueFtLb} ft-lb` : '--'}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="warnings">
          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Warnings and Assumptions</CardTitle>
              <CardDescription>
                This is where the calculator calls out harder materials, missing thread inputs, and default-envelope overruns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result?.warnings.length ? (
                <div className="space-y-3">
                  {result.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} className="flex gap-3 rounded-xl border border-[#ff5a00]/70 bg-white p-3 text-sm text-[#0b1f3a]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5a00]" />
                      <p>{warning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No warnings for the current mix.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
