'use client'

import { useState } from 'react'
import { X, Bell, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface JobNotificationProps {
  jobId: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  size: number
  bounty: number
  location: string
  potholeCount: number
  onAccept: (jobId: string) => void
  onReject: (jobId: string) => void
  onDismiss: () => void
}

export default function JobNotification({
  jobId,
  severity,
  size,
  bounty,
  location,
  potholeCount,
  onAccept,
  onReject,
  onDismiss
}: JobNotificationProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const severityColor = {
    LOW: 'bg-blue-50 border-blue-200 text-blue-900',
    MEDIUM: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    HIGH: 'bg-red-50 border-red-200 text-red-900'
  }

  const severityBadgeColor = {
    LOW: 'bg-blue-100 text-blue-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-red-100 text-red-800'
  }

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      await onAccept(jobId)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await onReject(jobId)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className={`fixed top-4 right-4 w-full max-w-md rounded-lg border-2 ${severityColor[severity]} shadow-xl z-50 animate-in slide-in-from-top-5`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-full">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg">New Job Available!</h3>
              <p className="text-sm opacity-75">{potholeCount} pothole{potholeCount > 1 ? 's' : ''} detected</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Job Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-white rounded-lg">
          <div>
            <p className="text-xs opacity-60 mb-1">Severity</p>
            <div className={`inline-block px-2 py-1 rounded font-semibold text-xs ${severityBadgeColor[severity]}`}>
              {severity}
            </div>
          </div>
          <div>
            <p className="text-xs opacity-60 mb-1">Average Size</p>
            <p className="font-bold">{size.toFixed(1)} cm</p>
          </div>
          <div>
            <p className="text-xs opacity-60 mb-1">Bounty</p>
            <p className="font-bold text-green-600">₹{bounty.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs opacity-60 mb-1">Location</p>
            <p className="font-semibold text-xs truncate">{location}</p>
          </div>
        </div>

        {/* Action Buttons - Properly Aligned */}
        <div className="flex gap-3 w-full">
          <Button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            Accept Job
          </Button>
          <Button
            onClick={handleReject}
            disabled={isProcessing}
            variant="outline"
            className="flex-1 border-2 border-red-300 text-red-600 hover:bg-red-50 font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all bg-transparent"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>

        {isProcessing && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Processing...
          </div>
        )}
      </div>
    </div>
  )
}
