import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";
import { cn } from "@/lib/utils.js";
import { Calculator, Hash, Maximize2, Medal, Minimize2, NotebookPen, PlusCircle, Sparkles } from "lucide-react";

export default function KpiAdjustmentGuidanceDialog({
  open,
  fullscreen,
  guidanceGroups,
  formatDecimal,
  onOpenChange,
  onToggleFullscreen,
  onOpenSettings,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-3xl overflow-hidden p-0 sm:max-h-[85vh]",
          fullscreen &&
            "h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] max-w-[min(1200px,calc(100vw-2rem))] sm:w-[min(1200px,calc(100vw-2rem))]"
        )}
      >
        <div
          className={cn(
            "grid h-full grid-rows-[auto,1fr,auto]",
            fullscreen ? "sm:max-h-none" : "sm:max-h-[85vh]"
          )}
        >
          <DialogHeader className="px-6 pb-4 pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <DialogTitle>Hướng dẫn nhập điểm KPI +/-</DialogTitle>
                <DialogDescription>
                  Tham khảo điểm mặc định, điểm bổ sung và cách tính cho từng nhóm hạng mục theo cấu hình hiện tại.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleFullscreen}
                className="shrink-0"
                aria-pressed={fullscreen}
              >
                {fullscreen ? (
                  <>
                    <Minimize2 className="mr-2 size-4" aria-hidden="true" />
                    Thu nhỏ
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-2 size-4" aria-hidden="true" />
                    Mở toàn màn hình
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>

          {guidanceGroups.length ? (
            <ScrollArea className={cn("px-6", fullscreen ? "h-full pb-8" : "max-h-[55vh] pb-6")}>
              <div className="space-y-3 text-foreground">
                <Accordion type="multiple" className="space-y-3 text-foreground">
                  {guidanceGroups.map((group) => {
                    const totalDefaultPoints = group.items.reduce(
                      (sum, item) => (Number.isFinite(item.defaultUnit) ? sum + item.defaultUnit : sum),
                      0
                    );
                    const hasDefaultPoints = group.items.some((item) => Number.isFinite(item.defaultUnit));
                    const activeDefaultCount = group.items.reduce(
                      (count, item) => (Number.isFinite(item.defaultUnit) ? count + 1 : count),
                      0
                    );

                    return (
                      <AccordionItem
                        key={group.key}
                        value={group.key}
                        className="rounded-xl border border-border/70 bg-muted/20 px-1 py-1 shadow-sm transition-colors [&[data-state=open]]:border-border [&[data-state=open]]:bg-background"
                      >
                        <AccordionTrigger className="flex-col gap-3 px-3 text-left text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
                          <div className="flex flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-foreground">{group.label}</span>
                              <Badge variant="outline" className="border-border/70 bg-background/60 text-xs font-medium">
                                {group.items.length} hạng mục
                              </Badge>
                            </div>
                            {group.description ? (
                              <p className="text-xs text-muted-foreground">{group.description}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-start gap-2 text-xs font-medium text-muted-foreground sm:items-end">
                            <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
                              <Calculator className="size-4" aria-hidden="true" />
                              {hasDefaultPoints
                                ? `Tổng điểm chuẩn: ${formatDecimal(totalDefaultPoints)}`
                                : "Chưa có điểm chuẩn"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Sparkles className="size-4" aria-hidden="true" />
                              {`${activeDefaultCount}/${group.items.length} hạng mục có điểm mặc định`}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-2 text-sm text-foreground sm:px-4">
                          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                            {group.items.map((item) => (
                              <article
                                key={item.key}
                                className="rounded-lg border border-border/70 bg-background/80 shadow-sm transition hover:border-border"
                              >
                                <div className="flex flex-col gap-4 p-4 lg:flex-row">
                                  <div className="flex flex-col gap-3 lg:w-[32%]">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                                        {item.hasOverride ? (
                                          <Badge
                                            variant="outline"
                                            className="border-primary/40 bg-primary/10 text-xs font-medium text-primary"
                                          >
                                            Tuỳ chỉnh
                                          </Badge>
                                        ) : null}
                                      </div>
                                      {item.modeLabel ? (
                                        <Badge variant="secondary" className="flex items-center gap-1 text-xs font-medium">
                                          {item.modeLabel}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="grid gap-3">
                                      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          <Sparkles className="size-4" aria-hidden="true" />
                                          <span>Điểm mặc định</span>
                                        </div>
                                        <div className="mt-1 text-lg font-semibold text-foreground">
                                          {Number.isFinite(item.defaultUnit) ? (
                                            formatDecimal(item.defaultUnit)
                                          ) : (
                                            <span className="text-sm font-normal text-muted-foreground">
                                              Không xác định
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          <PlusCircle className="size-4" aria-hidden="true" />
                                          <span>Điểm bổ sung</span>
                                        </div>
                                        {item.extraUnit !== null ? (
                                          <div className="mt-1 space-y-1">
                                            <div className="text-lg font-semibold text-foreground">
                                              {formatDecimal(item.extraUnit)}
                                            </div>
                                            {item.extraLabel ? (
                                              <p className="text-xs text-muted-foreground">{item.extraLabel}</p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <p className="mt-1 text-sm text-muted-foreground">Không áp dụng</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex-1 space-y-4">
                                    <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        <Calculator className="size-4" aria-hidden="true" />
                                        <span>Cách tính</span>
                                      </div>
                                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        {item.calculation}
                                      </p>
                                    </section>
                                    {item.licensePoints.length ? (
                                      <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          <Hash className="size-4" aria-hidden="true" />
                                          <span>Mã &amp; điểm</span>
                                        </div>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                          {item.licensePoints.map((license) => (
                                            <div
                                              key={`${item.key}-${license.code}`}
                                              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs"
                                            >
                                              <span className="font-semibold text-foreground">{license.code}</span>
                                              <span className="text-muted-foreground">
                                                {formatDecimal(license.points)} điểm
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </section>
                                    ) : null}
                                    {item.gradeOptions.length ? (
                                      <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          <Medal className="size-4" aria-hidden="true" />
                                          <span>Các mức đánh giá</span>
                                        </div>
                                        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                          {item.gradeOptions.map((grade) => (
                                            <li key={`${item.key}-grade-${grade.value}`}>{grade.label}</li>
                                          ))}
                                        </ul>
                                      </section>
                                    ) : null}
                                    {item.notes.length ? (
                                      <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          <NotebookPen className="size-4" aria-hidden="true" />
                                          <span>Ghi chú</span>
                                        </div>
                                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
                                          {item.notes.map((note, index) => (
                                            <li key={`${item.key}-note-${index}`}>{note}</li>
                                          ))}
                                        </ul>
                                      </section>
                                    ) : null}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </ScrollArea>
          ) : (
            <div className="px-6 pb-6">
              <p className="text-sm text-muted-foreground">
                Chưa có thông tin cấu hình khả dụng. Vui lòng mở phần cấu hình để kiểm tra lại.
              </p>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 px-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="link" className="h-auto px-0 text-sm" onClick={onOpenSettings}>
              Mở phần cấu hình
            </Button>
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Đã rõ
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
