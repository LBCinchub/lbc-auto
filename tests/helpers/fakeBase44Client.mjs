// Records every call; tests script the responses. Nothing leaves the process.
export const calls = [];
export const script = { invoke: {}, failEntity: null };

const entity = (name) => ({
  async delete(id) { calls.push(["delete", name, id]); if (script.failEntity === name) throw new Error("denied"); return {}; },
  async update(id, data) { calls.push(["update", name, id, data]); if (script.failEntity === name) throw new Error("denied"); return { id, ...data }; },
});

export const base44 = {
  entities: new Proxy({}, { get: (_, name) => entity(name) }),
  functions: {
    async invoke(fn, payload) {
      calls.push(["invoke", fn, payload]);
      const r = script.invoke[fn];
      if (r instanceof Error) throw r;
      return { data: typeof r === "function" ? r(payload) : r };
    },
  },
};

export function reset() { calls.length = 0; script.invoke = {}; script.failEntity = null; }