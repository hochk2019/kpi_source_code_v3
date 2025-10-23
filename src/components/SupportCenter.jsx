import React, { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import * as Dialog from "@radix-ui/react-dialog";

import * as Tabs from "@radix-ui/react-tabs";

import { toast } from "@/shared/toast";

import { subscribeCommand } from "@/lib/commandBus.js";

import {
  fetchFeedbackSummary,
  fetchTrainingResources,
  prefetchEngagementData,
  submitFeedback,
} from "@/lib/feedbackClient.js";

const STORAGE_KEY = "kpi_training_progress_v1";

const DEFAULT_FEEDBACK = {
  category: "trai-nghiem",

  rating: "5",

  message: "",

  contact: "",
};

function loadProgress() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProgress(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (err) {
    console.warn("Không thể lưu tiến độ đào tạo vào localStorage", err);
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Chưa xác định";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa xác định";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(date);
}

function TrainingCard({ item, completedAt, onToggle }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-300">
          {item.level}
        </span>
      </header>

      <dl className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-1">
          <dt className="font-semibold text-gray-600 dark:text-gray-300">Thời lượng:</dt>

          <dd>{item.duration}</dd>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <dt className="font-semibold text-gray-600 dark:text-gray-300">Định dạng:</dt>

          <dd>{item.format}</dd>
        </div>

        {item.tags?.length ? (
          <div className="flex flex-wrap items-center gap-1">
            <dt className="font-semibold text-gray-600 dark:text-gray-300">Từ khóa:</dt>

            <dd className="flex flex-wrap items-center gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300"
                >
                  #{tag}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded border border-transparent bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Mở tài liệu
        </a>

        <button
          type="button"
          onClick={() => onToggle(item.id, completedAt)}
          className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            completedAt
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
          }`}
        >
          {completedAt ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}
        </button>
      </footer>

      {completedAt ? (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">
          Hoàn thành lúc {formatDateTime(completedAt)}
        </p>
      ) : null}
    </article>
  );
}

export default function SupportCenter() {
  const [open, setOpen] = useState(false);

  const [resources, setResources] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [summary, setSummary] = useState({ total: 0, latestAt: null, averageRating: null });

  const [progress, setProgress] = useState(() => loadProgress());

  const [search, setSearch] = useState("");

  const deferredSearch = useDeferredValue(search);

  const [activeTab, setActiveTab] = useState("training");

  const [formState, setFormState] = useState(() => ({ ...DEFAULT_FEEDBACK }));

  const [submitting, setSubmitting] = useState(false);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    prefetchEngagementData();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCommand((id, payload) => {
      if (id !== "open:support") {
        return;
      }

      setOpen(true);

      if (payload?.tab === "feedback") {
        setActiveTab("feedback");
      } else if (payload?.tab === "training") {
        setActiveTab("training");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    setLoading(true);

    setError("");

    fetchTrainingResources()
      .then((items) => {
        if (!cancelled) {
          setResources(items);
        }
      })

      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Không thể tải tài liệu đào tạo");
        }
      })

      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    fetchFeedbackSummary()
      .then((result) => {
        if (!cancelled && result) {
          setSummary(result);
        }
      })

      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const filteredResources = useMemo(() => {
    if (!resources.length) {
      return [];
    }

    const keyword = deferredSearch.trim().toLowerCase();

    if (!keyword) {
      return resources;
    }

    return resources.filter((item) => {
      const haystack = [item.title, item.description, item.tags?.join(" ")]

        .filter(Boolean)

        .join(" ")

        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [resources, deferredSearch]);

  const completedCount = useMemo(() => {
    return Object.keys(progress).filter((key) => progress[key]?.completedAt).length;
  }, [progress]);

  const completionPercent = resources.length
    ? Math.round((completedCount / resources.length) * 100)
    : 0;

  const averageRating = summary?.averageRating ? Number(summary.averageRating).toFixed(1) : null;

  const handleToggleTraining = (id, completedAt) => {
    startTransition(() => {
      setProgress((prev) => {
        const next = { ...prev };

        if (completedAt) {
          delete next[id];
        } else {
          next[id] = { completedAt: new Date().toISOString() };
        }

        return next;
      });
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formState.message.trim()) {
      toast.error("Vui lòng nhập nội dung phản hồi.");

      return;
    }

    setSubmitting(true);

    try {
      await submitFeedback({
        category: formState.category,

        rating: formState.rating ? Number(formState.rating) : null,

        message: formState.message,

        contact: formState.contact,
      });

      toast.success("Đã gửi phản hồi, cảm ơn bạn!");

      setFormState({ ...DEFAULT_FEEDBACK });

      const refreshed = await fetchFeedbackSummary({ forceRefresh: true });

      setSummary(refreshed);
    } catch (err) {
      toast.error(err?.message || "Không thể gửi phản hồi, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          Hỗ trợ & Đào tạo
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />

        <Dialog.Content className="fixed inset-y-6 right-4 z-50 w-full max-w-3xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl transition focus:outline-none dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between border-b border-gray-200 p-6 dark:border-slate-700">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Trung tâm hỗ trợ & đào tạo
              </Dialog.Title>

              <Dialog.Description className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Theo dõi tiến độ học tập, đọc tài liệu hướng dẫn và gửi góp ý trực tiếp tới đội vận
                hành.
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </Dialog.Close>
          </div>

          <div className="grid gap-6 px-6 py-5">
            <section className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Tiến độ đào tạo cá nhân</p>

                <span className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-300">
                  {completedCount}/{resources.length || 0} tài liệu • {completionPercent}% hoàn
                  thành
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-amber-500/20">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                  aria-hidden="true"
                />
              </div>

              {summary?.total ? (
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  Đã ghi nhận {summary.total.toLocaleString("vi-VN")} phản hồi • Điểm hài lòng trung
                  bình {averageRating || "—"} • Gần nhất {formatDateTime(summary.latestAt)}
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  Hãy gửi góp ý đầu tiên để đội vận hành cải tiến nhanh hơn.
                </p>
              )}
            </section>

            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="grid gap-4">
              <Tabs.List className="flex flex-wrap gap-3">
                <Tabs.Trigger
                  value="training"
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                    activeTab === "training"
                      ? "bg-amber-500 text-white shadow"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200"
                  }`}
                >
                  Tài liệu đào tạo
                </Tabs.Trigger>

                <Tabs.Trigger
                  value="feedback"
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                    activeTab === "feedback"
                      ? "bg-amber-500 text-white shadow"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200"
                  }`}
                >
                  Góp ý & phản hồi
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="training" className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex flex-1 items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">Tìm kiếm</span>

                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Nhập từ khóa về chủ đề, tổ đội hoặc nhu cầu..."
                      className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
                    />
                  </label>

                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isPending
                      ? "Đang cập nhật..."
                      : `${filteredResources.length} tài liệu phù hợp`}
                  </span>
                </div>

                {loading ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Đang tải tài liệu đào tạo...
                  </p>
                ) : error ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                ) : filteredResources.length ? (
                  <div className="grid gap-4">
                    {filteredResources.map((item) => (
                      <TrainingCard
                        key={item.id}
                        item={item}
                        completedAt={progress[item.id]?.completedAt}
                        onToggle={handleToggleTraining}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Không tìm thấy tài liệu phù hợp, vui lòng thử lại với từ khóa khác.
                  </p>
                )}
              </Tabs.Content>

              <Tabs.Content value="feedback" className="grid gap-4">
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  <div className="grid gap-1">
                    <label
                      className="text-sm font-medium text-gray-700 dark:text-gray-200"
                      htmlFor="feedback-category"
                    >
                      Chủ đề phản hồi
                    </label>

                    <select
                      id="feedback-category"
                      value={formState.category}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, category: event.target.value }))
                      }
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
                      required
                    >
                      <option value="trai-nghiem">Trải nghiệm sử dụng</option>

                      <option value="tinh-nang">Đề xuất tính năng</option>

                      <option value="dao-tao">Nhu cầu đào tạo</option>

                      <option value="van-hanh">Vấn đề vận hành</option>

                      <option value="khac">Khác</option>
                    </select>
                  </div>

                  <div className="grid gap-1">
                    <label
                      className="text-sm font-medium text-gray-700 dark:text-gray-200"
                      htmlFor="feedback-message"
                    >
                      Nội dung góp ý
                    </label>

                    <textarea
                      id="feedback-message"
                      value={formState.message}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, message: event.target.value }))
                      }
                      rows={5}
                      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
                      placeholder="Mô tả chi tiết nhu cầu hoặc sự cố bạn gặp phải..."
                      required
                    />
                  </div>

                  <div className="grid gap-1 sm:grid-cols-2 sm:gap-4">
                    <div className="grid gap-1">
                      <label
                        className="text-sm font-medium text-gray-700 dark:text-gray-200"
                        htmlFor="feedback-rating"
                      >
                        Mức độ hài lòng (1-5)
                      </label>

                      <input
                        type="number"
                        id="feedback-rating"
                        min="1"
                        max="5"
                        value={formState.rating}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, rating: event.target.value }))
                        }
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
                      />
                    </div>

                    <div className="grid gap-1">
                      <label
                        className="text-sm font-medium text-gray-700 dark:text-gray-200"
                        htmlFor="feedback-contact"
                      >
                        Thông tin liên hệ (tuỳ chọn)
                      </label>

                      <input
                        type="text"
                        id="feedback-contact"
                        value={formState.contact}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, contact: event.target.value }))
                        }
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
                        placeholder="Email, số máy lẻ hoặc Zalo công việc"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <p>
                      Phản hồi sẽ được gắn với tài khoản đang đăng nhập (nếu có) để đội vận hành hỗ
                      trợ nhanh hơn.
                    </p>

                    <span>{submitting ? "Đang gửi..." : "Cảm ơn bạn đã chia sẻ!"}</span>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Gửi phản hồi
                    </button>
                  </div>
                </form>
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
