import { useCallback, useState } from 'react';
import { initialAppointments } from './components/Scheduler/data';
import Scheduler from './components/Scheduler/Scheduler';
import type { Appointment } from './components/Scheduler/types';

function App() {
  const [tasks, setTasks] = useState<Appointment[]>(initialAppointments);

  const handleTaskCreate = useCallback(
    (draft: Omit<Appointment, 'id'>) => {
      setTasks((prev) => {
        const nextId = prev.reduce((max, task) => Math.max(max, task.id), 0) + 1;
        return [
          ...prev,
          {
            id: nextId,
            ...draft,
          },
        ];
      });
    },
    [setTasks],
  );

  const handleTaskDelete = useCallback(
    (task: Appointment) => {
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
    },
    [setTasks],
  );

  const handleTaskToggleComplete = useCallback(
    (task: Appointment, nextCompleted: boolean) => {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: nextCompleted } : item)));
    },
    [setTasks],
  );

  const handleTaskEdit = useCallback(
    (task: Appointment) => {
      if (typeof window === 'undefined') return;
      const nextText = window.prompt('Edit work log title', task.text);
      if (nextText === null) return;
      const text = nextText.trim();
      if (!text) return;
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, text } : item)));
    },
    [setTasks],
  );

  return (
    <div className="App">
      <Scheduler
        config={{
          views: ['day', 'week', 'workWeek', 'month'],
          startTime: new Date(2026, 0, 1, 9, 30),
          endTime: new Date(2026, 0, 1, 19, 30),
          blockMinutes: 15,
        }}
        ui={{
          showWeekStrip: false,
          showFilters: true,
        }}
        onTaskCreate={handleTaskCreate}
        onTaskDelete={handleTaskDelete}
        onTaskEdit={handleTaskEdit}
        onTaskToggleComplete={handleTaskToggleComplete}
        onTasksChange={setTasks}
      >
        {tasks.map((task) => (
          <Scheduler.TaskItem
            key={task.id}
            id={task.id}
            text={task.text}
            startDate={task.startDate}
            endDate={task.endDate}
            projectId={task.projectId}
            taskType={task.taskType}
            description={task.description}
            issueKey={task.issueKey}
            completed={task.completed}
          />
        ))}
      </Scheduler>
    </div>
  );
}

export default App;
