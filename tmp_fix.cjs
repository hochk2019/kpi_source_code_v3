const fs = require('fs');
let code = fs.readFileSync('e:/GPT/kpi_source_code_v4/src/components/DataHealthDashboard.jsx', 'utf8');

const startTag = '<header className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">';
const startIdx = code.indexOf(startTag);
const endIdx = code.indexOf('</header>', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `      {/* Lumina Ivory Master Header */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-200/50 shadow-sm relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-3 w-full">
          <div className="flex flex-wrap items-center justify-between w-full">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Sức khỏe Dữ liệu</h1>
                <div title="Theo dõi chất lượng dữ liệu và trạng thái đồng bộ." className="text-gray-400 hover:text-cyan-600 transition-colors cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Theo dõi chất lượng dữ liệu tờ khai, cảnh báo từ hệ thống lõi đồng bộ.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-white/80 border border-gray-200 hover:bg-cyan-50 text-sm font-medium text-gray-700 transition-all shadow-sm"
              disabled={summaryLoading || rolloutLoading}
            >
              {summaryLoading || rolloutLoading ? 'Đang tải…' : 'Làm mới tổng quan'}
            </button>
          </div>

          {(summaryError || rolloutError) && (
            <div className="mt-4 space-y-2">
              {summaryError && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm text-red-700 shadow-sm">
                  {summaryError}
                </div>
              )}
              {rolloutError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-700 shadow-sm">
                  {rolloutSummary
                    ? \`Lỗi tải metadata rollout: \${rolloutError}\`
                    : \`Lỗi hệ thống: \${rolloutError}\`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>`;
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx + 9);
    fs.writeFileSync('e:/GPT/kpi_source_code_v4/src/components/DataHealthDashboard.jsx', code);
    console.log('Replaced header successfully!');
} else {
    console.log('Not found ' + startIdx + ' ' + endIdx);
}

