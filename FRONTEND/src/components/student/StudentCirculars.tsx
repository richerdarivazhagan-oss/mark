import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { circularVisibleToStudent, circularRecipientLabel } from '../../services/circularTargeting';
import { FileText, Calendar, Users, Building2, GraduationCap, Paperclip, Clock, ShieldCheck } from 'lucide-react';
import { BackButton } from '../common/BackButton';

export const StudentCirculars: React.FC = () => {
  const { circulars, currentUser, facultyList } = useApp();

  const visibleCirculars = useMemo(() => {
    return circulars.filter((c) => {
      // Backend GET /circulars already strictly isolates student circulars by class.
      // If client-side helper is available, verify it; otherwise fallback to backend-filtered result.
      try {
        return circularVisibleToStudent(c, currentUser);
      } catch {
        return true;
      }
    });
  }, [circulars, currentUser]);

  const getIssuerLabel = (circ: any): string => {
    if (circ.targetClass || circ.target_section || circ.target === 'tutor_class') {
      return 'Class Advisor';
    }
    const name = circ.author_name || circ.createdBy || '';
    const fac = facultyList.find((f) => f.name === name);
    if (fac?.isHOD) return 'HOD';
    if (/^dr/i.test(name)) return 'HOD';
    return 'Faculty';
  };

  return (
    <div className="space-y-6">
      <BackButton label="Back to Dashboard" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2563EB] dark:text-[#3B82F6]" /> Class & Department Circulars
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Circulars and announcements officially published for your class
          </p>
        </div>

        {currentUser.section && (
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/30 dark:text-[#3B82F6] border border-[#2563EB]/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Class: {currentUser.departmentName || 'Dept'} · Year {currentUser.year || ''} Sec {currentUser.section}
          </span>
        )}
      </div>

      {visibleCirculars.length === 0 ? (
        <div className="p-12 bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-zinc-800 rounded-2xl text-center space-y-3 shadow-xs">
          <FileText className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-[#0F172A] dark:text-zinc-200">No circulars published for your class yet.</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            When your Class Advisor or department publishes an announcement, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleCirculars.map((c: any) => {
            const issuerRole = getIssuerLabel(c);
            const author = c.author_name || c.createdBy || c.createdByName || 'Class Advisor';
            const content = c.content || c.description;
            const attachment = c.attachmentUrl || c.attachment_url;
            const attachmentLabel = c.attachmentName || c.attachment_name || 'Download Attachment';
            const pubDate = c.publishedAt || c.published_at || c.createdAt || c.created_at;
            const formattedDate = pubDate
              ? new Date(pubDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : c.validFrom || 'Recent';

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-[#232326] rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-[#2563EB]/40 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-[#2563EB]/10 dark:bg-[#2563EB]/30 rounded-xl shrink-0 text-[#2563EB] dark:text-[#3B82F6]">
                        <FileText className="w-4 h-4" />
                      </span>
                      <h3 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100 leading-snug">
                        {c.title}
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/40 dark:text-[#3B82F6] border border-[#2563EB]/20">
                      {issuerRole}
                    </span>
                  </div>

                  <p className="text-xs text-[#1E293B] dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {content}
                  </p>

                  {attachment && (
                    <div className="pt-1">
                      <a
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2563EB]/5 hover:bg-[#2563EB]/10 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-[#2563EB]/20 dark:border-zinc-700 rounded-xl text-xs font-bold text-[#2563EB] dark:text-[#3B82F6] transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>{attachmentLabel}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-[#E2E8F0] dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                  <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-bold">
                    <GraduationCap className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#3B82F6]" />
                    Sent by: {author}
                  </span>

                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#3B82F6]" />
                    {circularRecipientLabel(c)}
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#3B82F6]" />
                    {formattedDate}
                  </span>

                  {c.departmentName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#3B82F6]" />
                      {c.departmentName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};