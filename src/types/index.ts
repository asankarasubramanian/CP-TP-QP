export type PlanStatus = 'Cascaded' | 'Drafting' | 'Plan In Progress' | 'Not Started';
export type RepType = 'Veteran' | 'TBH';
export type Industry = 'AERO' | 'MFG';

export interface OrgNode {
  id: string;
  rowNumber: number;
  name: string;             // Role name (e.g. "All Org", "AMER SVP", "RVP US")
  personName: string;       // Person's name (e.g. "Lisa Dawson") or label
  role: string;             // Short role (e.g. "CRO", "SVP", "AVP", "RVP", "AE")
  directReports?: number;   // Number of direct reports
  avatarUrl?: string;       // Optional avatar image URL
  avatarInitials?: string;  // Fallback initials for avatar
  avatarColor?: string;     // Avatar background color
  targetCapacity: number;
  headcount: number;
  expectedCapacity: number;
  validatedCapacity: number | null;
  difference: number;
  status: PlanStatus;
  children?: OrgNode[];
  depth: number;

  // New fields from screenshot
  segments?: string[];     // Segment(s) owned (e.g. ["AERO", "Manufacturing"])
  repType?: RepType;        // Veteran or TBH (To Be Hired)
  industry?: Industry;      // AERO or MFG
  startDate?: string;       // For TBH reps (e.g. "Oct 1 Start")
  allocatedHC?: number;     // Allocated headcount for RVP level
  validatedVeterans?: number;  // Number of validated veterans
  validatedTBH?: number;    // Number of validated TBH
  totalHC?: number;         // Total headcount for AVP level
}
