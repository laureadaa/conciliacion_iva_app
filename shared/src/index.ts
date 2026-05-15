// ===========================
// Shared Types
// ===========================

export type Language = "es" | "en";

export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected";
export type ClientStatus = "potential" | "active" | "recurring" | "inactive";
export type ProjectComplexity = "basic" | "medium" | "advanced";
export type EmailType =
  | "first_contact"
  | "follow_up"
  | "delivery"
  | "review_request"
  | "payment_reminder";
export type Platform = "malt" | "upwork" | "linkedin" | "other";

// ---- User / Auth ----
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// ---- Clients ----
export interface Client {
  id: number;
  userId: number;
  name: string;
  company: string | null;
  email: string | null;
  notes: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInput {
  name: string;
  company?: string | null;
  email?: string | null;
  notes?: string | null;
  status: ClientStatus;
}

// ---- Proposals ----
export interface Proposal {
  id: number;
  userId: number;
  clientId: number | null;
  title: string;
  projectType: string;
  description: string;
  budget: number | null;
  deadline: string | null;
  language: Language;
  content: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalGenerateRequest {
  clientId?: number | null;
  projectType: string;
  clientDescription: string;
  budget?: number | null;
  deadline?: string | null;
  language: Language;
  title?: string;
}

// ---- Pricing ----
export interface PricingRequest {
  projectType: string;
  complexity: ProjectComplexity;
  extras: string[];
  hourlyRate?: number;
}

export interface PricingResult {
  economic: { min: number; max: number; hours: number };
  recommended: { min: number; max: number; hours: number };
  premium: { min: number; max: number; hours: number };
  breakdown: Array<{ label: string; hours: number }>;
  currency: string;
}

export interface PricingJustificationRequest {
  projectType: string;
  complexity: ProjectComplexity;
  extras: string[];
  price: number;
  language: Language;
}

// ---- Profile (bios) ----
export interface ProfileRequest {
  name: string;
  yearsExperience: number;
  technologies: string[];
  platform: Platform;
  niche: string;
  language: Language;
}

export interface Profile {
  id: number;
  userId: number;
  name: string;
  platform: Platform;
  language: Language;
  niche: string;
  technologies: string;
  yearsExperience: number;
  content: string;
  createdAt: string;
}

// ---- Emails ----
export interface EmailGenerateRequest {
  type: EmailType;
  clientName: string;
  context: string;
  language: Language;
}

export interface EmailRecord {
  id: number;
  userId: number;
  type: EmailType;
  subject: string;
  body: string;
  clientName: string;
  language: Language;
  createdAt: string;
}

// ---- Income ----
export interface Income {
  id: number;
  userId: number;
  clientId: number | null;
  amount: number;
  currency: string;
  description: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface IncomeInput {
  clientId?: number | null;
  amount: number;
  currency?: string;
  description?: string | null;
  receivedAt: string;
}

// ---- Dashboard ----
export interface DashboardMetrics {
  monthlyIncome: number;
  monthlyIncomeCurrency: string;
  activeProjects: number;
  proposalsSent: number;
  conversionRate: number;
  projectedMonthly: number;
  recentClients: Client[];
  monthlyIncomeSeries: Array<{ month: string; total: number }>;
}

// ---- API generic ----
export interface ApiError {
  error: string;
  details?: unknown;
}
