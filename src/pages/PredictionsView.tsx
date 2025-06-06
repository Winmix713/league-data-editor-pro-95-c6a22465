
import { memo, useState } from "react"
import { useLeagueState } from "@/hooks/league"
import { Button } from "@/components/ui/button"
import { RefreshCw, ArrowLeft, PieChart, TrendingUp, BarChart4 } from "lucide-react"
import { LeagueStats } from "@/components/stats/LeagueStats"
import { calculateLeagueStatistics } from "@/utils/leagueStatistics"
import { runPrediction } from "@/utils/predictionEngine"
import { MatchPredictionSystem } from "@/components/predictions/MatchPredictionSystem"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchPrediction, ValueBet } from "@/types"
import { PredictionHistory } from "@/components/predictions/PredictionHistory"
import { ValueBetTracker } from "@/components/predictions/ValueBetTracker"
import { toast } from "sonner"

export const PredictionsView = memo(() => {
  const { 
    currentMatches, 
    selectedLeagueId, 
    leaguesList, 
    navigate, 
    isLoading, 
    refreshData 
  } = useLeagueState()
  
  const [savedPredictions, setSavedPredictions] = useState<MatchPrediction[]>([])
  const [valueBets, setValueBets] = useState<ValueBet[]>([])
  const [activeTab, setActiveTab] = useState("predictions")
  const [advancedMode, setAdvancedMode] = useState(false)
  
  // Get the currently selected league
  const selectedLeague = leaguesList.find(league => league.id === selectedLeagueId)
  
  // Calculate statistics for the selected league
  const leagueStatistics = calculateLeagueStatistics(currentMatches)

  // Handler for saving predictions
  const handleSavePrediction = (prediction: MatchPrediction) => {
    setSavedPredictions(prev => {
      // Check if prediction for this match already exists
      const existingIndex = prev.findIndex(
        p => p.match.home_team === prediction.match.home_team && 
             p.match.away_team === prediction.match.away_team
      )
      
      if (existingIndex >= 0) {
        // Replace existing prediction
        const updatedPredictions = [...prev]
        updatedPredictions[existingIndex] = prediction
        return updatedPredictions
      }
      
      // Add new prediction
      toast.success("Prediction saved successfully!")
      return [...prev, prediction]
    })
  }
  
  // Handler for saving value bets
  const handleSaveValueBet = (bet: ValueBet) => {
    setValueBets(prev => [...prev, bet])
    
    // Also update the prediction if it exists
    if (savedPredictions.length > 0) {
      setSavedPredictions(prev => 
        prev.map(prediction => {
          // Find the prediction that matches this bet's match
          if (prediction.match.id === bet.matchId || 
              `${prediction.match.home_team}-${prediction.match.away_team}-${prediction.match.date}` === bet.matchId) {
            return {
              ...prediction,
              valueBets: [...(prediction.valueBets || []), bet]
            }
          }
          return prediction
        })
      )
    }
  }
  
  // Handler for updating value bets
  const handleUpdateValueBet = (updatedBet: ValueBet) => {
    // Update in the main valueBets state
    setValueBets(prev => 
      prev.map(bet => bet.matchId === updatedBet.matchId && 
                       bet.pattern.type === updatedBet.pattern.type ? updatedBet : bet)
    )
    
    // Also update in the related prediction if it exists
    setSavedPredictions(prev => 
      prev.map(prediction => {
        if (!prediction.valueBets) return prediction
        
        // Check if this prediction contains the bet being updated
        const hasBet = prediction.valueBets.some(
          bet => bet.matchId === updatedBet.matchId && bet.pattern.type === updatedBet.pattern.type
        )
        
        if (hasBet) {
          return {
            ...prediction,
            valueBets: prediction.valueBets.map(
              bet => bet.matchId === updatedBet.matchId && 
                     bet.pattern.type === updatedBet.pattern.type ? updatedBet : bet
            )
          }
        }
        return prediction
      })
    )
  }
  
  // Generate advanced prediction using new prediction engine
  const generateAdvancedPrediction = (homeTeam: string, awayTeam: string) => {
    if (!homeTeam || !awayTeam) return null;
    
    // Run advanced prediction
    const advancedPrediction = runPrediction(homeTeam, awayTeam, currentMatches);
    
    // Create match object
    const match = {
      date: new Date().toISOString(),
      home_team: homeTeam,
      away_team: awayTeam,
      home_score: 0,
      away_score: 0,
      ht_home_score: 0,
      ht_away_score: 0
    };
    
    // Determine predicted result based on advancedPrediction
    const predictedResult = 
      advancedPrediction.predictedWinner === 'home' ? 'home_win' :
      advancedPrediction.predictedWinner === 'away' ? 'away_win' :
      'draw';
      
    // Convert prediction to our app's format
    const prediction: MatchPrediction = {
      match,
      predictedResult: predictedResult as 'home_win' | 'draw' | 'away_win',
      confidenceLevel: advancedPrediction.confidence,
      predictedScore: {
        home: advancedPrediction.modelPredictions.poisson.homeGoals,
        away: advancedPrediction.modelPredictions.poisson.awayGoals
      },
      patterns: advancedPrediction.patterns,
      htftAnalysis: [],
      headToHead: {
        homeTeam,
        awayTeam,
        totalMatches: 0, // We would need to calculate this
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        homeGoals: 0,
        awayGoals: 0,
        bothTeamsScored: 0,
        avgTotalGoals: advancedPrediction.homeExpectedGoals + advancedPrediction.awayExpectedGoals,
        htftReversals: 0
      }
    };
    
    return prediction;
  };
  
  // Filter value bets by active prediction (if any)
  const getActivePrediction = () => {
    if (savedPredictions.length === 0) return null
    return savedPredictions[savedPredictions.length - 1] // Get the most recent
  }
  
  const activePrediction = getActivePrediction()
  const activePredictionBets = activePrediction?.valueBets || []
  
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("leagues")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="text-2xl font-bold text-white">
            Match Predictions {selectedLeague ? `- ${selectedLeague.name}` : ''}
          </h2>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={advancedMode ? "secondary" : "outline"} 
            onClick={() => setAdvancedMode(prev => !prev)} 
            className="gap-2"
          >
            <BarChart4 className="h-4 w-4" />
            {advancedMode ? "Standard Mode" : "Advanced Mode"}
          </Button>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            onClick={refreshData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-black/20">
          <TabsTrigger value="predictions">Prediction System</TabsTrigger>
          <TabsTrigger value="value-bets">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Value Bets
            </div>
          </TabsTrigger>
          <TabsTrigger value="history">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Prediction History
            </div>
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="predictions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MatchPredictionSystem 
                  onSavePrediction={handleSavePrediction} 
                  advancedMode={advancedMode}
                  generateAdvancedPrediction={generateAdvancedPrediction}
                />
              </div>
              
              <div>
                <LeagueStats statistics={leagueStatistics} league={selectedLeague} />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="value-bets">
            <ValueBetTracker 
              match={activePrediction?.match}
              patterns={activePrediction?.patterns || []}
              existingBets={valueBets}
              onSaveBet={handleSaveValueBet}
              onUpdateBet={handleUpdateValueBet}
            />
          </TabsContent>
          
          <TabsContent value="history">
            <PredictionHistory predictions={savedPredictions} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
})

PredictionsView.displayName = "PredictionsView"
