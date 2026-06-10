// Pure pagination helpers, kept separate from DB code so they can be unit
// tested without a database connection.

export type PageMeta = {
  page: number;
  pageSize: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

// Normalize a requested page/pageSize into sane bounds.
export function normalizePage(page?: number, pageSize?: number): { page: number; pageSize: number; offset: number } {
  const p = Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1;
  let size = Number.isFinite(pageSize) && (pageSize as number) >= 1 ? Math.floor(pageSize as number) : 50;
  if (size > 200) size = 200;
  return { page: p, pageSize: size, offset: (p - 1) * size };
}

// Given the items returned for the current page and the (filter-matched) total,
// compute the metadata the client needs. `inMemoryFilter` indicates the total
// could not be computed in SQL (e.g. the JS-only "upcoming" filter), in which
// case we fall back to a heuristic so "load more" still works correctly.
export function computePageMeta(args: {
  page: number;
  pageSize: number;
  itemsLength: number;
  total: number;
  inMemoryFilter?: boolean;
}): PageMeta {
  const { page, pageSize, itemsLength } = args;
  const offset = (page - 1) * pageSize;
  if (args.inMemoryFilter) {
    // We don't know the real total. A full page implies there may be more;
    // a partial page means we've reached the end. We report the count loaded
    // so far as the displayed total.
    const loaded = offset + itemsLength;
    const hasMore = itemsLength >= pageSize;
    return {
      page,
      pageSize,
      offset,
      total: hasMore ? loaded + 1 : loaded,
      hasMore,
    };
  }
  return {
    page,
    pageSize,
    offset,
    total: args.total,
    hasMore: offset + itemsLength < args.total,
  };
}
