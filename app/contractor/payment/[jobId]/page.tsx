'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, QrCode, IndianRupee, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Job {
  id: string
  bounty: number
  status: string
  completed_at: string
  latitude: number
  longitude: number
  severity: string
  pothole_count: number
}

export default function ContractorPaymentPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending')

  useEffect(() => {
    fetchJobDetails()
  }, [jobId])

  const fetchJobDetails = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/contractor/job/${jobId}`
      )
      const data = await response.json()
      setJob(data)
      
      // Generate Razorpay QR code
      if (data.status === 'COMPLETED') {
        generateQRCode(data.bounty, jobId)
      } else if (data.status === 'PAID') {
        setPaymentStatus('paid')
      }
    } catch (error) {
      console.error('Error fetching job:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async (amount: number, jobId: string) => {
    try {
      console.log('[v0] Generating QR code for jobId:', jobId, 'amount:', amount)
      
      // Call backend to generate Razorpay QR code
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/payment/generate-qr`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amount * 100, // Convert to paise
            job_id: jobId,
            description: `Payment for pothole repair job ${jobId}`
          })
        }
      )
      
      const data = await response.json()
      console.log('[v0] QR response:', data)
      
      if (data.qr_code_url) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const fullUrl = data.qr_code_url.startsWith('http') 
          ? data.qr_code_url 
          : `${backendUrl}${data.qr_code_url}`
        
        console.log('[v0] Setting QR URL to:', fullUrl)
        setQrCodeUrl(fullUrl)
      }
    } catch (error) {
      console.error('[v0] Error generating QR code:', error)
    }
  }

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/payment/status/${jobId}`
      )
      const data = await response.json()
      if (data.status === 'PAID') {
        setPaymentStatus('paid')
        // Refresh job details
        fetchJobDetails()
      }
    } catch (error) {
      console.error('Error checking payment:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <p className="text-lg mb-4">Job not found</p>
          <Link href="/contractor/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (paymentStatus === 'paid') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-lg w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Payment Received!</h1>
            <p className="text-muted-foreground">Your payment has been successfully processed</p>
          </div>

          <div className="bg-muted rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground">Amount Paid</span>
              <div className="flex items-center gap-1 text-2xl font-bold text-green-600">
                <IndianRupee className="h-6 w-6" />
                {job.bounty}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Job ID</span>
              <span className="font-mono">{jobId.slice(0, 12)}...</span>
            </div>
          </div>

          <Link href="/contractor/dashboard">
            <Button className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/5">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6">
          <Link href="/contractor/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">Receive Payment</h1>
          <p className="text-muted-foreground text-lg">Your repair work is verified. Scan the QR code to get paid.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Amount Card - Featured */}
          <Card className="p-8 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-xl">
            <p className="text-sm font-semibold opacity-90 mb-2">TOTAL EARNINGS</p>
            <div className="flex items-center gap-3">
              <IndianRupee className="h-10 w-10" />
              <span className="text-6xl font-black">{job.bounty}</span>
            </div>
            <p className="text-sm opacity-80 mt-4">Ready to receive via UPI payment</p>
          </Card>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Details - Left */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Job Summary</h3>
                <div className="space-y-4">
                  <div className="border-b pb-3">
                    <p className="text-xs font-bold text-muted-foreground mb-1">JOB ID</p>
                    <p className="font-mono text-sm font-semibold text-foreground break-all">{jobId.slice(0, 20)}...</p>
                  </div>
                  
                  <div className="border-b pb-3">
                    <p className="text-xs font-bold text-muted-foreground mb-1">POTHOLES FIXED</p>
                    <p className="text-2xl font-bold text-foreground">{job.pothole_count}</p>
                  </div>

                  <div className="border-b pb-3">
                    <p className="text-xs font-bold text-muted-foreground mb-2">SEVERITY LEVEL</p>
                    <Badge className="bg-primary/20 text-primary">{job.severity}</Badge>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-1">COORDINATES</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {job.latitude !== null && job.latitude !== undefined && job.longitude !== null && job.longitude !== undefined 
                        ? `${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)}`
                        : 'Location unavailable'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* QR Code - Center/Right */}
            <div className="lg:col-span-2">
              <Card className="p-8 border-2 border-primary/30">
                <div className="text-center">
                  <div className="mb-8">
                    <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-full mb-6">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-semibold">Ready for Payment</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-3">Scan to Receive</h2>
                    <p className="text-muted-foreground text-lg">Use any UPI app to scan and complete payment</p>
                  </div>

                  {/* QR Code Display */}
                  <div className="bg-white dark:bg-slate-900 border-4 border-primary/20 rounded-2xl p-6 inline-block mb-8 shadow-lg">
                    {qrCodeUrl ? (
                      <img 
                        src={qrCodeUrl || "/placeholder.svg"} 
                        alt="Payment QR Code" 
                        className="w-72 h-72"
                      />
                    ) : (
                      <div className="w-72 h-72 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <QrCode className="h-20 w-20 mx-auto mb-4 text-blue-600 dark:text-blue-400 opacity-50" />
                          <p className="text-sm text-muted-foreground font-medium">Generating QR Code...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* UPI Apps */}
                  <div className="flex gap-3 justify-center mb-8">
                    <Card className="p-4 flex-1">
                      <p className="text-2xl mb-2">📱</p>
                      <p className="text-xs font-semibold">Google Pay</p>
                    </Card>
                    <Card className="p-4 flex-1">
                      <p className="text-2xl mb-2">💳</p>
                      <p className="text-xs font-semibold">PhonePe</p>
                    </Card>
                    <Card className="p-4 flex-1">
                      <p className="text-2xl mb-2">💰</p>
                      <p className="text-xs font-semibold">Paytm</p>
                    </Card>
                  </div>

                  {/* Instructions */}
                  <Card className="p-6 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 mb-6">
                    <h3 className="font-bold text-blue-900 dark:text-blue-200 text-left mb-3">How to Pay</h3>
                    <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-2 text-left">
                      <li className="flex gap-3">
                        <span className="font-bold flex-shrink-0">1</span>
                        <span>Open Google Pay, PhonePe, Paytm or any UPI app</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-bold flex-shrink-0">2</span>
                        <span>Tap "Scan QR Code" or similar option</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-bold flex-shrink-0">3</span>
                        <span>Point camera at the QR code above</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-bold flex-shrink-0">4</span>
                        <span>Confirm and complete the payment</span>
                      </li>
                    </ol>
                  </Card>

                  {/* Check Status Button */}
                  <Button 
                    onClick={checkPaymentStatus}
                    size="lg"
                    className="w-full"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Check Payment Status
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-sm text-green-900 dark:text-green-200">Instant Payment</p>
                  <p className="text-xs text-green-700 dark:text-green-300">Money arrives in your account instantly</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-sm text-green-900 dark:text-green-200">No Hidden Charges</p>
                  <p className="text-xs text-green-700 dark:text-green-300">You receive the full amount shown above</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
