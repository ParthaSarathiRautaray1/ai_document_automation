import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, X } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';
import { listMembers } from '@/features/organizations/organizations.api';
import { cancelApproval, decideApproval, listApprovals, requestApproval } from './approvals.api';
import { STATUS_BADGE } from './approval.helpers';

/** Read the id off an approver step's `user` (populated or raw id). */
function approverUserId(step) {
  return typeof step.user === 'object' && step.user ? step.user.id : step.user;
}

/** The approve/reject actions shown to a pending approver. */
function DecisionActions({ approval, onChanged }) {
  const [comment, setComment] = useState('');
  const mutation = useMutation({
    mutationFn: (decision) => decideApproval(approval.id, { decision, comment: comment.trim() || undefined }),
    onSuccess: onChanged,
  });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Your decision</p>
      <FormField id="decision-comment" label="Comment" hint="Optional — shared with the requester.">
        <Input
          id="decision-comment"
          placeholder="Looks good / needs changes…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </FormField>
      {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate('approve')}>
          {mutation.isPending ? <Spinner /> : <Check className="h-4 w-4" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate('reject')}
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

/** The current request: status, approver decisions, and any available actions. */
function CurrentRequest({ approval, onChanged }) {
  const userId = useAuthStore((s) => s.user?.id);
  const can = useAuthStore((s) => s.can);

  const myStep = (approval.approvers ?? []).find((s) => approverUserId(s) === userId);
  const canDecide = approval.status === 'pending' && myStep?.status === 'pending' && can(PERMISSIONS.APPROVAL_DECIDE);
  const canCancel = approval.status === 'pending' && can(PERMISSIONS.APPROVAL_CANCEL);

  const cancelMutation = useMutation({ mutationFn: () => cancelApproval(approval.id), onSuccess: onChanged });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={STATUS_BADGE[approval.status] ?? 'default'}>{approval.status}</Badge>
        <span className="capitalize text-muted-foreground">{approval.policy} must approve</span>
      </div>

      {approval.note ? <p className="text-sm text-muted-foreground">“{approval.note}”</p> : null}

      <ul className="space-y-1.5 text-sm">
        {(approval.approvers ?? []).map((step) => (
          <li key={step.id ?? approverUserId(step)} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {typeof step.user === 'object' && step.user
                ? `${step.user.firstName ?? ''} ${step.user.lastName ?? ''}`.trim() || step.user.email
                : 'Approver'}
              {step.comment ? <span className="italic"> — “{step.comment}”</span> : null}
            </span>
            <Badge variant={STATUS_BADGE[step.status] ?? 'default'}>{step.status}</Badge>
          </li>
        ))}
      </ul>

      {canDecide ? <DecisionActions approval={approval} onChanged={onChanged} /> : null}

      {canCancel ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending ? <Spinner /> : null}
            Cancel request
          </Button>
        </div>
      ) : null}
      {cancelMutation.isError ? <Alert>{getApiError(cancelMutation.error).message}</Alert> : null}
    </div>
  );
}

/** Form to route the document for approval (shown when nothing is pending). */
function RequestForm({ documentId, onChanged }) {
  const [approverIds, setApproverIds] = useState([]);
  const [policy, setPolicy] = useState('all');
  const [note, setNote] = useState('');

  const membersQuery = useQuery({
    queryKey: ['org-members', { limit: 100 }],
    queryFn: () => listMembers({ limit: 100 }),
  });
  const members = membersQuery.data?.members ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      requestApproval({ documentId, approverIds, policy, note: note.trim() || undefined }),
    onSuccess: onChanged,
  });

  const toggle = (id) =>
    setApproverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-4">
      <FormField id="approvers" label="Approvers" error={approverIds.length === 0 ? 'Select at least one approver' : undefined}>
        {membersQuery.isLoading ? (
          <Spinner className="h-4 w-4 text-muted-foreground" label="Loading members" />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members available to approve.</p>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={approverIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                />
                {`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email}
                <span className="text-muted-foreground">· {m.email}</span>
              </label>
            ))}
          </div>
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="policy" label="Policy" hint="Who must approve for the request to pass.">
          <Select id="policy" value={policy} onChange={(e) => setPolicy(e.target.value)}>
            <option value="all">All approvers</option>
            <option value="any">Any one approver</option>
          </Select>
        </FormField>
        <FormField id="note" label="Note" hint="Optional message to the approvers.">
          <Input id="note" placeholder="Please review by Friday…" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>

      {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={mutation.isPending || approverIds.length === 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
          {mutation.isPending ? 'Requesting…' : 'Request approval'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Approval section on the document detail page. Shows the active/last request and,
 * depending on the user's permissions, the decision actions or a request form.
 */
export default function DocumentApprovalPanel({ documentId }) {
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const approvalsQuery = useQuery({
    queryKey: ['approvals', 'document', documentId],
    queryFn: () => listApprovals({ documentId, limit: 5 }),
  });

  const approvals = approvalsQuery.data?.approvals ?? [];
  // Newest first (backend default sort) — the first is the current/latest request.
  const current = approvals[0];
  const hasPending = current?.status === 'pending';

  const onChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['approvals', 'document', documentId] });
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval</CardTitle>
        <CardDescription>
          Route this document to approvers and track their decisions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {approvalsQuery.isLoading ? (
          <div className="grid place-items-center py-6">
            <Spinner className="h-5 w-5 text-muted-foreground" label="Loading approval" />
          </div>
        ) : approvalsQuery.isError ? (
          <Alert>{getApiError(approvalsQuery.error).message}</Alert>
        ) : (
          <>
            {current ? <CurrentRequest approval={current} onChanged={onChanged} /> : null}

            {!hasPending && can(PERMISSIONS.APPROVAL_REQUEST) ? (
              <div className={current ? 'border-t border-border pt-4' : ''}>
                {current ? (
                  <p className="mb-3 text-sm text-muted-foreground">Start a new approval request:</p>
                ) : (
                  <p className="mb-3 text-sm text-muted-foreground">
                    This document has no approval request yet.
                  </p>
                )}
                <RequestForm documentId={documentId} onChanged={onChanged} />
              </div>
            ) : null}

            {!current && !can(PERMISSIONS.APPROVAL_REQUEST) ? (
              <p className="text-sm text-muted-foreground">No approval request for this document.</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
