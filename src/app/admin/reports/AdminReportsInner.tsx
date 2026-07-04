'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface Report {
  id: string;
  reason: string;
  details: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  created_at: string;
  reporter: { username: string; display_name: string } | null;
  reported_user: { username: string; display_name: string } | null;
  post: { id: string; content: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  reviewed: { bg: 'rgba(42,171,238,0.15)', color: 'var(--primary)' },
  dismissed: { bg: 'rgba(124,143,163,0.15)', color: 'var(--muted-foreground)' },
  actioned: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
};

export default function AdminReportsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/sign-up-login-screen');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_profiles').select('is_admin').eq('id', user.id).single().then(({ data }) => {
      if (!data?.is_admin) { setCheckingAdmin(false); return; }
      setIsAdmin(true);
      setCheckingAdmin(false);
    });
  }, [user]);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    let query = supabase
      .from('content_reports')
      .select(`
        id, reason, details, status, created_at,
        reporter:reporter_id(username, display_name),
        reported_user:reported_user_id(username, display_name),
        post:post_id(id, content)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data } = await query;
    setReports((data ?? []) as Report[]);
    setLoadingReports(false);
  }, [statusFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    loadReports();
  }, [isAdmin, loadReports]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function updateReportStatus(reportId: string, newStatus: Report['status']) {
    setActionLoading(true);
    try {
      await supabase.from('content_reports').update({ status: newStatus }).eq('id', reportId);
      await supabase.from('admin_actions').insert({
        admin_id: user!.id,
        action_type: `report_${newStatus}`,
        target_type: 'report',
        target_id: reportId,
        reason: `Status changed to ${newStatus}`,
      });
      showToast(`Report marked as ${newStatus}`);
      setSelectedReport(null);
      loadReports();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update report');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)' }}>
        <div className="text-5xl">🔒</div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Admin access required.</p>
        <button onClick={() => router.push('/social-feed')} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Go to Feed</button>
      </div>
    );
  }

  return (
    <AdminLayout title="Reported Content" activeSection="reports">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff' }}>
          {toast}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'pending', 'reviewed', 'dismissed', 'actioned'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all"
            style={{
              background: statusFilter === s ? 'var(--primary)' : 'var(--muted)',
              color: statusFilter === s ? '#fff' : 'var(--muted-foreground)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loadingReports ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No {statusFilter !== 'all' ? statusFilter : ''} reports found.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {reports.map((report) => {
              const sc = STATUS_COLORS[report.status] ?? STATUS_COLORS.pending;
              return (
                <div
                  key={report.id}
                  className="px-4 py-3 cursor-pointer hover:opacity-80 transition-all"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize" style={{ background: sc.bg, color: sc.color }}>
                          {report.status}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{report.reason}</span>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{new Date(report.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span>Reporter: @{report.reporter?.username ?? 'unknown'}</span>
                        {report.reported_user && <span>Against: @{report.reported_user.username}</span>}
                        {report.post && <span>Post: "{report.post.content?.slice(0, 30)}…"</span>}
                      </div>
                      {report.details && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>{report.details}</p>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--primary)' }}>Review →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>🚨 Report Details</h3>
                <button onClick={() => setSelectedReport(null)} className="text-lg" style={{ color: 'var(--muted-foreground)' }}>✕</button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>REASON</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{selectedReport.reason}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>STATUS</p>
                  <p className="text-sm font-medium capitalize" style={{ color: STATUS_COLORS[selectedReport.status]?.color }}>{selectedReport.status}</p>
                </div>
              </div>
              {selectedReport.details && (
                <div className="p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>DETAILS</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selectedReport.details}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>REPORTER</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>@{selectedReport.reporter?.username ?? 'unknown'}</p>
                </div>
                {selectedReport.reported_user && (
                  <div className="p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>REPORTED USER</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>@{selectedReport.reported_user.username}</p>
                  </div>
                )}
              </div>
              {selectedReport.post && (
                <div className="p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>REPORTED POST</p>
                  <p className="text-sm line-clamp-3" style={{ color: 'var(--foreground)' }}>{selectedReport.post.content}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'reviewed')}
                  disabled={actionLoading || selectedReport.status === 'reviewed'}
                  className="py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(42,171,238,0.15)', color: 'var(--primary)', opacity: selectedReport.status === 'reviewed' ? 0.5 : 1 }}
                >
                  Mark Reviewed
                </button>
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'dismissed')}
                  disabled={actionLoading || selectedReport.status === 'dismissed'}
                  className="py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', opacity: selectedReport.status === 'dismissed' ? 0.5 : 1 }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'actioned')}
                  disabled={actionLoading || selectedReport.status === 'actioned'}
                  className="py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', opacity: selectedReport.status === 'actioned' ? 0.5 : 1 }}
                >
                  Action Taken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
