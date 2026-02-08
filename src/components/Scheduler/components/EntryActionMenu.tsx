import type React from 'react';
import type { EntryActionMenuProps } from '../types';

const blockDragFromAction = (event: React.PointerEvent<HTMLButtonElement>): void => {
  event.preventDefault();
  event.stopPropagation();
};

export const EntryActionMenu = ({
  className,
  completed,
  canDelete = true,
  canEdit = true,
  canToggleComplete = true,
  onDelete,
  onEdit,
  onToggleComplete,
}: EntryActionMenuProps) => {
  if (!canDelete && !canEdit && !canToggleComplete) return null;

  return (
    <div className={className} onPointerDown={(event) => event.stopPropagation()}>
      <div className="menu-group">
        {canDelete && (
          <button
            type="button"
            className="menu-btn"
            title="Delete"
            onPointerDown={blockDragFromAction}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 7h12l-1 14H7L6 7z" />
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" />
            </svg>
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            className="menu-btn"
            title="Edit"
            onPointerDown={blockDragFromAction}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17.25V21h3.75l11.02-11.03-3.75-3.75L3 17.25z" />
              <path d="M20.71 7.04a1 1 0 000-1.42l-2.33-2.33a1 1 0 00-1.42 0L15.13 5.1l3.75 3.75 1.83-1.81z" />
            </svg>
          </button>
        )}
      </div>
      {canToggleComplete && (
        <div className="menu-separate">
          <button
            type="button"
            className={`menu-btn complete-btn${completed ? ' active' : ''}`}
            title={completed ? 'Mark incomplete' : 'Mark complete'}
            onPointerDown={blockDragFromAction}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleComplete();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.55 18.2L4.8 13.45l1.7-1.7 3.05 3.05L17.5 6.85l1.7 1.7-9.65 9.65z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
