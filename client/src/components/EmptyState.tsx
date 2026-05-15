import { ReactNode } from "react";

export default function EmptyState({
  icon = "✨",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && (
        <p className="mb-4 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
