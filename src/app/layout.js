import './globals.css';

export const metadata = {
  title: 'FlowBoard | Project Management',
  description: 'Manage projects like never before. Kanban boards, team collaboration, and analytics in one powerful platform.',
};

import { ToastProvider } from '@/contexts/ToastContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
