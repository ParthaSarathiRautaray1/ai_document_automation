import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Star, Trash2, UserRound } from 'lucide-react';

import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { addressSchema, contactSchema, customerSchema } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import {
  addAddress,
  addContact,
  deleteCustomer,
  getCustomer,
  removeAddress,
  removeContact,
  updateAddress,
  updateContact,
  updateCustomer,
} from './customers.api';

const STATUS_BADGE = { active: 'success', inactive: 'default', archived: 'warning' };

/** Turn '' into undefined so we don't send empty strings for optional fields. */
const blankToUndefined = (v) => (v?.trim() ? v.trim() : undefined);

/** Core profile editor. Read-only fields when the user lacks customer:update. */
function ProfileCard({ customer, canEdit, onSaved }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer.name ?? '',
      type: customer.type ?? 'business',
      status: customer.status ?? 'active',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      website: customer.website ?? '',
      taxId: customer.taxId ?? '',
      notes: customer.notes ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: customer.name ?? '',
      type: customer.type ?? 'business',
      status: customer.status ?? 'active',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      website: customer.website ?? '',
      taxId: customer.taxId ?? '',
      notes: customer.notes ?? '',
    });
  }, [customer, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateCustomer(customer.id, {
        name: values.name,
        type: values.type,
        status: values.status,
        email: values.email?.trim() ? values.email.trim() : null,
        phone: blankToUndefined(values.phone) ?? null,
        website: blankToUndefined(values.website) ?? null,
        taxId: blankToUndefined(values.taxId) ?? null,
        notes: blankToUndefined(values.notes) ?? null,
      }),
    onSuccess: onSaved,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          {canEdit ? 'Core details for this customer.' : 'Core details. Ask a manager to make changes.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {mutation.isError ? <Alert>{getApiError(mutation.error).message}</Alert> : null}
          {mutation.isSuccess && !isDirty ? <Alert variant="success">Customer updated.</Alert> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="name" label="Name" error={errors.name?.message}>
              <Input id="name" invalid={!!errors.name} disabled={!canEdit} {...register('name')} />
            </FormField>
            <FormField id="type" label="Type" error={errors.type?.message}>
              <Select id="type" disabled={!canEdit} {...register('type')}>
                <option value="business">Business</option>
                <option value="individual">Individual</option>
              </Select>
            </FormField>
            <FormField id="email" label="Email" error={errors.email?.message}>
              <Input id="email" type="email" invalid={!!errors.email} disabled={!canEdit} {...register('email')} />
            </FormField>
            <FormField id="phone" label="Phone" error={errors.phone?.message}>
              <Input id="phone" invalid={!!errors.phone} disabled={!canEdit} {...register('phone')} />
            </FormField>
            <FormField id="website" label="Website" error={errors.website?.message}>
              <Input id="website" invalid={!!errors.website} disabled={!canEdit} {...register('website')} />
            </FormField>
            <FormField id="taxId" label="Tax ID" error={errors.taxId?.message}>
              <Input id="taxId" invalid={!!errors.taxId} disabled={!canEdit} {...register('taxId')} />
            </FormField>
            <FormField id="status" label="Status" error={errors.status?.message}>
              <Select id="status" disabled={!canEdit} {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
          </div>

          <FormField id="notes" label="Notes" error={errors.notes?.message}>
            <textarea
              id="notes"
              rows={3}
              disabled={!canEdit}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register('notes')}
            />
          </FormField>

          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending || !isDirty}>
                {mutation.isPending ? <Spinner /> : null}
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

/** Add/edit form for a contact. `contact` is null when adding. */
function ContactForm({ contact, onSubmit, onCancel, pending }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: contact?.name ?? '',
      title: contact?.title ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      isPrimary: contact?.isPrimary ?? false,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) =>
        onSubmit({
          name: v.name,
          title: blankToUndefined(v.title) ?? null,
          email: v.email?.trim() ? v.email.trim() : null,
          phone: blankToUndefined(v.phone) ?? null,
          isPrimary: v.isPrimary,
        })
      )}
      className="space-y-3 rounded-md border border-border p-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="cName" label="Name" error={errors.name?.message}>
          <Input id="cName" invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField id="cTitle" label="Title" error={errors.title?.message}>
          <Input id="cTitle" {...register('title')} />
        </FormField>
        <FormField id="cEmail" label="Email" error={errors.email?.message}>
          <Input id="cEmail" type="email" invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField id="cPhone" label="Phone" error={errors.phone?.message}>
          <Input id="cPhone" {...register('phone')} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" {...register('isPrimary')} />
        Primary contact
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Spinner /> : null}
          {contact ? 'Save contact' : 'Add contact'}
        </Button>
      </div>
    </form>
  );
}

/** Add/edit form for an address. `address` is null when adding. */
function AddressForm({ address, onSubmit, onCancel, pending }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      type: address?.type ?? 'other',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postalCode ?? '',
      country: address?.country ?? '',
      isPrimary: address?.isPrimary ?? false,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) =>
        onSubmit({
          type: v.type,
          line1: v.line1,
          line2: blankToUndefined(v.line2) ?? null,
          city: blankToUndefined(v.city) ?? null,
          state: blankToUndefined(v.state) ?? null,
          postalCode: blankToUndefined(v.postalCode) ?? null,
          country: blankToUndefined(v.country) ?? null,
          isPrimary: v.isPrimary,
        })
      )}
      className="space-y-3 rounded-md border border-border p-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="aType" label="Type" error={errors.type?.message}>
          <Select id="aType" {...register('type')}>
            <option value="billing">Billing</option>
            <option value="shipping">Shipping</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
        <FormField id="aLine1" label="Address line 1" error={errors.line1?.message}>
          <Input id="aLine1" invalid={!!errors.line1} {...register('line1')} />
        </FormField>
        <FormField id="aLine2" label="Address line 2" error={errors.line2?.message}>
          <Input id="aLine2" {...register('line2')} />
        </FormField>
        <FormField id="aCity" label="City" error={errors.city?.message}>
          <Input id="aCity" {...register('city')} />
        </FormField>
        <FormField id="aState" label="State / Region" error={errors.state?.message}>
          <Input id="aState" {...register('state')} />
        </FormField>
        <FormField id="aPostal" label="Postal code" error={errors.postalCode?.message}>
          <Input id="aPostal" {...register('postalCode')} />
        </FormField>
        <FormField id="aCountry" label="Country" error={errors.country?.message}>
          <Input id="aCountry" {...register('country')} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" {...register('isPrimary')} />
        Primary address
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Spinner /> : null}
          {address ? 'Save address' : 'Add address'}
        </Button>
      </div>
    </form>
  );
}

function formatAddress(a) {
  return [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();

  const canEdit = can(PERMISSIONS.CUSTOMER_UPDATE);
  const canDelete = can(PERMISSIONS.CUSTOMER_DELETE);

  const [addingContact, setAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const customerQuery = useQuery({ queryKey: ['customer', id], queryFn: () => getCustomer(id) });

  const onCustomerUpdated = (customer) => {
    setActionError(null);
    queryClient.setQueryData(['customer', id], customer);
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    setAddingContact(false);
    setEditingContactId(null);
    setAddingAddress(false);
    setEditingAddressId(null);
  };
  const onActionError = (error) => setActionError(getApiError(error).message);

  // Each call passes the concrete API request as `mutationFn`; all of them
  // resolve to the updated customer, so success handling is shared.
  const contactMutation = useMutation({
    mutationFn: (vars) => vars.mutationFn(),
    onSuccess: onCustomerUpdated,
    onError: onActionError,
  });
  const addressMutation = useMutation({
    mutationFn: (vars) => vars.mutationFn(),
    onSuccess: onCustomerUpdated,
    onError: onActionError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
    onError: onActionError,
  });

  if (customerQuery.isLoading) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <div className="grid flex-1 place-items-center">
          <Spinner className="h-6 w-6 text-muted-foreground" label="Loading customer" />
        </div>
      </div>
    );
  }

  if (customerQuery.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Alert>{getApiError(customerQuery.error).message}</Alert>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Button>
        </main>
      </div>
    );
  }

  const customer = customerQuery.data;
  const busy = contactMutation.isPending || addressMutation.isPending;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{customer.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={STATUS_BADGE[customer.status] ?? 'default'}>{customer.status}</Badge>
                <span className="capitalize">{customer.type}</span>
              </div>
            </div>
          </div>
          {canDelete ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${customer.name}? This cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>

        {actionError ? <Alert>{actionError}</Alert> : null}

        <ProfileCard customer={customer} canEdit={canEdit} onSaved={onCustomerUpdated} />

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>People to reach at this customer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.contacts.map((contact) =>
                  editingContactId === contact.id ? (
                    <li key={contact.id} className="py-3">
                      <ContactForm
                        contact={contact}
                        pending={busy}
                        onCancel={() => setEditingContactId(null)}
                        onSubmit={(payload) =>
                          contactMutation.mutate({
                            mutationFn: () => updateContact(customer.id, contact.id, payload),
                          })
                        }
                      />
                    </li>
                  ) : (
                    <li key={contact.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {contact.name}
                          {contact.isPrimary ? (
                            <Badge variant="primary">
                              <Star className="mr-1 h-3 w-3" aria-hidden="true" />
                              Primary
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">
                          {[contact.title, contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      {canEdit ? (
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingContactId(contact.id)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${contact.name}`}
                            disabled={busy}
                            onClick={() =>
                              contactMutation.mutate({
                                mutationFn: () => removeContact(customer.id, contact.id),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                )}
              </ul>
            )}

            {canEdit ? (
              addingContact ? (
                <ContactForm
                  contact={null}
                  pending={busy}
                  onCancel={() => setAddingContact(false)}
                  onSubmit={(payload) =>
                    contactMutation.mutate({ mutationFn: () => addContact(customer.id, payload) })
                  }
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAddingContact(true)}>
                  <Plus className="h-4 w-4" />
                  Add contact
                </Button>
              )
            ) : null}
          </CardContent>
        </Card>

        {/* Addresses */}
        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
            <CardDescription>Billing, shipping, and other locations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No addresses yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.addresses.map((address) =>
                  editingAddressId === address.id ? (
                    <li key={address.id} className="py-3">
                      <AddressForm
                        address={address}
                        pending={busy}
                        onCancel={() => setEditingAddressId(null)}
                        onSubmit={(payload) =>
                          addressMutation.mutate({
                            mutationFn: () => updateAddress(customer.id, address.id, payload),
                          })
                        }
                      />
                    </li>
                  ) : (
                    <li key={address.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium capitalize">
                          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {address.type}
                          {address.isPrimary ? (
                            <Badge variant="primary">
                              <Star className="mr-1 h-3 w-3" aria-hidden="true" />
                              Primary
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">{formatAddress(address)}</div>
                      </div>
                      {canEdit ? (
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingAddressId(address.id)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${address.type} address`}
                            disabled={busy}
                            onClick={() =>
                              addressMutation.mutate({
                                mutationFn: () => removeAddress(customer.id, address.id),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                )}
              </ul>
            )}

            {canEdit ? (
              addingAddress ? (
                <AddressForm
                  address={null}
                  pending={busy}
                  onCancel={() => setAddingAddress(false)}
                  onSubmit={(payload) =>
                    addressMutation.mutate({ mutationFn: () => addAddress(customer.id, payload) })
                  }
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAddingAddress(true)}>
                  <Plus className="h-4 w-4" />
                  Add address
                </Button>
              )
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
