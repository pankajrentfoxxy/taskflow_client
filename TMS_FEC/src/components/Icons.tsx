// Feather-style stroke icon set — crisp, professional, no emoji.
import type { SVGProps } from 'react';

const S = (props: SVGProps<SVGSVGElement>) => ({
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24', ...props,
});

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
export const IconTasks = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>);
export const IconPen = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>);
export const IconFolder = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>);
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 13.5"/></svg>);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
export const IconFlag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><polyline points="9 18 15 12 9 6"/></svg>);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
export const IconZap = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);
export const IconCheckCircle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>);
export const IconInbox = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>);
export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>);
export const IconActivity = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
export const IconScale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 3 12a3 3 0 0 0 6 0L7 7"/><path d="M17 7l-2 5a3 3 0 0 0 6 0l-2-5"/></svg>);
export const IconMute = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>);
