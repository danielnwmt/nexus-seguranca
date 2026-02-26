import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import ChatWidget from '@/components/chat/ChatWidget';

const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  );
};

export default AppLayout;
