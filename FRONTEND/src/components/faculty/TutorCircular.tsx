import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../lib/apiClient';
import { Modal } from '../common/Modal';
import { BackButton } from '../common/BackButton';
import {
  Search,
  Eye,
  Send,
  Calendar,
  Users,
  FileText,
  Lock,
  Paperclip,
  Trash2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Building2,
  Clock
} from 'lucide-react';

interface AdvisingClassInfo {
  is_class_adviser: boolean;
  department_id?: string;
  department_code?: string;
  department_name?: string;
  year?: number;
  section?: string;
  programme?: string;
  shift?: string;
  class_label?: string;
  student_count?: number;
  message?: string;
}

export const TutorCircular: React.FC = () => {
  const { currentUser, circulars: contextCirculars, addToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [advisingClass, setAdvisingClass] = useState<AdvisingClassInfo | null>(null);
  const [circularList, setCircularList] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [selectedCircular, setSelectedCircular] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    title: '',
    content: '',
    attachmentUrl: '',
    attachmentName: '',
    dateTime: new Date().toISOString().slice(0, 16)
  });

  // Fetch Advisor status and assigned class info
  const loadAdvisorData = useCallback(async () => {
    // Only set full loading spinner if circularList is currently empty
    setCircularList((prev) => {
      if (prev.length === 0 && Array.isArray(contextCirculars) && contextCirculars.length > 0) {
        return contextCirculars;
      }
      return prev;
    });

    try {
      const [classRes, circRes] = await Promise.all([
        apiClient.myAdvisingClass().catch(() => null),
        apiClient.circulars().catch(() => [])
      ]);

      if (classRes && typeof classRes.is_class_adviser === 'boolean') {
        setAdvisingClass(classRes);
      } else {
        // Fallback check from currentUser profile
        const isAdv = !!(currentUser as any).is_class_adviser || !!(currentUser as any).isClassAdviser;
        setAdvisingClass({
          is_class_adviser: isAdv,
          department_name: currentUser.departmentName || 'Department',
          department_code: currentUser.departmentId || 'DEPT',
          department_id: currentUser.departmentId,
          year: (currentUser as any).advising_year || 1,
          section: (currentUser as any).advising_section || 'A',
          class_label: (currentUser as any).advising_class_label || 'Assigned Class',
          student_count: 0
        });
      }

      let fetchedCirculars = Array.isArray(circRes) ? circRes : [];
      if (fetchedCirculars.length === 0 && Array.isArray(contextCirculars) && contextCirculars.length > 0) {
        fetchedCirculars = contextCirculars;
      }
      setCircularList(fetchedCirculars);
    } catch (err: any) {
      console.error('Failed to load circular data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadAdvisorData();
  }, [loadAdvisorData]);

  // Sync contextCirculars into local list without triggering loading spinner
  useEffect(() => {
    if (Array.isArray(contextCirculars) && contextCirculars.length > 0) {
      setCircularList((prev) => (prev.length === 0 ? contextCirculars : prev));
    }
  }, [contextCirculars]);

  const isClassAdvisor = !!advisingClass?.is_class_adviser;

  // Filter circulars visible to this faculty member
  // 1. Subject Faculty: View circulars sent to faculty by HOD/Management/Admin
  // 2. Class Advisor: View circulars sent to faculty by HOD/Management/Admin + circulars created by themselves for their class
  const visibleCirculars = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    return circularList.filter((c) => {
      const isAuthor =
        c.author_id === currentUser.id ||
        c.author_name === currentUser.name ||
        c.createdBy === currentUser.name ||
        c.createdByName === currentUser.name ||
        c.createdBy === currentUser.id;

      if (isAuthor) return true;

      // Non-author faculty members can ONLY view Published circulars
      const statusStr = String(c.status || '').toLowerCase();
      if (statusStr !== 'published') return false;

      // Check validity period
      const validUntil = c.validUntil || c.valid_until;
      if (validUntil && String(validUntil).substring(0, 10) < todayStr) {
        return false;
      }

      const targetVal = c.target || c.target_role;
      if (targetVal === 'individual_faculty') {
        const rawIds = c.selectedFacultyIds || c.selected_faculty_ids || [];
        const facIds = typeof rawIds === 'string' ? JSON.parse(rawIds) : rawIds;
        if (Array.isArray(facIds)) {
          const userIdentifiers = [
            String(currentUser.id),
            String(currentUser.name),
            String((currentUser as any).employeeId || ''),
            String((currentUser as any).username || '')
          ].filter(Boolean);
          const isTargeted = facIds.some((id: string) => userIdentifiers.includes(String(id)));
          if (!isTargeted) return false;
        }
      }

      const isFacultyTarget =
        c.target_role === 'faculty' ||
        c.target === 'all_faculty' ||
        c.target === 'individual_faculty' ||
        c.target_role === null ||
        c.target_role === undefined;

      const isManagementSender =
        c.createdByRole === 'hod' ||
        c.createdByRole === 'admin' ||
        (c.author && (c.author.role === 'hod' || c.author.role === 'admin'));

      const isStudentTargetOnly =
        c.target === 'all_students' ||
        c.target === 'tutor_class' ||
        c.target_role === 'student';

      if (isStudentTargetOnly && !isAuthor) {
        return false;
      }

      return isFacultyTarget || isManagementSender;
    });
  }, [circularList, currentUser]);

  const filteredCirculars = useMemo(() => {
    if (!searchQuery.trim()) return visibleCirculars;
    const q = searchQuery.toLowerCase();
    return visibleCirculars.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.content || c.description || '').toLowerCase().includes(q)
    );
  }, [visibleCirculars, searchQuery]);

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      attachmentUrl: '',
      attachmentName: '',
      dateTime: new Date().toISOString().slice(0, 16)
    });
  };

  const handleSendCircular = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isClassAdvisor) {
      addToast('Access Denied', 'Only designated Class Advisors can create and send circulars', 'danger');
      return;
    }

    if (!form.title.trim()) {
      addToast('Validation Error', 'Please enter a circular title', 'warning');
      return;
    }
    if (!form.content.trim()) {
      addToast('Validation Error', 'Please enter the circular content / message', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // Payload locked to assigned class
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        content: form.content.trim(),
        attachment_url: form.attachmentUrl.trim() || undefined,
        attachment_name: form.attachmentName.trim() || (form.attachmentUrl.trim() ? 'Attachment' : undefined),
        department_id: advisingClass?.department_id,
        target_year: advisingClass?.year,
        target_section: advisingClass?.section
      };

      await apiClient.sendClassAdvisorCircular(payload);

      addToast('Circular Sent', `Circular successfully sent to ${advisingClass?.class_label || 'your assigned class'}`, 'success');

      await loadAdvisorData();
      resetForm();
      setView('list');
    } catch (err: any) {
      const msg = err?.message || 'Failed to send circular';
      addToast('Security Error', msg, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete circular "${title}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await apiClient.deleteCircular(id);
      addToast('Deleted', 'Circular removed successfully', 'info');
      setCircularList((prev) => prev.filter((c) => c.id !== id));
      if (selectedCircular?.id === id) {
        setShowPreview(false);
      }
    } catch (err: any) {
      addToast('Error', err?.message || 'Failed to delete circular', 'danger');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-xs font-semibold text-zinc-500">Loading circulars...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E2E8F0] dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-600 dark:text-amber-400" /> Circular
            </h2>
            {isClassAdvisor ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                <Lock className="w-3 h-3" /> Class Advisor: {advisingClass?.class_label || 'Assigned Class'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                <ShieldCheck className="w-3 h-3" /> Subject Faculty (View Only)
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isClassAdvisor
              ? `View management circulars and publish circulars to ${advisingClass?.class_label || 'your assigned class'}.`
              : 'View official circulars and notices published to faculty by HOD and management.'}
          </p>
        </div>

        {isClassAdvisor && (
          <div className="flex items-center gap-2 shrink-0">
            {view === 'list' ? (
              <button
                onClick={() => {
                  resetForm();
                  setView('create');
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create New Circular
              </button>
            ) : (
              <button
                onClick={() => setView('list')}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                View Circulars
              </button>
            )}
          </div>
        )}
      </div>

      {/* CREATE CIRCULAR VIEW (Class Advisor Only) */}
      {view === 'create' && isClassAdvisor && (
        <form
          onSubmit={handleSendCircular}
          className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100">Create New Circular</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This circular will be sent strictly to students of your assigned class: <span className="font-bold text-amber-600">{advisingClass?.class_label}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('list')}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>

          {/* Locked Recipient Banner */}
          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200">Recipient Target: </span>
                <span className="text-amber-800 dark:text-amber-300 font-semibold">{advisingClass?.class_label} Students ONLY</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/60 dark:bg-amber-800/40 text-amber-900 dark:text-amber-200">
              Auto-Restricted
            </span>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Circular Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Internal Assessment-II Timetable & Instructions"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Circular Message / Content <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                placeholder="Type the announcement or notice for your class here..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-normal text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all leading-relaxed"
              />
            </div>

            {/* Date & Time + Locked Class Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Date & Time
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-zinc-400 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={form.dateTime}
                    onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Target Recipient Class
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 select-none">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{advisingClass?.class_label}</span>
                </div>
              </div>
            </div>

            {/* Optional Attachment */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Optional Attachment Document Link
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Attachment Document Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., IA2_Portions.pdf"
                    value={form.attachmentName}
                    onChange={(e) => setForm({ ...form, attachmentName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Attachment URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://... or /uploads/..."
                    value={form.attachmentUrl}
                    onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setView('list')}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Sending to {advisingClass?.class_label}...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send Circular to Class
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* CIRCULARS LIST VIEW */}
      {view === 'list' && (
        <div className="space-y-4">
          {/* Search Bar & Refresh */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search circulars..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0] dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              onClick={() => loadAdvisorData()}
              className="px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" /> Refresh
            </button>
          </div>

          {/* List Cards */}
          {filteredCirculars.length === 0 ? (
            <div className="p-12 bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-zinc-800 rounded-2xl text-center space-y-3 shadow-xs">
              <FileText className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No circulars found</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                  {isClassAdvisor
                    ? 'No circulars available. Click "Create New Circular" to publish an announcement for your class.'
                    : 'Official circulars from HOD and management will appear here when published.'}
                </p>
              </div>
              {isClassAdvisor && (
                <button
                  onClick={() => {
                    resetForm();
                    setView('create');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Create New Circular
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCirculars.map((circ) => {
                const isAuthor =
                  circ.author_id === currentUser.id ||
                  circ.author_name === currentUser.name ||
                  circ.createdBy === currentUser.name ||
                  circ.createdByName === currentUser.name;

                const pubDate = circ.published_at || circ.publishedAt || circ.created_at || circ.createdAt;
                const formattedDate = pubDate
                  ? new Date(pubDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Recently';

                const authorDisplay = circ.author_name || circ.createdBy || circ.signer_name || 'Management';

                return (
                  <div
                    key={circ.id}
                    className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs hover:border-amber-200 dark:hover:border-amber-900/50 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`p-2 rounded-xl shrink-0 ${
                            isAuthor
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          }`}>
                            <FileText className="w-4 h-4" />
                          </span>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                            {circ.title}
                          </h3>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isAuthor
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {isAuthor ? 'Sent by You' : 'From HOD / Admin'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3 leading-relaxed">
                        {circ.content || circ.description}
                      </p>

                      {(circ.attachment_url || circ.attachmentUrl) && (
                        <div className="pt-1">
                          <a
                            href={circ.attachment_url || circ.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-amber-700 dark:text-amber-400 rounded-lg hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {circ.attachment_name || circ.attachmentName || 'View Attachment'}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                          <Building2 className="w-3 h-3 text-zinc-400" />
                          {authorDisplay}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedCircular(circ);
                            setShowPreview(true);
                          }}
                          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isAuthor && (
                          <button
                            onClick={() => handleDelete(circ.id, circ.title)}
                            disabled={deletingId === circ.id}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                            title="Delete Circular"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL PREVIEW MODAL */}
      {showPreview && selectedCircular && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Circular Details"
          subtitle={selectedCircular.title}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedCircular.title}</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {selectedCircular.status || 'published'}
                </span>
              </div>

              <div className="p-3.5 bg-white dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {selectedCircular.content || selectedCircular.description}
                </p>
              </div>

              {(selectedCircular.attachment_url || selectedCircular.attachmentUrl) && (
                <div className="pt-1">
                  <a
                    href={selectedCircular.attachment_url || selectedCircular.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 rounded-xl font-bold hover:underline"
                  >
                    <Paperclip className="w-4 h-4" />
                    {selectedCircular.attachment_name || selectedCircular.attachmentName || 'Download Attachment'}
                  </a>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Sender</span>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {selectedCircular.author_name || selectedCircular.createdBy || selectedCircular.signer_name || 'HOD / Management'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Target Audience</span>
                  <p className="font-bold text-amber-700 dark:text-amber-400">
                    {selectedCircular.target_role === 'student' || selectedCircular.target === 'tutor_class'
                      ? advisingClass?.class_label || 'Assigned Class Students'
                      : 'Faculty Members'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Recipients</span>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {selectedCircular.recipient_count || selectedCircular.recipientCount || advisingClass?.student_count || 'All Faculty'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
