export interface PageParams {
  page: number;
  size: number;
}

export interface PageEnvelope<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/**
 * Converts Material paginator indices (0-based pageIndex) into backend PageParams.
 *
 * Material Paginator counts pages from 0 while the backend page envelope uses the same
 * 0-based convention, so no arithmetic is needed. This adapter centralises the mapping so
 * that if the backend ever shifts to 1-based pages only this function needs to change.
 *
 * @param pageIndex - 0-based page index from MatPaginator's page event.
 * @param pageSize  - Number of items per page selected by the user.
 * @returns A PageParams object ready to pass as GraphQL variables.
 */
export function toPageParams(pageIndex: number, pageSize: number): PageParams {
  return { page: pageIndex, size: pageSize };
}

/**
 * Extracts the item list and total count from a backend PageEnvelope response.
 *
 * The backend wraps every paginated list in a PageEnvelope with metadata fields alongside
 * `content`. Components only need `content` and `totalElements` (for the paginator's length
 * binding), so this helper strips the rest rather than leaving components coupled to the
 * full envelope shape.
 *
 * @param envelope - The raw PageEnvelope returned by a GraphQL list query.
 * @returns An object with `items` (the content array) and `totalElements` (for pagination).
 */
export function fromPageEnvelope<T>(envelope: PageEnvelope<T>): {
  items: T[];
  totalElements: number;
} {
  return {
    items: envelope.content,
    totalElements: envelope.totalElements,
  };
}
