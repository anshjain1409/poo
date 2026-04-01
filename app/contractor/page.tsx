'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ContractorPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-generate contractor ID if not exists
    let contractorId = sessionStorage.getItem('contractor_id')
    if (!contractorId) {
      contractorId = `CONT_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      sessionStorage.setItem('contractor_id', contractorId)
    }
    // Redirect directly to dashboard
    router.push('/contractor/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-lg text-muted-foreground">Loading Contractor Dashboard...</p>
      </div>
    </div>
  )
}
