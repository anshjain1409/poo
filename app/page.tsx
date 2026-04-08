'use client'

import React from "react"
import { useState, useEffect } from 'react'
import { Camera, MapPin, AlertCircle, CheckCircle2, IndianRupee, ArrowRight, Smartphone, Bot, Wrench, Wallet, Zap, Shield, TrendingUp, Briefcase, Sparkles, ChevronRight, Cpu, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2' // Import Loader2 here

// Reverse geocoding utility
async function getReverseGeocoding(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'RoadFix-App'
        }
      }
    )
    const data = await response.json()
    
    const address = data.address || {}
    const locationStr = address.neighbourhood || 
                       address.residential || 
                       address.suburb || 
                       address.city || 
                       address.town || 
                       'Unknown Location'
    
    return locationStr
  } catch (err) {
    console.error('[v0] Geocoding error:', err)
    return ''
  }
}

export default function HomePage() {
  const [showReportForm, setShowReportForm] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string>('')
  const [reportDetails, setReportDetails] = useState<any>(null)
  const [locationName, setLocationName] = useState<string>('')
  const [loadingLocation, setLoadingLocation] = useState(false) // Declare setLoadingLocation here

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const captureLocation = () => {
    setError('')
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
          setLocation(coords)
          
          try {
            setLoadingLocation(true)
            const locationStr = await getReverseGeocoding(coords.latitude, coords.longitude)
            setLocationName(locationStr)
          } catch (err) {
            console.error('[v0] Geocoding error:', err)
          } finally {
            setLoadingLocation(false)
          }
          
          setError('')
        },
        (error) => {
          let errorMsg = 'Unable to get location. '
          if (error.code === 1) {
            errorMsg += 'Please allow location access in your browser settings.'
          } else if (error.code === 2) {
            errorMsg += 'Location unavailable. Check your device settings.'
          } else if (error.code === 3) {
            errorMsg += 'Location request timed out. Please try again.'
          }
          setError(errorMsg)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      setError('Geolocation is not supported by your browser')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!image || !location) {
      setError('Please provide both image and location')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('image', image)
      formData.append('latitude', location.latitude.toString())
      formData.append('longitude', location.longitude.toString())

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/api/report`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit report')
      }

      setSuccess(true)
      setReportDetails(data)
      
      // Get location name from coords if not already set
      if (!locationName && location) {
        try {
          const locationNameData = await getReverseGeocoding(location.latitude, location.longitude)
          setLocationName(locationNameData || '')
        } catch (err) {
          console.error('[v0] Failed to get location name:', err)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit report')
    } finally {
      setLoading(false)
    }
  }

  if (showReportForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/5">
        <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => setShowReportForm(false)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Home
            </button>
            <h2 className="text-lg font-bold">Report a Pothole</h2>
            <Link href="/reports">
              <Button variant="outline" size="sm">View All Reports</Button>
            </Link>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-12 max-w-3xl">
          {success ? (
            <Card className="p-12 shadow-xl border-2 text-center">
              <div className="mb-6">
                <div className="h-20 w-20 rounded-full bg-chart-5/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-10 w-10 text-chart-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-3 text-foreground">Report Submitted Successfully!</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Your pothole report has been analyzed and sent to nearby contractors
                </p>
              </div>

              {reportDetails && (
                <div className="space-y-6 mb-8">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pothole Size Card */}
                    {reportDetails.details?.size_cm && reportDetails.details.size_cm > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-lg p-6 border border-blue-200/50 dark:border-blue-900/50">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">POTHOLE SIZE</p>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-4xl font-black text-blue-900 dark:text-blue-200">{reportDetails.details.size_cm.toFixed(1)}</span>
                          <span className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-1">cm</span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {reportDetails.details.size_cm < 10 ? 'Small pothole' : reportDetails.details.size_cm < 30 ? 'Medium pothole' : 'Large pothole'}
                        </p>
                      </div>
                    )}

                    {/* Bounty Card */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 rounded-lg p-6 border border-green-200/50 dark:border-green-900/50">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">REPAIR BOUNTY</p>
                      <div className="flex items-end gap-1 mb-2">
                        <IndianRupee className="h-6 w-6 text-green-700 dark:text-green-400" />
                        <span className="text-4xl font-black text-green-900 dark:text-green-200">{reportDetails.details?.bounty || 0}</span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400">Reward for repair completion</p>
                    </div>

                    {/* Severity Card */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 rounded-lg p-6 border border-purple-200/50 dark:border-purple-900/50">
                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">SEVERITY LEVEL</p>
                      <Badge className={`${reportDetails.details?.severity === 'HIGH' ? 'bg-destructive/20 text-destructive' : reportDetails.details?.severity === 'MEDIUM' ? 'bg-yellow-200/30 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 'bg-chart-5/20 text-chart-5'} mb-2`}>
                        {reportDetails.details?.severity || 'UNKNOWN'}
                      </Badge>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Damage severity classification</p>
                    </div>

                    {/* Potholes Count */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 rounded-lg p-6 border border-orange-200/50 dark:border-orange-900/50">
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">POTHOLES DETECTED</p>
                      <span className="text-4xl font-black text-orange-900 dark:text-orange-200">{reportDetails.details?.pothole_count || 0}</span>
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">Total in image</p>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="bg-secondary/30 rounded-lg p-6 text-left border border-border">
                    <h3 className="font-semibold text-lg mb-4">Full Report Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Report ID</p>
                        <p className="font-mono font-semibold text-foreground">{reportDetails.report_id?.substring(0, 16)}...</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Detection Confidence</p>
                        <p className="font-semibold text-foreground">{((reportDetails.details?.confidence || reportDetails.confidence) * 100 || 0).toFixed(1)}%</p>
                      </div>
                      {locationName && (
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Location</p>
                          <p className="font-semibold text-foreground">{locationName}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Coordinates</p>
                        <p className="font-mono text-xs text-muted-foreground">{reportDetails.latitude?.toFixed(6)}, {reportDetails.longitude?.toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => {
                  setSuccess(false)
                  setShowReportForm(false)
                }} size="lg" className="px-8">
                  Back to Home
                </Button>
                <Button onClick={() => {
                  setSuccess(false)
                  setImage(null)
                  setPreviewUrl('')
                  setLocation(null)
                  setError('')
                  setReportDetails(null)
                  setLocationName('')
                }} variant="outline" size="lg" className="px-8">
                  Report Another
                </Button>
                <Link href="/reports">
                  <Button variant="outline" size="lg" className="px-8 bg-transparent">
                    View All Reports
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-8 shadow-xl border-2">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Report a Pothole</h2>
                <p className="text-muted-foreground">Help improve our city roads by reporting potholes in your area. We'll analyze the severity and assign it to contractors.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Photo Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">1</div>
                    <Label htmlFor="image" className="text-base font-semibold">Take or Upload Photo</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-10">Capture a clear image of the pothole</p>
                  <div className="ml-10 border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-all hover:bg-primary/5">
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                      required
                    />
                    <label htmlFor="image" className="cursor-pointer block">
                      {previewUrl ? (
                        <>
                          <img src={previewUrl || "/placeholder.svg"} alt="Preview" className="max-h-64 mx-auto rounded-lg mb-4" />
                          <p className="text-sm text-primary font-semibold">Click to change photo</p>
                        </>
                      ) : (
                        <>
                          <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm font-semibold text-foreground mb-1">Click to take or upload a photo</p>
                          <p className="text-xs text-muted-foreground">JPEG, PNG up to 10MB</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Location Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">2</div>
                    <Label htmlFor="location" className="text-base font-semibold">Capture Location</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-10">Allow us to access your GPS location</p>
                  <div className="ml-10">
                    {location ? (
                      <div className="space-y-2">
                        {loadingLocation ? (
                          <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                            <span className="text-sm text-blue-600 dark:text-blue-400">Getting location name...</span>
                          </div>
                        ) : (
                          <>
                            {locationName && (
                              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                                <MapPin className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">LOCATION NAME</p>
                                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">{locationName}</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg border border-primary/20">
                              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-primary">COORDINATES CAPTURED</p>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <Button type="button" onClick={captureLocation} variant="outline" className="w-full bg-transparent">
                        <MapPin className="h-4 w-4 mr-2" />
                        Capture GPS Location
                      </Button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive text-sm">Error</p>
                      <span className="text-sm text-destructive/90">{error}</span>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(image && location ? 100 : location ? 50 : image ? 25 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{image && location ? '100' : location ? '50' : image ? '25' : '0'}%</span>
                </div>

                <Button type="submit" disabled={loading || !image || !location} className="w-full" size="lg">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {loading ? 'Analyzing Image & Location...' : 'Submit Report & Get Bounty Details'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Your report helps our AI model improve and connects you with nearby contractors for quick repairs.
                </p>
              </form>
            </Card>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b backdrop-blur-sm sticky top-0 z-50 bg-background/95 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">RoadFix</h1>
              <p className="text-xs text-muted-foreground">Smart Infrastructure</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/reports">
              <Button variant="ghost" size="sm">View All Reports</Button>
            </Link>
            <Link href="/contractor">
              <Button variant="ghost" size="sm">Contractor Portal</Button>
            </Link>
            <Button onClick={() => setShowReportForm(true)} size="sm" className="shadow-lg">
              Report Pothole
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <style>{`
        @keyframes neonGlow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5), 
                        0 0 20px rgba(59, 130, 246, 0.3),
                        inset 0 0 10px rgba(59, 130, 246, 0.1);
            color: rgb(219, 234, 254);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 
                        0 0 40px rgba(59, 130, 246, 0.5),
                        inset 0 0 20px rgba(59, 130, 246, 0.2);
            color: rgb(191, 219, 254);
          }
        }
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .neon-button {
          animation: neonGlow 2s ease-in-out infinite;
          border: 2px solid rgb(59, 130, 246);
          background: rgba(59, 130, 246, 0.1);
          position: relative;
          overflow: hidden;
        }
        .neon-button:hover {
          background: rgba(59, 130, 246, 0.2);
        }
        .animate-slide-down { animation: slideInDown 0.8s ease-out forwards; }
        .animate-slide-up { animation: slideInUp 0.8s ease-out forwards 0.2s; }
      `}</style>
      
      <section className="relative overflow-hidden bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-slate-950 opacity-90"></div>
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(59, 130, 246) 1px, transparent 0)', backgroundSize: '50px 50px'}} />
          </div>
          <div className="absolute top-0 left-1/2 w-96 h-96 bg-blue-600/20 rounded-full filter blur-3xl opacity-30 -translate-x-1/2 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl opacity-20 animate-pulse" />
        </div>
        
        <div className="container mx-auto px-4 py-12 lg:py-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-blue-950/40 backdrop-blur-md rounded-full border border-blue-500/30 shadow-lg animate-slide-down">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-blue-300 tracking-wide">Smart Infrastructure Platform</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight tracking-tight animate-slide-down" style={{animationDelay: '0.1s'}}>
                Fix Roads,
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">Instantly</span>
              </h1>
              
              <p className="text-base md:text-lg text-slate-300 mb-8 leading-relaxed max-w-xl font-medium animate-slide-up" style={{animationDelay: '0.3s'}}>
                AI-powered pothole detection and repair coordination. Report, verify, and fix road damage in real-time with automated contractor assignment.
              </p>
              
              <div className="flex gap-4 items-center mb-12 animate-slide-up" style={{animationDelay: '0.4s'}}>
                <button 
                  onClick={() => setShowReportForm(true)} 
                  className="neon-button px-8 py-3 text-white font-bold rounded-lg transition-all duration-300 hover:scale-105 flex items-center gap-2"
                >
                  <Camera className="h-5 w-5" />
                  Report Now
                </button>
                <Link href="/contractor" className="inline-block">
                  <Button variant="outline" className="border-2 border-slate-600 text-white hover:bg-slate-900/50 px-8 py-3 h-auto bg-transparent backdrop-blur-sm font-bold rounded-lg transition-all duration-300 hover:scale-105">
                    <Briefcase className="h-5 w-5 mr-2" />
                    Contractor
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-700 animate-slide-up" style={{animationDelay: '0.5s'}}>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-blue-400 mb-1">2.4K</div>
                  <div className="text-xs text-slate-400">Potholes Fixed</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-blue-400 mb-1">450+</div>
                  <div className="text-xs text-slate-400">Active Contractors</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-blue-400 mb-1">89%</div>
                  <div className="text-xs text-slate-400">Detection Accuracy</div>
                </div>
              </div>
            </div>

            {/* Right Image */}
            <div className="animate-slide-up" style={{animationDelay: '0.2s'}}>
              <div className="relative rounded-2xl overflow-hidden border border-blue-500/20 shadow-2xl">
                <img 
                  src="/pothole-repair.jpg" 
                  alt="Pothole repair in action - city workers using RoadFix platform" 
                  className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-30"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Animated Workflow Pipeline */}
      <section className="py-20 bg-black border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">How It Works</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Four simple steps to repair roads faster than ever before</p>
          </div>

          <div className="relative">
            {/* Horizontal connector line - hidden on mobile */}
            <div className="hidden md:block absolute top-8 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent" style={{zIndex: 0}}></div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto relative" style={{zIndex: 1}}>
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/50 border border-blue-400 hover:scale-110 transition-transform group relative">
                  <Camera className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Report</h3>
                <p className="text-slate-400 text-sm">Snap a photo of the pothole with location data</p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/50 border border-blue-400 hover:scale-110 transition-transform group relative">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Verify</h3>
                <p className="text-slate-400 text-sm">AI analyzes severity and damage extent</p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/50 border border-blue-400 hover:scale-110 transition-transform group relative">
                  <Wrench className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Assign</h3>
                <p className="text-slate-400 text-sm">Contractors receive automated job assignment</p>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/50 border border-blue-400 hover:scale-110 transition-transform group relative">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Complete</h3>
                <p className="text-slate-400 text-sm">Payment released upon job completion</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-black py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Why Choose RoadFix</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Enterprise-grade infrastructure platform built for speed and reliability</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Card 1 */}
            <div className="group rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-900/80 p-8 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-5 group-hover:bg-blue-600/40 transition-colors">
                <Bot className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">AI-Powered Detection</h3>
              <p className="text-slate-400 text-sm">98% accuracy in pothole detection and severity assessment with computer vision</p>
            </div>

            {/* Card 2 */}
            <div className="group rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-900/80 p-8 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-5 group-hover:bg-blue-600/40 transition-colors">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">Instant Assignment</h3>
              <p className="text-slate-400 text-sm">Automatic contractor matching based on location, expertise, and availability</p>
            </div>

            {/* Card 3 */}
            <div className="group rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-900/80 p-8 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-5 group-hover:bg-blue-600/40 transition-colors">
                <Wallet className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">Auto Payments</h3>
              <p className="text-slate-400 text-sm">Transparent pricing and instant payment settlement after job verification</p>
            </div>

            {/* Card 4 */}
            <div className="group rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-900/80 p-8 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-5 group-hover:bg-blue-600/40 transition-colors">
                <MapPin className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">Real-Time Tracking</h3>
              <p className="text-slate-400 text-sm">GPS-enabled job tracking and live status updates for complete transparency</p>
            </div>

            {/* Card 5 */}
            <div className="group rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-900/80 p-8 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-5 group-hover:bg-blue-600/40 transition-colors">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">Secure & Verified</h3>
              <p className="text-slate-400 text-sm">Industry-grade security with photo verification and quality assurance checks</p>
            </div>

            {/* Card 6 */}
            <div className="group rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-900/80 p-8 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-5 group-hover:bg-blue-600/40 transition-colors">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">City Analytics</h3>
              <p className="text-slate-400 text-sm">Comprehensive dashboard for municipal infrastructure health monitoring</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-black py-16 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6">Ready to Fix Roads?</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">Join thousands of contractors and municipalities in revolutionizing infrastructure maintenance</p>
          <div className="flex gap-4 justify-center items-center flex-wrap">
            <button 
              onClick={() => setShowReportForm(true)} 
              className="neon-button px-8 py-3 text-white font-bold rounded-lg transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              <Camera className="h-5 w-5" />
              Report a Pothole
            </button>
            <Link href="/contractor" className="inline-block">
              <Button className="bg-white text-black hover:bg-slate-100 px-8 py-3 h-auto font-bold rounded-lg transition-all duration-300 hover:scale-105">
                Join as Contractor
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-black py-12 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto text-center">
            <div className="group cursor-default">
              <div className="text-2xl md:text-3xl font-black text-blue-400 mb-1 group-hover:scale-110 transition-transform origin-center">₹24L+</div>
              <div className="text-xs text-slate-400">Paid to Contractors</div>
            </div>
            <div className="group cursor-default">
              <div className="text-2xl md:text-3xl font-black text-blue-400 mb-1 group-hover:scale-110 transition-transform origin-center">48hrs</div>
              <div className="text-xs text-slate-400">Avg Response Time</div>
            </div>
            <div className="group cursor-default">
              <div className="text-2xl md:text-3xl font-black text-blue-400 mb-1 group-hover:scale-110 transition-transform origin-center">15+ Cities</div>
              <div className="text-xs text-slate-400">Operating Regions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 bg-black">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-slate-800">
            <div className="text-left md:text-center">
              <div className="flex items-center gap-2 mb-3 md:justify-center">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Wrench className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-black text-white">RoadFix</span>
              </div>
              <p className="text-sm text-slate-400">Smart infrastructure for modern cities</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400 font-medium">Powered by AI • Secured by GPS • Trusted by thousands</p>
            </div>
            <div className="text-right md:text-center">
              <p className="text-sm font-semibold text-white mb-2">Quick Links</p>
              <div className="flex justify-end md:justify-center gap-4 text-xs text-slate-400">
                <button className="hover:text-blue-400 transition-colors">About</button>
                <button className="hover:text-blue-400 transition-colors">Contact</button>
                <button className="hover:text-blue-400 transition-colors">Privacy</button>
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">© 2026 RoadFix. All rights reserved. Built for sustainable cities.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
