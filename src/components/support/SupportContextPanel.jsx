import React from 'react';

function ReferenceCard({ reference, onCopyReference }) {
  return (
    <article className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-1">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reference.title}</h4>
        <p className="text-xs text-slate-600 dark:text-slate-400">{reference.summary}</p>
      </div>
      <code className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {reference.path}
      </code>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>Tài liệu nội bộ trong repo</span>
        <button
          type="button"
          onClick={() => onCopyReference(reference)}
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Sao chép đường dẫn
        </button>
      </div>
    </article>
  );
}

function SuggestedResourceCard({ resource }) {
  return (
    <article className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="grid gap-1">
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">{resource.title}</h4>
        <p className="text-xs text-amber-800 dark:text-amber-200">{resource.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
        {resource.duration ? <span>{resource.duration}</span> : null}
        {resource.format ? <span>{resource.format}</span> : null}
        {Array.isArray(resource.tags)
          ? resource.tags.map((tag) => (
              <span key={tag} className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-500/20">
                #{tag}
              </span>
            ))
          : null}
      </div>
      <div className="flex justify-end">
        <a
          href={resource.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Mở tài nguyên
        </a>
      </div>
    </article>
  );
}

export default function SupportContextPanel({ context, suggestedResources, onCopyReference }) {
  if (!context) {
    return null;
  }

  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="inline-flex w-fit items-center rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Theo ngữ cảnh: {context.label}
          </span>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">FAQ nhanh cho màn hình hiện tại</h3>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">{context.summary}</p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Tài liệu trong `docs/` là tài liệu nội bộ của repo. Nếu app không mở trực tiếp được, hãy sao chép đường dẫn để tra cứu trong workspace hoặc chia sẻ cho đội vận hành.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-3">
          {context.faqs.map((faq) => (
            <article key={faq.question} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{faq.question}</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{faq.answer}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-3">
          {context.docReferences.map((reference) => (
            <ReferenceCard key={reference.path} reference={reference} onCopyReference={onCopyReference} />
          ))}
        </div>
      </div>

      {suggestedResources.length ? (
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tài nguyên nên xem tiếp</h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">Ưu tiên theo tags/keywords của màn hình hiện tại</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {suggestedResources.map((resource) => (
              <SuggestedResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
