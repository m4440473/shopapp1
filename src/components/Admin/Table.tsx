import React from 'react';

import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/Button';
import ConfirmButton from './ConfirmButton';

interface Column {
  key: string;
  header: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: Column[];
  rows: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
}

export default function Table({ columns = [], rows = [], onEdit, onDelete }: TableProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60">
      <UITable>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
            {(onEdit || onDelete) && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="bg-card/60">
              {columns.map((column) => (
                <TableCell key={column.key} className="align-middle">
                  {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                </TableCell>
              ))}
              {(onEdit || onDelete) && (
                <TableCell className="flex items-center justify-end gap-2">
                  {onEdit && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row)}>
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <ConfirmButton onConfirm={() => onDelete(row)}>
                      Delete
                    </ConfirmButton>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground">
                No records found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </UITable>
    </div>
  );
}
