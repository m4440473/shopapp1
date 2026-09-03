import { UserPlus, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type WorkerOption = {
  id: string;
  name: string;
};

type PartWorkerAssignment = {
  id: string;
  assignmentType?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  assignedBy?: { name?: string | null; email?: string | null } | null;
};

type PartWorkerAssignmentsPanelProps = {
  assignments: PartWorkerAssignment[];
  availableWorkers: WorkerOption[];
  canEdit: boolean;
  selectedWorkerId: string;
  saving: boolean;
  error: string | null;
  onSelectedWorkerIdChange: (workerId: string) => void;
  onAdd: () => void | Promise<void>;
  onRemove: (assignmentId: string) => void | Promise<void>;
};

export function PartWorkerAssignmentsPanel({
  assignments,
  availableWorkers,
  canEdit,
  selectedWorkerId,
  saving,
  error,
  onSelectedWorkerIdChange,
  onAdd,
  onRemove,
}: PartWorkerAssignmentsPanelProps) {
  return (
    <div className="order-detail-tile space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Part workers</div>
          <div className="text-sm font-semibold text-foreground">Who is working this part</div>
        </div>
        <Badge variant="outline">
          <Users className="mr-1 h-3.5 w-3.5" />
          {assignments.length} assigned
        </Badge>
      </div>
      <div className="order-detail-inset rounded-md border px-3 py-2 text-xs text-slate-300">
        Use this roster for the people actually touching this part. The order-level assigned machinist stays as coordinator only.
      </div>
      {assignments.length ? (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="order-detail-inset rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">
                    {assignment.user?.name || assignment.user?.email || 'Unknown user'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {assignment.assignmentType || 'WORKER'}
                    {assignment.assignedBy?.name || assignment.assignedBy?.email
                      ? ` · added by ${assignment.assignedBy?.name || assignment.assignedBy?.email}`
                      : ''}
                  </div>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void onRemove(assignment.id)}
                    disabled={saving}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="order-detail-inset rounded-md border border-dashed p-3 text-sm text-slate-300">
          No workers are assigned yet. Add the machinists, floaters, or helpers actually working this part.
        </div>
      )}
      {canEdit ? (
        <div className="order-detail-inset space-y-3 rounded-md border p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Add worker</Label>
              <Select
                value={selectedWorkerId || '__none__'}
                onValueChange={(value) => onSelectedWorkerIdChange(value === '__none__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a worker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Choose a worker</SelectItem>
                  {availableWorkers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={() => void onAdd()} disabled={saving || !selectedWorkerId}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
          Only admins can add or remove workers from a part.
        </div>
      )}
    </div>
  );
}
