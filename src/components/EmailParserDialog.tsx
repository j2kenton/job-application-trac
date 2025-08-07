import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { parseEmailWithStatusDetection, EnhancedParsedEmailData } from '@/lib/emailParser';
import { ApplicationStatus, ParsedEmailData } from '@/lib/types';
import { Envelope, Gear, Robot, CheckCircle, Clock, XCircle } from '@phosphor-icons/react';

interface EmailParserDialogProps {
  onParsed: (data: EnhancedParsedEmailData) => void;
  children?: React.ReactNode;
}

export function EmailParserDialog({ onParsed, children }: EmailParserDialogProps) {
  const [open, setOpen] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<EnhancedParsedEmailData | null>(null);

  const handleParse = async () => {
    if (!emailContent.trim()) return;
    
    setIsProcessing(true);
    
    try {
      // Use AI-enhanced parsing
      const parsed = await parseEmailWithStatusDetection(
        emailSubject || 'Email Content',
        emailContent,
        senderEmail || 'unknown@example.com'
      );
      setParsedData(parsed);
    } catch (error) {
      console.error('Enhanced parsing failed:', error);
      // Fallback to basic parsing if AI fails
      const { parseEmailContent } = await import('@/lib/emailParser');
      const basicParsed = parseEmailContent(emailContent);
      setParsedData({
        ...basicParsed,
        detectedStatus: 'applied'
      });
    } finally {
      setIsProcessing(false);
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject">Email Subject (Optional)</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="e.g., Interview Invitation - Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-email">Sender Email (Optional)</Label>
              <Input
                id="sender-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="e.g., hr@company.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email-content">Email Content</Label>
            <Textarea
              id="email-content"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={6}
              className="resize-none"
              placeholder="Paste the full email content here..."
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
              {/* AI Status Detection Results */}
              {parsedData.statusAnalysis && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Robot size={20} className="text-blue-600" />
                    <h3 className="font-semibold text-blue-900">AI Status Detection</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-blue-700">Detected Status</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={parsedData.statusAnalysis.confidence > 0.7 ? 'default' : 'secondary'}>
                          {parsedData.detectedStatus}
                        </Badge>
                        {parsedData.statusAnalysis.confidence > 0.8 && <CheckCircle size={16} className="text-green-600" />}
                        {parsedData.statusAnalysis.confidence <= 0.8 && parsedData.statusAnalysis.confidence > 0.6 && <Clock size={16} className="text-yellow-600" />}
                        {parsedData.statusAnalysis.confidence <= 0.6 && <XCircle size={16} className="text-red-600" />}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-blue-700">Confidence</Label>
                      <div className="text-sm font-medium mt-1">
                        {Math.round(parsedData.statusAnalysis.confidence * 100)}%
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-blue-700">Status Override</Label>
                      <Select 
                        value={parsedData.detectedStatus || 'applied'} 
                        onValueChange={(value: ApplicationStatus) => 
                          setParsedData({...parsedData, detectedStatus: value})
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="applied">Applied</SelectItem>
                          <SelectItem value="interview">Interview</SelectItem>
                          <SelectItem value="offer">Offer</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Label className="text-sm text-blue-700">AI Reasoning</Label>
                    <p className="text-sm text-blue-800 mt-1">
                      {parsedData.statusAnalysis.reasoning}
                    </p>
                  </div>
                  
                  {parsedData.statusAnalysis.keyIndicators.length > 0 && (
                    <div className="mt-3">
                      <Label className="text-sm text-blue-700">Key Indicators</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedData.statusAnalysis.keyIndicators.map((indicator, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
