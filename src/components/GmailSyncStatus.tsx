import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { syncScheduler, SyncResult } from '@/lib/gmail/SyncScheduler';
import { gmailAuth } from '@/lib/gmail/GmailAuth';
import { JobApplication } from '@/lib/types';
import { ArrowClockwise, Clock, CheckCircle, WarningCircle, Envelope, Play, Calendar } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface GmailSyncStatusProps {
  onApplicationAdd?: (application: Omit<JobApplication, 'id'>) => void;
}

export function GmailSyncStatus({ onApplicationAdd }: GmailSyncStatusProps) {
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Load initial data
    setLastSyncResult(syncScheduler.getLastSyncResult());
    setIsSyncing(syncScheduler.isSyncInProgress());
    setIsAuthenticated(gmailAuth.getAuthState().isAuthenticated);

    // Subscribe to auth state changes
    const unsubscribeAuth = gmailAuth.subscribe((state) => {
      setIsAuthenticated(state.isAuthenticated);
      
      if (state.isAuthenticated) {
        // Temporarily disabled automatic scheduler to prevent sync loops
        // syncScheduler.startScheduler();
      } else {
        // Stop scheduler when not authenticated
        syncScheduler.stopScheduler();
      }
    });

    // Subscribe to sync completion
    const unsubscribeSync = syncScheduler.onSyncComplete((result) => {
      setLastSyncResult(result);
      setIsSyncing(false);
    });

    // Automatic scheduler disabled to prevent infinite loops
    // if (gmailAuth.getAuthState().isAuthenticated) {
    //   syncScheduler.startScheduler();
    // }

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, []);

  const handleManualSync = async () => {
    if (!isAuthenticated) {
      toast.error('Please connect your Gmail account first');
      return;
    }

    if (isSyncing) {
      toast.info('Sync already in progress');
      return;
    }

    // Clear previous sync results when starting new sync
    setLastSyncResult(null);
    setIsSyncing(true);
    
    try {
      const result = await syncScheduler.performSync(onApplicationAdd);
      
      if (result.success) {
        toast.success(`Sync completed! Added ${result.autoAdded} applications, ${result.reviewQueue} in review queue`);
      } else {
        toast.warning(`Sync completed with ${result.errors.length} errors`);
      }
    } catch (error: any) {
      if (error.message.includes('Gmail API not fully initialized')) {
        toast.info('Gmail API is currently unavailable. Email sync features are limited in OAuth-only mode.');
      } else {
        toast.error(`Sync failed: ${error.message}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const formatSyncTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSyncStatusIcon = () => {
    if (isSyncing) return <ArrowClockwise size={20} className="animate-spin text-blue-600" />;
    if (!isAuthenticated) return <WarningCircle size={20} className="text-gray-500" />;
    if (lastSyncResult?.success) return <CheckCircle size={20} className="text-green-600" />;
    if (lastSyncResult && !lastSyncResult.success) return <WarningCircle size={20} className="text-red-600" />;
    return <Clock size={20} className="text-gray-500" />;
  };

  const getSyncStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (!isAuthenticated) return 'Not Connected';
    if (!lastSyncResult) return 'Ready to Sync';
    if (lastSyncResult.success) return 'Last sync successful';
    return 'Last sync failed';
  };

  const getSyncStatusColor = () => {
    if (isSyncing) return 'text-blue-600';
    if (!isAuthenticated) return 'text-gray-500';
    if (lastSyncResult?.success) return 'text-green-600';
    if (lastSyncResult && !lastSyncResult.success) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getSyncStatusIcon()}
          Gmail Sync Status
          <Badge variant={lastSyncResult?.success ? 'default' : 'secondary'}>
            {getSyncStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isAuthenticated ? (
          <Alert>
            <WarningCircle className="h-4 w-4" />
            <AlertDescription>
              Connect your Gmail account to enable automatic email sync.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Sync Progress */}
            {isSyncing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Syncing emails...</span>
                  <ArrowClockwise size={16} className="animate-spin" />
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {/* Last Sync Results */}
            {lastSyncResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Last Sync Results</h4>
                  <span className="text-xs text-muted-foreground">
                    {formatSyncTime(lastSyncResult.timestamp)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-lg font-bold">{lastSyncResult.totalEmails}</div>
                    <div className="text-xs text-muted-foreground">Emails Found</div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-lg font-bold">{lastSyncResult.processed}</div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                  </div>
                  
                  <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-lg font-bold text-green-700">{lastSyncResult.autoAdded}</div>
                    <div className="text-xs text-green-600">Auto Added</div>
                  </div>
                  
                  <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-lg font-bold text-yellow-700">{lastSyncResult.reviewQueue}</div>
                    <div className="text-xs text-yellow-600">Review Queue</div>
                  </div>
                </div>

                {lastSyncResult.errors.length > 0 && (
                  <Alert className="bg-red-50 border-red-200">
                    <WarningCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>{lastSyncResult.errors.length} error(s) occurred:</strong>
                      <ul className="list-disc list-inside mt-1 text-xs">
                        {lastSyncResult.errors.slice(0, 3).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {lastSyncResult.errors.length > 3 && (
                          <li>...and {lastSyncResult.errors.length - 3} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Sync Info */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Calendar size={16} />
                Sync Mode
              </h4>
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Manual sync only</strong> - No automatic scheduling
                </p>
                <p className="text-xs mt-1">
                  Sync when opening the app or by clicking the "Sync Now" button
                </p>
              </div>
            </div>

            {/* Manual Sync Button */}
            <div className="pt-2">
              <Button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="w-full gap-2"
                variant="outline"
              >
                {isSyncing ? (
                  <>
                    <ArrowClockwise size={16} className="animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Sync Now
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Manually sync your Gmail for recent job application emails
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
