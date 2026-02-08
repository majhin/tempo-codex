import { useDraggable } from '@dnd-kit/core';
import type { DraggableCardProps } from '../types';
import { toDragId } from '../utils';

export const DraggableCard = ({
  id,
  className,
  style,
  title,
  children,
  disabled = false,
  onMouseEnter,
  onMouseLeave,
}: DraggableCardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: toDragId(id), disabled });

  return (
    <div
      ref={setNodeRef}
      data-drag-id={id}
      className={`${className}${isDragging ? ' dragging' : ''}`}
      style={style}
      title={title}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
    >
      {children}
    </div>
  );
};
