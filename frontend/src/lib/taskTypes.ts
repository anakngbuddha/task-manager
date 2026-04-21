export type TaskType = 'EPIC' | 'STORY' | 'TASK';

export const TASK_TYPE_CONFIG: Record<TaskType, {
  label:       string;
  icon:        string;
  badgeColor:  string;  // Tailwind bg class
  textColor:   string;  // Tailwind text class
  borderColor: string;  // Tailwind border class
  description: string;
}> = {
  EPIC: {
    label:       'Epic',
    icon:        '⚡',
    badgeColor:  'bg-purple-100 dark:bg-purple-900/30',
    textColor:   'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-300 dark:border-purple-700',
    description: 'A large body of work that spans multiple sprints',
  },
  STORY: {
    label:       'Story',
    icon:        '🔖',
    badgeColor:  'bg-green-100 dark:bg-green-900/30',
    textColor:   'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    description: 'A user-facing requirement or feature',
  },
  TASK: {
    label:       'Task',
    icon:        '☑️',
    badgeColor:  'bg-blue-100 dark:bg-blue-900/30',
    textColor:   'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    description: 'A concrete unit of technical work',
  },
};

export const VALID_PARENT_TYPES: Record<TaskType, TaskType[]> = {
  EPIC:  [],               // Epics have no parent
  STORY: ['EPIC'],         // Stories must belong to an Epic
  TASK:  ['EPIC', 'STORY'] // Tasks can belong to either
};

export const HIERARCHY_LEVEL: Record<TaskType, number> = {
  EPIC: 0, STORY: 1, TASK: 2
};
