import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { syncScheduler, ReviewQueueItem } from '@/lib/gmail/SyncScheduler';
import { JobApplication } from '@/lib/types';
import { Envelope, Check, X, Eye, Calendar, Buildings, User, LinkSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { ProcessingStageIndicator } from './ProcessingStageIndicator';

interface EmailReviewQueueProps {
  onApplicationAdd?: (application: Omit<JobApplication, 'id'>) => void;
}

export function EmailReviewQueue({ onApplicationAdd }: EmailReviewQueueProps) {
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReviewQueue();
  }, []);

  const loadReviewQueue = () => {
    const queue = syncScheduler.getReviewQueue();
    setReviewQueue(queue);
  };

  const handleApprove = async (item: ReviewQueueItem) => {
    setIsLoading(true);
    try {
      syncScheduler.approveReviewItem(item.id, onApplicationAdd);
      toast.success(`Added application for ${item.suggestedApplication.position} at ${item.suggestedApplication.company}`);
      loadReviewQueue();
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      }
    } catch (error) {
      toast.error('Failed to approve application');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = (item: ReviewQueueItem) => {
    syncScheduler.rejectReviewItem(item.id);
    toast.info('Email rejected and removed from queue');
    loadReviewQueue();
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
    }
  };

  const handleClearQueue = () => {
    if (window.confirm(`Are you sure you want to clear all ${reviewQueue.length} emails from the review queue? This action cannot be undone.`)) {
      syncScheduler.clearReviewQueue();
      toast.success('Review queue cleared');
      loadReviewQueue();
      setSelectedItem(null);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'bg-green-100 text-green-800';
    if (confidence >= 0.25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.85) return 'High';
    if (confidence >= 0.25) return 'Review';
    return 'Low';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (reviewQueue.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Envelope size={20} />
            Email Review Queue
            <Badge variant="outline">Empty</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Envelope className="h-4 w-4" />
            <AlertDescription>
              No emails pending review. Emails with 25-84% confidence will appear here for manual review.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Envelope size={20} />
              Email Review Queue
              <Badge variant="secondary">{reviewQueue.length} pending</Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearQueue}
              className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X size={14} />
              Clear Queue
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Queue List */}
            <div className="space-y-3">
              <ScrollArea className="h-96">
                {reviewQueue.map((item, index) => (
                  <div key={item.id} className="space-y-3">
                    <Card 
                      className={`cursor-pointer transition-colors ${
                        selectedItem?.id === item.id 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant="secondary" 
                              className={getConfidenceColor(item.confidence)}
                            >
                              {getConfidenceLabel(item.confidence)} ({Math.round(item.confidence * 100)}%)
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.email.date)}
                            </span>
                          </div>
                          
                          <div>
                            <p className="font-medium text-sm">
                              {truncateText(item.email.subject, 50)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              From: {truncateText(item.email.from, 40)}
                            </p>
                          </div>

                          <div className="space-y-1">
                            {item.suggestedApplication.company && (
                              <div className="flex items-center gap-1 text-xs">
                                <Buildings size={12} />
                                <span>{item.suggestedApplication.company}</span>
                              </div>
                            )}
                            {item.suggestedApplication.position && (
                              <div className="flex items-center gap-1 text-xs">
                                <User size={12} />
                                <span>{item.suggestedApplication.position}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(item);
                              }}
                              disabled={isLoading}
                              className="gap-1"
                            >
                              <Check size={12} />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(item);
                              }}
                              className="gap-1"
                            >
                              <X size={12} />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {index < reviewQueue.length - 1 && <Separator />}
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Detail View */}
            <div>
              {selectedItem ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Eye size={16} />
                      Email Details
                      <Badge 
                        variant="secondary" 
                        className={getConfidenceColor(selectedItem.confidence)}
                      >
                        {Math.round(selectedItem.confidence * 100)}% confidence
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Email Info */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Email Information</h4>
                      <div className="text-xs space-y-1">
                        <p><strong>Subject:</strong> {selectedItem.email.subject}</p>
                        <p><strong>From:</strong> {selectedItem.email.from}</p>
                        <p><strong>Date:</strong> {formatDate(selectedItem.email.date)}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Extracted Data */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Extracted Application Data</h4>
                      <div className="space-y-2">
                        {selectedItem.suggestedApplication.company && (
                          <div className="flex items-center gap-2">
                            <Buildings size={14} />
                            <span className="text-sm">{selectedItem.suggestedApplication.company}</span>
                          </div>
                        )}
                        
                        {selectedItem.suggestedApplication.position && (
                          <div className="flex items-center gap-2">
                            <User size={14} />
                            <span className="text-sm">{selectedItem.suggestedApplication.position}</span>
                          </div>
                        )}

                        {selectedItem.suggestedApplication.appliedDate && (
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span className="text-sm">{selectedItem.suggestedApplication.appliedDate}</span>
                          </div>
                        )}

                        {selectedItem.suggestedApplication.contactEmail && (
                          <div className="flex items-center gap-2">
                            <Envelope size={14} />
                            <span className="text-sm">{selectedItem.suggestedApplication.contactEmail}</span>
                          </div>
                        )}

                        {selectedItem.suggestedApplication.jobUrl && (
                          <div className="flex items-center gap-2">
                            <LinkSimple size={14} />
                            <a 
                              href={selectedItem.suggestedApplication.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Job Posting
                            </a>
                          </div>
                        )}

                        {selectedItem.suggestedApplication.salary && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">💰</span>
                            <span className="text-sm">{selectedItem.suggestedApplication.salary}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* AI Stage Analysis */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">AI Processing Stage Analysis</h4>
                      <ProcessingStageIndicator 
                        email={selectedItem.email}
                        isInReviewQueue={true}
                        showDetails={true}
                      />
                    </div>

                    <Separator />

                    {/* Email Content Full */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Email Content (Full)</h4>
                      <ScrollArea className="h-48 w-full rounded border p-2">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {selectedItem.email.content}
                        </p>
                      </ScrollArea>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => handleApprove(selectedItem)}
                        disabled={isLoading}
                        className="gap-2 flex-1"
                      >
                        <Check size={16} />
                        Approve & Add Application
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReject(selectedItem)}
                        className="gap-2"
                      >
                        <X size={16} />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Eye size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Select an email from the queue to review details
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
