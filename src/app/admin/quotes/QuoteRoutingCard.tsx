'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type QuoteDepartmentOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type QuoteRoutingCardProps = {
  value: string;
  activeDepartments: QuoteDepartmentOption[];
  selectedDepartment?: QuoteDepartmentOption;
  loaded: boolean;
  loadFailed: boolean;
  onChange: (departmentId: string) => void;
};

export function QuoteRoutingCard({ value, activeDepartments, selectedDepartment, loaded, loadFailed, onChange }: QuoteRoutingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote routing</CardTitle>
        <CardDescription>Choose the department this quote should start from when it converts to an order.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
        <div className="grid gap-2">
          <Label>Origin / default department</Label>
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="border border-border bg-background px-3 py-2 text-sm">
              <SelectValue placeholder={loaded ? loadFailed ? 'Departments unavailable' : 'No active departments' : 'Loading departments…'} />
            </SelectTrigger>
            <SelectContent>
              {activeDepartments.map((department) => (
                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
              ))}
              {selectedDepartment && !selectedDepartment.isActive ? (
                <SelectItem value={selectedDepartment.id} disabled>{selectedDepartment.name} (inactive — saved)</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
          {selectedDepartment ? (
            <p>Converted orders from this quote will start in <span className="font-medium text-foreground">{selectedDepartment.name}</span> unless a later workflow move changes them.</p>
          ) : loadFailed ? (
            <p>Departments could not be loaded. Refresh the page before saving this quote.</p>
          ) : (
            <p>The first active department will be selected and saved as soon as departments finish loading.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
