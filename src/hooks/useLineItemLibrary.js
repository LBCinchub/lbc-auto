import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Loads the current shop's LineItemLibrary (tenant-scoped via RLS).
 * Cached briefly so autocomplete suggestions feel instant while typing.
 */
export function useLineItemLibrary() {
  return useQuery({
    queryKey: ["lineItemLibrary"],
    queryFn: () => base44.entities.LineItemLibrary.list("-updated_date", 500),
    staleTime: 30_000,
  });
}