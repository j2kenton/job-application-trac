import { gmailService, ProcessedEmail } from './GmailService';
import { gmailAuth } from './GmailAuth';
import { JobApplication } from '../types';
import gmailFilters from '../../config/gmail-filters.json';
import syncSettings from '../../config/sync-settings.json';

export interface SyncResult {
  success: boolean;
  totalEmails: number;
  processed: number;
  autoAdded: number;
  reviewQueue: number;
  errors: string[];
  timestamp: string;
}

export interface ReviewQueueItem {
  id: string;
  email: ProcessedEmail;
  confidence: number;
  suggestedApplication: Omit<JobApplication, 'id'>;
}

class SyncScheduler {
  private static instance: SyncScheduler;
  private isScheduled = false;
  private syncInProgress = false;
  private lastSyncResult: SyncResult | null = null;
  private reviewQueue: ReviewQueueItem[] = [];
  private syncListeners: Array<(result: SyncResult) => void> = [];

  private constructor() {
    this.loadPersistedData();
    // Force reset sync state on initialization to prevent stuck states
    this.syncInProgress = false;
    this.isScheduled = false;
    console.log('SyncScheduler initialized - all timers stopped, sync state reset');
  }

  static getInstance(): SyncScheduler {
    if (!SyncScheduler.instance) {
      SyncScheduler.instance = new SyncScheduler();
    }
    return SyncScheduler.instance;
  }

  private loadPersistedData() {
    try {
      const storedQueue = localStorage.getItem('gmail_review_queue');
      if (storedQueue) {
        this.reviewQueue = JSON.parse(storedQueue);
      }

      const storedLastSync = localStorage.getItem('gmail_last_sync');
      if (storedLastSync) {
        this.lastSyncResult = JSON.parse(storedLastSync);
      }
    } catch (error) {
      console.error('Error loading persisted sync data:', error);
    }
  }

  private persistData() {
    try {
      localStorage.setItem('gmail_review_queue', JSON.stringify(this.reviewQueue));
      if (this.lastSyncResult) {
        localStorage.setItem('gmail_last_sync', JSON.stringify(this.lastSyncResult));
      }
    } catch (error) {
      console.error('Error persisting sync data:', error);
    }
  }

  startScheduler(): void {
    if (this.isScheduled) return;

    this.isScheduled = true;
    this.scheduleNextSync();
    console.log('Gmail sync scheduler started');
  }

  stopScheduler(): void {
    this.isScheduled = false;
    console.log('Gmail sync scheduler stopped');
  }

  private scheduleNextSync(): void {
    if (!this.isScheduled) return;

    const now = new Date();
    const scheduledTime = this.getNextSyncTime();
    const timeUntilSync = scheduledTime.getTime() - now.getTime();

    console.log(`Next Gmail sync scheduled for: ${scheduledTime.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })}`);

    setTimeout(async () => {
      if (this.isScheduled && !this.syncInProgress) {
        try {
          await this.performSync();
        } catch (error) {
          console.error('Scheduled sync failed:', error);
        } finally {
          this.scheduleNextSync(); // Schedule the next sync
        }
      }
    }, timeUntilSync);
  }

  private getNextSyncTime(): Date {
    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    
    // Set to 9:00 AM Israel time
    const syncTime = new Date(israelTime);
    syncTime.setHours(9, 0, 0, 0);

    // If it's already past 9 AM today, schedule for tomorrow
    if (israelTime.getTime() >= syncTime.getTime()) {
      syncTime.setDate(syncTime.getDate() + 1);
    }

    // Convert back to local time
    const utcOffset = now.getTimezoneOffset() * 60000;
    const israelOffset = 3 * 60 * 60 * 1000; // UTC+3
    const localSyncTime = new Date(syncTime.getTime() - israelOffset + utcOffset);

    return localSyncTime;
  }

  async performSync(onApplicationAdd?: (application: Omit<JobApplication, 'id'>) => void): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.warn('Sync already in progress, aborting new sync request');
      throw new Error('Sync already in progress');
    }

    if (!gmailAuth.getAuthState().isAuthenticated) {
      throw new Error('Gmail not authenticated');
    }

    this.syncInProgress = true;
    const startTime = new Date().toISOString();
    const errors: string[] = [];
    let totalEmails = 0;
    let processed = 0;
    let autoAdded = 0;
    let reviewQueueAdded = 0;

    try {
      console.log('Starting Gmail sync...');

      // Fetch recent emails
      const emails = await gmailService.fetchRecentEmails(syncSettings.processing.maxEmailsPerSync);
      totalEmails = emails.length;

      console.log(`Found ${totalEmails} emails to process`);

      for (const email of emails) {
        try {
          // Process email with AI
          const processedEmail = await gmailService.processEmail(email);
          processed++;

          // Two-stage processing system
          const isAIProcessed = processedEmail.extractedData.notes?.includes('AI analysis');
          
          // Stage 1: Manual confidence check
          if (processedEmail.confidence >= gmailFilters.confidenceThresholds.autoProcess) {
            // High confidence (85%+) - auto-process
            const application = this.createApplicationFromEmail(processedEmail);
            
            if (onApplicationAdd) {
              onApplicationAdd(application);
              autoAdded++;
            }

            // Add tracking label to email
            try {
              await gmailService.addLabelToEmail(email.id, gmailFilters.trackingLabel);
            } catch (labelError) {
              console.error('Error adding label to email:', labelError);
              errors.push(`Failed to add label to email ${email.id}`);
            }

          } else if (processedEmail.confidence >= gmailFilters.confidenceThresholds.reviewQueue) {
            // Medium confidence (25-84%) - add to review queue
            const existingItem = this.reviewQueue.find(item => item.email.id === email.id);
            if (!existingItem) {
              const reviewItem: ReviewQueueItem = {
                id: `review_${email.id}_${Date.now()}`,
                email: processedEmail,
                confidence: processedEmail.confidence,
                suggestedApplication: this.createApplicationFromEmail(processedEmail)
              };

              this.reviewQueue.push(reviewItem);
              reviewQueueAdded++;
              console.log(`Added email ${email.id} to review queue (confidence: ${processedEmail.confidence})`);
            } else {
              console.log(`Email ${email.id} already in review queue, skipping`);
            }

          } else {
            // Stage 2: Low confidence (<25%) - this will be handled by AI processing inside processEmail method
            // The processEmail method already includes AI enhancement for low confidence emails
            // If we reach here, it means the email was processed (including AI if applicable) and still has low confidence
            console.log(`Email ${email.id} rejected (confidence: ${processedEmail.confidence})`);
          }

        } catch (emailError) {
          console.error(`Error processing email ${email.id}:`, emailError);
          errors.push(`Failed to process email ${email.id}: ${emailError}`);
        }
      }

      const result: SyncResult = {
        success: errors.length === 0,
        totalEmails,
        processed,
        autoAdded,
        reviewQueue: reviewQueueAdded,
        errors,
        timestamp: startTime
      };

      this.lastSyncResult = result;
      this.persistData();
      this.notifySyncListeners(result);

      console.log('Gmail sync completed:', result);
      return result;

    } catch (error) {
      console.error('Gmail sync failed:', error);
      
      const result: SyncResult = {
        success: false,
        totalEmails,
        processed,
        autoAdded,
        reviewQueue: reviewQueueAdded,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: startTime
      };

      this.lastSyncResult = result;
      this.persistData();
      this.notifySyncListeners(result);

      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  private createApplicationFromEmail(processedEmail: ProcessedEmail): Omit<JobApplication, 'id'> {
    const now = new Date().toISOString();
    
    return {
      company: processedEmail.extractedData.company || 'Unknown Company',
      position: processedEmail.extractedData.position || 'Unknown Position',
      status: 'applied',
      appliedDate: processedEmail.extractedData.appliedDate || processedEmail.date.split('T')[0],
      notes: this.buildNotesFromEmail(processedEmail),
      contactEmail: processedEmail.extractedData.contactEmail || processedEmail.from,
      jobUrl: processedEmail.extractedData.jobUrl || '',
      salary: processedEmail.extractedData.salary || '',
      location: '',
      emailContent: processedEmail.content,
      createdAt: now,
      updatedAt: now
    };
  }

  private buildNotesFromEmail(processedEmail: ProcessedEmail): string {
    const notes: string[] = [];
    
    notes.push(`Auto-imported from Gmail (${Math.round(processedEmail.confidence * 100)}% confidence)`);
    notes.push(`Email from: ${processedEmail.from}`);
    notes.push(`Subject: ${processedEmail.subject}`);
    
    if (processedEmail.extractedData.notes) {
      notes.push(`Details: ${processedEmail.extractedData.notes}`);
    }

    return notes.join('\n');
  }

  // Review Queue Management
  getReviewQueue(): ReviewQueueItem[] {
    return [...this.reviewQueue];
  }

  approveReviewItem(itemId: string, onApplicationAdd?: (application: Omit<JobApplication, 'id'>) => void): void {
    const item = this.reviewQueue.find(item => item.id === itemId);
    if (!item) return;

    if (onApplicationAdd) {
      onApplicationAdd(item.suggestedApplication);
    }

    // Add tracking label to email
    gmailService.addLabelToEmail(item.email.id, gmailFilters.trackingLabel).catch(error => {
      console.error('Error adding label after approval:', error);
    });

    this.removeFromReviewQueue(itemId);
  }

  rejectReviewItem(itemId: string): void {
    this.removeFromReviewQueue(itemId);
  }

  clearReviewQueue(): void {
    this.reviewQueue = [];
    this.persistData();
    console.log('Review queue cleared');
  }

  resetSyncState(): void {
    this.syncInProgress = false;
    console.log('Sync state manually reset');
  }

  private removeFromReviewQueue(itemId: string): void {
    this.reviewQueue = this.reviewQueue.filter(item => item.id !== itemId);
    this.persistData();
  }

  // Sync Status and Listeners
  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  onSyncComplete(listener: (result: SyncResult) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  private notifySyncListeners(result: SyncResult): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  // Get time until next sync in a human-readable format
  getTimeUntilNextSync(): string {
    const nextSync = this.getNextSyncTime();
    const now = new Date();
    const diff = nextSync.getTime() - now.getTime();

    if (diff <= 0) return 'Overdue';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

export const syncScheduler = SyncScheduler.getInstance();
