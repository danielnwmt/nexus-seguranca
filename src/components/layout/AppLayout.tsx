import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import ChatWidget from '@/components/chat/ChatWidget';
import { useAuth } from '@/contexts/AuthContext';

const AppLayout = () => {
  const { userRole } = useAuth();
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        <Outlet />
      </main>
      {userRole !== 'owner' && <ChatWidget />}
    </div>
  );
};

export default AppLayout;
