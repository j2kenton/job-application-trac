import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { linkedInService } from '@/lib/linkedin/LinkedInService';
import { JobApplication } from '@/lib/types';
import { ArrowClockwise, Clock, CheckCircle, WarningCircle, LinkedinLogo, Play, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface LinkedInSyncResult {
  success: boolean;
  companiesEnhanced: number;
  connectionsFound: number;
  errors: string[];
  timestamp: string;
}

interface LinkedInSyncStatusProps {
  applications: JobApplication[];
  onApplicationsChange?: (applications: JobApplication[]) => void;
}

export function LinkedInSyncStatus({ applications, onApplicationsChange }: LinkedInSyncStatusProps) {
  const [lastSyncResult, setLastSyncResult] = useState<LinkedInSyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check LinkedIn authentication status
    setIsAuthenticated(linkedInService.isAuthenticated());
    
    // Load last sync result from localStorage
    const storedResult = localStorage.getItem('linkedin_last_sync');
    if (storedResult) {
      try {
        setLastSyncResult(JSON.parse(storedResult));
      } catch (error) {
        console.error('Error loading LinkedIn sync result:', error);
      }
    }
  }, []);

  const handleLinkedInSync = async () => {
    if (!isAuthenticated) {
      toast.error('Please connect your LinkedIn account first');
      return;
    }

    if (isSyncing) {
      toast.info('LinkedIn sync already in progress');
      return;
    }

    if (applications.length === 0) {
      toast.info('No applications to enhance with LinkedIn data');
      return;
    }

    // Clear previous sync results when starting new sync
    setLastSyncResult(null);
    setIsSyncing(true);
    
    const startTime = new Date().toISOString();
    const errors: string[] = [];
    let companiesEnhanced = 0;
    let connectionsFound = 0;

    try {
      const updatedApplications = [...applications];
      
      // Process each application
      for (const app of updatedApplications) {
        try {
          if (!app.company) continue;

          // Search for company on LinkedIn
          const companies = await linkedInService.searchCompanies(app.company);
          
          if (companies.length > 0) {
            const company = companies[0];
            
            // Enhance application with LinkedIn company data
            const appIndex = updatedApplications.findIndex(a => a.id === app.id);
            if (appIndex !== -1) {
              updatedApplications[appIndex] = {
                ...updatedApplications[appIndex],
                location: updatedApplications[appIndex].location || company.location || '',
                notes: updatedApplications[appIndex].notes + 
                       `\n\nLinkedIn Company Data:\n` +
                       `Industry: ${company.industry || 'N/A'}\n` +
                       `Size: ${company.size || 'N/A'}\n` +
                       `Location: ${company.location || 'N/A'}`,
                updatedAt: new Date().toISOString()
              };
              
              companiesEnhanced++;
              console.log(`Enhanced ${app.company} with LinkedIn data`);
            }
          }
          
          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (companyError) {
          console.error(`Error processing company ${app.company}:`, companyError);
          errors.push(`Failed to enhance ${app.company}: ${companyError}`);
        }
      }

      // Update applications if any were enhanced
      if (companiesEnhanced > 0 && onApplicationsChange) {
        onApplicationsChange(updatedApplications);
      }

      const result: LinkedInSyncResult = {
        success: errors.length === 0,
        companiesEnhanced,
        connectionsFound, // TODO: Implement connection finding
        errors,
        timestamp: startTime
      };

      setLastSyncResult(result);
      
      // Store result in localStorage
      localStorage.setItem('linkedin_last_sync', JSON.stringify(result));

      if (result.success) {
        toast.success(`LinkedIn sync completed! Enhanced ${companiesEnhanced} companies`);
      } else {
        toast.warning(`LinkedIn sync completed with ${errors.length} errors`);
      }

    } catch (error: any) {
      console.error('LinkedIn sync failed:', error);
      
      const result: LinkedInSyncResult = {
        success: false,
        companiesEnhanced,
        connectionsFound,
        errors: [error.message || 'Unknown error'],
        timestamp: startTime
      };

      setLastSyncResult(result);
      localStorage.setItem('linkedin_last_sync', JSON.stringify(result));
      
      toast.error(`LinkedIn sync failed: ${error.message}`);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getSyncStatusIcon()}
          LinkedIn Sync Status
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
              Connect your LinkedIn account to enhance applications with company data and find connections.
            </AlertDescription>
          </Alert>
        ) : !linkedInService.isConfigured() ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              LinkedIn integration is not fully configured. Check your environment variables and setup.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Sync Progress */}
            {isSyncing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Enhancing applications with LinkedIn data...</span>
                  <ArrowClockwise size={16} className="animate-spin" />
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {/* Last Sync Results */}
            {lastSyncResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Last LinkedIn Sync Results</h4>
                  <span className="text-xs text-muted-foreground">
                    {formatSyncTime(lastSyncResult.timestamp)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-lg font-bold text-blue-700">{lastSyncResult.companiesEnhanced}</div>
                    <div className="text-xs text-blue-600">Companies Enhanced</div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-lg font-bold text-purple-700">{lastSyncResult.connectionsFound}</div>
                    <div className="text-xs text-purple-600">Connections Found</div>
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

            {/* LinkedIn Features Info */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <LinkedinLogo size={16} />
                LinkedIn Enhancement
              </h4>
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>What this sync does:</strong>
                </p>
                <ul className="text-xs mt-1 space-y-1">
                  <li>• Enhances company information (industry, size, location)</li>
                  <li>• Adds company insights to application notes</li>
                  <li>• Finds connections at target companies (coming soon)</li>
                  <li>• Provides professional network insights</li>
                </ul>
              </div>
            </div>

            {/* Manual Sync Button */}
            <div className="pt-2">
              <Button
                onClick={handleLinkedInSync}
                disabled={isSyncing || applications.length === 0}
                className="w-full gap-2"
                variant="outline"
              >
                {isSyncing ? (
                  <>
                    <ArrowClockwise size={16} className="animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <LinkedinLogo size={16} />
                    Enhance with LinkedIn
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {applications.length === 0 
                  ? 'Add some applications first to enhance them with LinkedIn data'
                  : `Enhance ${applications.length} application(s) with LinkedIn company data`
                }
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
