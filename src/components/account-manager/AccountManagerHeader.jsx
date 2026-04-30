import React from "react";

export default function AccountManagerHeader() {
  return (
    <div className="group/hq-header relative mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-teal-700/10 bg-white/60 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-teal-700/20 hover:bg-white/80 dark:border-teal-400/20 dark:bg-slate-900/60 dark:hover:bg-slate-900/80">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-50/40 via-transparent to-primary/5 dark:from-teal-900/20 dark:to-transparent" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Quản trị Tài khoản Hệ thống
            </h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Quản lý tài khoản đăng nhập cho hệ thống KPI, gán quyền và nhân viên phụ trách theo từng tổ đội.
            </p>
            <div className="mt-2 flex items-center gap-3 text-[0.8rem] text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline-block">Mọi thao tác đều được ghi nhận trong màn hình Giám sát.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
