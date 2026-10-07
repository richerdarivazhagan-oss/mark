import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types';
import { Modal } from '../common/Modal';
import { BackButton } from '../common/BackButton';
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';

export const AcademicCalendar: React.FC = () => {
  const {
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    selectedCalendarMonth,
    setSelectedCalendarMonth,
    language,
    t
  } = useApp();

  // Month navigation state - Initialize from selectedCalendarMonth or default 2026-09
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (selectedCalendarMonth) {
      const parts = selectedCalendarMonth.split('-');
      if (parts.length === 2) {
        const m = parseInt(parts[1], 10) - 1;
        if (m >= 0 && m <= 11) return m;
      }
    }
    return 8; // September (0-indexed 8)
  });
  const [viewYear, setViewYear] = useState<number>(() => {
    if (selectedCalendarMonth) {
      const parts = selectedCalendarMonth.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        if (y >= 2020 && y <= 2035) return y;
      }
    }
    return 2026;
  });

  useEffect(() => {
    const ym = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    if (ym !== selectedCalendarMonth) {
      setSelectedCalendarMonth(ym);
    }
  }, [viewMonth, viewYear, selectedCalendarMonth, setSelectedCalendarMonth]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CalendarEvent, 'id'>>({
    date: '2026-09-01',
    type: 'holiday',
    title: '',
    description: ''
  });

  const monthNames = language === 'ta'
    ? [
        'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
        'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
      ]
    : [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

  const weekdays = language === 'ta'
    ? ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build date string YYYY-MM-DD for a given day of the viewed month
  const dateStrFor = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const daysInMonth = Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => {
    const day = i + 1;
    const dateStr = dateStrFor(day);
    const events = calendarEvents.filter((e) => {
      if (!e.date) return false;
      const norm = e.date.trim().substring(0, 10);
      return norm === dateStr;
    });
    return { day, dateStr, events };
  });

  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setFormData((f) => ({ ...f, date: dateStrFor(1) }));
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setFormData((f) => ({ ...f, date: dateStrFor(1) }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    if (editingEventId) {
      updateCalendarEvent({ id: editingEventId, ...formData });
    } else {
      addCalendarEvent(formData);
    }
    setModalOpen(false);
    setEditingEventId(null);
  };

  const openAddModal = () => {
    setEditingEventId(null);
    setFormData({
      date: dateStrFor(1),
      type: 'holiday',
      title: '',
      description: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setFormData({
      date: event.date,
      type: event.type,
      title: event.title,
      description: event.description || ''
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0] dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-zinc-100 tracking-tight">
            {t('calendar.title', 'Academic Calendar & Holiday Planner')}
          </h2>

        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-[#FFFFFF] dark:bg-[#2563EB] dark:text-[#FFFFFF] dark:hover:bg-white text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('common.add', 'Add')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0] dark:border-[#232326] rounded-xl text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500" /> {t('calendar.holidayNonWorking', 'Holiday / Non-working')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" /> {t('calendar.examPeriod', 'Examination Period')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" /> {t('calendar.workingDay', 'Working Day')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#2563EB] dark:bg-[#2563EB]" /> {t('calendar.institutionalEvent', 'Institutional Event')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-500" /> {t('calendar.dayOrderStaff', 'Day Order (from Staff Schedule)')}
        </span>
      </div>

      {/* Month Grid */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-[#232326] rounded-2xl p-4 shadow-sm">
        {/* Month navigation header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goPrevMonth}
            className="p-2 text-[#000000] dark:text-[#64748B] hover:text-[#2563EB] dark:hover:text-[#3B82F6] hover:bg-[#F7F9FC] dark:hover:bg-zinc-800 rounded-xl transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100">
            {monthNames[viewMonth]} {viewYear}
          </h3>
          <button
            onClick={goNextMonth}
            className="p-2 text-[#000000] dark:text-[#64748B] hover:text-[#2563EB] dark:hover:text-[#3B82F6] hover:bg-[#F7F9FC] dark:hover:bg-zinc-800 rounded-xl transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-7 gap-2 min-w-[560px]">
            {weekdays.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase text-[#000000] dark:text-[#64748B] p-2">
                {d}
              </div>
            ))}

            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`blank-${idx}`} className="min-h-20 p-2" />
            ))}

            {daysInMonth.map(({ day, dateStr, events }) => (
              <div
                key={day}
                className="min-h-20 p-2 bg-[#F7F9FC] dark:bg-[#0A0A0A]/60 border border-[#E2E8F0]/60 dark:border-zinc-800 rounded-xl flex flex-col justify-between"
              >
              <span className="text-xs font-bold text-[#1E293B] dark:text-zinc-300">{day}</span>
              <div className="space-y-1">
                {events.map((e) => {
                  const romanMatch = e.title.match(/Day Order\s+(I|II|III|IV|V|VI|\d)/i);
                  const dayOrderVal = e.dayOrder != null
                    ? (['', 'I', 'II', 'III', 'IV', 'V', 'VI'][e.dayOrder] || e.dayOrder)
                    : (romanMatch ? romanMatch[1] : null);

                  let badgeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300';
                  if (e.type === 'exam') badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300';
                  if (e.type === 'working') badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300';
                  if (e.type === 'event') badgeColor = 'bg-[#2563EB]/20 text-[#2563EB] dark:bg-[#2563EB]/50 dark:text-[#3B82F6]';

                  return (
                    <div
                      key={e.id}
                      className={`p-1 rounded text-[9px] font-bold flex items-center justify-between ${badgeColor}`}
                      title={`${e.title}${e.description ? ` — ${e.description}` : ''}${dayOrderVal ? ` (Day Order ${dayOrderVal})` : ''}`}
                    >
                      <span className="truncate">
                        {dayOrderVal != null ? (
                          <span className="flex items-center gap-1">
                            <span className="px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px]">
                              {language === 'ta' ? `நாள் வரிசை ${dayOrderVal}` : `DO ${dayOrderVal}`}
                            </span>
                            <span className="truncate">{e.title}</span>
                          </span>
                        ) : (
                          e.title
                        )}
                      </span>
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => openEditModal(e)}
                          className="opacity-60 hover:opacity-100 ml-1"
                          title={t('common.edit', 'Edit event')}
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => deleteCalendarEvent(e.id)}
                          className="opacity-60 hover:opacity-100 ml-1"
                          title={t('common.delete', 'Delete event')}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEventId(null); }}
        title={editingEventId ? t('calendar.editTitle', 'Edit Academic Calendar Event') : t('calendar.addTitle', 'Tag Academic Calendar Date')}
        subtitle={editingEventId ? t('calendar.editSubtitle', 'Update the existing calendar event details') : t('calendar.addSubtitle', 'Mark holidays, exams, or custom working days')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300 mb-1">{t('calendar.date', 'Date')}</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-2 text-xs bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300 mb-1">{t('calendar.tagClassification', 'Tag Classification')}</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full p-2 text-xs bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl"
            >
              <option value="holiday">{t('calendar.holidayOption', 'National / Festival Holiday')}</option>
              <option value="exam">{t('calendar.examOption', 'Examination Period')}</option>
              <option value="working">{t('calendar.workingOption', 'Special Working Day')}</option>
              <option value="event">{t('calendar.eventOption', 'Campus Event / Symposium')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300 mb-1">{t('calendar.eventTitle', 'Title')}</label>
            <input
              type="text"
              required
              placeholder={language === 'ta' ? 'சுதந்திர தினம் / பருவத் தேர்வுகள்' : 'Independence Day / Midterm Exams'}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 text-xs bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300 mb-1">{t('calendar.eventDescription', 'Description (Optional)')}</label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('calendar.descPlaceholder', 'Short note about this date')}
              className="w-full p-2 text-xs bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#2563EB] hover:bg-[#FFFFFF] dark:bg-[#2563EB] dark:text-[#FFFFFF] dark:hover:bg-white text-white text-xs font-bold rounded-xl transition-colors"
          >
            {editingEventId ? t('common.saveChanges', 'Save Changes') : t('calendar.saveEvent', 'Save Calendar Event')}
          </button>
        </form>
      </Modal>
    </div>
  );
};
