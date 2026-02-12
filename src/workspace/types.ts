export type EpicStatus = "active" | "paused" | "done";
export type TaskStatus = "todo" | "doing" | "done";

export interface Epic {
  id: string;
  title: string;
  goal: string;
  status: EpicStatus;
  constraints: string[];
  decisions: string[];
  context?: string;
  digest?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  epic_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 0 | 1 | 2 | 3 | 4;
  notes?: string;
  acceptance?: string[];
  outcome_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface BlockEdge {
  from: string;
  to: string;
}

export interface AnankeIndex {
  next_epic: number;
  next_task: number;
  updated_at: string;
}
