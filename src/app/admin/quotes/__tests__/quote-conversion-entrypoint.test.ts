import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/Button';

// Render the actual detail-page action without fetching unrelated quote/pricing data.
function renderAction(quote: { id: string; customer: { id: string } | null }, metadata: { approval: { received: boolean }; conversion: { orderId?: string } }) {
  const sourcePath = path.resolve('src/app/admin/quotes/[id]/page.tsx');
  const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map<string, string>();
  let action: ts.ConditionalExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, `const ${node.name.text} = ${node.initializer.getText(source)};`);
    if (ts.isConditionalExpression(node) && node.condition.getText(source) === 'quickConvertEnabled') action = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!action) throw new Error('Quote detail Create Order action was not found.');
  const guards = ['hasCustomer', 'alreadyConverted', 'quickConvertEnabled', 'quickConvertDisabledReason'].map(name => declarations.get(name)).join('\n');
  const code = ts.transpileModule(`${guards}\nreturn (${action.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
  const Link = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', props);
  const element = new Function('quote', 'metadata', 'React', 'Button', 'Link', code)(quote, metadata, React, Button, Link);
  return renderToStaticMarkup(element);
}

describe('quote detail conversion entrypoint', () => {
  it('opens the durable conversion wizard with the exact quote id instead of submitting from a modal', () => {
    const markup = renderAction({ id: 'quote/17?', customer: { id: 'customer' } }, { approval: { received: true }, conversion: {} });
    expect(markup).toContain('href="/orders/new?quoteId=quote%2F17%3F"');
    expect(markup).toContain('Create Order');
    expect(markup).not.toContain('disabled=');
    expect(markup).not.toContain('<form');
  });

  it.each([
    [false, true, false, 'Upload approval before converting.'],
    [true, false, false, 'Assign a customer record before converting.'],
    [true, true, true, 'Quote has already been converted.'],
  ] as const)('keeps the existing conversion eligibility gate (%s/%s/%s)', (approved, customer, converted, reason) => {
    const markup = renderAction({ id: 'quote-17', customer: customer ? { id: 'customer' } : null }, { approval: { received: approved }, conversion: converted ? { orderId: 'order-17' } : {} });
    expect(markup).toContain('disabled=""');
    expect(markup).toContain(`title="${reason}"`);
    expect(markup).not.toContain('href=');
  });
});
