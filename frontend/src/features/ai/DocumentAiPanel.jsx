import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Sparkles } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { updateDocument } from '@/features/documents/documents.api';
import { requestAiAssist } from './ai.api';
import { AI_OPERATIONS, AI_TONES, operationNeedsTone } from './ai.helpers';

const outputClass =
  'w-full whitespace-pre-wrap rounded-md border border-input bg-muted/40 px-3 py-2 text-sm';

/**
 * Assistive AI panel embedded on the document detail page (gated `ai:assist`).
 * Runs a text operation on the document's current content and shows the
 * suggestion. The assistant never mutates the document on its own — the user
 * explicitly copies the result or (with `document:update`) applies it.
 *
 * @param {object} props
 * @param {object} props.document - the document record (source text = its content)
 * @param {boolean} props.canApply - whether the user may write the suggestion back
 * @param {(document: object) => void} props.onApplied - called with the updated doc
 */
export default function DocumentAiPanel({ document, canApply, onApplied }) {
  const [operation, setOperation] = useState('improve');
  const [tone, setTone] = useState('professional');
  const [copied, setCopied] = useState(false);

  const content = document.content ?? '';
  const hasContent = content.trim().length > 0;

  const assistMutation = useMutation({
    mutationFn: () =>
      requestAiAssist({
        operation,
        input: content,
        ...(operationNeedsTone(operation) ? { tone } : {}),
      }),
    onSuccess: () => setCopied(false),
  });

  const applyMutation = useMutation({
    mutationFn: (text) => updateDocument(document.id, { content: text }),
    onSuccess: onApplied,
  });

  const suggestion = assistMutation.data?.completion?.output ?? '';
  const cached = assistMutation.data?.cached;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — ignore silently.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          AI assistant
        </CardTitle>
        <CardDescription>
          Run an assistive text operation on this document&rsquo;s content. Results are suggestions —
          nothing changes until you apply them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="ai-operation" label="Operation">
            <Select
              id="ai-operation"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              {AI_OPERATIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>
          </FormField>
          {operationNeedsTone(operation) ? (
            <FormField id="ai-tone" label="Tone">
              <Select id="ai-tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                {AI_TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
        </div>

        {!hasContent ? (
          <p className="text-sm text-muted-foreground">
            This document has no content to work with yet.
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => assistMutation.mutate()}
            disabled={assistMutation.isPending || !hasContent}
          >
            {assistMutation.isPending ? <Spinner /> : <Sparkles className="h-4 w-4" />}
            {assistMutation.isPending ? 'Working…' : 'Generate suggestion'}
          </Button>
        </div>

        {assistMutation.isError ? <Alert>{getApiError(assistMutation.error).message}</Alert> : null}
        {applyMutation.isError ? <Alert>{getApiError(applyMutation.error).message}</Alert> : null}

        {suggestion ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Suggestion</span>
                {cached ? (
                  <span className="text-xs text-muted-foreground">from cache</span>
                ) : null}
              </div>
              <div className={outputClass}>{suggestion}</div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              {canApply ? (
                <Button
                  size="sm"
                  onClick={() => applyMutation.mutate(suggestion)}
                  disabled={applyMutation.isPending}
                >
                  {applyMutation.isPending ? <Spinner /> : null}
                  {applyMutation.isPending ? 'Applying…' : 'Apply to content'}
                </Button>
              ) : null}
            </div>
            {applyMutation.isSuccess ? (
              <Alert variant="success">Suggestion applied to the document content.</Alert>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
