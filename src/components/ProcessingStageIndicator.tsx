import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { aiStageDetector, ProcessingStage, StageAnalysis } from '@/lib/ai-stage-detector';
import { ProcessedEmail } from '@/lib/gmail/GmailService';
import { 
  Gear, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Robot, 
  Eye, 
  ArrowRight,
  Info
} from '@phosphor-icons/react';

interface ProcessingStageIndicatorProps {
  email: ProcessedEmail;
  isInReviewQueue?: boolean;
  hasBeenProcessed?: boolean;
  previousStages?: ProcessingStage[];
  showDetails?: boolean;
}

export function ProcessingStageIndicator({
  email,
  isInReviewQueue = false,
  hasBeenProcessed = false,
  previousStages = [],
  showDetails = true
}: ProcessingStageIndicatorProps) {
  const [stageAnalysis, setStageAnalysis] = useState<StageAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectStage();
  }, [email.id, isInReviewQueue, hasBeenProcessed]);

  const detectStage = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const analysis = await aiStageDetector.detectProcessingStage(email, {
        isInReviewQueue,
        hasBeenProcessed,
        previousStages
      });
      
      setStageAnalysis(analysis);
    } catch (error) {
      console.error('Failed to detect processing stage:', error);
      setError('Failed to analyze processing stage');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStageIcon = (stage: ProcessingStage) => {
    const iconMap: Record<ProcessingStage, React.ReactNode> = {
      initial: <Clock size={16} className="text-gray-500" />,
      manual_review: <Eye size={16} className="text-blue-500" />,
      ai_enhanced: <Robot size={16} className="text-purple-500" />,
      auto_processed: <Gear size={16} className="text-green-500" />,
      rejected: <XCircle size={16} className="text-red-500" />,
      pending_review: <Clock size={16} className="text-yellow-600" />,
      completed: <CheckCircle size={16} className="text-green-600" />
    };
    
    return iconMap[stage] || <Info size={16} className="text-gray-400" />;
  };

  const getStageColor = (stage: ProcessingStage) => {
    const colorMap: Record<ProcessingStage, string> = {
      initial: 'bg-gray-100 text-gray-800',
      manual_review: 'bg-blue-100 text-blue-800',
      ai_enhanced: 'bg-purple-100 text-purple-800',
      auto_processed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800'
    };
    
    return colorMap[stage] || 'bg-gray-100 text-gray-800';
  };

  const formatStageName = (stage: ProcessingStage) => {
    const nameMap: Record<ProcessingStage, string> = {
      initial: 'Initial',
      manual_review: 'Manual Review',
      ai_enhanced: 'AI Enhanced',
      auto_processed: 'Auto Processed',
      rejected: 'Rejected',
      pending_review: 'Pending Review',
      completed: 'Completed'
    };
    
    return nameMap[stage] || stage;
  };

  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Analyzing processing stage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
        <XCircle size={16} className="text-red-500" />
        <span className="text-sm text-red-700">{error}</span>
        <Button size="sm" variant="outline" onClick={detectStage}>
          Retry
        </Button>
      </div>
    );
  }

  if (!stageAnalysis) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <Info size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Unable to determine processing stage</span>
      </div>
    );
  }

  if (!showDetails) {
    return (
      <div className="flex items-center gap-2">
        {getStageIcon(stageAnalysis.currentStage)}
        <Badge variant="secondary" className={getStageColor(stageAnalysis.currentStage)}>
          {formatStageName(stageAnalysis.currentStage)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {Math.round(stageAnalysis.confidence * 100)}% confident
        </span>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gear size={16} />
          Processing Stage Analysis
          {getStageIcon(stageAnalysis.currentStage)}
          <Badge variant="secondary" className={getStageColor(stageAnalysis.currentStage)}>
            {formatStageName(stageAnalysis.currentStage)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Stage Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Stage:</span>
            <div className="flex items-center gap-2">
              {getStageIcon(stageAnalysis.currentStage)}
              <span className="text-sm">{formatStageName(stageAnalysis.currentStage)}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {aiStageDetector.getStageDescription(stageAnalysis.currentStage)}
          </div>
        </div>

        <Separator />

        {/* Analysis Details */}
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium">AI Confidence: </span>
            <span className="text-sm">{Math.round(stageAnalysis.confidence * 100)}%</span>
          </div>
          
          <div>
            <span className="text-sm font-medium">Reasoning: </span>
            <p className="text-xs text-muted-foreground mt-1">{stageAnalysis.reasoning}</p>
          </div>
          
          <div>
            <span className="text-sm font-medium">Suggested Next Action: </span>
            <p className="text-xs text-muted-foreground mt-1">{stageAnalysis.suggestedNextAction}</p>
          </div>
        </div>

        <Separator />

        {/* Processing Indicators */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Processing Indicators:</span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${stageAnalysis.indicators.hasJobKeywords ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Job Keywords</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${stageAnalysis.indicators.hasCompanyInfo ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Company Info</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${stageAnalysis.indicators.hasPositionInfo ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Position Info</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${stageAnalysis.indicators.hasApplicationContext ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Application Context</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${stageAnalysis.indicators.aiProcessed ? 'bg-blue-500' : 'bg-gray-300'}`} />
              <span>AI Processed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${stageAnalysis.indicators.manuallyReviewed ? 'bg-yellow-500' : 'bg-gray-300'}`} />
              <span>Manual Review</span>
            </div>
          </div>
        </div>

        {/* Stage History */}
        {stageAnalysis.stageHistory.length > 1 && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-sm font-medium">Processing History:</span>
              <div className="flex items-center gap-1 text-xs">
                {stageAnalysis.stageHistory.map((stage, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs py-0">
                      {formatStageName(stage)}
                    </Badge>
                    {index < stageAnalysis.stageHistory.length - 1 && (
                      <ArrowRight size={12} className="text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Next Possible Stages */}
        {aiStageDetector.getNextPossibleStages(stageAnalysis.currentStage).length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-sm font-medium">Next Possible Stages:</span>
              <div className="flex flex-wrap gap-1">
                {aiStageDetector.getNextPossibleStages(stageAnalysis.currentStage).map((stage) => (
                  <Badge key={stage} variant="outline" className="text-xs">
                    {formatStageName(stage)}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end pt-2">
          <Button size="sm" variant="outline" onClick={detectStage} className="gap-1">
            <Gear size={12} />
            Re-analyze
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
