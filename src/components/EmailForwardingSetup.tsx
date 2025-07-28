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
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                Setup Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  Demo Mode
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Email forwarding is conceptual - manual entry recommended
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                The forwarding address shown below is for demonstration purposes only.
              </p>
            </CardContent>
          </Card>

          {/* Forwarding Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Demo Forwarding Address
                <Badge variant="outline" className="text-xs">Not Functional</Badge>
              </CardTitle>
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
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  This is what a forwarding address would look like in a real implementation.
                </p>
                <p className="text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded p-2">
                  <strong>Note:</strong> This address doesn't exist and won't receive emails. 
                  For the demo, use manual entry to add your job applications.
                </p>
              </div>
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
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">Setup Instructions</h3>
              <Badge variant="outline" className="text-xs">Demo Mode</Badge>
            </div>
            
            {/* Reality Check */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Warning size={20} className="text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">How Email Forwarding Actually Works</h4>
                  <div className="text-blue-800 text-sm space-y-2">
                    <p>
                      When you add a forwarding address in Gmail, Google sends a verification email to that address. 
                      Someone must click the verification link to approve the forwarding.
                    </p>
                    <p>
                      Since <code className="px-1 bg-blue-100 rounded">{currentForwardingAddress}</code> is a demo address, 
                      no one can verify it, so forwarding won't work.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Gmail Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail size={18} />
                  Gmail Setup (Conceptual)
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
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Gmail will send a verification email to this address, which won't be received since it's a demo
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      3
                    </div>
                    <div className="opacity-60">
                      <p className="font-medium">Create Filter (After Verification)</p>
                      <p className="text-sm text-muted-foreground">
                        Once verified, create filters to automatically forward job-related emails
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Warning size={16} className="text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">For Now</p>
                      <p className="text-amber-700">
                        Use the manual "Add Application" button below to track your job applications.
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
                  Outlook Setup (Conceptual)
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
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold mt-0.5">
                      3
                    </div>
                    <div className="opacity-60">
                      <p className="font-medium">Set Forward Action</p>
                      <p className="text-sm text-muted-foreground">
                        Choose "forward it to people or public group" and add: 
                        <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">{currentForwardingAddress}</code>
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Similar verification requirements apply
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Check size={16} className="text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-900">Alternative: Manual Entry</p>
                      <p className="text-green-700">
                        The app works great for manual tracking - just use the "Add Application" button below!
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Important Note About Email Forwarding */}
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <Warning size={18} />
                  Important: Email Forwarding Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-amber-800">
                  <p className="text-sm">
                    <strong>Email forwarding requires verification:</strong> When you add a forwarding address in Gmail/Outlook, 
                    the destination email must confirm they want to receive your forwards. Since <code>{currentForwardingAddress}</code> 
                    is a demo address, this won't work in reality.
                  </p>
                  <div className="p-3 bg-amber-100 rounded border">
                    <p className="font-medium text-sm mb-2">Alternative approaches:</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>Use a service like Zapier to connect Gmail to this app</li>
                      <li>Set up email forwarding to your own secondary email, then manually copy/paste emails</li>
                      <li>Use Gmail's API with proper authentication (requires developer setup)</li>
                      <li>For now, manually add applications using the form below</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What Would Happen (Theoretical) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight size={18} />
                  How Email Parsing Would Work
                  <Badge variant="secondary" className="ml-2">Conceptual</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm">Job emails would be forwarded to a real parsing service</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm">AI would extract company, position, and application details</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm">Applications would appear automatically in your tracker</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm">Duplicates would be automatically detected and prevented</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Realistic Alternatives */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Check size={18} />
                  Realistic Alternatives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-green-800">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Manual Entry (Recommended)</p>
                        <p className="text-sm text-green-700">
                          Use the app's manual "Add Application" feature. It's quick, reliable, and you control the data quality.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Zapier Integration</p>
                        <p className="text-sm text-green-700">
                          Set up a Zapier automation that watches your Gmail for job emails and adds them to a webhook endpoint.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Gmail API Integration</p>
                        <p className="text-sm text-green-700">
                          For developers: Use Gmail's API with OAuth to read emails directly (requires significant setup).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                        4
                      </div>
                      <div>
                        <p className="font-medium">Forward to Your Own Email</p>
                        <p className="text-sm text-green-700">
                          Set up forwarding to your own secondary email address, then copy/paste relevant details into the app.
                        </p>
                      </div>
                    </div>
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