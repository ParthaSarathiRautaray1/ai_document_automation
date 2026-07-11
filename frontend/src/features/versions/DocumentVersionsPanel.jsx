import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitCompare, History, RotateCcw } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';
import { diffVersions, listVersions, restoreVersion } from './versions.api';
import { CHANGE_TYPE_BADGE, DIFF_LINE_CLASS, DIFF_LINE_MARKER } from './version.helpers';

/** Rendered line-by-line diff between two versions. */
function DiffView({ diff }) {
  const { changes, stats } = diff;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>{' '}
        <span className="text-red-600 dark:text-red-400">−{stats.removed}</span> · {stats.unchanged}{' '}
        unchanged
      </p>
      <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs leading-relaxed">
        {changes.length === 0 ? (
          <p className="px-2 py-1 text-muted-foreground">Both versions are empty.</p>
        ) : (
          changes.map((line, i) => (
            <div key={i} className={`flex gap-2 whitespace-pre-wrap px-2 ${DIFF_LINE_CLASS[line.type]}`}>
              <span aria-hidden="true" className="select-none">
                {DIFF_LINE_MARKER[line.type]}
              </span>
              <span className="break-all">{line.text || ' '}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Choose two versions and render their content diff. */
function CompareVersions({ documentId, versions }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Default to comparing the second-newest → newest version.
  useEffect(() => {
    if (versions.length >= 2) {
      setFrom(versions[1].id);
      setTo(versions[0].id);
    } else if (versions.length === 1) {
      setFrom(versions[0].id);
      setTo(versions[0].id);
    }
  }, [versions]);

  const mutation = useMutation({ mutationFn: () => diffVersions(documentId, { from, to }) });

  const label = (v) => `v${v.version} · ${v.changeType}`;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="diff-from" label="From">
          <Select id="diff-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="diff-to" label="To">
          <Select id="diff-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={mutation.isPending || !from || !to} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <Spinner /> : <GitCompare className="h-4 w-4" />}
          Compare
        </Button>
      </div>

      {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
      {mutation.data ? <DiffView diff={mutation.data.diff} /> : null}
    </div>
  );
}

/**
 * Version-history section on the document detail page. Lists the document's
 * snapshots, lets any reader diff two versions, and lets a manager restore one.
 */
export default function DocumentVersionsPanel({ documentId }) {
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();
  const canRestore = can(PERMISSIONS.VERSION_RESTORE);

  const versionsQuery = useQuery({
    queryKey: ['versions', documentId],
    queryFn: () => listVersions(documentId, { limit: 50 }),
  });

  const versions = versionsQuery.data?.versions ?? [];

  const restoreMutation = useMutation({
    mutationFn: (versionId) => restoreVersion(documentId, versionId),
    onSuccess: (document) => {
      queryClient.setQueryData(['document', documentId], document);
      queryClient.invalidateQueries({ queryKey: ['versions', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Version history
        </CardTitle>
        <CardDescription>
          Every generation, regeneration, edit, and restore is snapshotted. Compare any two versions
          or roll the document back to a previous one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {versionsQuery.isLoading ? (
          <div className="grid place-items-center py-6">
            <Spinner className="h-5 w-5 text-muted-foreground" label="Loading history" />
          </div>
        ) : versionsQuery.isError ? (
          <Alert>{getApiError(versionsQuery.error).message}</Alert>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions recorded yet.</p>
        ) : (
          <>
            {restoreMutation.isError ? <Alert>{getApiError(restoreMutation.error).message}</Alert> : null}

            <ul className="space-y-1.5 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">v{v.version}</span>
                    <Badge variant={CHANGE_TYPE_BADGE[v.changeType] ?? 'default'}>{v.changeType}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </span>
                  {canRestore ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={restoreMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Restore the document to v${v.version}? A new version will be recorded.`)) {
                          restoreMutation.mutate(v.id);
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            {versions.length >= 1 ? <CompareVersions documentId={documentId} versions={versions} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
