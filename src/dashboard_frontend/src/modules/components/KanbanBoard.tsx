import React, { useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanTaskCard } from './KanbanTaskCard';
import { useTranslation } from 'react-i18next';

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  isHeader?: boolean;
  completed?: boolean;
  files?: string[];
  implementationDetails?: string[];
  requirements?: string[];
  leverage?: string;
  prompt?: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  specName: string;
  onTaskStatusChange: (taskId: string, newStatus: 'pending' | 'in-progress' | 'completed') => void;
  onCopyTaskPrompt: (task: Task) => void;
  copiedTaskId: string | null;
  data: any;
  statusFilter?: 'all' | 'pending' | 'in-progress' | 'completed';
}

export function KanbanBoard({
  tasks,
  specName,
  onTaskStatusChange,
  onCopyTaskPrompt,
  copiedTaskId,
  data,
  statusFilter = 'all'
}: KanbanBoardProps) {
  const { t } = useTranslation();
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);

  // Setup sensors for drag and drop - includes touch support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const filtered = tasks.filter(task => !task.isHeader); // Exclude headers from kanban
    return {
      pending: filtered.filter(task => task.status === 'pending'),
      'in-progress': filtered.filter(task => task.status === 'in-progress'),
      completed: filtered.filter(task => task.status === 'completed'),
    };
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    // Debug logging
    console.log('[KanbanBoard] Drag end event:', {
      activeId: active.id,
      overId: over?.id,
      overData: over?.data,
    });

    if (!over) {
      console.log('[KanbanBoard] No drop target detected');
      return;
    }

    const taskId = active.id as string;
    let newStatus: 'pending' | 'in-progress' | 'completed' | null = null;

    // Check if we dropped directly on a status column
    if (['pending', 'in-progress', 'completed'].includes(over.id as string)) {
      newStatus = over.id as 'pending' | 'in-progress' | 'completed';
      console.log('[KanbanBoard] Dropped on column:', newStatus);
    } else {
      // We dropped on a task - figure out which column that task is in
      const targetTask = tasks.find(t => t.id === over.id);
      if (targetTask) {
        newStatus = targetTask.status;
        console.log('[KanbanBoard] Dropped on task:', targetTask.id, 'in column:', newStatus);
      } else {
        console.log('[KanbanBoard] Could not find target task for id:', over.id);
      }
    }

    if (!newStatus) {
      console.log('[KanbanBoard] No new status determined');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.log('[KanbanBoard] Could not find dragged task:', taskId);
      return;
    }

    if (task.status === newStatus) {
      console.log('[KanbanBoard] Task already has target status:', newStatus);
      return;
    }

    console.log('[KanbanBoard] Updating task status:', taskId, 'from', task.status, 'to', newStatus);
    onTaskStatusChange(taskId, newStatus);
  };

  const getColumnConfig = (status: 'pending' | 'in-progress' | 'completed') => {
    const configs = {
      pending: {
        title: t('tasksPage.statusPill.pending', 'Pending'),
        bgColor: 'bg-gray-50 dark:bg-gray-900/50',
        borderColor: 'border-gray-200 dark:border-gray-700',
        headerBg: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-700 dark:text-gray-300',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      'in-progress': {
        title: t('tasksPage.statusPill.inProgress', 'In Progress'),
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-700',
        headerBg: 'bg-orange-100 dark:bg-orange-800',
        textColor: 'text-orange-700 dark:text-orange-300',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      completed: {
        title: t('tasksPage.statusPill.completed', 'Completed'),
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-700',
        headerBg: 'bg-green-100 dark:bg-green-800',
        textColor: 'text-green-700 dark:text-green-300',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    };
    return configs[status];
  };

  // Droppable Column Component
  const DroppableColumn = ({ status }: { status: 'pending' | 'in-progress' | 'completed' }) => {
    const config = getColumnConfig(status);
    const columnTasks = tasksByStatus[status];

    const {
      isOver,
      setNodeRef,
    } = useDroppable({
      id: status,
      data: {
        type: 'column',
        status: status,
      },
    });

    return (
      <div
        ref={setNodeRef}
        key={status}
        className={`flex-1 min-w-0 sm:min-w-[280px] rounded-lg border ${config.borderColor} ${config.bgColor} flex flex-col ${
          isOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
        }`}
      >
        {/* Column Header */}
        <div className={`px-4 py-3 rounded-t-lg ${config.headerBg} border-b ${config.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={config.textColor}>
                {config.icon}
              </div>
              <h3 className={`text-sm font-medium ${config.textColor}`}>
                {config.title}
              </h3>
            </div>
            <span className={`text-sm ${config.textColor} bg-white dark:bg-gray-800 px-2 py-1 rounded-full`}>
              {columnTasks.length}
            </span>
          </div>
        </div>

        {/* Drop Zone */}
        <SortableContext
          id={`${status}-sortable`}
          items={columnTasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={`flex-1 p-2 sm:p-3 space-y-2 transition-colors duration-200 max-h-[70vh] overflow-y-auto ${
              isOver ? 'bg-blue-50 dark:bg-blue-900/10' : ''
            }`}
          >
            {columnTasks.length === 0 ? (
              <div className="flex items-center justify-center min-h-[120px] text-center py-4 text-gray-400 dark:text-gray-500">
                <div className="text-xs">
                  {status === 'pending' && t('tasksPage.kanban.noPendingTasks', 'No pending tasks')}
                  {status === 'in-progress' && t('tasksPage.kanban.noInProgressTasks', 'No tasks in progress')}
                  {status === 'completed' && t('tasksPage.kanban.noCompletedTasks', 'No completed tasks')}
                </div>
              </div>
            ) : (
              columnTasks.map((task) => (
                <KanbanTaskCard
                  key={task.id}
                  task={task}
                  specName={specName}
                  onCopyTaskPrompt={() => onCopyTaskPrompt(task)}
                  copiedTaskId={copiedTaskId}
                  isInProgress={data?.inProgress === task.id}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    );
  };

  const renderColumn = (status: 'pending' | 'in-progress' | 'completed') => {
    return <DroppableColumn key={status} status={status} />;
  };

  // Determine which columns to show based on status filter
  const columnsToShow = useMemo(() => {
    if (statusFilter === 'all') {
      return ['pending', 'in-progress', 'completed'] as const;
    } else {
      return [statusFilter] as const;
    }
  }, [statusFilter]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex flex-col md:flex-row gap-3 md:gap-4 w-full ${
        columnsToShow.length === 1 ? 'md:justify-center' : ''
      } ${
        columnsToShow.length === 1 ? 'md:max-w-md md:mx-auto' : ''
      }`}>
        {columnsToShow.map(status => renderColumn(status))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 opacity-95 transform scale-105">
            <KanbanTaskCard
              task={activeTask}
              specName={specName}
              onCopyTaskPrompt={() => {}}
              copiedTaskId={null}
              isInProgress={data?.inProgress === activeTask.id}
              isDragging={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}