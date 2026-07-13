const PAGE_SIZE = 1000

interface PagedResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * PostgREST caps unbounded selects at the project's Max Rows setting, so any
 * query expected to return more rows than that must page through `.range()`.
 * Pass a factory that applies `.range(from, to)` to your query and awaits it.
 */
export async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<PagedResult<T>>
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await queryFactory(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
