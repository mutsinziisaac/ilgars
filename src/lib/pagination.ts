import { apiRequest, type ApiRequestOptions } from "@/lib/api"

/**
 * Pagination sibling returned alongside `data` on list endpoints.
 * Core emits snake_case keys; query params are kebab-case `page-number`
 * (1-based) and `page-size`.
 */
export type PaginationMeta = {
  page_number?: number
  page_size?: number
  total_pages?: number
  total_records?: number
  [key: string]: unknown
}

type PaginatedEnvelope<T> = {
  data?: T[]
  pagination?: PaginationMeta
  [key: string]: unknown
}

const MAX_PAGE_SIZE = 100

function envelopeData<T>(envelope: PaginatedEnvelope<T>): T[] {
  return Array.isArray(envelope.data) ? envelope.data : []
}

/**
 * Append `page-number`/`page-size` to a path that may already carry a query
 * string, preserving every existing param.
 */
function withPageParams(path: string, pageNumber: number, pageSize: number): string {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}page-number=${pageNumber}&page-size=${pageSize}`
}

/**
 * Fetch every page of a server-paginated list endpoint and concatenate the
 * results into one complete array.
 *
 * Requests `page-size=100` (the server max) to minimize round-trips, reads
 * `pagination.total_pages` from the first response, then fetches pages
 * `2..total_pages` and flattens every page's `data`.
 *
 * @param path Full request path, optionally already containing query params
 *             (e.g. `vehicleId=...`); they are preserved.
 */
export async function fetchAllPages<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T[]> {
  const first = await apiRequest<PaginatedEnvelope<T>>(
    withPageParams(path, 1, MAX_PAGE_SIZE),
    options
  )

  const items = envelopeData(first)
  const totalPages = first.pagination?.total_pages ?? 1

  if (totalPages <= 1) {
    return items
  }

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      apiRequest<PaginatedEnvelope<T>>(
        withPageParams(path, index + 2, MAX_PAGE_SIZE),
        options
      )
    )
  )

  for (const page of remaining) {
    items.push(...envelopeData(page))
  }

  return items
}
