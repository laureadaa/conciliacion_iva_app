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

// ---- Settings (business profile) ----
export interface Settings {
  id: number;
  userId: number;
  businessName: string | null;
  fullName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  iban: string | null;
  hourlyRate: number;
  currency: string;
  defaultLanguage: Language;
  signature: string | null;
  vatRate: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  smtpUser: string | null;
  smtpAppPassword: string | null;
  smtpFromName: string | null;
  smtpDailyLimit: number;
  updatedAt: string;
}

export type SettingsInput = Omit<Settings, "id" | "userId" | "updatedAt">;

// ---- Outbox ----
export type OutboxStatus = "pending" | "sending" | "sent" | "failed";

export interface OutboxEmail {
  id: number;
  userId: number;
  leadId: number | null;
  recipient: string;
  recipientName: string | null;
  subject: string;
  body: string;
  status: OutboxStatus;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Discover (lead finder from OpenStreetMap) ----
export interface DiscoverRequest {
  city: string;
  sectors: string[];
  onlyWithoutWebsite: boolean;
  limit?: number;
}

export interface DiscoverHit {
  name: string;
  category: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string;
  address: string | null;
  lat: number;
  lon: number;
  osmId: string;
}

export interface DiscoverResult {
  hits: DiscoverHit[];
  imported: number;
  skippedDuplicates: number;
}

// ---- Invoices ----
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: number;
  userId: number;
  clientId: number | null;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceInput {
  clientId: number | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  items: InvoiceItem[];
  vatRate: number;
  notes: string | null;
}

// ---- Leads ----
export type LeadStatus =
  | "new"
  | "audited"
  | "contacted"
  | "interested"
  | "converted"
  | "rejected";

export interface LeadAudit {
  url: string;
  reachable: boolean;
  statusCode: number | null;
  https: boolean;
  responseTimeMs: number | null;
  responsiveMeta: boolean;
  generator: string | null;
  title: string | null;
  description: string | null;
  hasFavicon: boolean;
  approxSizeKb: number;
  imageCount: number;
  scriptCount: number;
  signals: string[];
  opportunities: string[];
  score: number;
  auditedAt: string;
}

export interface Lead {
  id: number;
  userId: number;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  niche: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  audit: LeadAudit | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadInput {
  name: string;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  niche?: string | null;
  source?: string | null;
  status?: LeadStatus;
  notes?: string | null;
}

// ---- Portfolio ----
export interface PortfolioService {
  id: string;
  title: string;
  description: string;
  price: string;
  duration: string;
  bullets: string[];
}

export interface PortfolioCaseStudy {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  imageUrl: string | null;
}

export interface PortfolioSocials {
  github?: string;
  linkedin?: string;
  twitter?: string;
  email?: string;
  website?: string;
  malt?: string;
  upwork?: string;
}

export interface Portfolio {
  id: number;
  userId: number;
  slug: string;
  displayName: string | null;
  headline: string | null;
  tagline: string;
  bio: string | null;
  services: PortfolioService[];
  caseStudies: PortfolioCaseStudy[];
  availability: string | null;
  socials: PortfolioSocials;
  accentColor: string;
  photoUrl: string | null;
  contactEmail: string | null;
  technologies: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioInput {
  slug: string;
  displayName: string | null;
  headline: string | null;
  tagline: string;
  bio: string | null;
  services: PortfolioService[];
  caseStudies: PortfolioCaseStudy[];
  availability: string | null;
  socials: PortfolioSocials;
  accentColor: string;
  photoUrl: string | null;
  contactEmail: string | null;
  technologies: string[];
  published: boolean;
}

export interface PublicPortfolio {
  slug: string;
  displayName: string;
  headline: string | null;
  tagline: string;
  bio: string | null;
  services: PortfolioService[];
  caseStudies: PortfolioCaseStudy[];
  availability: string | null;
  socials: PortfolioSocials;
  accentColor: string;
  photoUrl: string | null;
  contactEmail: string | null;
  technologies: string[];
}

export interface PortfolioContactInput {
  name: string;
  email: string;
  message: string;
  company?: string;
}

// ---- API generic ----
export interface ApiError {
  error: string;
  details?: unknown;
}
