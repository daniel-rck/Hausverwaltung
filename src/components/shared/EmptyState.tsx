interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <span className="text-4xl mb-3">{icon}</span>}
      <h3 className="text-base font-semibold text-stone-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 max-w-xs mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
