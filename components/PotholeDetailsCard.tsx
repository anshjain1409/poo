import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Ruler, IndianRupee, AlertCircle, CheckCircle2, TrendingUp, MapPin, Calendar } from 'lucide-react'

interface PotholeDetails {
  id: string
  size_cm: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  bounty: number
  pothole_count: number
  confidence: number
  latitude: number
  longitude: number
  created_at: string
  status: string
  location_name?: string
}

export function PotholeDetailsCard({ pothole }: { pothole: PotholeDetails }) {
  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
        return <AlertCircle className="w-4 h-4" />
      case 'MEDIUM':
        return <TrendingUp className="w-4 h-4" />
      case 'LOW':
        return <CheckCircle2 className="w-4 h-4" />
      default:
        return null
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
        return 'bg-destructive/10 text-destructive border-destructive/30'
      case 'MEDIUM':
        return 'bg-yellow-100/50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300/50'
      case 'LOW':
        return 'bg-chart-5/10 text-chart-5 border-chart-5/30'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getSizeCategory = (size: number) => {
    if (size < 10) return 'Small'
    if (size < 30) return 'Medium'
    return 'Large'
  }

  return (
    <div className="space-y-4">
      {/* Main Size Card */}
      <Card className="p-6 border-2 border-blue-200/50 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
        <div className="flex items-end gap-4 justify-between">
          <div className="flex-1">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wider">Pothole Size</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-blue-900 dark:text-blue-200">{pothole.size_cm.toFixed(1)}</span>
              <span className="text-xl font-bold text-blue-700 dark:text-blue-300">cm</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
              {getSizeCategory(pothole.size_cm)} Pothole
            </p>
          </div>
          <Ruler className="h-12 w-12 text-blue-400 opacity-20" />
        </div>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Severity */}
        <Card className="p-4 border-1.5 border-border">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Severity</p>
          <Badge className={`${getSeverityColor(pothole.severity)} w-full flex items-center justify-center gap-2 py-2`}>
            {getSeverityIcon(pothole.severity)}
            {pothole.severity}
          </Badge>
        </Card>

        {/* Bounty */}
        <Card className="p-4 border-1.5 border-border bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-3 uppercase tracking-wider">Bounty</p>
          <div className="flex items-center gap-1">
            <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-2xl font-bold text-green-900 dark:text-green-200">{pothole.bounty}</span>
          </div>
        </Card>

        {/* Confidence */}
        <Card className="p-4 border-1.5 border-border">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Confidence</p>
          <div className="space-y-2">
            <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                style={{ width: `${pothole.confidence * 100}%` }}
              />
            </div>
            <p className="text-sm font-bold text-foreground">{(pothole.confidence * 100).toFixed(1)}%</p>
          </div>
        </Card>

        {/* Count */}
        <Card className="p-4 border-1.5 border-border">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Potholes</p>
          <p className="text-2xl font-bold text-foreground">{pothole.pothole_count}</p>
        </Card>
      </div>

      {/* Details Card */}
      <Card className="p-5 border-1.5 border-border space-y-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Location</p>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            <div className="flex-1">
              {pothole.location_name && (
                <p className="text-sm font-semibold text-foreground">{pothole.location_name}</p>
              )}
              <p className="text-xs font-mono text-muted-foreground">
                {pothole.latitude.toFixed(6)}, {pothole.longitude.toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Reported</p>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-foreground">{new Date(pothole.created_at).toLocaleString()}</p>
          </div>
        </div>

        {pothole.status && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Status</p>
            <Badge variant="secondary" className="w-full justify-center py-2">
              {pothole.status}
            </Badge>
          </div>
        )}
      </Card>
    </div>
  )
}
