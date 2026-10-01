// Runs one awaited task at a time; extra calls while busy are ignored (never queued or retried).
// run(task) -> { status: "ok", value } | { status: "error", error } | { status: "busy" }
export function createSingleFlight() {
  let busy = false;
  return {
    isBusy: () => busy,
    async run(task) {
      if (busy) return { status: "busy" };
      busy = true;
      try {
        return { status: "ok", value: await task() };
      } catch (error) {
        return { status: "error", error };
      } finally {
        busy = false;
      }
    },
  };
}