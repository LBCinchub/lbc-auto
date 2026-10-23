// Own records (client RLS) first, then verified shop records not already present.
export function mergeById(own = [], scoped = []) {
  const seen = new Set(own.map((r) => r.id));
  return [...own, ...scoped.filter((r) => !seen.has(r.id))];
}