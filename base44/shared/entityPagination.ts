const PAGE_SIZE = 250;

export async function listAllRecords(entity, query = null, sort = "created_date") {
  const rows = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = query ? await entity.filter(query, sort, PAGE_SIZE, skip) : await entity.list(sort, PAGE_SIZE, skip);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}