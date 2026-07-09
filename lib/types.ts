export interface ScheduleTask {
  id: number;
  title: string;
  createdAt: string;
  dueDate: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  durationDays: number;
  done: boolean;
  dependsOn: number[];
  earliestStartDay: number;
  earliestStartDate: string;
  earliestFinishDate: string;
  slackDays: number;
  isCritical: boolean;
}

export interface ScheduleResponse {
  tasks: ScheduleTask[];
  criticalPath: number[];
  totalDurationDays: number;
  projectStartDate: string;
}
