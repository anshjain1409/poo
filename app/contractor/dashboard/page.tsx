'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Briefcase, MapPin, IndianRupee, AlertCircle, Loader2, Search, Wrench, CheckCircle2, Ruler } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Loading from './loading'

interface PotholeReport {
  id: string
  image_path?: string
  latitude: number
  longitude: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  confidence: number
  bounty: number
  size_cm: number
  pothole_count: number
  created_at: string
  status: string
  distance_meters?: number
}

export default function ContractorDashboard() {
  const [contractorId, setContractorId] = useState<string | null>(null)
  const [openJobs, setOpenJobs] = useState<PotholeReport[]>([])
  const [myJobs, setMyJobs] = useState<PotholeReport[]>([])
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('available')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const id = sessionStorage.getItem('contractor_id')
    if (!id) {
      router.push('/contractor')
      return
    }
    setContractorId(id)
    getCurrentLocation()
  }, [router])

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        () => {
          setLocation(null)
        }
      )
    }
  }

  useEffect(() => {
    if (contractorId) {
      fetchJobs()
    }
  }, [contractorId, location])

  const fetchJobs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const openUrl = new URL(`${backendUrl}/api/reports/open`)
      
      if (location) {
        openUrl.searchParams.append('contractor_lat', location.latitude.toString())
        openUrl.searchParams.append('contractor_lon', location.longitude.toString())
      }
      
      const openResponse = await fetch(openUrl.toString())
      
      if (!openResponse.ok) {
        throw new Error(`Failed to fetch open reports: ${openResponse.statusText}`)
      }
      
      const openData = await openResponse.json()
      
      const myResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/contractor/${contractorId}/jobs`
      )
      const myData = await myResponse.json()
      
      setOpenJobs(openData.reports || [])
      setMyJobs(myData.jobs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptJob = async (jobId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/report/${jobId}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractor_id: contractorId })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to accept job')
      }

      await fetchJobs()
      setActiveTab('my-jobs')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept job')
    }
  }

  const handleRejectJob = async (jobId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/report/${jobId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to reject job')
      }

      await fetchJobs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject job')
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-destructive text-destructive-foreground'
      case 'MEDIUM':
        return 'bg-chart-3 text-white'
      case 'LOW':
        return 'bg-chart-4 text-white'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) return null
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    // Remove leading slash if present to avoid double slashes
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath
    return `${backendUrl}/${cleanPath}`
  }

  if (!contractorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  // Calculate stats
  const statsData = [
    { 
      label: 'Available Jobs', 
      value: openJobs.length, 
      icon: Briefcase, 
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    { 
      label: 'In Progress', 
      value: myJobs.filter(j => j.status === 'IN_PROGRESS').length, 
      icon: AlertCircle, 
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    },
    { 
      label: 'Completed', 
      value: myJobs.filter(j => j.status === 'COMPLETED' || j.status === 'PAID').length, 
      icon: CheckCircle2, 
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    { 
      label: 'Total Earnings', 
      value: `₹${myJobs.filter(j => j.status === 'PAID').reduce((sum, j) => sum + j.bounty, 0)}`, 
      icon: IndianRupee, 
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/">
                <Button variant="ghost" size="sm" className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
                  ← Back to Public Portal
                </Button>
              </Link>
              <h1 className="text-3xl font-bold mb-1">Contractor Dashboard</h1>
              <p className="text-muted-foreground">Manage and track your repair jobs</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant={activeTab === 'available' ? 'default' : 'outline'}
                onClick={() => setActiveTab('available')}
                className="gap-2"
              >
                <Briefcase className="h-4 w-4" />
                Available Jobs
              </Button>
              <Button 
                variant={activeTab === 'my-jobs' ? 'default' : 'outline'}
                onClick={() => setActiveTab('my-jobs')}
                className="gap-2"
              >
                <Wrench className="h-4 w-4" />
                My Work
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsData.map((stat, index) => (
            <Card key={index} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.iconBg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

      {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="my-jobs">My Jobs</TabsTrigger>
          </TabsList>

          {/* Available Jobs Tab */}
          <TabsContent value="available" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Available Repair Jobs</h2>
              <Button onClick={fetchJobs} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <Card className="p-6 border-destructive bg-destructive/5">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </Card>
            )}

            {!loading && !error && openJobs.length === 0 && (
              <Card className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Jobs Available</h3>
                <p className="text-muted-foreground">Check back later for new repair jobs</p>
              </Card>
            )}

            {!loading && !error && openJobs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {openJobs.map((job) => {
                  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
                  const imageUrl = job.image_path ? `${backendUrl}/${job.image_path}` : null
                  
                  return (
                    <Card key={job.id} className="overflow-hidden hover:shadow-md transition-all group">
                      {/* Pothole Image - Compact */}
                      <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
                        {imageUrl ? (
                          <img 
                            src={imageUrl || "/placeholder.svg"}
                            alt="Pothole"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted-foreground"><div class="text-center"><svg class="h-16 w-16 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-sm">Image Failed</p></div></div>'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <svg className="h-16 w-16 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm">No Image Path</p>
                            </div>
                          </div>
                        )}
                        {/* Severity Badge Overlay */}
                        <div className="absolute top-3 left-3">
                          <Badge className={getSeverityColor(job.severity) + ' text-xs font-bold shadow-lg'}>
                            {job.severity}
                          </Badge>
                        </div>
                        {/* Available Badge */}
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs">
                            Available
                          </Badge>
                        </div>
                        {/* Distance info moved to card */}
                      </div>
                      
                      {/* Job Details - Compact */}
                      <div className="p-3">
                        <div className="space-y-2">
                          {/* Bounty */}
                          <div className="flex items-center gap-1.5">
                            <IndianRupee className="h-4 w-4 text-green-600" />
                            <span className="text-lg font-bold">₹{job.bounty}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {job.pothole_count} {job.pothole_count === 1 ? 'hole' : 'holes'}
                            </span>
                          </div>

                          {/* Pothole Size */}
                          <div className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded">
                            <Ruler className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                              {job.size_cm.toFixed(1)} cm diameter
                            </span>
                          </div>
                          
                          {/* Location */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              {job.latitude.toFixed(3)}, {job.longitude.toFixed(3)}
                            </span>
                          </div>
                          
                          {/* Action Buttons - Accept Only */}
                          <div className="flex gap-2 pt-2">
                            <Button 
                              onClick={() => handleAcceptJob(job.id)}
                              className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
                              size="sm"
                            >
                              Accept Job
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* My Jobs Tab */}
          <TabsContent value="my-jobs" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">My Active Jobs</h2>
              <Button onClick={fetchJobs} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!loading && myJobs.length === 0 && (
              <Card className="p-12 text-center">
                <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Active Jobs</h3>
                <p className="text-muted-foreground">Accept a job from the Available Jobs tab to get started</p>
              </Card>
            )}

            {!loading && myJobs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myJobs.map((job) => {
                  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
                  const imageUrl = job.image_path ? `${backendUrl}/${job.image_path}` : null
                  
                  return (
                    <Card key={job.id} className="overflow-hidden hover:shadow-md transition-all group">
                      {/* Pothole Image - Compact */}
                      <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
                        {imageUrl ? (
                          <img 
                            src={imageUrl || "/placeholder.svg"}
                            alt="Pothole"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted-foreground"><div class="text-center"><svg class="h-16 w-16 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-sm">Image Failed</p></div></div>'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <svg className="h-16 w-16 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm">No Image Path</p>
                            </div>
                          </div>
                        )}
                        {/* Status Badge Overlay */}
                        <div className="absolute top-3 left-3">
                          <Badge className={getSeverityColor(job.severity) + ' text-xs font-bold shadow-lg'}>
                            {job.severity}
                          </Badge>
                        </div>
                        <div className="absolute top-3 right-3">
                          <Badge variant="outline" className="bg-background/90 backdrop-blur-sm text-xs capitalize">
                            {job.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Job Details - Compact */}
                      <div className="p-5">
                        <div className="space-y-3">
                          {/* Bounty */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <IndianRupee className="h-5 w-5 text-chart-5" />
                              <span className="text-2xl font-bold">₹{job.bounty}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {job.pothole_count} {job.pothole_count === 1 ? 'pothole' : 'potholes'}
                            </div>
                          </div>

                          {/* Pothole Size - Compact */}
                          {job.size_cm > 0 && (
                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-md">
                              <Ruler className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">
                                {job.size_cm.toFixed(1)} cm diameter
                              </span>
                            </div>
                          )}
                          
                          {/* Location - Compact */}
                          <div className="flex items-start gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span className="font-mono truncate">
                              {job.latitude.toFixed(4)}, {job.longitude.toFixed(4)}
                            </span>
                          </div>
                          
                          {/* Action Buttons - Full Width */}
                          {job.status === 'IN_PROGRESS' && (
                            <div className="flex gap-2 mt-3">
                              <Link href={`/contractor/job/${job.id}`} className="flex-1">
                                <Button className="w-full" size="sm">Complete Job</Button>
                              </Link>
                              <Button 
                                onClick={() => handleRejectJob(job.id)}
                                variant="outline"
                                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                                size="sm"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {job.status === 'COMPLETED' && (
                            <Link href={`/contractor/payment/${job.id}`} className="block">
                              <Button variant="outline" className="w-full mt-2 bg-transparent" size="sm">Get Payment</Button>
                            </Link>
                          )}
                          {job.status === 'PAID' && (
                            <div className="mt-2">
                              <Badge className="bg-chart-5 text-white w-full justify-center py-2">Paid ✓</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
