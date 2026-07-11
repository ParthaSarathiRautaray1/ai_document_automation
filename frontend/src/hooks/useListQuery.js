import { useEffect, useMemo, useState } from 'react';

import { cleanParams } from '@/lib/api';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Shared state for a paginated, searchable, filterable list view (Module 10).
 *
 * Encapsulates the pattern every list page repeated: a debounced search box,
 * a bag of exact-match filters, page state that resets whenever the search or
 * any filter changes, and a memoized, cleaned params object ready for the API.
 *
 * @param {object} [options]
 * @param {Record<string, string>} [options.filters] - initial filter values (usually '')
 * @param {number} [options.pageSize]
 * @returns {{
 *   search: string, setSearch: (v:string)=>void,
 *   filters: Record<string, string>, setFilter: (key:string, value:string)=>void,
 *   page: number, nextPage: ()=>void, prevPage: ()=>void,
 *   params: object,
 * }}
 */
export function useListQuery({ filters: initialFilters = {}, pageSize = 20 } = {}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  // Return to page 1 whenever the query narrows/changes (so we never land on an
  // out-of-range page). Serialize filters to a stable dependency.
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
  }, [q, filterKey]);

  const params = useMemo(
    () => cleanParams({ page, limit: pageSize, q, ...filters }),
    [page, pageSize, q, filters]
  );

  return {
    search,
    setSearch,
    filters,
    setFilter,
    page,
    nextPage: () => setPage((p) => p + 1),
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    params,
  };
}
