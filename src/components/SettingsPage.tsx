import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Settings, Mail, Building, Brain, Database } from 'lucide-react';
import { GmailAuth } from './GmailAuth';
import { LinkedInAuth } from './LinkedInAuth';
import { EmailForwardingSetup } from './EmailForwardingSetup';
import { googleAI } from '../lib/googleAI';
import { LinkedInProfile } from '../lib/linkedin/LinkedInService';

export function SettingsPage() {
  const [linkedInProfile, setLinkedInProfile] = useState<LinkedInProfile | null>(null);
  const [aiStats, setAiStats] = useState<any>(null);

  // Load AI usage stats
  React.useEffect(() => {
    if (googleAI.isConfigured()) {
      setAiStats(googleAI.getUsageStats());
    }
  }, []);

  const handleLinkedInProfileUpdate = (profile: LinkedInProfile | null) => {
    setLinkedInProfile(profile);
  };

  const refreshAIStats = () => {
    if (googleAI.isConfigured()) {
      setAiStats(googleAI.getUsageStats());
    }
  };

  const resetAIStats = () => {
    googleAI.resetUsageStats();
    setAiStats(googleAI.getUsageStats());
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Settings & Integrations</h1>
      </div>

      <Tabs defaultValue="gmail" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="gmail" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Gmail
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Models
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gmail" className="space-y-6">
          <GmailAuth />
          <EmailForwardingSetup />
        </TabsContent>

        <TabsContent value="linkedin" className="space-y-6">
          <LinkedInAuth onProfileUpdate={handleLinkedInProfileUpdate} />
          
          {linkedInProfile && (
            <Card>
              <CardHeader>
                <CardTitle>LinkedIn Integration Status</CardTitle>
                <CardDescription>
                  Your LinkedIn account is connected and ready to enhance job applications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Features Available:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Company data auto-fill</li>
                      <li>Professional network insights</li>
                      <li>Company search and details</li>
                      <li>Profile integration</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Limitations:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>No direct job application access</li>
                      <li>Limited to public company data</li>
                      <li>Rate limits apply (500 requests/day)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Model Configuration</CardTitle>
              <CardDescription>
                Hybrid Gemini 2.5 system with intelligent model selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Gemini 2.5 Flash</h4>
                  <p className="text-sm text-muted-foreground">
                    Used for: Simple emails, high/low confidence cases
                  </p>
                  <Badge variant="secondary">Cost: $0.35/1M tokens</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Gemini 2.5 Pro</h4>
                  <p className="text-sm text-muted-foreground">
                    Used for: Hebrew text, medium confidence, complex analysis
                  </p>
                  <Badge variant="secondary">Cost: $7.00/1M tokens</Badge>
                </div>
              </div>

              {aiStats && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Usage Statistics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">{aiStats.flashCalls}</div>
                      <div className="text-muted-foreground">Flash Calls</div>
                    </div>
                    <div>
                      <div className="font-medium">{aiStats.proCalls}</div>
                      <div className="text-muted-foreground">Pro Calls</div>
                    </div>
                    <div>
                      <div className="font-medium">{aiStats.totalTokens.toLocaleString()}</div>
                      <div className="text-muted-foreground">Total Tokens</div>
                    </div>
                    <div>
                      <div className="font-medium">${aiStats.estimatedCost.total.toFixed(4)}</div>
                      <div className="text-muted-foreground">Estimated Cost</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refreshAIStats}>
                      Refresh Stats
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetAIStats}>
                      Reset Stats
                    </Button>
                  </div>
                </div>
              )}

              {!googleAI.isConfigured() && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <p className="text-sm text-yellow-800">
                    <strong>AI not configured:</strong> Add your Google AI API key to enable intelligent email analysis.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Manage your application data and integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Data Storage</h4>
                  <p className="text-sm text-muted-foreground">
                    Your job applications are stored locally in your browser. 
                    Data is not sent to external servers except for AI analysis.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Privacy</h4>
                  <p className="text-sm text-muted-foreground">
                    Email content is only processed by AI when analyzing job-related emails. 
                    No personal data is permanently stored by external services.
                  </p>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Data Export/Import</h4>
                <p className="text-sm text-muted-foreground">
                  Export your data for backup or import from other systems.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Export Data (Coming Soon)
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Import Data (Coming Soon)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
