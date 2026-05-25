import React, {

  useDeferredValue,

  useEffect,

  useMemo,

  useState,

  useTransition,

} from 'react';
import { t } from '@/lib/i18n.js';

import * as Dialog from '@radix-ui/react-dialog';

import * as Tabs from '@radix-ui/react-tabs';

import { toast } from '@/shared/toast';

import { subscribeCommand } from '@/lib/commandBus.js';
import SupportContextPanel from '@/components/support/SupportContextPanel.jsx';
import {
  getSuggestedSupportResources,
  resolveSupportContext,
} from '@/components/support/supportContextCatalog.js';

import {

  fetchFeedbackSummary,

  fetchTrainingResources,

  prefetchEngagementData,

  submitFeedback,

} from '@/lib/feedbackClient.js';



const STORAGE_KEY = 'kpi_training_progress_v1';

const DEFAULT_FEEDBACK = {

  category: 'trai-nghiem',

  rating: '5',

  message: '',

  contact: '',

};



interface FeedbackFormState {
  category: string;
  rating: string;
  message: string;
  contact: string;
}

interface TrainingItem {
  id: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  format: string;
  tags?: string[];
  link: string;
}

interface SupportCenterProps {
  currentTabId?: string;
}

interface TrainingCardProps {
  item: TrainingItem;
  completedAt?: string;
  onToggle: (id: string, completedAt?: string) => void;
}

interface FeedbackSummary {
  total: number;
  latestAt: string | null;
  averageRating: number | null;
}

function loadProgress(): Record<string, { completedAt: string }> {

  if (typeof window === 'undefined') {

    return {};

  }

  try {

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {

      return {};

    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === 'object' ? parsed : {};

  } catch {

    return {};

  }

}



function saveProgress(value: Record<string, { completedAt: string }>) {

  if (typeof window === 'undefined') {

    return;

  }

  try {

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));

  } catch (err) {

    console.warn(t('support.error.saveProgress'), err);

  }

}



function formatDateTime(value: string | null | undefined): string {

  if (!value) {

    return t('health.date.unknown');

  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return t('health.date.unknown');

  }

  return new Intl.DateTimeFormat('vi-VN', {

    dateStyle: 'medium',

    timeStyle: 'short',

  }).format(date);

}



function TrainingCard({ item, completedAt, onToggle }: TrainingCardProps) {

  return (

    <article className="rounded-lg border border-ds-border-subtle bg-ds-surface-card p-4 shadow-sm transition">

      <header className="flex flex-wrap items-start justify-between gap-2">

        <div>

          <h3 className="text-base font-semibold text-ds-text-primary">{item.title}</h3>

          <p className="mt-1 text-sm text-ds-text-secondary">{item.description}</p>

        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-ds-warning/30 bg-ds-warning/10 px-2 py-0.5 text-xs font-medium text-ds-warning">

          {item.level}

        </span>

      </header>

      <dl className="mt-3 grid gap-2 text-xs text-ds-text-muted">

        <div className="flex flex-wrap items-center gap-1">

          <dt className="font-semibold text-ds-text-secondary">{t('support.training.duration')}:</dt>

          <dd>{item.duration}</dd>

        </div>

        <div className="flex flex-wrap items-center gap-1">

          <dt className="font-semibold text-ds-text-secondary">{t('support.training.format')}:</dt>

          <dd>{item.format}</dd>

        </div>

        {item.tags?.length ? (

          <div className="flex flex-wrap items-center gap-1">

            <dt className="font-semibold text-ds-text-secondary">{t('support.training.tags')}:</dt>

            <dd className="flex flex-wrap items-center gap-1">

              {item.tags.map((tag: string) => (

                <span key={tag} className="rounded bg-ds-surface-base px-1.5 py-0.5 text-[11px] font-medium text-ds-text-secondary">

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

          className="inline-flex items-center gap-2 rounded border border-transparent bg-ds-accent px-3 py-1.5 text-sm font-medium text-ds-text-inverse transition hover:bg-ds-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-ds-accent-ring"

        >

          {t('support.training.openDoc')}

        </a>

        <button

          type="button"

          onClick={() => onToggle(item.id, completedAt)}

          className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-ds-accent-ring ${

            completedAt

              ? 'border-ds-success/30 bg-ds-success/10 text-ds-success'

              : 'border-ds-border-subtle bg-ds-surface-card text-ds-text-primary hover:bg-ds-surface-base'

          }`}

        >

          {completedAt ? t('support.training.markIncomplete') : t('support.training.markComplete')}

        </button>

      </footer>

      {completedAt ? (

        <p className="mt-2 text-xs text-ds-success">{t('support.training.completedAt')} {formatDateTime(completedAt)}</p>

      ) : null}

    </article>

  );

}



export default function SupportCenter({ currentTabId = 'reports' }: SupportCenterProps) {

  const [open, setOpen] = useState(false);

  const [resources, setResources] = useState<TrainingItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [summary, setSummary] = useState<FeedbackSummary>({ total: 0, latestAt: null, averageRating: null });

  const [progress, setProgress] = useState<Record<string, { completedAt: string }>>(() => loadProgress());

  const [search, setSearch] = useState('');

  const deferredSearch = useDeferredValue(search);

  const [activeTab, setActiveTab] = useState('training');
  const [contextOverrideTabId, setContextOverrideTabId] = useState<string | null>(null);

  const [formState, setFormState] = useState<FeedbackFormState>(() => ({ ...DEFAULT_FEEDBACK }));

  const [submitting, setSubmitting] = useState(false);

  const [isPending, startTransition] = useTransition();



  useEffect(() => {

    prefetchEngagementData();

  }, []);



  useEffect(() => {

    const unsubscribe = subscribeCommand((id: string, payload?: { tab?: string; contextTab?: string }) => {

      if (id !== 'open:support') {

        return;

      }

      setOpen(true);
      setContextOverrideTabId(typeof payload?.contextTab === 'string' ? payload.contextTab : null);

      if (payload?.tab === 'feedback') {

        setActiveTab('feedback');

      } else if (payload?.tab === 'training') {

        setActiveTab('training');

      }

    });

    return () => unsubscribe();

  }, []);

  useEffect(() => {

    if (!open) {

      setContextOverrideTabId(null);

    }

  }, [open]);



  useEffect(() => {

    if (!open) {

      return;

    }

    let cancelled = false;

    setLoading(true);

    setError('');

    fetchTrainingResources()

      .then((items: TrainingItem[]) => {

        if (!cancelled) {

          setResources(items);

        }

      })

      .catch((err: Error) => {

        if (!cancelled) {

          setError(err?.message || t('support.error.loadResources'));

        }

      })

      .finally(() => {

        if (!cancelled) {

          setLoading(false);

        }

      });

    fetchFeedbackSummary()

      .then((result: FeedbackSummary | null) => {

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

      const haystack = [item.title, item.description, item.tags?.join(' ')]

        .filter(Boolean)

        .join(' ')

        .toLowerCase();

      return haystack.includes(keyword);

    });

  }, [resources, deferredSearch]);

  const supportContext = useMemo(() => {

    return resolveSupportContext(contextOverrideTabId || currentTabId);

  }, [contextOverrideTabId, currentTabId]);

  const suggestedResources = useMemo(() => {

    return getSuggestedSupportResources(resources, supportContext);

  }, [resources, supportContext]);



  const completedCount = useMemo(() => {

    return Object.keys(progress).filter((key) => progress[key]?.completedAt).length;

  }, [progress]);



  const completionPercent = resources.length

    ? Math.round((completedCount / resources.length) * 100)

    : 0;



  const averageRating = summary?.averageRating

    ? Number(summary.averageRating).toFixed(1)

    : null;



  const handleToggleTraining = (id: string, completedAt?: string) => {

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

  const handleCopyReference = async (reference: { path: string }) => {

    try {

      if (!navigator?.clipboard?.writeText) {

        throw new Error('clipboard-unavailable');

      }

      await navigator.clipboard.writeText(reference.path);

      toast.success(`Đã sao chép ${reference.path}`);

    } catch {

      toast.error('Không thể sao chép đường dẫn tài liệu trong trình duyệt hiện tại.');

    }

  };



  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (!formState.message.trim()) {

      toast.error('Vui lòng nhập nội dung phản hồi.');

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

      toast.success('Đã gửi phản hồi, cảm ơn bạn!');

      setFormState({ ...DEFAULT_FEEDBACK });

      const refreshed = await fetchFeedbackSummary({ forceRefresh: true });

      setSummary(refreshed);

    } catch (err: unknown) {

      const message = err instanceof Error ? err.message : 'Không thể gửi phản hồi, vui lòng thử lại.';

      toast.error(message);

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <Dialog.Root open={open} onOpenChange={setOpen}>

      <Dialog.Trigger asChild>

        <button

          type="button"

          className="inline-flex items-center gap-2 rounded border border-ds-border-subtle px-3 py-1 text-sm font-medium text-ds-text-primary transition hover:bg-ds-surface-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-ds-accent-ring"

        >

          Hỗ trợ & Đào tạo

        </button>

      </Dialog.Trigger>

      <Dialog.Portal>

        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />

        <Dialog.Content className="fixed inset-y-6 right-4 z-50 w-full max-w-3xl overflow-y-auto rounded-xl border border-ds-border-subtle bg-ds-surface-card shadow-xl transition focus:outline-none">

          <div className="flex items-start justify-between border-b border-ds-border-subtle p-6">

            <div>

              <Dialog.Title className="text-lg font-semibold text-ds-text-primary">

                Trung tâm hỗ trợ & đào tạo

              </Dialog.Title>

              <Dialog.Description className="mt-1 text-sm text-ds-text-secondary">

                Theo dõi tiến độ học tập, đọc tài liệu hướng dẫn và gửi góp ý trực tiếp tới đội vận hành.

              </Dialog.Description>

            </div>

            <Dialog.Close asChild>

              <button

                type="button"

                className="rounded border border-ds-border-subtle px-2 py-1 text-sm text-ds-text-muted transition hover:bg-ds-surface-base hover:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-ds-accent-ring"

              >

                Đóng

              </button>

            </Dialog.Close>

          </div>



          <div className="grid gap-6 px-6 py-5">

            <section className="grid gap-2 rounded-lg border border-ds-warning/30 bg-ds-warning/10 p-4 text-sm text-ds-warning">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <p className="font-medium">Tiến độ đào tạo cá nhân</p>

                <span className="text-xs uppercase tracking-wide text-ds-accent">

                  {completedCount}/{resources.length || 0} tài liệu • {completionPercent}% hoàn thành

                </span>

              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-ds-warning/20">

                <div

                  className="h-full rounded-full bg-ds-accent transition-all"

                  style={{ width: `${completionPercent}%` }}

                  aria-hidden="true"

                />

              </div>

              {summary?.total ? (

                <p className="text-xs text-ds-warning">

                  Đã ghi nhận {summary.total.toLocaleString('vi-VN')} phản hồi • Điểm hài lòng trung bình {averageRating || '—'} • Gần nhất {formatDateTime(summary.latestAt)}

                </p>

              ) : (

                <p className="text-xs text-ds-warning">

                  Hãy gửi góp ý đầu tiên để đội vận hành cải tiến nhanh hơn.

                </p>

              )}

            </section>

            <SupportContextPanel
              context={supportContext}
              suggestedResources={suggestedResources}
              onCopyReference={handleCopyReference}
            />



            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="grid gap-4">

              <Tabs.List className="flex flex-wrap gap-3">

                <Tabs.Trigger

                  value="training"

                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-ds-accent-ring ${

                    activeTab === 'training'

                      ? 'bg-ds-accent text-ds-text-inverse shadow'

                      : 'bg-ds-surface-base text-ds-text-primary hover:bg-ds-surface-muted'

                  }`}

                >

                  Tài liệu đào tạo

                </Tabs.Trigger>

                <Tabs.Trigger

                  value="feedback"

                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-ds-accent-ring ${

                    activeTab === 'feedback'

                      ? 'bg-ds-accent text-ds-text-inverse shadow'

                      : 'bg-ds-surface-base text-ds-text-primary hover:bg-ds-surface-muted'

                  }`}

                >

                  Góp ý & phản hồi

                </Tabs.Trigger>

              </Tabs.List>



              <Tabs.Content value="training" className="grid gap-4">

                <div className="flex flex-wrap items-center justify-between gap-3">

                  <label className="flex flex-1 items-center gap-2 rounded border border-ds-border-subtle bg-ds-surface-card px-3 py-2 text-sm text-ds-text-secondary focus-within:border-ds-accent focus-within:ring-1 focus-within:ring-ds-accent-ring">

                    <span className="text-ds-text-muted">Tìm kiếm</span>

                    <input

                      type="search"

                      value={search}

                      onChange={(event) => setSearch(event.target.value)}

                      placeholder={`Tìm tài liệu cho ${supportContext.label.toLowerCase()} hoặc một nhu cầu khác...`}

                      className="flex-1 bg-transparent text-sm text-ds-text-primary outline-none placeholder:text-ds-text-muted"

                    />

                  </label>

                  <span className="text-xs text-ds-text-muted">

                    {isPending ? 'Đang cập nhật...' : `${filteredResources.length} tài liệu phù hợp`}

                  </span>

                </div>



                {loading ? (

                  <p className="text-sm text-ds-text-muted">Đang tải tài liệu đào tạo...</p>

                ) : error ? (

                  <p className="text-sm text-ds-destructive">{error}</p>

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

                  <p className="text-sm text-ds-text-muted">

                    Không tìm thấy tài liệu phù hợp, vui lòng thử lại với từ khóa khác.

                  </p>

                )}

              </Tabs.Content>



              <Tabs.Content value="feedback" className="grid gap-4">

                <form className="grid gap-4" onSubmit={handleSubmit}>

                  <div className="grid gap-1">

                    <label className="text-sm font-medium text-ds-text-primary" htmlFor="feedback-category">

                      Chủ đề phản hồi

                    </label>

                    <select

                      id="feedback-category"

                      value={formState.category}

                      onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}

                      className="rounded border border-ds-border-subtle bg-ds-surface-card px-3 py-2 text-sm text-ds-text-primary focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent-ring/40"

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

                    <label className="text-sm font-medium text-ds-text-primary" htmlFor="feedback-message">

                      Nội dung góp ý

                    </label>

                    <textarea

                      id="feedback-message"

                      value={formState.message}

                      onChange={(event) => setFormState((prev) => ({ ...prev, message: event.target.value }))}

                      rows={5}

                      className="w-full rounded border border-ds-border-subtle bg-ds-surface-card px-3 py-2 text-sm text-ds-text-primary focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent-ring/40"

                      placeholder="Mô tả chi tiết nhu cầu hoặc sự cố bạn gặp phải..."

                      required

                    />

                  </div>



                  <div className="grid gap-1 sm:grid-cols-2 sm:gap-4">

                    <div className="grid gap-1">

                      <label className="text-sm font-medium text-ds-text-primary" htmlFor="feedback-rating">

                        Mức độ hài lòng (1-5)

                      </label>

                      <input

                        type="number"

                        id="feedback-rating"

                        min="1"

                        max="5"

                        value={formState.rating}

                        onChange={(event) => setFormState((prev) => ({ ...prev, rating: event.target.value }))}

                        className="rounded border border-ds-border-subtle bg-ds-surface-card px-3 py-2 text-sm text-ds-text-primary focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent-ring/40"

                      />

                    </div>

                    <div className="grid gap-1">

                      <label className="text-sm font-medium text-ds-text-primary" htmlFor="feedback-contact">

                        Thông tin liên hệ (tuỳ chọn)

                      </label>

                      <input

                        type="text"

                        id="feedback-contact"

                        value={formState.contact}

                        onChange={(event) => setFormState((prev) => ({ ...prev, contact: event.target.value }))}

                        className="rounded border border-ds-border-subtle bg-ds-surface-card px-3 py-2 text-sm text-ds-text-primary focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent-ring/40"

                        placeholder="Email, số máy lẻ hoặc Zalo công việc"

                      />

                    </div>

                  </div>



                  <div className="flex items-center justify-between gap-3 text-xs text-ds-text-muted">

                    <p>

                      Phản hồi sẽ được gắn với tài khoản đang đăng nhập (nếu có) để đội vận hành hỗ trợ nhanh hơn.

                    </p>

                    <span>{submitting ? 'Đang gửi...' : 'Cảm ơn bạn đã chia sẻ!'}</span>

                  </div>



                  <div className="flex justify-end">

                    <button

                      type="submit"

                      disabled={submitting}

                      className="inline-flex items-center gap-2 rounded bg-ds-accent px-4 py-2 text-sm font-semibold text-ds-text-inverse shadow transition hover:bg-ds-accent-strong disabled:cursor-not-allowed disabled:opacity-70"

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
