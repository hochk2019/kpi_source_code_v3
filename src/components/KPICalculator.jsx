import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import DataImporter from './DataImporter.jsx';
import RulesEditor from './RulesEditor.jsx';
import MSTAssignment from './MSTAssignment.jsx';
import TeamManager from './TeamManager.jsx';
import ReportViewer from './ReportViewer.jsx';

const KPICalculator = ({ role = "admin" }) => {
  const isAdmin = role === 'admin';
  const tabListClass = isAdmin ? 'grid grid-cols-5 gap-2' : 'grid grid-cols-2 gap-2';

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Hệ thống tính KPI Hải quan</h1>
        <p className="text-gray-500">Công cụ tính điểm KPI cho nhân viên làm thủ tục hải quan</p>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className={tabListClass}>
          <TabsTrigger value="import">Import Excel</TabsTrigger>
          {isAdmin && (<TabsTrigger value="rules">Quy tắc KPI</TabsTrigger>)}
          {isAdmin && (<TabsTrigger value="mst">Gán MST</TabsTrigger>)}
          {isAdmin && (<TabsTrigger value="teams">Quản lý Thành viên &amp; Tổ đội</TabsTrigger>)}
          <TabsTrigger value="reports">Báo cáo/In</TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <DataImporter />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rules">
            <RulesEditor />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="mst">
            <MSTAssignment />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="teams">
            <TeamManager />
          </TabsContent>
        )}

        <TabsContent value="reports">
          <ReportViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KPICalculator;
