'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, MapPin, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Shield, FileText } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

export default function CompleteJob() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  
  const [contractorId, setContractorId] = useState<string | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreeQuality, setAgreeQuality] = useState(false)
  const [agreeWarranty, setAgreeWarranty] = useState(false)

  useEffect(() => {
    const id = sessionStorage.getItem('contractor_id')
    if (!id) {
      router.push('/contractor')
      return
    }
    setContractorId(id)
  }, [router])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const getCurrentLocation = () => {
    setLoadingLocation(true)
    setError(null)
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setLoadingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        setLoadingLocation(false)
      },
      (err) => {
        setError('Unable to get your location. Please enable location services.')
        setLoadingLocation(false)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!image) {
      setError('Please upload an after-repair image')
      return
    }

    if (!location) {
      setError('Please get your current location for verification')
      return
    }

    if (!contractorId) {
      setError('Contractor ID not found')
      return
    }

    // Show agreement dialog instead of submitting directly
    setShowAgreement(true)
  }

  const handleAgreementSubmit = async () => {
    if (!agreedToTerms || !agreeQuality || !agreeWarranty) {
      setError('Please accept all terms and conditions')
      return
    }

    setLoading(true)
    setShowAgreement(false)

    try {
      const formData = new FormData()
      formData.append('image', image!)
      formData.append('latitude', location!.latitude.toString())
      formData.append('longitude', location!.longitude.toString())
      formData.append('contractor_id', contractorId!)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/report/${jobId}/complete`,
        {
          method: 'POST',
          body: formData
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to complete job')
      }

      // Redirect to payment page
      router.push(`/contractor/payment/${jobId}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/contractor/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Complete Repair</h1>
            <p className="text-sm text-muted-foreground">Submit verification</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Job Verification</h2>
            <p className="text-muted-foreground leading-relaxed">
              {'To complete this job, you must be at the repair location and upload a photo showing the repaired area. Our system will verify that no potholes remain.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Current Location</Label>
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  {'You must be within 15 meters of the original pothole location to complete this job.'}
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                onClick={getCurrentLocation}
                disabled={loadingLocation}
                variant={location ? "outline" : "default"}
                className="w-full"
              >
                {loadingLocation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location...
                  </>
                ) : location ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Location Captured
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Get Current Location
                  </>
                )}
              </Button>
              {location && (
                <div className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-md font-mono">
                  Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
                </div>
              )}
            </div>

            {/* Image Upload Section */}
            <div className="space-y-3">
              <Label htmlFor="image-upload" className="text-base font-semibold text-foreground">
                After-Repair Image
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {'Upload a clear photo of the repaired area. The system will automatically verify no potholes remain.'}
              </p>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                {imagePreview ? (
                  <div className="space-y-4">
                    <img 
                      src={imagePreview || "/placeholder.svg"} 
                      alt="Preview" 
                      className="max-h-64 mx-auto rounded-lg shadow-md"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImage(null)
                        setImagePreview(null)
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <span className="text-primary font-semibold hover:underline">Click to upload</span>
                      <span className="text-muted-foreground"> or drag and drop</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG up to 10MB</p>
                  </>
                )}
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={loading || !image || !location}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Submit Completion'
              )}
            </Button>
          </form>
        </Card>

        {/* Info Box */}
        <div className="mt-8 bg-muted/50 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-3">Verification Requirements</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{'Be physically present at the repair location (within 15m radius)'}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{'Upload a clear photo showing the repaired area'}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{'AI system must confirm no potholes remain in the image'}</span>
            </li>
          </ul>
        </div>
      </main>

      {/* Quality Assurance Agreement Dialog */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-primary/10 to-primary/5 -m-6 mb-6 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <div className="text-left">
                <DialogTitle className="text-2xl">Quality Assurance Agreement</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Accept terms before submitting your repair completion
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pr-4">
            {/* Warranty Card */}
            <Card className="p-6 border-2 border-blue-200/50 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex gap-4">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-blue-900 dark:text-blue-200 mb-2">3-Year Quality Warranty</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed mb-3">
                    By completing this job, you guarantee that the pothole repair work meets the following standards:
                  </p>
                  <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>High-quality asphalt/concrete material used for repair</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Proper compaction and leveling of the repair area</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Seamless blend with existing road surface</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Professional workmanship standards applied</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Fine Terms Card */}
            <Card className="p-6 border-2 border-amber-200/50 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex gap-4">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-amber-900 dark:text-amber-200 mb-2">Warranty Duration & Penalties</h3>
                  <div className="space-y-3 text-sm text-amber-800 dark:text-amber-300">
                    <div>
                      <p className="font-semibold mb-1">Valid Period: 3 Years from Completion Date</p>
                      <p>This warranty covers any pothole damage that recurs in the same repaired area.</p>
                    </div>
                    <div className="bg-amber-100/50 dark:bg-amber-900/30 p-3 rounded-lg">
                      <p className="font-semibold mb-1">If Repair Fails Within 3 Years:</p>
                      <p>You agree to refund the bounty amount (₹{/* Amount will be filled from backend */}) plus 50% penalty fee as compensation to the Municipal Corporation for re-repair work.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Acceptance Checkboxes */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex items-start gap-3 cursor-pointer hover:bg-secondary/50 p-3 rounded-lg transition-colors" onClick={() => setAgreeQuality(!agreeQuality)}>
                <Checkbox 
                  id="quality"
                  checked={agreeQuality}
                  onCheckedChange={setAgreeQuality}
                  className="mt-1"
                />
                <label htmlFor="quality" className="flex-1 cursor-pointer">
                  <p className="font-semibold text-foreground">I guarantee the quality of repair work</p>
                  <p className="text-xs text-muted-foreground">The materials used meet standard road repair specifications</p>
                </label>
              </div>

              <div className="flex items-start gap-3 cursor-pointer hover:bg-secondary/50 p-3 rounded-lg transition-colors" onClick={() => setAgreeWarranty(!agreeWarranty)}>
                <Checkbox 
                  id="warranty"
                  checked={agreeWarranty}
                  onCheckedChange={setAgreeWarranty}
                  className="mt-1"
                />
                <label htmlFor="warranty" className="flex-1 cursor-pointer">
                  <p className="font-semibold text-foreground">I accept the 3-year warranty terms</p>
                  <p className="text-xs text-muted-foreground">I will pay penalties if the repair fails within 3 years</p>
                </label>
              </div>

              <div className="flex items-start gap-3 cursor-pointer hover:bg-secondary/50 p-3 rounded-lg transition-colors" onClick={() => setAgreedToTerms(!agreedToTerms)}>
                <Checkbox 
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={setAgreedToTerms}
                  className="mt-1"
                />
                <label htmlFor="terms" className="flex-1 cursor-pointer">
                  <p className="font-semibold text-foreground">I agree to all terms and conditions</p>
                  <p className="text-xs text-muted-foreground">I have read and understood all warranty terms</p>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-border pt-6">
              <Button
                variant="outline"
                onClick={() => setShowAgreement(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAgreementSubmit}
                disabled={!agreedToTerms || !agreeQuality || !agreeWarranty || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Accept & Complete Job'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
