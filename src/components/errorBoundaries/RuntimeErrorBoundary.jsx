import React from 'react';

function areResetKeysEqual(previousKeys = [], nextKeys = []) {
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return previousKeys.every((value, index) => Object.is(value, nextKeys[index]));
}

function DefaultFallback({
  error,
  level = 'panel',
  title = 'Đã xảy ra lỗi khi hiển thị nội dung.',
  description = 'Bạn có thể thử hiển thị lại. Nếu lỗi tiếp diễn, hãy liên hệ quản trị viên.',
  resetLabel = 'Thử hiển thị lại',
  onReset,
}) {
  const wrapperClassName =
    level === 'page'
      ? 'mx-auto my-10 flex max-w-3xl flex-col gap-4 rounded-3xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/30 dark:bg-slate-900'
      : 'flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm shadow-sm dark:border-red-500/30 dark:bg-red-500/10';

  return (
    <div className={wrapperClassName} role="alert">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
          Runtime error
        </p>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        {error?.message ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Chi tiết kỹ thuật: {error.message}</p>
        ) : null}
      </div>
      <div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-400/40 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-500/10"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

class RuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && !areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const {
      children,
      fallback,
      level,
      title,
      description,
      resetLabel,
    } = this.props;

    if (this.state.error) {
      if (typeof fallback === 'function') {
        return fallback({
          error: this.state.error,
          reset: this.resetErrorBoundary,
        });
      }

      return (
        <DefaultFallback
          error={this.state.error}
          level={level}
          title={title}
          description={description}
          resetLabel={resetLabel}
          onReset={this.resetErrorBoundary}
        />
      );
    }

    return children;
  }
}

export default RuntimeErrorBoundary;
