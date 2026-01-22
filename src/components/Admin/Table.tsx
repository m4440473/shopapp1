"use client";

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
import { cn } from '@/lib/utils';

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
  actionsEnabled?: boolean;
}

export default function Table({
  columns = [],
  rows = [],
  onEdit,
  onDelete,
  actionsEnabled = true,
}: TableProps) {
  const showActions = actionsEnabled && (onEdit || onDelete);
  return (
    <div className="rounded-lg border border-border/60 bg-card/60">
      <UITable className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                key={column.key}
                className={cn(index === 0 && 'sticky left-0 z-10 bg-card/90 backdrop-blur')}
              >
                {column.header}
              </TableHead>
            ))}
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="bg-card/60">
              {columns.map((column, index) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    'align-middle',
                    index === 0 && 'sticky left-0 z-10 bg-card/90 backdrop-blur'
                  )}
                >
                  {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                </TableCell>
              ))}
              {showActions && (
                <TableCell className="flex items-center justify-end gap-2">
                  {onEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] px-3"
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <ConfirmButton onConfirm={() => onDelete(row)} buttonClassName="min-h-[44px] px-3">
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
