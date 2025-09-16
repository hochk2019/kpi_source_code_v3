import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import DataImporter from './DataImporter.jsx';
import RulesEditor from './RulesEditor.jsx';
import MSTAssignment from './MSTAssignment.jsx';
import ReportViewer from './ReportViewer.jsx';

const KPICalculator = ({ role = "admin" }) => {
  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Hệ thống tính KPI Hải quan</h1>
        <p className="text-gray-500">Công cụ tính điểm KPI cho nhân viên làm thủ tục hải quan</p>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className="grid grid-cols-4 gap-2">
          <TabsTrigger value="import">Import Excel</TabsTrigger>
          {role === 'admin' && (<TabsTrigger value="rules">Quy tắc KPI</TabsTrigger>)}
          {role === 'admin' && (<TabsTrigger value="mst">Gán MST</TabsTrigger>)}
          <TabsTrigger value="reports">Báo cáo/In</TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <DataImporter />
        </TabsContent>

        {role === 'admin' && (
          <TabsContent value="rules">
            <RulesEditor />
          </TabsContent>
        )}

        {role === 'admin' && (
          <TabsContent value="mst">
            <MSTAssignment />
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
