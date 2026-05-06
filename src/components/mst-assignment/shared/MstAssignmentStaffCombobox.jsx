import SharedStaffCombobox from "@/components/shared/StaffCombobox.tsx";

export default function MstAssignmentStaffCombobox(props) {
  return (
    <SharedStaffCombobox
      {...props}
      allowCustom
      preserveTeamOnCustom
      preserveTeamOnClear
    />
  );
}
