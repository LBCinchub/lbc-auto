import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function EmptyState({ icon: Icon, title, description, onAction, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-white font-semibold text-lg">{title}</h3>
      <p className="text-gray-500 text-sm mt-1 max-w-sm">{description}</p>
      {onAction && (
        <Button onClick={onAction} className="mt-4 bg-sky-500 hover:bg-sky-600 text-white gap-2">
          <Plus className="w-4 h-4" />
          {actionLabel || "Add New"}
        </Button>
      )}
    </div>
  );
}