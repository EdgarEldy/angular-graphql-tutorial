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

export function toPageParams(pageIndex: number, pageSize: number): PageParams {
  return { page: pageIndex, size: pageSize };
}

export function fromPageEnvelope<T>(envelope: PageEnvelope<T>): {
  items: T[];
  totalElements: number;
} {
  return {
    items: envelope.content,
    totalElements: envelope.totalElements,
  };
}
