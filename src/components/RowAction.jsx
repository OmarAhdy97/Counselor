import React from 'react';

/**
 * One icon button in a table row's actions. Every row action in the app uses this
 * so the icons share the same size, stroke and hover states.
 * tone: undefined (neutral) | 'primary' | 'danger'
 */
export default function RowAction({ icon: Icon, label, tone, onClick }) {
  return (
    <button
      type="button"
      className={`icon-btn${tone ? ` is-${tone}` : ''}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Icon size={17} strokeWidth={1.9} />
    </button>
  );
}

export function RowActions({ children }) {
  return <div className="row-actions">{children}</div>;
}
