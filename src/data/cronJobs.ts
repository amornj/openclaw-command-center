export interface CronJob {
  name: string;
  schedule: string;
  category: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'bimonthly';
  dayOfWeek?: number; // 0=Sun, 1=Mon, ...
  dayOfMonth?: number;
  months?: number[];
  time: string; // HH:MM
  agent: string;
  description?: string;
}

export const cronJobs: CronJob[] = [
  // === DAILY JOBS ===
  { name: 'Daily Market Briefing', schedule: '0 6 * * *', category: 'daily', time: '06:00', agent: 'Echo', description: 'Crypto, stocks, commodities prices' },
  { name: 'Daily Email Summary', schedule: '30 6 * * *', category: 'daily', time: '06:30', agent: 'Echo', description: 'Gmail inbox digest' },
  { name: 'Bangkok Weather & Air Quality', schedule: '30 6 * * *', category: 'daily', time: '06:30', agent: 'Echo', description: 'Weather + AQI report' },
  { name: 'Daily Tweet Summary', schedule: '0 23 * * *', category: 'daily', time: '23:00', agent: 'Echo', description: 'Roam Quick Capture tweets digest' },
  { name: 'Daily Activity Log to Roam', schedule: '30 23 * * *', category: 'daily', time: '23:30', agent: 'Echo', description: 'Claude/OpenClaw activity log' },
  { name: 'Daily Exercise Reminder', schedule: '0 6 * * *', category: 'daily', time: '06:00', agent: 'Echo', description: 'Exercise reminder (every day)' },
  { name: 'Hunter: Morning Clinical Radar', schedule: '5 6 * * *', category: 'daily', time: '06:05', agent: 'Hunter', description: 'Clinical morning radar with Reader/email bias' },
  { name: 'Hunter: Evening Reader Triage', schedule: '30 20 * * *', category: 'daily', time: '20:30', agent: 'Hunter', description: 'Reader inbox triage, max 3 items' },
  { name: 'Hunter: Nightly Learning Recap', schedule: '30 21 * * *', category: 'daily', time: '21:30', agent: 'Hunter', description: '3-bullet knowledge compression' },
  { name: 'Shin: Cron & Gateway Watchdog', schedule: 'every 2h', category: 'daily', time: '00:00', agent: 'Shin', description: 'Gateway, cron failures, session/log watchdog' },
  { name: 'Shin: Late-Night Claude Quota Watch', schedule: '30 21,22,23 * * *', category: 'daily', time: '21:30', agent: 'Shin', description: 'Claude quota <20% warning before late-night cron failures' },

  // === WEEKLY RESEARCH DIGESTS ===
  { name: 'Complex PCI Review', schedule: '0 7 * * 1', category: 'weekly', dayOfWeek: 1, time: '07:00', agent: 'Echo', description: 'PubMed: CTO PCI, complex interventions' },
  { name: 'Heart Failure Research', schedule: '0 7 * * 2', category: 'weekly', dayOfWeek: 2, time: '07:00', agent: 'Echo', description: 'PubMed: heart failure research' },
  { name: 'DM/Lipid/Obesity Research', schedule: '0 7 * * 3', category: 'weekly', dayOfWeek: 3, time: '07:00', agent: 'Echo', description: 'PubMed: diabetes, lipidology, obesity' },
  { name: 'Structural Heart Digest', schedule: '0 7 * * 4', category: 'weekly', dayOfWeek: 4, time: '07:00', agent: 'Echo', description: 'PubMed: TAVR, TMVR, structural' },
  { name: 'ACS/Shock/MCS/Critical Care', schedule: '0 7 * * 5', category: 'weekly', dayOfWeek: 5, time: '07:00', agent: 'Echo', description: 'PubMed: ACS, cardiogenic shock, MCS' },
  { name: 'Cardiomyopathy/AF/PE Digest', schedule: '0 7 * * 6', category: 'weekly', dayOfWeek: 6, time: '07:00', agent: 'Echo', description: 'PubMed: cardiomyopathy, myocarditis, AF, PE' },
  { name: 'Aging & Anti-Aging Digest', schedule: '0 7 * * 0', category: 'weekly', dayOfWeek: 0, time: '07:00', agent: 'Echo', description: 'PubMed: aging, anti-aging research' },

  // === WEEKLY FINANCE ===
  { name: 'Buy Bitcoin 75K', schedule: '0 6 * * 5', category: 'weekly', dayOfWeek: 5, time: '06:00', agent: 'Echo', description: 'Weekly BTC DCA' },
  { name: 'Buy Gold 75K', schedule: '0 6 * * 5', category: 'weekly', dayOfWeek: 5, time: '06:00', agent: 'Echo', description: 'Weekly gold DCA' },
  { name: 'Transfer 100K to Dad', schedule: '0 6 * * 0', category: 'weekly', dayOfWeek: 0, time: '06:00', agent: 'Echo', description: 'Sunday transfer' },
  { name: 'Weekly Review', schedule: '0 6 * * 0', category: 'weekly', dayOfWeek: 0, time: '06:00', agent: 'Echo', description: 'Sunday weekly review' },

  // === MONTHLY PAYMENTS ===
  { name: 'Pay 333 Electric Bill', schedule: '0 6 15 * *', category: 'monthly', dayOfMonth: 15, time: '06:00', agent: 'Echo', description: '15th of every month' },
  { name: 'Pay True Mobile', schedule: '0 6 16 * *', category: 'monthly', dayOfMonth: 16, time: '06:00', agent: 'Echo', description: '16th of every month' },
  { name: 'Pay Credit Card', schedule: '0 6 17 * *', category: 'monthly', dayOfMonth: 17, time: '06:00', agent: 'Echo', description: '17th of every month' },
  { name: 'Transfer 40K to Dad', schedule: '0 6 28 * *', category: 'monthly', dayOfMonth: 28, time: '06:00', agent: 'Echo', description: '28th of every month' },
  { name: 'Transfer 5K to Yui & Hung', schedule: '0 6 28 * *', category: 'monthly', dayOfMonth: 28, time: '06:00', agent: 'Echo', description: '28th of every month' },

  // === END-OF-MONTH WRITING ===
  { name: 'Write End of Month', schedule: 'EOM', category: 'monthly', dayOfMonth: 30, time: '06:00', agent: 'Echo', description: 'Monthly reflection writing' },
  { name: 'Charge Kindle', schedule: 'EOM', category: 'monthly', dayOfMonth: 30, time: '06:00', agent: 'Echo', description: 'Monthly Kindle charge reminder' },

  // === BIMONTHLY / PERIODIC ===
  { name: 'Blood Test', schedule: '0 6 23 2,4,6,8,10,12 *', category: 'bimonthly', dayOfMonth: 23, months: [2, 4, 6, 8, 10, 12], time: '06:00', agent: 'Echo', description: '23rd of even months' },
  { name: 'Submit Tax Form', schedule: '0 6 28 3,9 *', category: 'yearly', dayOfMonth: 28, months: [3, 9], time: '06:00', agent: 'Echo', description: 'Mar 28 & Sep 28' },

  // === YEARLY ===
  { name: 'Flu Shot', schedule: '0 6 10 6 *', category: 'yearly', dayOfMonth: 10, months: [6], time: '06:00', agent: 'Echo', description: 'June 10' },
  { name: 'Dental Scaling (Apr)', schedule: '0 6 15 4 *', category: 'yearly', dayOfMonth: 15, months: [4], time: '06:00', agent: 'Echo', description: 'April 15' },
  { name: 'Dental Scaling (Oct)', schedule: '0 6 15 10 *', category: 'yearly', dayOfMonth: 15, months: [10], time: '06:00', agent: 'Echo', description: 'October 15' },
  { name: 'Chest X-Ray', schedule: '0 6 11 9 *', category: 'yearly', dayOfMonth: 11, months: [9], time: '06:00', agent: 'Echo', description: 'September 11' },
  { name: "PUM's Birthday", schedule: '0 6 28 5 *', category: 'yearly', dayOfMonth: 28, months: [5], time: '06:00', agent: 'Echo', description: 'May 28' },
  { name: 'Buy BERMF', schedule: '0 6 28 12 *', category: 'yearly', dayOfMonth: 28, months: [12], time: '06:00', agent: 'Echo', description: 'December 28' },
  { name: 'Property Tax 333 Condo', schedule: '0 6 10 4,5 *', category: 'yearly', dayOfMonth: 10, months: [4, 5], time: '06:00', agent: 'Echo', description: 'Apr-May' },
  { name: 'Building Tax 333', schedule: '0 6 31 5,6,7 *', category: 'yearly', dayOfMonth: 31, months: [5, 6, 7], time: '06:00', agent: 'Echo', description: 'May-Jul' },
  { name: '333 Condo Maintenance', schedule: 'quarterly', category: 'yearly', dayOfMonth: 31, months: [1, 6, 7, 12], time: '06:00', agent: 'Echo', description: 'Jan, Jun, Jul, Dec' },
  { name: 'Replace 333 Condo Battery', schedule: '0 6 31 5 *', category: 'yearly', dayOfMonth: 31, months: [5], time: '06:00', agent: 'Echo', description: 'May 31' },
];

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
