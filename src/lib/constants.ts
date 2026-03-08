import { ComplaintCategory, ComplaintChannel, ComplaintPriority, ComplaintStatus, Sentiment, SLAStatus } from '@/types/complaint';

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_customer: 'Pending Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  loan: 'Loan',
  account: 'Account',
  card: 'Card',
  transfer: 'Transfer',
  kyc: 'KYC',
  fraud: 'Fraud',
  other: 'Other',
};

export const CHANNEL_LABELS: Record<ComplaintChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  branch: 'Branch',
  app: 'App',
  web: 'Web',
  api: 'API',
  manual: 'Manual',
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  angry: 'Angry',
};

export const SENTIMENT_EMOJIS: Record<Sentiment, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
  angry: '🤬',
};

export const SLA_LABELS: Record<SLAStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  breached: 'Breached',
};

export const CHANNEL_ICONS: Record<ComplaintChannel, string> = {
  email: 'Mail',
  whatsapp: 'MessageCircle',
  phone: 'Phone',
  branch: 'Building2',
  app: 'Smartphone',
  web: 'Globe',
  api: 'Code',
  manual: 'PenLine',
};
