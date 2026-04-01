'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, MapPin, Ruler, IndianRupee, Loader2, Search, Download, TrendingUp, CheckCircle2, Camera, X } from 'lucide-react'
import Link from 'next/link'

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
  location_name?: string
}

export default function PotholeReportsPage() {
  const [reports, setReports] = useState<PotholeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedReport, setSelectedReport] = useState<PotholeReport | null>(null)
  const [sortBy, setSortBy] = useState<string>('latest')

  useEffect(() => {
    fetchAllReports()
  }, [])

  const fetchAllReports = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      
      const response = await fetch(`${backendUrl}/api/reports/all`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch reports (${response.status})`)
      }
      
      const data = await response.json()
      setReports(data.reports || [])
    } catch (err) {
      console.error('[v0] Error fetching reports:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-destructive/20 text-destructive'
      case 'MEDIUM':
        return 'bg-yellow-200/30 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      case 'LOW':
        return 'bg-chart-5/20 text-chart-5'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-chart-5/20 text-chart-5'
      case 'IN_PROGRESS':
        return 'bg-blue-200/30 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      case 'OPEN':
        return 'bg-orange-200/30 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const filteredAndSortedReports = reports
    .filter(report => {
      const matchesSearch = searchTerm === '' || 
        report.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.location_name?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSeverity = severityFilter === 'ALL' || report.severity === severityFilter
      const matchesStatus = statusFilter === 'ALL' || report.status === statusFilter
      return matchesSearch && matchesSeverity && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'largest') return b.size_cm - a.size_cm
      if (sortBy === 'bounty') return b.bounty - a.bounty
      return 0
    })

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-accent/5">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link href="/">
                <Button variant="ghost" size="sm" className="mb-2">
                  ← Back
                </Button>
              </Link>
              <h1 className="text-4xl font-bold">Pothole Reports</h1>
              <p className="text-muted-foreground mt-1">Viewing {filteredAndSortedReports.length} pothole{filteredAndSortedReports.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/">
              <Button className="shadow-lg">Report a Pothole</Button>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severity</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest First</SelectItem>
                <SelectItem value="largest">Largest First</SelectItem>
                <SelectItem value="bounty">Highest Bounty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <Card className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">Loading pothole reports...</p>
          </Card>
        ) : error ? (
          <Card className="p-8 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-destructive">Error Loading Reports</h3>
                <p className="text-destructive/80 mt-1">{error}</p>
                <Button onClick={fetchAllReports} className="mt-4">
                  Retry
                </Button>
              </div>
            </div>
          </Card>
        ) : filteredAndSortedReports.length === 0 ? (
          <Card className="p-16 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your filters or be the first to report a pothole</p>
            <Link href="/">
              <Button>Report a Pothole</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reports Grid */}
            <div className="lg:col-span-2 space-y-4">
              {filteredAndSortedReports.map((report) => (
                <Card 
                  key={report.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="md:flex">
                    {/* Image Section */}
                    <div className="w-full md:w-48 h-48 bg-gradient-to-br from-secondary/20 to-accent/10 overflow-hidden flex-shrink-0">
                      {report.image_path ? (
                        <img 
                          src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${report.image_path}`}
                          alt="Pothole"
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Camera className="h-8 w-8 opacity-20" />
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <h3 className="font-mono text-xs font-semibold text-muted-foreground mb-2">
                              {report.id.substring(0, 16)}...
                            </h3>
                            <p className="text-sm text-foreground flex items-center gap-1 font-medium">
                              <MapPin className="h-4 w-4 text-primary" />
                              {report.location_name || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getSeverityColor(report.severity)}>
                              {report.severity}
                            </Badge>
                            <Badge className={getStatusColor(report.status)}>
                              {report.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 bg-secondary/30 rounded-lg p-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground font-semibold mb-0.5">SIZE</p>
                          <p className="font-bold text-lg text-primary">{report.size_cm.toFixed(1)}cm</p>
                        </div>
                        <div className="text-center border-l border-r border-border">
                          <p className="text-xs text-muted-foreground font-semibold mb-0.5">BOUNTY</p>
                          <p className="font-bold text-lg text-chart-5">₹{report.bounty}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground font-semibold mb-0.5">COUNT</p>
                          <p className="font-bold text-lg">{report.pothole_count}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        <span className="font-semibold">Confidence: {(report.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Details Panel */}
            <div className="lg:col-span-1">
              {selectedReport ? (
                <div className="sticky top-24 h-fit space-y-4">
                  {/* Close Button */}
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">Details</h3>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedReport(null)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Large Image */}
                  {selectedReport.image_path && (
                    <Card className="overflow-hidden border-2 border-primary/30">
                      <div className="aspect-square bg-secondary/30">
                        <img 
                          src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${selectedReport.image_path}`}
                          alt="Pothole"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = ''
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    </Card>
                  )}

                  {/* Size Card */}
                  <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/30 dark:from-blue-950/40 dark:to-blue-900/20 border-2 border-blue-200/50 dark:border-blue-900/50">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 uppercase">Pothole Size</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-blue-900 dark:text-blue-200">{selectedReport.size_cm.toFixed(1)}</span>
                      <span className="text-xl font-bold text-blue-700 dark:text-blue-300">cm</span>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      {selectedReport.size_cm < 10 ? 'Small pothole' : selectedReport.size_cm < 30 ? 'Medium pothole' : 'Large pothole'}
                    </p>
                  </Card>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="p-3 text-center">
                      <p className="text-xs font-bold text-muted-foreground mb-1">SEVERITY</p>
                      <Badge className={getSeverityColor(selectedReport.severity)} variant="outline">
                        {selectedReport.severity}
                      </Badge>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-xs font-bold text-muted-foreground mb-1">STATUS</p>
                      <Badge className={getStatusColor(selectedReport.status)}>
                        {selectedReport.status}
                      </Badge>
                    </Card>
                  </div>

                  {/* Bounty */}
                  <Card className="p-4 bg-gradient-to-br from-chart-5/10 to-chart-5/5 border-chart-5/30">
                    <p className="text-xs font-bold text-chart-5 mb-2 uppercase">Repair Bounty</p>
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-6 w-6 text-chart-5" />
                      <span className="text-3xl font-bold text-chart-5">{selectedReport.bounty}</span>
                    </div>
                  </Card>

                  {/* Confidence */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Confidence</p>
                      <span className="text-sm font-bold text-primary">{(selectedReport.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${selectedReport.confidence * 100}%` }}
                      />
                    </div>
                  </Card>

                  {/* Location Info */}
                  <Card className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-1">LOCATION</p>
                      <p className="text-sm font-mono text-foreground">
                        {selectedReport.latitude.toFixed(6)}, {selectedReport.longitude.toFixed(6)}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-bold text-muted-foreground mb-1">REPORTED</p>
                      <p className="text-sm text-foreground">
                        {new Date(selectedReport.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Card>

                  <Button className="w-full bg-transparent" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </Button>
                </div>
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>Click on a report to view details</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
