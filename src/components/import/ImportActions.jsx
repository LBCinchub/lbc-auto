import React from "react";
import { Button } from "@/components/ui/button";

export default function ImportActions({ count, onImport, onCancel }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={onImport} disabled={!count} className="bg-sky-500 text-white hover:bg-sky-600">
        Import {count} customer{count === 1 ? "" : "s"}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} className="border-gray-700 text-gray-300">
        Start over
      </Button>
    </div>
  );
}