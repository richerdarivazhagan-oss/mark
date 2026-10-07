import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { notificationVisibleToUser } from '../../services/circularTargeting';
import { EditProfileModal } from '../profile/EditProfileModal';
import { ProfileDropdown } from './ProfileDropdown';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  ChevronDown,
  ArrowRight,
  Calendar
} from 'lucide-react';

import { Avatar } from './Avatar';

export const Navbar: React.FC = () => {
  const {
    currentUser,
    logout,
    isDarkMode,
    toggleDarkMode,
    notifications,
    markNotificationRead,
    clearAllNotifications,
    setActiveScreen,
    language,
    setLanguage,
    t
  } = useApp();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const notifTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);

  useClickOutside(
    [notifRef, notifTriggerRef],
    () => setNotificationsOpen(false),
    notificationsOpen
  );

  const myNotifications = useMemo(
    () => notifications.filter((n) => notificationVisibleToUser(n, currentUser)),
    [notifications, currentUser]
  );

  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const currentDate = new Date().toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <>
      <header className="sticky top-0 z-30 h-16 shrink-0 bg-white dark:bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between transition-colors">
        {/* Left branding + Welcome */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => setActiveScreen('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 flex items-center justify-center font-extrabold group-hover:scale-105 transition-transform">
              <img src="/assets/tn-emblem.png" alt="Emblem" className="w-full h-full object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100 leading-tight uppercase">markup</h1>
            </div>
          </div>
          <div className="hidden md:flex items-center ml-3 pl-3 border-l border-[#E2E8F0] dark:border-zinc-700">
            <span className="text-xs font-semibold text-[#000000] dark:text-[#64748B] dark:text-zinc-400">
              {t('common.welcome', 'Welcome')}, <span className="text-[#0F172A] dark:text-zinc-100 font-bold">{currentUser.name}</span>
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Current Date */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F9FC] dark:bg-zinc-800/50 rounded-xl border border-[#E2E8F0] dark:border-zinc-700">
            <Calendar className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#3B82F6]" />
            <span className="text-[11px] font-semibold text-[#000000] dark:text-[#64748B] dark:text-zinc-400">{currentDate}</span>
          </div>

          {/* Active Role Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#EAF2FF] dark:bg-[#FFFFFF] text-[#2563EB] dark:text-[#3B82F6] rounded-xl border border-[#E2E8F0] dark:border-zinc-700 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#2563EB] animate-pulse" />
            <span>{t(`role.${currentUser.role}`, currentUser.role)} {t('common.portal', 'Portal')}</span>
          </div>

          {/* Global Language Switcher: ABC | அ */}
          <div
            id="navbar-language-switcher"
            className="flex items-center bg-[#F1F5F9] dark:bg-zinc-800/80 p-0.5 rounded-xl border border-[#E2E8F0] dark:border-zinc-700 text-xs font-bold select-none"
            aria-label="Language selector"
          >
            <button
              id="lang-switch-en"
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-[#2563EB] text-white shadow-sm ring-1 ring-[#2563EB]/40'
                  : 'text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-zinc-200'
              }`}
              title="English (ABC)"
              aria-pressed={language === 'en'}
            >
              ABC
            </button>
            <span className="px-0.5 text-[#CBD5E1] dark:text-zinc-600 font-light pointer-events-none">|</span>
            <button
              id="lang-switch-ta"
              type="button"
              onClick={() => setLanguage('ta')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                language === 'ta'
                  ? 'bg-[#2563EB] text-white shadow-sm ring-1 ring-[#2563EB]/40'
                  : 'text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-zinc-200'
              }`}
              title="தமிழ் (அ)"
              aria-pressed={language === 'ta'}
            >
              அ
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 text-[#000000] dark:text-[#64748B] hover:text-[#0F172A] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F7F9FC] dark:hover:bg-zinc-800 rounded-xl transition-colors"
            title="Toggle Dark/Light mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#2563EB]" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              ref={notifTriggerRef}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-[#000000] dark:text-[#64748B] hover:text-[#0F172A] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F7F9FC] dark:hover:bg-zinc-800 rounded-xl transition-colors relative focus:outline-none"
              aria-expanded={notificationsOpen}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
              )}
            </button>

            {notificationsOpen && (
              <div
                ref={notifRef}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0] dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="p-3.5 border-b border-[#E2E8F0] dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-zinc-100">{t('notifications.title', 'Notifications')}</h4>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#EAF2FF] dark:bg-[#FFFFFF] text-[#2563EB] dark:text-[#3B82F6] rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearAllNotifications}
                    className="text-[10px] font-semibold text-[#2563EB] dark:text-[#3B82F6] hover:underline"
                  >
                    {t('notifications.markAllRead', 'Mark all read')}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {myNotifications.length === 0 ? (
                    <p className="p-4 text-xs text-center text-[#000000] dark:text-[#64748B]">{t('notifications.noNotifications', 'No notifications')}</p>
                  ) : (
                    myNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          if (notif.link) {
                            setNotificationsOpen(false);
                            setActiveScreen(notif.link);
                          }
                        }}
                        className={`p-3 text-xs cursor-pointer hover:bg-[#F7F9FC] dark:hover:bg-zinc-800/50 transition-colors ${
                          !notif.read ? 'bg-[#EAF2FF]/60 dark:bg-[#FFFFFF]/60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-[#0F172A] dark:text-zinc-100">{notif.title}</span>
                          <span className="text-[10px] text-[#000000] dark:text-[#64748B] shrink-0">{notif.timestamp}</span>
                        </div>
                        <p className="text-[#000000] dark:text-[#64748B] dark:text-zinc-400 mt-1 text-[11px] leading-relaxed">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-[#E2E8F0] dark:border-zinc-800 text-center">
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      setActiveScreen('notifications');
                    }}
                    className="text-xs font-semibold text-[#2563EB] dark:text-[#3B82F6] hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <span>{t('notifications.viewHub', 'View Notification Hub')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile avatar dropdown */}
          <div className="relative">
            <button
              ref={profileTriggerRef}
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 hover:bg-[#F7F9FC] dark:hover:bg-zinc-800 rounded-xl transition-colors focus:outline-none"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <Avatar
                name={currentUser.name}
                src={currentUser.avatar}
                size="md"
              />
              <ChevronDown className={`w-3.5 h-3.5 text-[#64748B] dark:text-zinc-400 hidden sm:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            <ProfileDropdown
              user={currentUser}
              isOpen={profileOpen}
              onClose={() => setProfileOpen(false)}
              triggerRef={profileTriggerRef}
              onEditProfile={() => setEditProfileOpen(true)}
            />
          </div>
        </div>
      </header>

      {/* Edit Profile Modal mounted outside header flow */}
      <EditProfileModal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
    </>
  );
};
