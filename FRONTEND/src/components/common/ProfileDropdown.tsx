import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User as UserType } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from './Avatar';
import {
  User,
  LogOut,
  Bell,
  Sun,
  Moon,
  Shield,
  X,
  Building2,
  GraduationCap,
  Award,
  IdCard
} from 'lucide-react';

interface ProfileDropdownProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onEditProfile?: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  user,
  isOpen,
  onClose,
  triggerRef,
  onEditProfile,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { logout, isDarkMode, toggleDarkMode, setActiveScreen, t } = useApp();

  // Escape key listener to close popup
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const roleLabel = t(`role.${user.role}`, user.role);

  const modalContent = (
    /* Full-screen Semi-Transparent Backdrop Overlay (Centered Flex Layout) */
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9998] flex items-center justify-center p-4 sm:p-6 transition-all duration-200 animate-in fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Centered Medium-Sized Profile Card (Approx ~25% viewport area, max-w-lg) */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside popup from closing
        className="w-full max-w-md sm:max-w-lg bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0] dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col z-[9999]"
      >
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-zinc-800/80 bg-[#F7F9FC]/60 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#EAF2FF] dark:bg-zinc-800 text-[#2563EB] dark:text-[#3B82F6] rounded-xl">
              <User className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100 tracking-tight">
                {t('common.userProfile', 'User Account & Profile')}
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-zinc-400">
                {user.role.toUpperCase()} Portal Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            title="Close Profile Popup (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* User Header Profile Card */}
          <div className="p-5 bg-gradient-to-br from-[#F7F9FC] to-[#EAF2FF]/40 dark:from-zinc-900/60 dark:to-zinc-900/20 border border-[#E2E8F0] dark:border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-xs">
            <div className="relative shrink-0">
              <Avatar name={user.name} src={user.avatar} size="lg" />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h4 className="text-base font-extrabold text-[#0F172A] dark:text-zinc-100 truncate">
                  {user.name}
                </h4>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#EAF2FF] text-[#2563EB] dark:bg-zinc-800 dark:text-[#3B82F6] rounded-md border border-[#2563EB]/20">
                  <Shield className="w-3 h-3" />
                  {roleLabel}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-zinc-400 truncate font-medium">
                {user.email || `${user.id}@college.edu`}
              </p>
            </div>
          </div>

          {/* Role Metadata Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {user.departmentName && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Department
                </span>
                <p className="font-bold text-[#0F172A] dark:text-zinc-200 truncate">{user.departmentName}</p>
              </div>
            )}

            {(user.regNo || user.employeeId || user.id) && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <IdCard className="w-3 h-3" /> Identifier / ID
                </span>
                <p className="font-bold text-[#0F172A] dark:text-zinc-200 truncate font-mono">
                  {user.regNo || user.employeeId || user.id}
                </p>
              </div>
            )}

            {user.role === 'student' && user.programme && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> Programme & Year
                </span>
                <p className="font-bold text-[#0F172A] dark:text-zinc-200 truncate">
                  {user.programme} · Year {user.year || 1}
                </p>
              </div>
            )}

            {user.role === 'faculty' && (user as any).is_class_adviser && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl space-y-0.5 col-span-2">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Award className="w-3 h-3" /> Class Advisor Designation
                </span>
                <p className="font-bold text-amber-900 dark:text-amber-200 truncate">
                  Assigned Class Advisor: {(user as any).advising_section || 'Section A'}
                </p>
              </div>
            )}
          </div>

          {/* Action Links - Exclusively Notifications and Light Mode */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {/* 1. Notifications */}
            <button
              type="button"
              onClick={() => {
                onClose();
                setActiveScreen('notifications');
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#0F172A] dark:text-zinc-200 hover:bg-[#F7F9FC] dark:hover:bg-zinc-800/70 rounded-xl transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              <div className="flex items-center gap-3">
                <span className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-[#2563EB] dark:text-[#3B82F6] rounded-lg">
                  <Bell className="w-4 h-4" />
                </span>
                <span>{t('notifications.title', 'Notifications')}</span>
              </div>
            </button>

            {/* 2. Light Mode / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#0F172A] dark:text-zinc-200 hover:bg-[#F7F9FC] dark:hover:bg-zinc-800/70 rounded-xl transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              <div className="flex items-center gap-3">
                <span className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-amber-950/40 text-amber-400' : 'bg-blue-50 text-[#2563EB]'}`}>
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </span>
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-500 font-bold">
                {isDarkMode ? 'DARK' : 'LIGHT'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer with Logout */}
        <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/50 border-t border-[#E2E8F0] dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/80 dark:border-rose-900/40 rounded-xl transition-all shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('common.signOut', 'Sign Out of Account')}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

