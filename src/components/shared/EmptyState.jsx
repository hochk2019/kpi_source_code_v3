import { PackageOpen, Inbox, FileX } from "lucide-react";

const iconMap = {
  data: PackageOpen,
  inbox: Inbox,
  file: FileX,
};

export default function EmptyState({
  icon = "data",
  title = "Không có dữ liệu",
  description = "Chưa có dữ liệu để hiển thị.",
  action = null,
}) {
  const Icon = iconMap[icon] || PackageOpen;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  );
}
