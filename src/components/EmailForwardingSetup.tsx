import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useKV } from '@github/spark/hooks';
import { Copy, Check, Mail, Settings, ArrowRight, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface EmailForwardingSetupProps {
  children?: React.ReactNode;
}

export function EmailForwardingSetup({ children }: EmailForwardingSetupProps) {
  const [open, setOpen] = useState(false);
  const [forwardingEmail, setForwardingEmail] = useKV<string>('forwarding-email', '');
  const [tempEmail, setTempEmail] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Generate a unique forwarding address based on current timestamp or user ID
  const generateForwardingAddress = () => {
    const randomId = Math.random().toString(36).substring(2, 8);
    return `jobs+${randomId}@your-email-parser.com`;
  };

  const handleSaveEmail = () => {
    if (tempEmail) {
      setForwardingEmail(tempEmail);
      toast.success('Forwarding email saved!');
      setOpen(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const currentForwardingAddress = forwardingEmail || generateForwardingAddress();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <Settings size={16} />
            Email Setup
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={20} />
            Email Forwarding Setup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${forwardingEmail ? 'bg-green-500' : 'bg-yellow-500'}`} />
                Setup Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={forwardingEmail ? 'default' : 'secondary'}>
                  {forwardingEmail ? 'Configured' : 'Pending Setup'}
                </Badge>
                {forwardingEmail && (
                  <span className="text-sm text-muted-foreground">
                    Forwarding to: {forwardingEmail}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Forwarding Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Forwarding Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
                <span className="flex-1">{currentForwardingAddress}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(currentForwardingAddress, 'address')}
                  className="gap-1"
                >
                  {copied === 'address' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'address' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Forward job application emails to this address to automatically parse and track them.
              </p>
            </CardContent>
          </Card>

          {/* Your Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configure Your Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="your-email">Your Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="your-email"
                    type="email"
                    placeholder="your.email@gmail.com"
                    value={tempEmail || forwardingEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                  />
                  <Button onClick={handleSaveEmail} disabled={!tempEmail}>
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This is where parsed applications will be sent for your review.
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Setup Instructions */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Setup Instructions</h3>
            
            {/* Gmail Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail size={18} />
                  Gmail Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Open Gmail Settings</p>
                      <p className="text-sm text-muted-foreground">
                        Go to Gmail → Settings (gear icon) → "Forwarding and POP/IMAP"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Add Forwarding Address</p>
                      <p className="text-sm text-muted-foreground">
                        Click "Add a forwarding address" and enter: 
                        <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">{currentForwardingAddress}</code>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Create Filter</p>
                      <p className="text-sm text-muted-foreground">
                        Go to Settings → "Filters and Blocked Addresses" → "Create a new filter"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      4
                    </div>
                    <div>
                      <p className="font-medium">Configure Filter</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Set filter criteria:</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li>From: contains "noreply" OR "no-reply" OR "careers"</li>
                          <li>Subject: contains "application" OR "job" OR "position"</li>
                        </ul>
                        <p>Then choose action: "Forward it to {currentForwardingAddress}"</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Warning size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">Pro Tip</p>
                      <p className="text-blue-700">
                        You can also manually forward specific job emails to this address when needed.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Outlook Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail size={18} />
                  Outlook Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Open Outlook Rules</p>
                      <p className="text-sm text-muted-foreground">
                        Go to File → Manage Rules & Alerts → "New Rule"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Create Custom Rule</p>
                      <p className="text-sm text-muted-foreground">
                        Select "Apply rule on messages I receive" → Set conditions for job emails
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Set Forward Action</p>
                      <p className="text-sm text-muted-foreground">
                        Choose "forward it to people or public group" and add: 
                        <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">{currentForwardingAddress}</code>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What Happens Next */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight size={18} />
                  What Happens Next
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">Job emails are automatically forwarded to our parser</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">AI extracts company, position, and application details</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">Applications appear automatically in your tracker</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">Duplicates are automatically detected and prevented</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}