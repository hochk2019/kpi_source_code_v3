import { PackageOpen, Inbox, FileX, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  data: PackageOpen,
  inbox: Inbox,
  file: FileX,
};

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon = "data",
  title = "Không có dữ liệu",
  description = "Chưa có dữ liệu để hiển thị.",
  action = null,
}: EmptyStateProps) {
  const Icon = iconMap[icon] || PackageOpen;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 rounded-full bg-ds-surface-muted p-4">
        <Icon className="h-8 w-8 text-ds-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-ds-text-primary">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-ds-text-secondary">
        {description}
      </p>
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  );
}
