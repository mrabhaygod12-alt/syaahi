"use client";

import Logo from "@/components/Logo";

export default function WorkspaceSkeleton({
  message = "Syaahi is preparing your handwritten study notes…",
}: {
  message?: string;
}) {
  return (
    <div className="ws-app ws-skeleton-app" aria-busy="true" aria-live="polite">
      {/* Sidebar Rail Skeleton */}
      <aside className="ws-rail ws-skeleton-rail">
        <div className="ws-brand">
          <Logo size={34} showText={false} />
        </div>
        <div className="ws-skeleton-nav">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ws-skeleton-nav-item">
              <span className="ws-skeleton-icon" />
              <span className="ws-skeleton-label" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main Workspace Body */}
      <div className="ws-body">
        {/* Header Skeleton */}
        <header className="ws-top ws-skeleton-top">
          <div className="ws-skeleton-crumb">
            <span className="ws-skeleton-crumb-link">Home</span>
            <span>›</span>
            <span className="ws-skeleton-crumb-title" />
          </div>
          <div className="ws-top-actions">
            <span className="ws-skeleton-badge" />
            <span className="ws-skeleton-btn" />
            <div className="ws-burger">
              <span />
              <span />
              <span />
            </div>
          </div>
        </header>

        {/* Stage with Notebook Page Skeleton */}
        <div className="ws-stage">
          <div className="ws-main ws-skeleton-main">
            <div className="ws-skeleton-sheet">
              {/* Ruled Notebook Left Margin Line */}
              <div className="ws-skeleton-margin" />

              {/* Ink Animation Header */}
              <div className="ws-skeleton-header">
                <div className="ws-ink-nib-anim">
                  <span className="nib-icon">✒️</span>
                  <span className="ink-pulse-ring" />
                </div>
                <div className="ws-skeleton-title-box">
                  <div className="ws-skeleton-title-bar" />
                  <p className="ws-skeleton-status">{message}</p>
                </div>
              </div>

              {/* Shimmer Notebook Ruled Lines */}
              <div className="ws-skeleton-lines">
                <div className="ws-skeleton-line w-85" />
                <div className="ws-skeleton-line w-95" />
                <div className="ws-skeleton-line w-75" />
                <div className="ws-skeleton-callout">
                  <div className="ws-skeleton-line w-60" />
                  <div className="ws-skeleton-line w-90" />
                </div>
                <div className="ws-skeleton-line w-90" />
                <div className="ws-skeleton-line w-80" />
                <div className="ws-skeleton-line w-70" />
                <div className="ws-skeleton-line w-95" />
                <div className="ws-skeleton-line w-60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
