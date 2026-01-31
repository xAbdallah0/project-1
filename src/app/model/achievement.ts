export interface User {
  id: string;
  role: 'admin' | 'user' | string;
  name?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  userId: string;
  userName: string;
  department: string;
  createdAt: string;
  mainCriterion: string;
  subCriterion: string;
  attachments: string[];
  comments?: string;
  status: "pending" | "approved" | "rejected" | "draft";
}

// واجهة الجداول
export interface TableData {
  title?: string;
  rows: number;
  cols: number;
  data: any[][];
  html?: string;
}

export interface Activity {
  _id?: string;
  user: { _id?: string; name?: string; fullname?: string } | string;
  activityTitle: string;
  activityDescription: string;
  MainCriteria: { _id?: string; name?: string } | string;
  SubCriteria: { _id?: string; name?: string } | string;
  department?: { _id?: string; name?: string } | string;
  status: 'مرفوض' | 'قيد المراجعة' | 'معتمد' | string;
  reasonForRejection?: string;
  SaveStatus: 'مسودة' | 'مكتمل';
  Attachments: string[];
  tables?: TableData[] | string; // أضف هذا السطر
  name?: string;
  date?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  sentTo?: string;
  comment?: string;
  lastViewedAt?: Date;
  lastViewedBy?: string;
  generatedFiles?: {
    pdf?: string;
    docx?: string;
    report?: string;
    certificate?: string;
  };
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  MainCriteria?: string;
  SubCriteria?: string;
  user?: string;
  status?: string;
  username?: string;
  performerName?: string;
  reportType?: 'pdf' | 'docx';
}
