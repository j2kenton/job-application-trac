import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { parseEmailContent } from '@/lib/emailParser';
import { ParsedEmailData } from '@/lib/types';
import { Envelope, Gear } from '@phosphor-icons/react';

interface EmailParserDialogProps {
  onParsed: (data: ParsedEmailData) => void;
  children?: React.ReactNode;
}

export function EmailParserDialog({ onParsed, children }: EmailParserDialogProps) {
  const [open, setOpen] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedEmailData | null>(null);

  const handleParse = async () => {
    if (!emailContent.trim()) return;
    
    setIsProcessing(true);
    
    // Add a small delay to show processing state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const parsed = parseEmailContent(emailContent);
    setParsedData(parsed);
    setIsProcessing(false);
  };

  const handleConfirm = () => {
    if (parsedData) {
      onParsed(parsedData);
      setOpen(false);
      setEmailContent('');
      setParsedData(null);
    }
  };

  const handleReset = () => {
    setParsedData(null);
    setEmailContent('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2">
            <Envelope size={16} />
            Parse Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Envelope size={20} />
            Parse Job Application Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email-content">Email Content</Label>
            <Textarea
              id="email-content"
              placeholder="Paste your job application email content here..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {!parsedData && (
            <Button 
              onClick={handleParse} 
              disabled={!emailContent.trim() || isProcessing}
              className="w-full gap-2"
            >
              <Gear size={16} />
              {isProcessing ? 'Processing...' : 'Parse Email'}
            </Button>
          )}

          {parsedData && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-3">Extracted Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="parsed-company">Company</Label>
                    <Input
                      id="parsed-company"
                      value={parsedData.company || ''}
                      onChange={(e) => setParsedData({...parsedData, company: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="parsed-position">Position</Label>
                    <Input
                      id="parsed-position"
                      value={parsedData.position || ''}
                      onChange={(e) => setParsedData({...parsedData, position: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="parsed-date">Applied Date</Label>
                    <Input
                      id="parsed-date"
                      type="date"
                      value={parsedData.appliedDate || ''}
                      onChange={(e) => setParsedData({...parsedData, appliedDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="parsed-email">Contact Email</Label>
                    <Input
                      id="parsed-email"
                      type="email"
                      value={parsedData.contactEmail || ''}
                      onChange={(e) => setParsedData({...parsedData, contactEmail: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="parsed-url">Job URL</Label>
                    <Input
                      id="parsed-url"
                      type="url"
                      value={parsedData.jobUrl || ''}
                      onChange={(e) => setParsedData({...parsedData, jobUrl: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleConfirm} className="flex-1">
                  Add Application
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
